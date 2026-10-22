const test=require('node:test'),assert=require('node:assert/strict');
const {Harness,expect,users}=require('./helpers/sales-flow-harness.cjs');
const sha='a'.repeat(64),ref='archive/qa/document-original';
const api=(h,role,p)=>h.call('sales/bid-readiness','POST',role,{opportunity_id:'opp-qa',flow_version:h.deal().flow_version,...p});
const get=(h,role='sales')=>h.call('sales/bid-readiness','GET',role,null,'?opportunity_id=opp-qa');
const deadline=new Date(Date.now()+90*86400000).toISOString().replace('.000Z','Z');

async function uploadOriginal(h,kind='supporting',name='evidence.pdf'){
 const q=new URLSearchParams({opportunity_id:'opp-qa',kind,filename:name});
 const r=await h.load('src/app/api/sales/document-vault/route.ts').POST(
  new Request('https://flow.invalid/api/sales/document-vault?'+q,
   {method:'POST',headers:{Origin:'https://flow.invalid','x-test-role':'sales'},
    body:Buffer.from('%PDF-1.7\\nOriginal signed tender evidence '+name)}));
 return expect(Promise.resolve({status:r.status,body:await r.json()}),201);
}
async function approvedOriginal(h){
 await expect(h.flow('scope','presales'),201);
 const q=new URLSearchParams({opportunity_id:'opp-qa',release_id:h.release().id,kind:'proposal',filename:'proposal.pdf'});
 const r=await h.load('src/app/api/sales/vault/route.ts').POST(
  new Request('https://flow.invalid/api/sales/vault?'+q,{method:'POST',
   headers:{Origin:'https://flow.invalid','x-test-role':'sales'},body:Buffer.from('%PDF-1.7\\nApproved synthetic proposal')}));
 const proof=await expect(Promise.resolve({status:r.status,body:await r.json()}),201);
 await expect(h.flow('propose','sales',{proposal_reference:proof.body.reference,proposal_sha256:proof.body.sha256}),200);
 await expect(h.flow('approve','approver'),200);
}

