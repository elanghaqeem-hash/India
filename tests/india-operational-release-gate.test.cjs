const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const preflight=path.join(root,'scripts/india-operational-gate.mjs');
const restore=path.join(root,'scripts/india-d1-0028-restore-rehearsal.py');
const migration=path.join(root,'migrations/0028_ai_mistral_provider.sql');
const candidate='5b9b58de-be29-48bb-9023-018c7f15f68b';
function runOffline(env){
 return spawnSync(process.execPath,[preflight,'--preflight'],{
  cwd:root,encoding:'utf8',timeout:3000,
  env:{PATH:process.env.PATH,INDIA_GATE_WORKER_NAME:'uat-india-releasegate',
   INDIA_GATE_D1_ID:candidate,INDIA_GATE_SHA:'a'.repeat(40),
   INDIA_GATE_ACCESS_APP_ID:'d3d7a87c-e867-4362-aa8d-f99f3cc404d6',
   INDIA_GATE_TOKEN:'',...env}});
}
test('uncredentialed live preflight fails closed before network and never emits PASS',()=>{
 const r=runOffline();
 assert.equal(r.status,2);
 assert.match(r.stderr,/Cloudflare READ ONLY token required/);
 assert.doesNotMatch(r.stderr+r.stdout,/"result":"PASS"/);
});
test('release gate rejects production DB and default shared UAT Worker before network',()=>{
 const r=runOffline({INDIA_GATE_D1_ID:'8395dd84-1b7d-4eaf-9990-1d8e75a42cb5'});
 assert.equal(r.status,2);assert.match(r.stderr,/never production\/shared UAT/);
 const s=runOffline({INDIA_GATE_WORKER_NAME:'uat-india'});
 assert.equal(s.status,2);assert.match(s.stderr,/dedicated uat-india/);
});
test('source does not permit uncontrolled writes or change production gate',()=>{
 const source=fs.readFileSync(preflight,'utf8');
 assert.match(source,/--preflight/);
 assert.match(source,/INDIA_RELEASE_SHA/);
 assert.match(source,/INDIA_DOCUMENT_ENCRYPTION_KEY/);
 assert.match(source,/INDIA_AI_ENCRYPTION_KEY/);
 assert.match(source,/MANDATORY_ROLES/);
 assert.match(source,/PRAGMA foreign_key_check/);
 assert.match(source,/READ_ONLY_CLOUDFLARE_CONFIG_PREFLIGHT/);
 assert.doesNotMatch(source,/time_travel\/restore|workers\/scripts\/.*deployments.*POST/);
 assert.match(source,/Production release still HOLD/);
});
const baseline=[
"CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY);",
"INSERT INTO india_schema_migrations VALUES(27);",
"CREATE TABLE india_schema_file_manifest(path TEXT PRIMARY KEY,source_branch TEXT NOT NULL);",
"INSERT INTO india_schema_file_manifest VALUES('migrations/0027_customer_delivery_cash_renewal.sql','qa');",
"CREATE TABLE india_ai_providers (",
" provider_id TEXT PRIMARY KEY CHECK(provider_id IN ('openai','gemini','anthropic','groq','openrouter','deepseek')),",
" model TEXT NOT NULL,priority INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),",
" key_iv TEXT,key_ciphertext TEXT,tested_at TEXT,tested_ok INTEGER CHECK(tested_ok IN(0,1)),",
" updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_by TEXT NOT NULL",
");",
"INSERT INTO india_ai_providers(provider_id,model,priority,enabled,key_iv,key_ciphertext,updated_by)",
" VALUES('openai','gpt-qa',1,1,'cipher-iv','cipher-text','qa-admin');",
"CREATE TABLE india_members(email TEXT PRIMARY KEY,role TEXT,active INTEGER);",
"INSERT INTO india_members VALUES('qa-person@example.invalid','finance',1);",
].join('\n');
test('independent SQL restore, injected rollback and 0028 rehearsal on synthetic backup',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'india-release-gate-'));
 try{
  const sql=path.join(dir,'synthetic.sql'),evidence=path.join(dir,'evidence.json');
  fs.writeFileSync(sql,baseline);
  const hash=crypto.createHash('sha256').update(baseline).digest('hex');
  const params=[restore,sql,'--migration',migration,'--expected-sha256',hash,
   '--source-bookmark','00000019-00000000-0000510e-5b0ebacb47f79d2ee5c6cdb32a4ca579',
   '--output',evidence];
  const ok=spawnSync('python3',params,{encoding:'utf8',timeout:30000});
  assert.equal(ok.status,0,ok.stderr);
  const report=JSON.parse(fs.readFileSync(evidence,'utf8'));
  assert.equal(report.result,'PASS');
  assert.equal(report.migration_rollback_after_injected_failure,'PASS');
  assert.equal(report.rehearsal_version,28);
  assert.equal(report.legacy_data_preserved,true);
  assert.equal(report.provider_ciphertext_and_metadata_preserved,true);
  assert.equal(report.backup_sha256,hash);
  const again=spawnSync('python3',params,{encoding:'utf8',timeout:30000});
  assert.equal(again.status,2);assert.match(again.stderr,/never overwrite/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('independent restore rejects a forged checksum and produces no evidence',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'india-release-negative-'));
 try{
  const input=path.join(dir,'backup.sql'),evidence=path.join(dir,'report.json');fs.writeFileSync(input,baseline);
  const r=spawnSync('python3',[restore,input,'--migration',migration,
   '--expected-sha256','0'.repeat(64),'--source-bookmark',
   '00000019-00000000-0000510e-5b0ebacb47f79d2ee5c6cdb32a4ca579',
   '--output',evidence],{encoding:'utf8',timeout:30000});
  assert.equal(r.status,2);assert.match(r.stderr,/checksum mismatch/);
  assert.equal(fs.existsSync(evidence),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
