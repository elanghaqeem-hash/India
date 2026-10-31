const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const source=fs.readFileSync('src/lib/indonesia-postal.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',code)(mod,mod.exports);
const {canonicalPostalFields,fieldPatch,postalRegex,findPostalAreasByCode}=mod.exports;
const area={
 region_code:'32.73.19.1001',postal_code:'40111',province_code:'32',province_name:'Jawa Barat',
 regency_code:'32.73',regency_name:'Kota Bandung',district_code:'32.73.19',
 district_name:'Sumur Bandung',village_name:'Braga',village_kind:'Kelurahan'
};
function referenceDb(mode='normalized'){
 return {prepare(sql){
  if(sql.includes('india_postal_import_state'))return {first:async()=>({source_version:'uat'})};
  if(sql.includes('sqlite_master'))return {first:async()=>mode==='compact'?{name:'india_postal_lookup'}:null};
  if(sql.includes('SELECT 1 AS present FROM india_postal_lookup'))return {first:async()=>({present:1})};
  if(sql.includes('FROM india_postal_lookup WHERE postal_code=?'))
   return {bind(postal){return {first:async()=>postal==='40111'?{areas_json:JSON.stringify([area]),village_count:1}:null}}};
  if(sql.includes('FROM india_postal_areas WHERE postal_code=?'))
   return {bind(postal){return {all:async()=>({results:postal==='40111'?[area]:[]})}}};
  throw Error('Unexpected D1 SQL: '+sql);
 }};
}

test('postal code must be five numeric digits, retaining leading zeroes',()=>{
 for(const code of ['40111','00123'])assert.equal(postalRegex.test(code),true);
 for(const code of ['4011','401111','12x45','401 1',''])assert.equal(postalRegex.test(code),false);
});
for(const mode of ['normalized','compact']){
 test(mode+': selected administrative hierarchy persists canonically',async()=>{
  const result=await canonicalPostalFields(referenceDb(mode),{hq_postal:'40111',hq_village_code:area.region_code});
  assert.deepEqual(result,fieldPatch(area));
 });
 test(mode+': stale postcode+village pairs rejected',async()=>{
  await assert.rejects(()=>canonicalPostalFields(referenceDb(mode),{hq_postal:'40112',hq_village_code:area.region_code}),/tidak terdaftar/);
 });
 test(mode+': forged province is rejected',async()=>{
  await assert.rejects(()=>canonicalPostalFields(referenceDb(mode),{hq_postal:'40111',hq_village_code:area.region_code,hq_province:'DKI Jakarta'}),/tidak konsisten/);
 });
 test(mode+': postcode not found returns empty, never fabricated',async()=>{
  assert.deepEqual(await findPostalAreasByCode(referenceDb(mode),'12345'),[]);
 });
}
test('postal requires actual verified village selection',async()=>{
 await assert.rejects(()=>canonicalPostalFields(referenceDb('compact'),{hq_postal:'40111'}),/Pilih kode pos/);
 await assert.rejects(()=>canonicalPostalFields(referenceDb('compact'),{hq_postal:'4011',hq_village_code:area.region_code}),/Pilih kode pos/);
});
test('legacy customer without postal reference is still editable',async()=>{
 assert.deepEqual(await canonicalPostalFields(referenceDb('compact'),{hq_address:'Jl. Merdeka'}),{hq_address:'Jl. Merdeka'});
});
test('unverified reference fails closed before any query for address',async()=>{
 const db={prepare(sql){
  if(sql.includes('india_postal_import_state'))return {first:async()=>null};
  throw Error('Should not reach postal table while unverified');
 }};
 await assert.rejects(()=>canonicalPostalFields(db,{hq_postal:'40111',hq_village_code:area.region_code}),/belum siap/);
});
test('corrupt compact postal JSON cannot certify customer address',async()=>{
 const db={prepare(sql){
  if(sql.includes('india_postal_import_state'))return {first:async()=>({source_version:'uat'})};
  if(sql.includes('sqlite_master'))return {first:async()=>({name:'india_postal_lookup'})};
  if(sql.includes('SELECT 1 AS present'))return {first:async()=>({present:1})};
  if(sql.includes('FROM india_postal_lookup'))return {bind(){return {first:async()=>({areas_json:JSON.stringify([{...area,postal_code:'99999'}]),village_count:1})}}};
  throw Error('Unexpected query '+sql);
 }};
 await assert.rejects(()=>findPostalAreasByCode(db,'40111'),/tidak konsisten/);
});

test('suggestion input accepts postcode prefixes or searchable administrative names safely',()=>{
 const {validPostalSearchQuery}=mod.exports;
 for(const q of ['00','40111','Braga','Jakarta Timur'])assert.equal(validPostalSearchQuery(q),true,q);
 for(const q of ['1','Ja','%x','_xx','a'.repeat(51)])assert.equal(validPostalSearchQuery(q),false,q);
});
for(const mode of ['normalized','compact']){
 test(mode+': autocomplete returns unique canonical postal options by postcode and wilayah',async()=>{
  const db={prepare(sql){
   if(sql.includes('india_postal_import_state'))return {first:async()=>({source_version:'uat'})};
   if(sql.includes('sqlite_master'))return {first:async()=>mode==='compact'?{name:'india_postal_lookup'}:null};
   if(sql.includes('SELECT 1 AS present FROM india_postal_lookup'))return {first:async()=>({present:1})};
   if(sql.includes('FROM india_postal_lookup')){
    return {bind(param){return {all:async()=>({results:param==='401%'||param==='%Braga%'?
     [{postal_code:'40111',areas_json:JSON.stringify([area])}]:[]})}}};
   }
   if(sql.includes('FROM india_postal_areas')){
    return {bind(...params){return {all:async()=>({results:params[0]==='401%'||params[0]==='%Braga%'?
     [area,{...area,region_code:'other'}]:[]})}}};
   }
   throw Error('Unexpected D1 SQL: '+sql);
  }};
  const {searchPostalSuggestions}=mod.exports;
  for(const q of ['401','Braga']){
   const options=await searchPostalSuggestions(db,q);
   assert.deepEqual(options,[{postal_code:'40111',description:'Kelurahan Braga · Sumur Bandung · Kota Bandung · Jawa Barat'}]);
  }
 });
}
test('postcode suggestion search fails closed when reference not ready',async()=>{
 const {searchPostalSuggestions}=mod.exports;
 const db={prepare(sql){
  if(sql.includes('india_postal_import_state'))return {first:async()=>null};
  throw Error('Should not search unverified reference');
 }};
 await assert.rejects(()=>searchPostalSuggestions(db,'Braga'),/belum siap/);
});
test('postal customer UI exposes searchable picker while retaining village validation',()=>{
 const ui=fs.readFileSync('src/components/sales/PostalAddressFields.tsx','utf8');
 assert.match(ui,/Pilih kode pos terstandar/);
 assert.ok(ui.includes('/api/reference/postal?q='));
 assert.match(ui,/hq_postal:option.postal_code/);
 assert.match(ui,/villageSelect/);
});
