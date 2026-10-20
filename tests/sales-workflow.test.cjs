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
