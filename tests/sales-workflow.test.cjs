const test=require('node:test');
const assert=require('node:assert/strict');
const {stageTransition,requiredForStage,validateAccount,cleanFields,ACCOUNT_KEYS,documentChecklist,stageProbability}=require('../src/lib/sales-workflow.ts');
const account={id:'c1',legal_name:'PT Contoh Uji',customer_number:'IND-X',created_at:'',fields:{
 business_type:'Layanan Teknologi Informasi',industry:'Teknologi Informasi',employee_band:'100-500',
 company_phone:'02112345678',hq_address:'Lokasi uji',hq_province:'DKI Jakarta',hq_postal:'12345',
 primary_name:'PIC Uji',primary_phone:'+6281212345678',primary_email:'pic@example.test',
 billing_same_as_hq:'ya'
}};
const deal={id:'op1',company_id:'c1',company_name:'PT Contoh Uji',title:'Proyek Uji',
 stage:'prospecting',estimated_value:1000000,created_at:'',fields:{
 lead_source:'Referral',sales_owner:'Sales',expected_closing_date:'2026-11-30',service_family:'VAPT',
 client_need:'VAPT',budget_status:'Budget tersedia',decision_maker:'Direktur',
 procurement_process:'Tender'
}};
test('qualified requires verified account essentials and BANT',()=>{
 assert.deepEqual(validateAccount(account),[]);
 assert.deepEqual(requiredForStage('qualified',deal,account),[]);
 assert.ok(requiredForStage('qualified',{...deal,fields:{...deal.fields,decision_maker:''}},account).includes('decision_maker'));
 assert.ok(requiredForStage('qualified',deal,{...account,fields:{...account.fields,primary_email:'bad'}}).includes('pelanggan.primary_email (format)'));
});
test('no stage-skipping or Won from negotiation',()=>{
 assert.match(stageTransition('prospecting','quotation_sent'),/bertahap/);
 assert.match(stageTransition('negotiation','closed_won'),/Pending PO/);
 assert.equal(stageTransition('pending_po','closed_won'),null);
 assert.match(stageTransition('closed_won','negotiation'),/terkunci/);
 assert.equal(stageProbability('closed_lost'),0);
});
test('Won fields and PO reconciliation mandatory',()=>{
 const missing=requiredForStage('closed_won',deal,account);
 assert.ok(missing.includes('po_number'));
 assert.ok(missing.includes('po_date'));
 assert.ok(missing.includes('po_amount_before_vat'));
});
test('cannot inject uncontrolled workflow fields',()=>{
 assert.throws(()=>cleanFields({po_verified_by:'fake-finance'},ACCOUNT_KEYS),/Field/);
 assert.equal(cleanFields({fax:'N\/A'},ACCOUNT_KEYS).fax,'N/A');
});
test('document checklist never assumes KTP or evidence',()=>{
 const check=documentChecklist(deal,account);
 assert.ok(check.registration.some(x=>x.includes('primaryKtpNumber')));
 assert.ok(check.registration.some(x=>x.includes('npwpAttachmentConfirmed')));
 assert.ok(check.project.includes('po_number'));
});

test('Closed Lost may capture an unqualified early loss without fabricated customer details',()=>{
 const partial={...account,fields:{industry:'Teknologi Informasi'}};
 const lost={...deal,fields:{lost_reason:'Tidak sesuai prioritas',lost_notes:'Pelanggan membatalkan inisiatif ini.'}};
 assert.deepEqual(requiredForStage('closed_lost',lost,partial),[]);
 assert.equal(stageTransition('prospecting','closed_lost'),null);
});
test('Won requires explicit customer approval, not merely filled PO fields',()=>{
 const filled={...deal,fields:{...deal.fields,po_number:'PO-123',po_date:'2026-10-20',po_reference:'Dokumen PO-123',
 po_amount_before_vat:'1000000',scope_reconciliation:'Scope sesuai penawaran',customer_decision:'pending'}};
 assert.ok(requiredForStage('closed_won',filled,account).includes('customer_decision (harus approved)'));
});
test('authenticated D1 Sales and AI URLs are allowlisted; legacy demo APIs remain blocked',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const middleware=fs.readFileSync(path.join(__dirname,'../src/middleware.ts'),'utf8');
 assert.match(middleware, /'\/api\/sales'/);
 assert.match(middleware, /path\.startsWith\('\/api\/sales\/'\)/);
 assert.match(middleware, /'\/api\/ai\/assist'/);
 assert.match(middleware, /'\/api\/partners'/);
 assert.match(middleware, /'\/api\/reports'/);
 assert.match(middleware, /'\/api\/admin\/system'/);
 assert.match(middleware,/API demo nonpersisten dinonaktifkan/);
});
test('quotation export requires approved D1 BoQ linked to same account and opportunity',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/quotation/route.ts'),'utf8');
 assert.match(source,/createQuotationDocx/);
 assert.match(source,/boq\.status!=='approved'/);
 assert.match(source,/opportunity_id=\?/);
 assert.match(source,/quotation_valid_days/);
});