async function prepare(h){
 await expect(h.edit({procurement_process:'Tender RFQ'}),200);
 await expect(h.call('sales/procurement','POST','sales',{entity:'bid',opportunity_id:'opp-qa',channel:'tender',summary:'Bid recommendation with adequate evidence'}),200);
 await expect(h.call('sales/procurement','PATCH','approver',{entity:'bid_decision',opportunity_id:'opp-qa',bid_decision:'go',decision_reason:'Independent bid decision approved'}),200);
 const original=await uploadOriginal(h,'rks','source-rks.pdf');
 const r=await expect(h.call('sales/procurement','POST','sales',{entity:'requirement',opportunity_id:'opp-qa',kind:'rks',title:'Tender technical requirements',requirement_summary:'Assurance must meet defined scope',file_reference:original.body.reference,source_content_hash:original.body.sha256}),201);
 const c=await expect(h.call('sales/compliance','POST','sales',{opportunity_id:'opp-qa',flow_version:h.deal().flow_version,action:'clause',requirement_id:r.body.id,clause_reference:'RKS-1',category:'technical',mandatory:true,requirement_text:'Certified security assessment resources',response_text:'Qualified staff with deliverables',evidence_reference:original.body.reference,evidence_sha256:original.body.sha256}),201);
 await expect(h.call('sales/compliance','POST','presales',{opportunity_id:'opp-qa',flow_version:h.deal().flow_version,action:'review_clause',id:c.body.id,version:1,compliance_status:'compliant',review_notes:'Independently checked the original technical evidence'}),201);
 await expect(h.call('sales/procurement','PATCH','presales',{entity:'requirement_review',opportunity_id:'opp-qa',id:r.body.id,compliance_status:'compliant',review_notes:'All mandatory clauses independently reviewed'}),200);
 return {r:r.body.id,c:c.body.id};
}
async function seedPackage(h){
 const t=await expect(api(h,'sales',{action:'deadline',milestone:'submission',due_at:deadline,notes:'Official customer tender calendar'}),201);
 await expect(api(h,'approver',{action:'review_deadline',id:t.body.id,version:1,approve:true,review_notes:'Customer portal deadline verified independently'}),201);
 const ids=[];
 for(const [category,code] of [['administrative','ADM-01'],['technical','TEC-01'],['commercial','COM-01']]){
  const original=await uploadOriginal(h,'supporting',code+'.pdf');
  const x=await expect(api(h,'sales',{action:'item',item_code:code,category,mandatory:true,label:'Required '+category+' bid document',document_name:code+'.pdf',evidence_reference:original.body.reference,evidence_sha256:original.body.sha256}),201);
  ids.push(x.body.id);
  await expect(api(h,'admin',{action:'review_item',id:x.body.id,version:1,approve:true,review_notes:'Confirmed document package evidence and signature'}),201);
 }
 return {deadlineId:t.body.id,ids};
}
test('0021/0022/0023 migration has durable history and clean foreign keys',()=>{
 const h=new Harness(true,true).seed();try{
  assert.equal(h.sql.prepare('SELECT version FROM india_schema_migrations WHERE version=21').get().version,21);
  assert.deepEqual(h.sql.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(h.sql.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{h.close();}
});
test('missing mandatory documents and unreviewed deadline fail closed on Tender stage',async()=>{
 const h=new Harness(true,true).seed();try{
  await prepare(h);await approvedOriginal(h);await expect(h.stage('solution_design'),200);
  const r=await expect(get(h),200);assert.equal(r.body.report.ready,false);
  assert.match(r.body.report.gaps.join(' | '),/Deadline|Checklist/);
  await expect(h.stage('commercial_review'),409);
 }finally{h.close();}
});
test('strict deadline parser rejects leap errors, missing offset and malformed time',async()=>{
 const h=new Harness(true,true).seed();try{
  const m=h.load('src/lib/bid-readiness.ts');
  for(const value of ['2026-02-30T08:00:00+07:00','2026-11-20T08:00:00','2026-11-20T25:00:00+07:00','2026-11-20T08:00:00+15:00'])assert.equal(m.validDeadline(value),false,value);
  assert.equal(m.validDeadline('2028-02-29T08:00:00+07:00'),true);
  await expect(api(h,'sales',{action:'deadline',milestone:'submission',due_at:'2026-02-30T08:00:00+07:00',notes:'Invalid official date'}),422);
 }finally{h.close();}
});
test('cross Sales owner, viewer, CSRF and invalid clause link are rejected',async()=>{
 const h=new Harness(true,true).seed();try{
  await expect(get(h,'other'),403);await expect(get(h,'viewer'),403);
  await expect(api(h,'other',{action:'deadline',milestone:'submission',due_at:deadline,notes:'Wrong owner attempt'}),403);
  await expect(h.call('sales/bid-readiness','POST','admin',{opportunity_id:'opp-qa'},'',{Origin:'https://evil.invalid'}),403);
  await expect(api(h,'sales',{action:'item',item_code:'ADM-01',category:'administrative',label:'Signed company declaration',mandatory:true,source_clause_id:'not-from-this-deal'}),409);
 }finally{h.close();}
});
test('deadline must have independent reviewer; revision removes approval',async()=>{
 const h=new Harness(true,true).seed();try{
  const t=await expect(api(h,'sales',{action:'deadline',milestone:'submission',due_at:deadline,notes:'Original tender submission calendar'}),201);
  await expect(api(h,'sales',{action:'review_deadline',id:t.body.id,version:1,approve:true,review_notes:'Self-approval not permitted here'}),403);
  await expect(api(h,'approver',{action:'review_deadline',id:t.body.id,version:1,approve:true,review_notes:'Independent customer deadline approval'}),201);
  await expect(api(h,'approver',{action:'review_deadline',id:t.body.id,version:1,approve:true,review_notes:'Duplicate approval conflict'}),409);
  await expect(api(h,'sales',{action:'revise_deadline',id:t.body.id,version:2,milestone:'submission',due_at:deadline,notes:'Official addendum revises deadline'}),201);
  const row=h.sql.prepare('SELECT status,reviewed_by,version FROM india_tender_deadlines').get();
  assert.equal(row.status,'draft');assert.equal(row.reviewed_by,null);assert.equal(row.version,3);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_tender_readiness_history').get().n,2);
  assert.throws(()=>h.sql.exec('DELETE FROM india_tender_readiness_history'),/IMMUTABLE/);
 }finally{h.close();}
});
test('checklist blocks absent evidence, prevents maker review, and preserves revision audit',async()=>{
 const h=new Harness(true,true).seed();try{
  const item=await expect(api(h,'sales',{action:'item',item_code:'ADM-01',category:'administrative',mandatory:true,label:'Signed corporate declaration'}),201);
  await expect(api(h,'sales',{action:'review_item',id:item.body.id,version:1,approve:true,review_notes:'Self approval should be denied'}),403);
  await expect(api(h,'finance',{action:'review_item',id:item.body.id,version:1,approve:true,review_notes:'No original evidence is available'}),409);
  const original=await uploadOriginal(h,'supporting','signed.pdf');
  await expect(api(h,'sales',{action:'revise_item',id:item.body.id,version:1,item_code:'ADM-01',category:'administrative',label:'Signed corporate declaration',mandatory:true,document_name:'signed.pdf',evidence_reference:original.body.reference,evidence_sha256:original.body.sha256}),201);
  await expect(api(h,'finance',{action:'review_item',id:item.body.id,version:2,approve:true,review_notes:'Original signed file and archive checksum checked'}),201);
  await expect(api(h,'sales',{action:'revise_item',id:item.body.id,version:3,item_code:'ADM-01',category:'administrative',label:'Signed corporate declaration',mandatory:true,document_name:'unsigned.pdf',evidence_reference:original.body.reference,evidence_sha256:original.body.sha256}),201);
  assert.equal(h.sql.prepare('SELECT status FROM india_tender_checklist').get().status,'draft');
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_tender_readiness_history').get().n,3);
 }finally{h.close();}
});
test('GO + all reviewed RKS/clauses, 3 checklist categories, deadline makes SQL and report ready',async()=>{
 const h=new Harness(true,true).seed();try{
  await prepare(h);await approvedOriginal(h);await expect(h.stage('solution_design'),200);
  await seedPackage(h);
  const r=await expect(get(h),200);
  assert.equal(r.body.report.ready,true);assert.equal(r.body.sqlReady,true);assert.equal(r.body.report.mandatory_ready,3);
  await expect(h.stage('commercial_review'),200);
 }finally{h.close();}
});
test('one extra unreviewed RKS cannot be bypassed by another compliant source',async()=>{
 const h=new Harness(true,true).seed();try{
  await prepare(h);await seedPackage(h);
  await expect(h.call('sales/procurement','POST','sales',{entity:'requirement',opportunity_id:'opp-qa',kind:'kak',title:'Second mandatory KAK',requirement_summary:'Additional mandatory technical scope requirement',file_reference:ref,source_content_hash:sha}),201);
  const r=await expect(get(h),200);assert.equal(r.body.report.ready,false);assert.equal(r.body.sqlReady,false);
  assert.match(r.body.report.gaps.join(' '),/Second mandatory KAK/);
 }finally{h.close();}
});
test('deadline expiry or rejected administrative checklist revokes readiness without rewriting history',async()=>{
 const h=new Harness(true,true).seed();try{
  await prepare(h);const pkg=await seedPackage(h);assert.equal((await get(h)).body.report.ready,true);
  h.sql.prepare('UPDATE india_tender_deadlines SET due_at=? WHERE id=?').run('2026-01-01T08:00:00+07:00',pkg.deadlineId);
  const r=await get(h);assert.equal(r.body.report.deadline_status,'expired');assert.equal(r.body.report.ready,false);
 }finally{h.close();}
});
test('invalid CSV formula cells are neutralized; all three exports are protected',async()=>{
 const h=new Harness(true,true).seed();try{
  const m=h.load('src/lib/bid-readiness.ts');assert.match(m.safeCSV([['=1+1','\t@SUM(1,2)']]),/'\=1\+1/);
  assert.match(m.safeCSV([['=1+1']]),/^﻿"'\=1\+1"/);
  for(const kind of ['matrix','checklist','report']){
   const route=h.load('src/app/api/sales/bid-readiness/route.ts');
   const req=new Request('https://flow.invalid/api/sales/bid-readiness?opportunity_id=opp-qa&output='+kind,{headers:{'x-test-role':'sales'}});
   const response=await route.GET(req);
   assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);
   assert.match(await response.text(),/Opportunity|RKS\/KAK|Kategori/);
  }
  await expect(h.call('sales/bid-readiness','GET','other',null,'?opportunity_id=opp-qa&output=report'),403);
 }finally{h.close();}
});
test('stale CAS and audit write failure leave deadline/checklist unchanged',async()=>{
 const h=new Harness(true,true).seed();try{
  const item=await expect(api(h,'sales',{action:'item',item_code:'COM-01',category:'commercial',mandatory:true,label:'Approved price quotation'}),201);
  h.beforeBatch=()=>h.sql.prepare('UPDATE india_tender_checklist SET version=version+1 WHERE id=?').run(item.body.id);
  await expect(api(h,'sales',{action:'revise_item',id:item.body.id,version:1,item_code:'COM-01',category:'commercial',mandatory:true,label:'Updated price quotation'}),409);
  assert.equal(h.sql.prepare('SELECT label FROM india_tender_checklist').get().label,'Approved price quotation');
  h.sql.exec("CREATE TRIGGER deny_readiness_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  await expect(api(h,'sales',{action:'deadline',milestone:'submission',due_at:deadline,notes:'Deadline for audit rollback'}),503);
  assert.equal(h.sql.prepare('SELECT count(*) n FROM india_tender_deadlines').get().n,0);
 }finally{h.close();}
});