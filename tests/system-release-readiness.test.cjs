const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const file='src/lib/release-readiness.ts';
const compiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={};
vm.runInNewContext(compiled,{exports:exp,require:n=>{throw Error('Unexpected dependency '+n)}},{filename:file});
const {evaluateSchemaReadiness,CANONICAL_MANIFEST_PATHS}=exp;
const ledger=()=>Array.from({length:16},(_,i)=>({version:i+13}));
const manifest=()=>CANONICAL_MANIFEST_PATHS.map(path=>({path}));

test('full canonical ledger/manifest is reconciled, never a production PASS',()=>{
 const x=evaluateSchemaReadiness(ledger(),manifest());
 assert.equal(x.status,'reconciled');
 assert.equal(x.latest_applied_version,28);
 assert.equal(x.required_through_version,28);
 assert.equal(x.missing_versions.length,0);
 assert.equal(x.missing_manifest_paths.length,0);
 assert.match(x.evidence_scope,/independent evidence/);
});

test('production baseline through 0012 is incomplete, no false green',()=>{
 const x=evaluateSchemaReadiness(Array.from({length:10},(_,i)=>({version:i+3})),[]);
 assert.equal(x.status,'incomplete');
 assert.ok(x.missing_versions.includes(27));
 assert.ok(x.missing_versions.includes(28));
 assert.ok(x.missing_manifest_paths.includes('migrations/0028_ai_mistral_provider.sql'));
});

test('noncanonical migration 0025 path collision and orphan manifest are visible',()=>{
 const x=evaluateSchemaReadiness(ledger().filter(v=>v.version!==25),[
   ...manifest(),{path:'migrations/0025_ai_mistral.sql'}
 ]);
 assert.equal(x.status,'incomplete');
 assert.ok(x.missing_versions.includes(25));
 assert.ok(x.conflicting_manifest_paths.includes('migrations/0025_ai_mistral.sql'));
 assert.ok(x.manifest_without_ledger.includes('migrations/0025_vendor_resource_feasibility.sql'));
});

test('string ledger versions from D1 are treated as numbers but cannot spoof non-integers',()=>{
 const rows=ledger().map(v=>({version:String(v.version)}));
 assert.equal(evaluateSchemaReadiness(rows,manifest()).status,'reconciled');
 rows[15].version='28abc';
 assert.ok(evaluateSchemaReadiness(rows,manifest()).missing_versions.includes(28));
});

test('Admin health API uses server-side evaluated evidence and never certifies production',()=>{
 const route=read('src/app/api/admin/system/route.ts');
 const ui=read('src/app/settings/system/page.tsx');
 assert.match(route,/await authorizeBoQ\(req\)/);
 assert.match(route,/evaluateSchemaReadiness\(migrations\.results,manifest\.results\)/);
 assert.match(route,/production_gate:'HOLD'/);
 assert.match(ui,/release_readiness/);
 assert.match(ui,/Bukti UAT Access asli/);
 assert.match(ui,/Backup dan restore mandiri/);
});
