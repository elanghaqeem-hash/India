const test=require('node:test');
const assert=require('node:assert/strict');
const {Harness,expect}=require('./helpers/sales-flow-harness.cjs');

function seedChecklist(d,ref='archive/fake',hash='a'.repeat(64),name='term-sheet.pdf'){
 d.sql.prepare(`INSERT INTO india_tender_checklist(
 id,tenant_id,opportunity_id,item_code,category,label,mandatory,document_name,
 evidence_reference,evidence_sha256,created_by
 ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
  'item-qa','defendit360','opp-qa','COM-01','commercial','Required vendor commercial document',1,
  name,ref,hash,'sales.a@flow.invalid');
}
async function original(d,kind='supporting',name='term-sheet.pdf',bytes=Buffer.from('%PDF-1.7\nAuthentic synthetic tender source')){
 const query=new URLSearchParams({opportunity_id:'opp-qa',kind,filename:name});
 const response=await d.load('src/app/api/sales/document-vault/route.ts').POST(
  new Request('https://flow.invalid/api/sales/document-vault?'+query,{
   method:'POST',headers:{Origin:'https://flow.invalid','x-test-role':'sales'},body:bytes
  }));
 return {status:response.status,body:await response.json()};
}
const review=d=>d.call('sales/bid-readiness','POST','finance',{
 opportunity_id:'opp-qa',flow_version:d.deal().flow_version,action:'review_item',id:'item-qa',
 version:1,approve:true,review_notes:'Independent review of original file and valid checksum'
});

test('canonical 0021 Tender, 0022 Vault governance and 0023 evidence gate have unique migration identifiers',()=>{
 const d=new Harness(true,true).seed();
 try{
  const versions=d.sql.prepare('SELECT version FROM india_schema_migrations WHERE version>=21 ORDER BY version').all().map(x=>x.version);
  assert.deepEqual(versions,[21,22,23]);
  for(const n of ['india_tender_checklist','india_document_library','india_document_vault','india_tender_vault_originals']){
   assert.ok(d.sql.prepare("SELECT name FROM sqlite_master WHERE name=?").get(n),'missing '+n);
  }
  assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.deepEqual(d.sql.prepare('PRAGMA quick_check').all().map(x=>x.quick_check),['ok']);
 }finally{d.close();}
});

test('Tender review rejects invented reference and mismatching checksum; authenticated original succeeds',async()=>{
 const d=new Harness(true,true).seed();
 try{
  seedChecklist(d);
  await expect(review(d),409);
  let row=d.sql.prepare("SELECT status FROM india_tender_checklist WHERE id='item-qa'").get();
  assert.equal(row.status,'draft');
  const upload=await expect(original(d),201);
  assert.match(upload.body.reference,/^vault:/);
  assert.equal(upload.body.sha256.length,64);
  d.sql.prepare('UPDATE india_tender_checklist SET evidence_reference=?,evidence_sha256=? WHERE id=?')
   .run(upload.body.reference,'b'.repeat(64),'item-qa');
  await expect(review(d),409);
  d.sql.prepare('UPDATE india_tender_checklist SET evidence_sha256=? WHERE id=?')
   .run(upload.body.sha256,'item-qa');
  await expect(review(d),200);
  assert.equal(d.sql.prepare("SELECT status FROM india_tender_checklist WHERE id='item-qa'").get().status,'ready');
  const snapshot=await expect(d.call('sales/bid-readiness','GET','sales',null,'?opportunity_id=opp-qa'),200);
  assert.equal(snapshot.body.report.ready,false); // No GO / approved deadline / 3 categories.
  assert.ok(!snapshot.body.report.gaps.some(x=>x.includes('COM-01')&&x.includes('file asli Vault')));
  assert.equal(d.sql.prepare("SELECT count(*) AS n FROM india_document_library").get().n,1);
 }finally{d.close();}
});

test('SQL trigger refuses direct mandatory checklist approval with fake or cross-Opportunity source',async()=>{
 const d=new Harness(true,true).seed();
 try{
  seedChecklist(d);
  assert.throws(()=>d.sql.exec("UPDATE india_tender_checklist SET status='ready',checked_by='finance@flow.invalid' WHERE id='item-qa'"),/TENDER_VAULT_EVIDENCE/);
  const uploaded=await expect(original(d),201);
  d.sql.prepare('UPDATE india_tender_checklist SET evidence_reference=?,evidence_sha256=?,document_name=? WHERE id=?')
   .run(uploaded.body.reference,uploaded.body.sha256,'different.pdf','item-qa');
  assert.throws(()=>d.sql.exec("UPDATE india_tender_checklist SET status='ready',checked_by='finance@flow.invalid' WHERE id='item-qa'"),/TENDER_VAULT_EVIDENCE/);
  assert.equal(d.sql.prepare("SELECT status FROM india_tender_checklist WHERE id='item-qa'").get().status,'draft');
 }finally{d.close();}
});

test('cross-role document listing denies Sales B and allows original owner and reviewer',async()=>{
 const d=new Harness(true,true).seed();
 try{
  const uploaded=await expect(original(d,'rks','source-rks.pdf'),201);
  const q='?opportunity_id=opp-qa';
  await expect(d.call('sales/document-vault','GET','other',null,q),403);
  const list=await expect(d.call('sales/document-vault','GET','sales',null,q),200);
  assert.ok(list.body.documents.some(x=>x.id===uploaded.body.id&&x.source==='library'));
  await expect(d.call('sales/document-vault','GET','finance',null,q),200);
  await expect(d.call('sales/document-vault','GET','viewer',null,q),403);
 }finally{d.close();}
});
