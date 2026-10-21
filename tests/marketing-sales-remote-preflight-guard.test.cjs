const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const target=path.join(__dirname,'../scripts/india-uat-d1-readonly-preflight.mjs');
const source=fs.readFileSync(target,'utf8');
function run(extra){
 return spawnSync(process.execPath,[target],{encoding:'utf8',timeout:3000,env:{...process.env,...extra}});
}
test('consolidated UAT D1 preflight refuses production binding even with bogus credentials',()=>{
 const r=run({INDIA_UAT_D1_ID:'8395dd84-1b7d-4eaf-9990-1d8e75a42cb5',CLOUDFLARE_API_TOKEN:'never-used'});
 assert.equal(r.status,2);
 assert.match(r.stderr,/DENIED/);
 assert.doesNotMatch(r.stdout+r.stderr,/never-used/);
});
test('consolidated UAT D1 preflight refuses missing credentials without network access',()=>{
 const env={...process.env,INDIA_UAT_D1_ID:'eaed652e-7322-4950-a304-dd50baa5de02'};
 delete env.CLOUDFLARE_API_TOKEN;
 const r=spawnSync(process.execPath,[target],{encoding:'utf8',timeout:3000,env});
 assert.equal(r.status,2);
 assert.match(r.stderr,/NOT RUN/);
});
test('preflight verifies canonical cross-table lineage, unique Customer and FK checks read-only',()=>{
 for(const pattern of [/india_schema_file_manifest/,/india_sales_lead_links/,/PRAGMA foreign_key_check/,
  /missing_converted_links/,/orphan_opportunities/,/duplicate_account_names/,/result:ok\?'PASS':'BLOCKED'/])
  assert.match(source,pattern);
 assert.match(source,/^const UAT='eaed652e-7322-4950-a304-dd50baa5de02';/m);
 assert.doesNotMatch(source,/\.execute\(|wrangler d1 execute|db\.batch\(/);
});