test('billing Ya reuses headquarters street, province and postal without re-entry',()=>{
 const {synchronizeBillingAddress}=require('../src/lib/sales-workflow.ts');
 const fields={hq_address:'Jl. Raya Cipedak 1',hq_province:'DKI Jakarta',hq_postal:'12630',
  hq_village:'Cipedak',hq_district:'Jagakarsa',hq_regency:'Kota Jakarta Selatan',
  billing_same_as_hq:'ya',billing_address:'OLD',billing_province:'OLD',billing_postal:'00000'};
 const result=synchronizeBillingAddress(fields);
 assert.equal(result.billing_address,'Jl. Raya Cipedak 1');
 assert.equal(result.billing_province,'DKI Jakarta');
 assert.equal(result.billing_postal,'12630');
 assert.equal(fields.billing_address,'OLD','must not mutate input fields');
});
test('billing Ya stays synchronized as headquarters address changes',()=>{
 const {updateCustomerAddressFields}=require('../src/lib/sales-workflow.ts');
 const start={hq_address:'Jl Lama',hq_province:'DKI Jakarta',hq_postal:'12630',billing_same_as_hq:'ya'};
 const newStreet=updateCustomerAddressFields(start,{hq_address:'Jl Baru'});
 assert.equal(newStreet.billing_address,'Jl Baru');
 const newRegion=updateCustomerAddressFields(newStreet,{hq_province:'Jawa Barat',hq_postal:'16411'});
 assert.equal(newRegion.billing_province,'Jawa Barat');
 assert.equal(newRegion.billing_postal,'16411');
});
test('billing Tidak has editable separate address and switching from Ya removes stale mirror',()=>{
 const {updateCustomerAddressFields,synchronizeBillingAddress}=require('../src/lib/sales-workflow.ts');
 const mirrored=updateCustomerAddressFields({hq_address:'Jl Kantor',hq_province:'DKI Jakarta',hq_postal:'12630',billing_same_as_hq:'ya'},{});
 const separate=updateCustomerAddressFields(mirrored,{billing_same_as_hq:'tidak'});
 assert.equal(separate.billing_address,'');
 assert.equal(separate.billing_province,'');
 assert.equal(separate.billing_postal,'');
 const edited=updateCustomerAddressFields(separate,{billing_address:'Jl Tagihan 2',billing_province:'Banten',billing_postal:'15111'});
 assert.deepEqual([edited.billing_address,edited.billing_province,edited.billing_postal],['Jl Tagihan 2','Banten','15111']);
 assert.deepEqual(synchronizeBillingAddress(edited),edited);
});
test('customer form hides redundant billing inputs only when Ya and backend persists canonical values',()=>{
 const fs=require('node:fs');
 const ui=fs.readFileSync('src/app/sales/pipeline/page.tsx','utf8');
 const api=fs.readFileSync('src/app/api/sales/route.ts','utf8');
 assert.match(ui,/values\.billing_same_as_hq==='ya'&&billingAddressKeys\.has\(key\)/);
 assert.match(ui,/Alamat penagihan otomatis mengikuti kantor pusat/);
 assert.match(ui,/updateCustomerAddressFields\(f,patch\)/);
 assert.equal((api.match(/fields=synchronizeBillingAddress\(await canonicalPostalFields/g)||[]).length,2);
});
