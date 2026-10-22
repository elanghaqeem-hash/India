const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const script=path.join(__dirname,'../scripts/india-cloudflare-access-real-uat.mjs');
const source=fs.readFileSync(script,'utf8');
const base={
 INDIA_UAT_BASE_URL:'https://uat-india.example.workers.dev',
 INDIA_UAT_ALLOWED_HOST:'uat-india.example.workers.dev',
 INDIA_UAT_WORKER_NAME:'uat-india',
 INDIA_UAT_D1_ID:'eaed652e-7322-4950-a304-dd50baa5de02',
 INDIA_UAT_ALLOW_WRITE:'YES_ISOLATED_UAT',
 CLOUDFLARE_API_TOKEN:'never-sent',
 INDIA_ACCESS_TEAM_DOMAIN:'example.cloudflareaccess.com',
 INDIA_ACCESS_AUD:'012345678901234567890123456789012345',
 INDIA_UAT_JWT_SALES_A:'fake.fake.fake',
 INDIA_UAT_JWT_SALES_B:'fake.fake.fake',
 INDIA_UAT_JWT_ADMIN:'fake.fake.fake',
 INDIA_UAT_EMAIL_SALES_A:'a@example.com',
 INDIA_UAT_EMAIL_SALES_B:'b@example.com',
 INDIA_UAT_EMAIL_ADMIN:'admin@example.com',
};
function run(patch){
 return spawnSync(process.execPath,[script],{
 encoding:'utf8',timeout:3000,env:{...process.env,...base,...patch}
 });
}
test('real Access UAT runner requires explicit write approval before network',()=>{
 const r=run({INDIA_UAT_ALLOW_WRITE:''});
 assert.equal(r.status,2);
 assert.match(r.stderr,/UAT write harus diizinkan/);
 assert.doesNotMatch(r.stdout,/PASS/);
});
test('real Access UAT runner cannot target current production Worker hostname',()=>{
 const r=run({INDIA_UAT_BASE_URL:'https://india.elang-haqeem.workers.dev',
 INDIA_UAT_ALLOWED_HOST:'india.elang-haqeem.workers.dev'});
 assert.equal(r.status,2);
 assert.match(r.stderr,/Hostname UAT tidak cocok/);
});
test('real Access UAT runner rejects production D1 UUID before network',()=>{
 const r=run({INDIA_UAT_D1_ID:'8395dd84-1b7d-4eaf-9990-1d8e75a42cb5'});
 assert.equal(r.status,2);
 assert.match(r.stderr,/D1 target bukan UAT/);
});
test('real Access UAT runner rejects missing distinct identities and never logs JWT',()=>{
 const r=run({INDIA_UAT_EMAIL_ADMIN:'a@example.com'});
 assert.equal(r.status,2);
 assert.match(r.stderr,/Tiga identitas harus berbeda/);
 assert.doesNotMatch(r.stdout+r.stderr,/fake\.fake\.fake|never-sent/);
});
test('runner requires verified JWT and read-only Workers binding attestation',()=>{
 assert.match(source,/createRemoteJWKSet/);
 assert.match(source,/jwtVerify\(p\.token,keys/);
 assert.match(source,/\.id\|\|selected\[0\]\.database_id/);
 assert.match(source,/verifyWorkerBinding\(c\.worker\)/);
 assert.match(source,/entity:'convert'/);
 assert.match(source,/\/api\/marketing\/leads/);
 assert.match(source,/Sales B blocked from Sales A lead/);
 assert.match(source,/Duplicate conversion idempotently returns link/);
 assert.match(source,/Cross-owner opportunity creation denied/);
});
