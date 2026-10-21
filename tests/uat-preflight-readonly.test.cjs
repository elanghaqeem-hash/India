const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.join(__dirname,'../scripts/india-uat-d1-readonly-preflight.mjs');
const source=fs.readFileSync(script,'utf8');
const UAT='eaed652e-7322-4950-a304-dd50baa5de02';
const PROD='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';

test('UAT preflight cannot target production D1',()=>{
 const res=spawnSync(process.execPath,[script],{encoding:'utf8',env:{
  ...process.env,INDIA_UAT_D1_ID:PROD,CLOUDFLARE_API_TOKEN:'never-sent-to-network'
 }});
 assert.equal(res.status,2);
 assert.match(res.stderr,/DENIED/);
 assert.doesNotMatch(res.stdout,/PASS/);
});
test('UAT preflight refuses to run without scoped credentials',()=>{
 const env={...process.env,INDIA_UAT_D1_ID:UAT};
 delete env.CLOUDFLARE_API_TOKEN;
 const res=spawnSync(process.execPath,[script],{encoding:'utf8',env});
 assert.equal(res.status,2);
 assert.match(res.stderr,/NOT RUN/);
 assert.doesNotMatch(res.stdout,/PASS/);
});
test('UAT preflight contains read-only Cloudflare D1 checks',()=>{
 assert.match(source,/SELECT name FROM sqlite_master/);
 assert.match(source,/PRAGMA foreign_key_check/);
 assert.match(source,/duplicate_account_names/);
 assert.match(source,/converted_lead_inconsistencies/);
 assert.match(source,/result:good\?'PASS':'BLOCKED'/);
 assert.match(source,/\^\\s\*\(SELECT\|PRAGMA foreign_key_check\)/);
 assert.doesNotMatch(source,/db\.batch|\.execute\(|wrangler d1 execute/);
});
