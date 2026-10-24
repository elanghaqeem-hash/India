const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {Harness,expect,users}=require('./helpers/sales-flow-harness.cjs');
const seed=()=>new Harness().seed();
async function get(d,id,role='sales'){
 return d.load('src/app/api/sales/vault/route.ts').GET(new Request('https://flow.invalid/api/sales/vault?id='+id,{headers:{'x-test-role':role}}));
}
async function scope(d){await expect(d.flow('scope','presales'),201);}
test('upload encrypts original bytes; authenticated download is exact and audited',async()=>{const d=seed();try{
 await scope(d);const plain=Buffer.from('%PDF-1.7\nConfidential synthetic original document');
 const x=await expect(d.upload('proposal','sales',plain),201);
 const stored=d.sql.prepare('SELECT * FROM india_document_vault').get();assert.equal(stored.sha256,require('node:crypto').createHash('sha256').update(plain).digest('hex'));
 const cipher=d.sql.prepare('SELECT ciphertext FROM india_document_chunks').get().ciphertext;assert.ok(!Buffer.from(cipher,'base64').includes(plain));
 const r=await get(d,x.body.id);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),plain);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('content-disposition'),/^attachment;/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.equal(d.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE action='DOCUMENT_DOWNLOADED'").get().n,1);
}finally{d.close();}});
test('Sales B, Viewer and unauthenticated requests cannot upload or download Sales A originals',async()=>{const d=seed();try{
 await scope(d);const x=await expect(d.upload('proposal'),201);
 for(const [role,status] of [['other',403],['viewer',403],['none',401]]){assert.equal((await get(d,x.body.id,role)).status,status);await expect(d.upload('proposal',role),status);}
 for(const role of ['finance','approver','legal','presales','admin'])assert.equal((await get(d,x.body.id,role)).status,200);
}finally{d.close();}});
test('presales can upload proposals; Finance, Legal and Approver cannot become evidence makers',async()=>{const d=seed();try{
 await scope(d);await expect(d.upload('proposal','presales'),201);
 for(const role of ['finance','legal','approver'])await expect(d.upload('proposal',role),403);
 await expect(d.upload('po','presales'),403);
}finally{d.close();}});
test('empty, oversized, disguised files and unsafe names leave no stored original',async()=>{const d=seed();try{
 await scope(d);await expect(d.upload('proposal','sales',Buffer.alloc(0)),422);
 await expect(d.upload('proposal','sales',Buffer.from('<html>untrusted</html>')),415);
 await expect(d.upload('proposal','sales',Buffer.from('%PDF-1.7'),{filename:'../secret.pdf'}),422);
 await expect(d.upload('proposal','sales',Buffer.alloc(8*1024*1024+1)),413);
 assert.equal(d.sql.prepare('SELECT count(*) n FROM india_document_vault').get().n,0);
}finally{d.close();}});
test('DOCX upload checks archive structure and rejects renamed ZIPs',async()=>{const d=seed();try{
 await scope(d);const JSZip=require('jszip'),z=new JSZip();z.file('[Content_Types].xml','<Types/>');z.file('word/document.xml','<document/>');
 await expect(d.upload('proposal','sales',await z.generateAsync({type:'nodebuffer'}),{filename:'proposal.docx'}),201);
 const bad=new JSZip();bad.file('unrelated.txt','not a document');await expect(d.upload('proposal','sales',await bad.generateAsync({type:'nodebuffer'}),{filename:'proposal.docx'}),415);
}finally{d.close();}});
test('multi-chunk and maximum 8 MiB originals round-trip with exact bytes',async()=>{const d=seed();try{
 await scope(d);const bytes=Buffer.alloc(8*1024*1024,91);bytes.write('%PDF-1.7\n');
 const x=await expect(d.upload('proposal','sales',bytes),201);assert.equal(d.sql.prepare('SELECT chunk_count FROM india_document_vault').get().chunk_count,33);
 assert.deepEqual(Buffer.from(await(await get(d,x.body.id)).arrayBuffer()),bytes);
}finally{d.close();}});
test('missing encryption key fails closed before any document writes',async()=>{const d=seed();try{
 await scope(d);d.documentKey='';await expect(d.upload('proposal'),503);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_document_vault').get().n,0);
}finally{d.close();}});
test('late upload audit failure rolls back manifest and every encrypted chunk',async()=>{const d=seed();try{
 await scope(d);d.sql.exec("CREATE TRIGGER fail_document_audit BEFORE INSERT ON india_sales_audit WHEN NEW.action='DOCUMENT_UPLOADED' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 await expect(d.upload('proposal','sales',Buffer.from('%PDF-1.7\n'+'A'.repeat(600000))),503);
 for(const table of ['india_document_vault','india_document_chunks','india_sales_tx_guards'])assert.equal(d.sql.prepare('SELECT count(*) n FROM '+table).get().n,0);
}finally{d.close();}});
test('original manifests and encrypted bytes are immutable',async()=>{const d=seed();try{
 await scope(d);await expect(d.upload('proposal'),201);
 for(const t of ['india_document_vault','india_document_chunks'])for(const op of ['DELETE FROM '+t,'UPDATE '+t+' SET '+(t.endsWith('chunks')?"ciphertext='AAAA'":"file_name='changed.pdf'")])assert.throws(()=>d.sql.exec(op),/immutable/);
 assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
}finally{d.close();}});
test('ciphertext corruption or key change yields no plaintext; evidence cannot be approved',async()=>{for(const mode of ['cipher','key']){const d=seed();try{
 await scope(d);const x=await expect(d.upload('proposal'),201);
 if(mode==='key')d.documentKey=Buffer.alloc(32,8).toString('base64');else{d.sql.exec('DROP TRIGGER india_document_chunks_update');d.sql.exec("UPDATE india_document_chunks SET ciphertext='AAAA'");}
 const r=await get(d,x.body.id);assert.equal(r.status,503);assert.equal((await r.json()).success,false);
 await expect(d.flow('propose','sales',{proposal_reference:x.body.reference,proposal_sha256:x.body.sha256}),503);
 assert.equal(d.release().status,'scoped');
}finally{d.close();}}});
test('a failed download audit prevents plaintext response',async()=>{const d=seed();try{
 await scope(d);const x=await expect(d.upload('proposal'),201);d.sql.exec("CREATE TRIGGER fail_download_audit BEFORE INSERT ON india_sales_audit WHEN NEW.action='DOCUMENT_DOWNLOADED' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 assert.equal((await get(d,x.body.id)).status,503);
}finally{d.close();}});
test('invented archive references and incorrect digest cannot propose or bypass the DB gate',async()=>{const d=seed();try{
 await scope(d);await expect(d.flow('propose','sales',{proposal_reference:'archive/not-stored',proposal_sha256:'a'.repeat(64)}),422);
 const x=await expect(d.upload('proposal'),201);await expect(d.flow('propose','sales',{proposal_reference:x.body.reference,proposal_sha256:'a'.repeat(64)}),422);
 assert.throws(()=>d.sql.exec("UPDATE india_sales_releases SET status='proposed',proposed_by='qa',proposal_reference='archive/fake',proposal_sha256='"+'a'.repeat(64)+"',boq_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',boq_version=1,boq_edit_seq=1"),/stored original/);
}finally{d.close();}});
test('stale release uploads cannot commit after a concurrent scope change',async()=>{const d=seed();try{
 await scope(d);d.beforeBatch=()=>d.sql.prepare("UPDATE india_sales_opportunities SET data_json=json_set(data_json,'$.technical_scope','Concurrent scope') WHERE id='opp-qa'").run();
 await expect(d.upload('proposal'),409);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_document_vault').get().n,0);
}finally{d.close();}});
test('revised offers retain downloadable originals but cannot reuse their approval evidence',async()=>{const d=seed();try{
 await scope(d);const proof=await d.proof('proposal');const id=proof.proposal_reference.slice(6);
 await expect(d.flow('propose','sales',proof),200);await expect(d.flow('revise'),200);await scope(d);
 await expect(d.flow('propose','sales',proof),422);assert.equal((await get(d,id,'finance')).status,200);
}finally{d.close();}});
test('metadata listing omits IV and ciphertext, and follows Sales ownership',async()=>{const d=seed();try{
 await scope(d);await expect(d.upload('proposal'),201);const x=await expect(d.call('sales/vault','GET','sales',null,'?opportunity_id=opp-qa'),200);
 assert.equal(x.body.documents.length,1);assert.ok(!('iv' in x.body.documents[0]));assert.ok(!('ciphertext' in x.body.documents[0]));await expect(d.call('sales/vault','GET','other',null,'?opportunity_id=opp-qa'),403);
}finally{d.close();}});
test('cross-origin upload is denied before a file is read or written',async()=>{const d=seed();try{
 await scope(d);const q=new URLSearchParams({opportunity_id:'opp-qa',release_id:d.release().id,kind:'proposal',filename:'proposal.pdf'});
 const r=await d.load('src/app/api/sales/vault/route.ts').POST(new Request('https://flow.invalid/api/sales/vault?'+q,{method:'POST',headers:{'x-test-role':'sales',Origin:'https://untrusted.invalid'},body:'%PDF-1.7'}));assert.equal(r.status,403);
}finally{d.close();}});
test('migration 0015 has full DDL/DML rollback and preserves legacy release history',async()=>{const d=new Harness(true,false).seed();try{
 // An existing scoped legacy release must be preserved and superseded, with a revalidation audit.
 await expect(d.flow('scope','presales'),201);const old=d.release().id;
 const migration=fs.readFileSync(path.join(__dirname,'../migrations/0015_secure_document_vault.sql'),'utf8');
 d.sql.exec('BEGIN');assert.throws(()=>d.sql.exec(migration+"INSERT INTO india_sales_tx_guards(id,ok) VALUES('injected',0);"),/CHECK/);d.sql.exec('ROLLBACK');
 assert.equal(d.release().id,old);assert.equal(d.sql.prepare("SELECT count(*) n FROM sqlite_master WHERE name='india_document_vault'").get().n,0);
 d.sql.exec(migration);assert.equal(d.release(),undefined);assert.equal(d.sql.prepare('SELECT status FROM india_sales_releases WHERE id=?').get(old).status,'superseded');assert.equal(d.deal().stage,'solution_design');
 assert.ok(d.sql.prepare("SELECT * FROM india_sales_audit WHERE action='DOCUMENT_REVALIDATION_REQUIRED'").get());assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
}finally{d.close();}});

test('final Won reauthenticates each accepted original and refuses ciphertext corruption after review',async()=>{
 for(const kind of ['proposal','submission','negotiation','po']){
  const d=seed();try{
   await d.awarded();await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);
   const doc=d.sql.prepare('SELECT id FROM india_document_vault WHERE kind=?').get(kind);
   d.sql.exec('DROP TRIGGER india_document_chunks_update');
   d.sql.prepare("UPDATE india_document_chunks SET ciphertext='AAAA' WHERE document_id=?").run(doc.id);
   const before=d.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE action='STAGE'").get().n;
   await expect(d.stage('closed_won'),503);
   assert.equal(d.deal().stage,'pending_po');
   assert.equal(d.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE action='STAGE'").get().n,before);
  }finally{d.close();}
 }
});
test('current lifecycle refuses runtime with no Vault schema and does not accept legacy metadata',async()=>{
 const d=new Harness(true,false).seed();try{
  await expect(d.flow('scope','presales'),201);
  await expect(d.flow('propose','sales',{proposal_reference:'vault:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',proposal_sha256:'a'.repeat(64)}),503);
  assert.equal(d.release().status,'scoped');
 }finally{d.close();}
});
