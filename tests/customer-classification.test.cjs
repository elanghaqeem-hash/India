const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const file=p=>readFileSync(join(root,p),'utf8');
const {CUSTOMER_SEGMENTS,CUSTOMER_INDUSTRIES,POPULAR_BUSINESS_TYPES,ALL_BUSINESS_TYPES,businessTypeOptions}=require('../src/lib/customer-classification.ts');
const {ACCOUNT_KEYS,cleanFields}=require('../src/lib/sales-workflow.ts');

test('standard segments include existing Corporate without inventing defaults',()=>{
 assert.ok(CUSTOMER_SEGMENTS.includes('Corporate'));
 assert.ok(CUSTOMER_SEGMENTS.includes('BUMN'));
 assert.ok(CUSTOMER_SEGMENTS.includes('Pemerintah Daerah'));
 assert.equal(new Set(CUSTOMER_SEGMENTS).size,CUSTOMER_SEGMENTS.length);
});
test('all standard sectors have relevant, nonempty activity suggestions',()=>{
 for(const industry of CUSTOMER_INDUSTRIES){
  const options=businessTypeOptions(industry);
  assert.ok(options.length>=3,'No suggestions for '+industry);
  assert.equal(new Set(options).size,options.length,'Repeated activity for '+industry);
 }
 assert.deepEqual(businessTypeOptions('Banking').slice(0,2),['Bank Umum Konvensional','Bank Umum Syariah']);
 assert.ok(businessTypeOptions('Teknologi Informasi').includes('Layanan Teknologi Informasi'));
 assert.deepEqual(businessTypeOptions(''),[...POPULAR_BUSINESS_TYPES]);
});
test('every standardized business activity is searchable across industries and unique',()=>{
 assert.ok(ALL_BUSINESS_TYPES.length>=75,'Cross-industry catalog unexpectedly incomplete');
 assert.equal(new Set(ALL_BUSINESS_TYPES).size,ALL_BUSINESS_TYPES.length);
 assert.ok(ALL_BUSINESS_TYPES.includes('Keamanan Siber'));
 assert.ok(ALL_BUSINESS_TYPES.includes('BPR / BPRS'));
 assert.ok(ALL_BUSINESS_TYPES.includes('Pemerintah Provinsi'));
 assert.deepEqual(businessTypeOptions('Banking',true),ALL_BUSINESS_TYPES);
 assert.ok(businessTypeOptions('Banking',true).includes('Rumah Sakit'));
});

test('legacy segment and custom business activity remain valid D1 account strings',()=>{
 const v=cleanFields({client_tier:'Corporate',industry:'Teknologi Informasi',business_type:'Aktivitas usaha historis'},ACCOUNT_KEYS);
 assert.equal(v.client_tier,'Corporate');
 assert.equal(v.business_type,'Aktivitas usaha historis');
 assert.throws(()=>cleanFields({unexpected_field:'value'},ACCOUNT_KEYS),/Field/);
});
test('pipeline and Lead conversion share dropdowns; no simulated choices sent to D1',()=>{
 const component=file('src/components/sales/StandardCustomerChoice.tsx');
 const pipeline=file('src/app/sales/pipeline/page.tsx');
 const leads=file('src/app/sales/leads/page.tsx');
 assert.match(component,/Lainnya — isi manual/);
 assert.match(component,/value={value}/);
 assert.match(component,/disabled={disabled}/);
 assert.match(component,/aria-label={label}/);
 assert.match(pipeline,/key==='client_tier'\|\|key==='industry'\|\|key==='business_type'/);
 assert.match(leads,/field==='client_tier'\|\|field==='industry'\|\|field==='business_type'/);
 assert.match(component,/field==='industry'\?CUSTOMER_INDUSTRIES/);
 assert.match(component,/type="search"/);
 assert.match(component,/Lihat semua bidang usaha/);
 assert.match(component,/filtered/);
 assert.match(component,/value&&known/);

});
