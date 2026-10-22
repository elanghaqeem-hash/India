const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const source=fs.readFileSync('src/lib/indonesia-postal.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',code)(mod,mod.exports);
const {canonicalPostalFields,fieldPatch,postalRegex}=mod.exports;

const row={
 region_code:'32.73.14.1001',postal_code:'40111',province_code:'32',province_name:'Jawa Barat',
 regency_code:'32.73',regency_name:'Kota Bandung',
 district_code:'32.73.14',district_name:'Sumur Bandung',village_name:'Braga',
 village_kind:'Kelurahan'
};
const db={prepare(statement){
 assert.match(statement,/WHERE region_code=\? AND postal_code=\?/);
 return {bind(village,postal){
  return {first:async()=>village===row.region_code&&postal===row.postal_code?row:null};
 }};
}};

test('postal code must be five numeric digits, retaining leading zeroes',()=>{
 for(const code of ['40111','00123'])assert.equal(postalRegex.test(code),true);
 for(const code of ['4011','401111','12x45','401 1',''])assert.equal(postalRegex.test(code),false);
});
test('full administrative hierarchy persists as canonical reference',async()=>{
 const result=await canonicalPostalFields(db,{hq_postal:'40111',hq_village_code:row.region_code});
 assert.deepEqual(result,fieldPatch(row));
});
test('stale selected village/postal pair is rejected at write time',async()=>{
 await assert.rejects(()=>canonicalPostalFields(db,{hq_postal:'40112',hq_village_code:row.region_code}),/tidak terdaftar/);
});
test('forged region/province names are rejected',async()=>{
 await assert.rejects(()=>canonicalPostalFields(db,{hq_postal:'40111',hq_village_code:row.region_code,hq_province:'DKI Jakarta'}),/tidak konsisten/);
});
test('postal requires an actual village selection',async()=>{
 await assert.rejects(()=>canonicalPostalFields(db,{hq_postal:'40111'}),/Pilih kode pos/);
 await assert.rejects(()=>canonicalPostalFields(db,{hq_postal:'4011',hq_village_code:row.region_code}),/Pilih kode pos/);
});
test('legacy Customer without postal data remains editable',async()=>{
 assert.deepEqual(await canonicalPostalFields(db,{hq_address:'Jl. Merdeka'}),{hq_address:'Jl. Merdeka'});
});
