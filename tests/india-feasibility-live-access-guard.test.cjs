const test=require('node:test');
const assert=require('node:assert/strict');
const guards=import('../scripts/india-feasibility-uat-guards.mjs');
const sha='a'.repeat(40),worker='uat-india-modules';
const origin='https://'+worker+'.elang-haqeem.workers.dev';

test('live transactions require the restored clone and exclude production/shared UAT before network',async()=>{
 const g=await guards;
 assert.equal(g.validateTarget('--transactions',worker,origin,g.RESTORED_UAT_DB,sha).db,g.RESTORED_UAT_DB);
 assert.throws(()=>g.validateTarget('--transactions',worker,origin,g.SHARED_UAT_DB,sha),/shared UAT is read-only/);
 assert.equal(g.validateTarget('--preflight','uat-india','https://uat-india.elang-haqeem.workers.dev',g.SHARED_UAT_DB,sha).mode,'--preflight');
 for(const db of ['8395dd84-1b7d-4eaf-9990-1d8e75a42cb5','unapproved-db'])
  assert.throws(()=>g.validateTarget('--preflight',worker,origin,db,sha),/pinned INDIA UAT/);
 for(const url of ['https://india.elang-haqeem.workers.dev',origin+'/api',origin+'?redirect=elsewhere','http://'+worker+'.elang-haqeem.workers.dev'])
  assert.throws(()=>g.validateTarget('--transactions',worker,url,g.RESTORED_UAT_DB,sha),/HTTPS origin/);
 assert.throws(()=>g.validateTarget('--transactions','india','https://india.elang-haqeem.workers.dev',g.RESTORED_UAT_DB,sha),/UAT-only/);
 assert.throws(()=>g.validateTarget('--transactions',worker,origin,g.RESTORED_UAT_DB,'main'),/Exact intended/);
});

test('only a genuine pinned Access login redirect proves the anonymous challenge',async()=>{
 const {isAccessChallenge,ACCESS_TEAM}=await guards;
 assert.equal(isAccessChallenge(302,'https://'+ACCESS_TEAM+'/cdn-cgi/access/login/test',origin),true);
 assert.equal(isAccessChallenge(302,'/cdn-cgi/access/login',origin),true);
 for(const [status,location] of [[403,''],[401,''],[200,''],[302,'https://evil.test/cdn-cgi/access/login'],
  [302,'https://'+ACCESS_TEAM+'.evil.test/cdn-cgi/access/login'],[302,'https://'+ACCESS_TEAM+'/unrelated'],
  [302,'https://evil.test/?next=cloudflareaccess.com']])
  assert.equal(isAccessChallenge(status,location,origin),false,status+' '+location);
});

test('real session request uses the Access cookie and never injects the origin assertion header',async()=>{
 const {accessCookieHeaders}=await guards;
 const headers=accessCookieHeaders('signed.application.token');
 assert.equal(headers.Cookie,'CF_Authorization=signed.application.token');
 assert.equal(headers['cf-access-jwt-assertion'],undefined);
 for(const token of ['', 'signed.application.token; extra=value', 'signed.application.token\r\nInjected: x'])
  assert.throws(()=>accessCookieHeaders(token),/signed application JWT/);
});

test('D1 membership attestation prevents inactive, duplicate and mislabeled admin sessions before any write',async()=>{
 const {validateMemberRoles}=await guards;
 const roles=['sales','sales','presales','finance','approver','admin'];
 const people=Object.fromEntries(roles.map((role,i)=>[i,{role,label:'Role '+i,email:'person'+i+'@mail.test'}]));
 const rows=Object.values(people).map(p=>({email:p.email,role:p.role,active:1}));
 assert.doesNotThrow(()=>validateMemberRoles(people,rows));
 for(const patch of [{role:'admin'},{active:0}]){
  const altered=rows.map((r,i)=>i===0?{...r,...patch}:r);
  assert.throws(()=>validateMemberRoles(people,altered),/Role 0/);
 }
 assert.throws(()=>validateMemberRoles(people,rows.slice(1)),/Role 0/);
 assert.throws(()=>validateMemberRoles(people,[...rows,rows[0]]),/Role 0/);
 assert.throws(()=>validateMemberRoles({...people,1:{...people[1],email:people[0].email}},rows),/Six distinct/);
});
