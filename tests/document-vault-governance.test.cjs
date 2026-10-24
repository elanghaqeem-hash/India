const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {Harness,expect}=require('./helpers/sales-flow-harness.cjs');
const pdf=(name='nda')=>Buffer.from('%PDF-1.7\nSynthetic original '+name);
async function upload(d,kind,role='sales',bytes=pdf(kind),name=kind+'.pdf'){
 const q=new URLSearchParams({opportunity_id:'opp-qa',kind,filename:name});
 const r=await d.load('src/app/api/sales/document-vault/route.ts').POST(new Request('https://flow.invalid/api/sales/document-vault?'+q,{
  method:'POST',headers:{Origin:'https://flow.invalid','x-test-role':role},body:bytes
 }));
 return {status:r.status,body:await r.json()};
}
async function download(d,id,source='library',role='sales'){
 const q=new URLSearchParams({opportunity_id:'opp-qa',id,source});
 return d.load('src/app/api/sales/document-vault/route.ts').GET(new Request('https://flow.invalid/api/sales/document-vault?'+q,{headers:{'x-test-role':role}}));
}
async function patch(d,role,body){
 return d.call('sales/document-vault','PATCH',role,{opportunity_id:'opp-qa',...body});
}
test('NDA can upload before Presales scope, and revision versions are append-only',async()=>{
 const d=new Harness().seed();try{
  const a=await expect(upload(d,'nda'),201),b=await expect(upload(d,'nda','sales',pdf('nda revision')) ,201);
  assert.equal(a.body.version,1);assert.equal(b.body.version,2);
  assert.equal(d.sql.prepare('SELECT count(*) n FROM india_document_library').get().n,2);
  assert.deepEqual(Buffer.from(await(await download(d,a.body.id)).arrayBuffer()),pdf('nda'));
  assert.deepEqual(Buffer.from(await(await download(d,b.body.id)).arrayBuffer()),pdf('nda revision'));
  const list=await expect(d.call('sales/document-vault','GET','sales',null,'?opportunity_id=opp-qa'),200);
  assert.deepEqual(list.body.documents.map(x=>x.version).sort(),[1,2]);
  assert.equal(d.sql.prepare("SELECT count(*) n FROM india_document_access_events WHERE action='DOWNLOAD'").get().n,2);
  assert.throws(()=>d.sql.exec("UPDATE india_document_library SET sha256='"+'a'.repeat(64)+"'"),/immutable/);
  assert.throws(()=>d.sql.exec('DELETE FROM india_document_library'),/immutable/);
 }finally{d.close();}
});
test('RKS, KAK, quotation originals support independent role restrictions, pre-release encryption',async()=>{
 const d=new Harness().seed();try{
  for(const kind of ['rks','kak','quotation'])await expect(upload(d,kind),201);
  await expect(upload(d,'rks','presales'),201);
  await expect(upload(d,'nda','presales'),403);
  for(const role of ['finance','legal','approver','viewer','other','none']){
   const result=await upload(d,'quotation',role);
   assert.equal(result.status,role==='other'?403:role==='none'?401:403);
  }
  const original=d.sql.prepare('SELECT * FROM india_document_library ORDER BY version').get();
  const chunks=d.sql.prepare('SELECT ciphertext FROM india_document_library_chunks WHERE document_id=?').all(original.id);
  assert.ok(chunks.length>0);assert.ok(!Buffer.from(chunks[0].ciphertext,'base64').includes(pdf('rks')));
  assert.equal((await download(d,original.id,'library','other')).status,403);
  assert.equal((await download(d,original.id,'library','viewer')).status,403);
  assert.equal((await download(d,original.id,'library','legal')).status,200);
 }finally{d.close();}
});
test('governance retention only Admin, hold release only Legal, every change audited',async()=>{
 const d=new Harness().seed();try{
  const x=await expect(upload(d,'nda'),201);
  await expect(patch(d,'sales',{id:x.body.id,source:'library',action:'retention',until:'2036-12-31',reason:'Internal policy approval review'}),403);
  await expect(patch(d,'admin',{id:x.body.id,source:'library',action:'retention',until:'2036-12-31',reason:'Internal policy approval review'}),200);
  await expect(patch(d,'admin',{id:x.body.id,source:'library',action:'retention',until:'2035-12-31',reason:'Try to shorten without review'}),409);
  await expect(patch(d,'legal',{id:x.body.id,source:'library',action:'hold',hold:true,reason:'Regulatory investigation legal hold'}),200);
  await expect(patch(d,'admin',{id:x.body.id,source:'library',action:'hold',hold:false,reason:'Attempt to bypass Legal release'}),403);
  await expect(patch(d,'legal',{id:x.body.id,source:'library',action:'hold',hold:false,reason:'Independent Legal release approval'}),200);
  const row=d.sql.prepare('SELECT retention_until,legal_hold FROM india_document_library WHERE id=?').get(x.body.id);
  assert.equal(row.retention_until,'2036-12-31');assert.equal(row.legal_hold,0);
  assert.equal(d.sql.prepare("SELECT count(*) n FROM india_document_access_events WHERE action LIKE 'LEGAL_HOLD%'").get().n,2);
  assert.throws(()=>d.sql.exec('DELETE FROM india_document_access_events'),/immutable/);
  const logs=await expect(d.call('sales/document-vault','GET','legal',null,'?opportunity_id=opp-qa&audit=1'),200);
  assert.ok(logs.body.events.some(x=>x.action==='RETENTION_SET'));
  await expect(d.call('sales/document-vault','GET','sales',null,'?opportunity_id=opp-qa&audit=1'),403);
 }finally{d.close();}
});
test('original release evidence gets stable versions across offer revisions, with unified download',async()=>{
 const d=new Harness().seed();try{
  await expect(d.flow('scope','presales'),201);
  const a=await expect(d.upload('proposal'),201);
  assert.equal(d.sql.prepare('SELECT version FROM india_document_governance WHERE document_id=?').get(a.body.id).version,1);
  const r=await download(d,a.body.id,'release');
  assert.equal(r.status,200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),Buffer.from('%PDF-1.7\nSynthetic UAT original proposal'));
  const list=await expect(d.call('sales/document-vault','GET','admin',null,'?opportunity_id=opp-qa'),200);
  assert.equal(list.body.documents[0].source,'release');
  await expect(d.flow('propose','sales',{proposal_reference:a.body.reference,proposal_sha256:a.body.sha256}),200);
  await expect(d.flow('revise'),200);await expect(d.flow('scope','presales'),201);
  const b=await expect(d.upload('proposal'),201);
  assert.equal(d.sql.prepare('SELECT version FROM india_document_governance WHERE document_id=?').get(b.body.id).version,2);
 }finally{d.close();}
});
test('missing key, forged input and access audit failure fail closed for library',async()=>{
 const d=new Harness().seed();try{
  await expect(upload(d,'nda','sales',Buffer.from('<html>disguised</html>')),415);
  await expect(upload(d,'nda','sales',pdf(), '../bad.pdf'),422);
  d.documentKey='';await expect(upload(d,'nda'),503);
  assert.equal(d.sql.prepare('SELECT count(*) n FROM india_document_library').get().n,0);
  d.documentKey=undefined;
  const a=await expect(upload(d,'nda'),201);
  d.sql.exec("CREATE TRIGGER fail_library_download BEFORE INSERT ON india_document_access_events WHEN NEW.action='DOWNLOAD' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  const r=await download(d,a.body.id);assert.equal(r.status,503);
  assert.equal(d.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE action='DOCUMENT_DOWNLOADED'").get().n,0);
 }finally{d.close();}
});
test('migration 0021 is additive, backfills numbered originals and rolls back atomically',async()=>{
 const d=new Harness(true,false).seed();try{
  await expect(d.flow('scope','presales'),201);
  d.sql.exec(fs.readFileSync(path.join(__dirname,'../migrations/0015_secure_document_vault.sql'),'utf8'));
  await expect(d.flow('scope','presales'),201);
  const release=d.release();
  d.sql.prepare('INSERT INTO india_document_vault(id,tenant_id,opportunity_id,release_id,kind,file_name,media_type,byte_length,sha256,iv,chunk_count,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac','defendit360','opp-qa',release.id,'proposal','legacy.pdf','application/pdf',10,'a'.repeat(64),'b'.repeat(16),1,'sales@flow.invalid');
  d.sql.prepare('INSERT INTO india_document_chunks(document_id,part,ciphertext) VALUES(?,?,?)').run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac',0,'AAAA');
  const m=fs.readFileSync(path.join(__dirname,'../migrations/0022_document_vault_governance.sql'),'utf8');
  d.sql.exec('BEGIN');assert.throws(()=>d.sql.exec(m+"INSERT INTO india_sales_tx_guards(id,ok) VALUES('bad',0);"),/CHECK/);d.sql.exec('ROLLBACK');
  assert.equal(d.sql.prepare("SELECT count(*) n FROM sqlite_master WHERE name='india_document_governance'").get().n,0);
  d.sql.exec(m);
  assert.equal(d.sql.prepare('SELECT version FROM india_document_governance').get().version,1);
  assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{d.close();}
});

test('retention expiry is enforced across both legacy and new download endpoints',async()=>{
 const d=new Harness().seed();try{
  await expect(d.flow('scope','presales'),201);
  const a=await expect(d.upload('proposal'),201),b=await expect(upload(d,'nda'),201);
  d.sql.prepare('UPDATE india_document_governance SET retention_until=? WHERE document_id=?').run('2020-01-01',a.body.id);
  d.sql.prepare('UPDATE india_document_library SET retention_until=? WHERE id=?').run('2020-01-01',b.body.id);
  const q=new URLSearchParams({id:a.body.id});
  const legacy=await d.load('src/app/api/sales/vault/route.ts').GET(new Request('https://flow.invalid/api/sales/vault?'+q,{headers:{'x-test-role':'sales'}}));
  assert.equal(legacy.status,403);
  assert.equal((await download(d,a.body.id,'release','sales')).status,403);
  assert.equal((await download(d,b.body.id,'library','sales')).status,403);
  assert.equal((await download(d,a.body.id,'release','legal')).status,200);
  assert.equal((await download(d,b.body.id,'library','admin')).status,200);
 }finally{d.close();}
});

test('concurrent retention extension cannot be shortened by a stale governance request',async()=>{
 const d=new Harness().seed();try{
  const x=await expect(upload(d,'nda'),201);
  d.sql.prepare('UPDATE india_document_library SET retention_until=? WHERE id=?').run('2030-01-01',x.body.id);
  d.beforeBatch=()=>d.sql.prepare('UPDATE india_document_library SET retention_until=? WHERE id=?').run('2036-01-01',x.body.id);
  await expect(patch(d,'admin',{id:x.body.id,source:'library',action:'retention',until:'2033-01-01',reason:'Administrative retention review request'}),409);
  assert.equal(d.sql.prepare('SELECT retention_until FROM india_document_library WHERE id=?').get(x.body.id).retention_until,'2036-01-01');
  assert.equal(d.sql.prepare("SELECT count(*) n FROM india_document_access_events WHERE action='RETENTION_SET'").get().n,0);
  assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_tx_guards').get().n,0);
 }finally{d.close();}
});
test('concurrent Legal hold change prevents stale release and orphan governance audit',async()=>{
 const d=new Harness().seed();try{
  const x=await expect(upload(d,'nda'),201);
  d.sql.prepare('UPDATE india_document_library SET legal_hold=1,hold_reason=? WHERE id=?').run('Original legal hold',x.body.id);
  d.beforeBatch=()=>d.sql.prepare('UPDATE india_document_library SET hold_reason=? WHERE id=?').run('New independent investigation hold',x.body.id);
  await expect(patch(d,'legal',{id:x.body.id,source:'library',action:'hold',hold:false,reason:'Release based on original investigation'}),409);
  assert.equal(d.sql.prepare('SELECT legal_hold FROM india_document_library WHERE id=?').get(x.body.id).legal_hold,1);
  assert.equal(d.sql.prepare("SELECT count(*) n FROM india_document_access_events WHERE action='LEGAL_HOLD_RELEASE'").get().n,0);
 }finally{d.close();}
});
