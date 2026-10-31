const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {pathToFileURL}=require('node:url');
const root=join(__dirname,'..');
const source=p=>readFileSync(join(root,p),'utf8');
async function options(){return import(pathToFileURL(join(root,'src/lib/scoping-service-options.ts')).href);}

test('scoping supports exactly the categories approved by BoQ validation',async()=>{
 const {SCOPING_SERVICE_TYPES,SCOPING_DEFINITIONS}=await options();
 const boq=source('src/lib/boq-domain.ts');
 const raw=boq.match(/const allowedServiceTypes=new Set\(\[([^\]]+)\]\)/);
 assert.ok(raw,'BoQ whitelist still exists');
 const allowed=[...raw[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 assert.deepEqual([...SCOPING_SERVICE_TYPES].sort(),allowed.sort());
 assert.equal(new Set(SCOPING_SERVICE_TYPES).size,SCOPING_SERVICE_TYPES.length);
 for(const service of SCOPING_SERVICE_TYPES){
  const def=SCOPING_DEFINITIONS[service];
  assert.ok(def?.label&&def.outputUnit);
  if(!['VAPT','SOC'].includes(service)){
   assert.ok(def.fields.length>=4,service+' must have specific fields');
   assert.ok(def.fields.some(f=>f.required));
  }
 }
});

test('required scoped fields validate and non-priced summary uses only actual inputs',async()=>{
 const {SCOPING_DEFINITIONS,validateServiceScope,summarizeServiceScope}=await options();
 for(const [service,def] of Object.entries(SCOPING_DEFINITIONS)){
  if(['VAPT','SOC'].includes(service))continue;
  assert.ok(validateServiceScope(service,{}).length>0);
  const fields=Object.fromEntries(def.fields.map(f=>[f.key,f.kind==='number'?'2':f.kind==='select'?f.options[0]:'Dalam lingkup pelanggan']));
  assert.deepEqual(validateServiceScope(service,fields),[],service);
  const summary=summarizeServiceScope(service,fields);
  assert.ok(summary.includes(def.label)&&summary.length<=900);
  assert.ok(summary.includes('2'));
  assert.ok(!summary.includes('Rp '),'never invent a price');
 }
});

test('scoping drafts reach BoQ for review, not direct approval or D1 writes',()=>{
 const scoping=source('src/app/scoping/page.tsx');
 const boq=source('src/app/boq/page.tsx');
 assert.match(scoping,/SCOPING_SERVICE_TYPES\.map/);
 assert.match(scoping,/validateServiceScope/);
 assert.match(scoping,/sessionStorage\.setItem\('india_scoping_boq_draft_v1'/);
 assert.match(scoping,/router\.push\('\/boq\?from=scoping'\)/);
 assert.match(boq,/sessionStorage\.getItem\('india_scoping_boq_draft_v1'/);
 assert.match(boq,/unit_price:0/);
 assert.match(boq,/Simpan ke D1/);
 assert.match(boq,/\/api\/boq/);
});
