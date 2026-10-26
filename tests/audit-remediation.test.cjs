const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Harness,expect}=require('./helpers/sales-flow-harness.cjs');
const read=p=>fs.readFileSync(p,'utf8');

test('Admin health reports missing role coverage and historical AI verification without issuing live network probes',async()=>{
 const h=new Harness(true,true).seed();
 try{
  await expect(h.call('admin/system','GET','viewer',null,'?section=health'),403);
  const result=await expect(h.call('admin/system','GET','admin',null,'?section=health'),200);
  assert.equal(result.body.release_readiness.production_gate,'HOLD');
  assert.equal(result.body.identity_readiness.access_identity_verification,'external_real_jwt_required');
  assert.ok(result.body.identity_readiness.roster.some(x=>x.role==='admin'&&x.count===2));
  assert.ok(result.body.identity_readiness.roster.some(x=>x.role==='sales'&&x.count===2));
  assert.ok(result.body.identity_readiness.roster.some(x=>x.role==='legal'));
  assert.ok(result.body.identity_readiness.roster.some(x=>x.role==='viewer'));
  assert.equal(result.body.ai_readiness.probe_validity,'historical_record_only_not_live_provider_probe');
  assert.equal(typeof result.body.active_registered_options,'number');
  assert.equal(Object.prototype.hasOwnProperty.call(result.body.ai_readiness,'key_ciphertext'),false);
 }finally{h.close();}
});
test('Scoping uses explicit, bounded, 30-minute session-only draft with no document/AI content',()=>{
 const page=read('src/app/scoping/page.tsx');
 assert.match(page,/saveSessionDraft/);
 assert.match(page,/restoreSessionDraft/);
 assert.match(page,/discardSessionDraft/);
 assert.match(page,/30\*60\*1000/);
 assert.match(page,/raw.length>70000/);
 assert.match(page,/sessionStorage.setItem\(scopingSessionKey,raw\)/);
 assert.match(page,/Tidak menyimpan file RKS\/TOR/);
 const saveSource=page.slice(page.indexOf('const saveSessionDraft='),page.indexOf('const restoreSessionDraft='));
 assert.doesNotMatch(saveSource,/aiDocText|uploadedDocument|aiExtractionResult|key_ciphertext/);
 assert.match(page,/draft scoping dipulihkan|Draft scoping dipulihkan/);
});
test('Existing production gate remains fail-closed after adding Admin observability',()=>{
 const api=read('src/app/api/admin/system/route.ts');
 const ui=read('src/components/admin/SystemSettings.tsx');
 assert.match(api,/production_gate:'HOLD'/);
 assert.match(api,/access_identity_verification:'external_real_jwt_required'/);
 assert.match(ui,/minimum_ready/);
 assert.match(ui,/all_enabled_tested/);
 assert.match(ui,/Periksa ulang/);
});
