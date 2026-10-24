const test=require('node:test'), assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const read=p=>readFileSync(join(__dirname,'..',p),'utf8');
const initial=read('migrations/0002_ai_connections.sql');
const upgrade=read('migrations/0028_ai_mistral_provider.sql');

function fixture(version=27){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY); CREATE TABLE india_schema_file_manifest(path TEXT PRIMARY KEY,source_branch TEXT NOT NULL);');
 db.exec(initial);
 if(version>0)db.prepare('INSERT INTO india_schema_migrations(version) VALUES(?)').run(version);
 for(let i=0;i<6;i++)db.prepare('INSERT INTO india_ai_providers(provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
  .run(['openai','gemini','anthropic','groq','openrouter','deepseek'][i],'model-'+i,i+2,i%2,'iv-'+i,'encrypted-original-'+i,'2026-10-20 08:00:00',i%2,'2026-10-20 08:02:00','existing-admin');
 return db;
}
const snapshot=db=>db.prepare("SELECT provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at,updated_by FROM india_ai_providers WHERE provider_id!='mistral' ORDER BY provider_id").all();

test('migration 0028 preserves every provider ciphertext, config and original priority',()=>{
 const db=fixture();
 try{
  const before=snapshot(db);
  db.exec('BEGIN IMMEDIATE');db.exec(upgrade);db.exec('COMMIT');
  assert.deepEqual(snapshot(db),before);
  const m=db.prepare("SELECT * FROM india_ai_providers WHERE provider_id='mistral'").get();
  assert.ok(m);assert.equal(m.enabled,0);assert.equal(m.key_ciphertext,null);
  assert.equal(m.tested_ok,null);assert.equal(m.priority,8);
  assert.equal(db.prepare('SELECT count(*) n FROM india_ai_providers').get().n,7);
  assert.equal(db.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=28').get().n,1);
  assert.equal(db.prepare("SELECT count(*) n FROM india_schema_file_manifest WHERE path='migrations/0028_ai_mistral_provider.sql'").get().n,1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{db.close();}
});

test('dependency guard blocks upgrade without canonical 0027 and rolls back',()=>{
 const db=fixture(0);
 try{
  const before=snapshot(db);
  db.exec('BEGIN IMMEDIATE');
  assert.throws(()=>db.exec(upgrade),/CHECK constraint failed/);
  db.exec('ROLLBACK');
  assert.deepEqual(snapshot(db),before);
  assert.equal(db.prepare('SELECT count(*) n FROM india_schema_migrations WHERE version=28').get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='india_migration_0028_dependency'").get().n,0);
 }finally{db.close();}
});

test('existing fixed-endpoint AI adapter is reused, not an arbitrary URL',()=>{
 const reg=read('src/lib/ai-provider-registry.ts'),vault=read('src/lib/ai-credential-vault.ts');
 assert.match(reg,/id:'mistral'.*mistral-small-latest/);
 assert.equal((vault.match(/mistral:'https:\/\/api\.mistral\.ai\/v1\/chat\/completions'/g)||[]).length,2);
 assert.match(read('src/app/api/ai/config/route.ts'),/ids\.length!==AI_PROVIDERS\.length/);
 assert.ok(!upgrade.includes('api_key_plaintext'));
 assert.ok(!upgrade.includes('migrations/0025_ai_mistral_provider.sql'));
});
