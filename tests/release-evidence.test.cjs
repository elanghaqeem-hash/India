const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const api=import('../scripts/india-release-evidence.mjs');
const catalog=require('../docs/INDIA_UAT_210_CATALOG.json').cases;
const erpCatalog=require('../docs/INDIA_ERP_UAT_210_CATALOG.json').cases;

// Synthetic receipts exercise rejection controls only; never count these as real UAT.
async function fixture(){
 const {GATES,verifyReleaseEvidence}=await api;
 const dir=mkdtempSync(join(tmpdir(),'india-signed-evidence-'));
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const proof=Buffer.from('synthetic proof bytes for unit-test signature validation');
 writeFileSync(join(dir,'proof.txt'),proof);
 const ref={path:'proof.txt',sha256:createHash('sha256').update(proof).digest('hex')};
 const identities=['admin','marketing','sales','sales','presales','finance','approver','legal','viewer'].map((role,i)=>({subject:'subject-'+i,role,auth_method:'cloudflare_access',jwt_signature_verified:true,audience:'test-audience',issuer:'https://test.cloudflareaccess.com'}));
 const now=Date.now(),sha='a'.repeat(40);
 const payload={schema_version:1,release_sha:sha,environment:'production',worker:'india',database_id:'8395dd84-1b7d-4eaf-9990-1d8e75a42cb5',issued_at:new Date(now).toISOString(),expires_at:new Date(now+60000).toISOString(),gates:GATES.map(id=>({id,status:'PASS',evidence:[ref]})),identities,uat:catalog.map(c=>({id:c.id,priority:c.priority,status:'PASS',release_sha:sha,execution_kind:'real_cloudflare_access',actual_result:'test assertion',tester_subject:identities[0].subject,executed_at:new Date(now).toISOString(),evidence:[ref]})),erp_uat:erpCatalog.map(c=>({id:c.id,priority:c.priority,status:'PASS',release_sha:sha,execution_kind:'real_cloudflare_access',actual_result:'synthetic test assertion',tester_subject:identities[0].subject,executed_at:new Date(now).toISOString(),evidence:[ref],actor:c.actor,role_scope_verified:true,segregation_of_duties_checked:true,actor_proofs:c.actor.split(',').map((label,i)=>({role_label:label.trim(),subject:identities[i].subject,jwt_signature_verified:true}))})),signoffs:['security','finance','operations','release','legal','hr','procurement','cyber_operations'].map(kind=>({kind,decision:'APPROVED',release_sha:sha,subject:'authority',reference:'synthetic-unit-test'})),open_critical:0,open_high:0};
 const receiptPath=join(dir,'receipt.json');
 const save=()=>writeFileSync(receiptPath,JSON.stringify({payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),privateKey).toString('base64')}));
 const check=()=>verifyReleaseEvidence({receiptPath,publicKey:publicKey.export({format:'pem',type:'spki'}),sha,now});
 save();return {payload,save,check,dir,receiptPath};
}
test('missing signed evidence cannot be replaced by PASS environment flags',async()=>{
 const {verifyReleaseEvidence}=await api;
 assert.throws(()=>verifyReleaseEvidence({sha:'a'.repeat(40)}),/SIGNED_RELEASE_EVIDENCE_MISSING/);
});
test('signed receipt enforces exact SHA, all roles, all 210 real cases and evidence bytes',async()=>{
 const f=await fixture();try{
  assert.equal(f.check().decision,'GO');assert.equal(f.check().uat_pass,420);
  f.payload.release_sha='b'.repeat(40);f.save();assert.throws(f.check,/STALE_RELEASE_EVIDENCE/);
  f.payload.release_sha='a'.repeat(40);f.payload.identities.pop();f.save();assert.throws(f.check,/ROLE_MISSING_viewer/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('unrun, fixture UAT and checksum tampering all block release',async()=>{
 const f=await fixture();try{
  f.payload.uat[0].status='NOT RUN';f.save();assert.throws(f.check,/REAL_UAT_MISSING/);
  f.payload.uat[0].status='PASS';f.payload.uat[0].execution_kind='fixture';f.save();assert.throws(f.check,/REAL_UAT_MISSING/);
  f.payload.uat[0].execution_kind='real_cloudflare_access';f.save();writeFileSync(join(f.dir,'proof.txt'),'changed');assert.throws(f.check,/EVIDENCE_CHECKSUM_MISMATCH/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('edited receipt without a new authority signature is rejected',async()=>{
 const f=await fixture();try{
  const e=JSON.parse(require('node:fs').readFileSync(f.receiptPath));e.payload.open_high=0;e.payload.worker='other';writeFileSync(f.receiptPath,JSON.stringify(e));
  assert.throws(f.check,/INVALID_RELEASE_SIGNATURE/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});


test('all-module certification rejects omitted, unrun, stale or forged ERP evidence',async()=>{
 const f=await fixture();try{
  const original=f.payload.erp_uat;
  delete f.payload.erp_uat;f.save();
  assert.throws(f.check,/ERP_UAT_210_REQUIRED/);
  f.payload.erp_uat=original.map(x=>({...x}));
  f.payload.erp_uat[0].status='NOT_RUN';f.save();
  assert.throws(f.check,/REAL_ERP_UAT_MISSING/);
  f.payload.erp_uat[0].status='PASS';
  f.payload.erp_uat[0].execution_kind='synthetic';f.save();
  assert.throws(f.check,/REAL_ERP_UAT_MISSING/);
  f.payload.erp_uat[0].execution_kind='real_cloudflare_access';
  f.payload.erp_uat[0].release_sha='f'.repeat(40);f.save();
  assert.throws(f.check,/REAL_ERP_UAT_MISSING/);
  f.payload.erp_uat[0].release_sha='a'.repeat(40);
  f.payload.erp_uat[0].role_scope_verified=false;f.save();
  assert.throws(f.check,/REAL_ERP_UAT_MISSING/);
  f.payload.erp_uat[0].role_scope_verified=true;
  f.payload.erp_uat[0].actor_proofs=[];f.save();
  assert.throws(f.check,/ERP_ACTOR_PROOFS_MISSING/);
  f.payload.erp_uat[0].actor_proofs=[{role_label:f.payload.erp_uat[0].actor,subject:f.payload.identities[0].subject,jwt_signature_verified:true}];
  f.payload.signoffs=f.payload.signoffs.filter(x=>x.kind!=='hr');f.save();
  assert.throws(f.check,/SIGNOFF_MISSING_hr/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test('multi-actor ERP cases cannot use one signed subject for distinct functions',async()=>{
 const f=await fixture();try{
  const c=f.payload.erp_uat.find(t=>t.actor.includes(','));
  assert.ok(c);
  c.actor_proofs=c.actor_proofs.map(p=>({...p,subject:f.payload.identities[0].subject}));
  f.save();
  assert.throws(f.check,/ERP_MULTIACTOR_SOD_MISSING/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
