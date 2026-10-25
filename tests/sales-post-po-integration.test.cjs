const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../src/lib');
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const source=fs.readFileSync(path.join(root,name+'.ts'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 cache.set(name,module.exports);
 new Function('require','module','exports',js)(specifier=>{
  if(specifier==='./sales-workflow')return load('sales-workflow');
  if(specifier==='./post-po-documents')return load('post-po-documents');
  throw Error('Unexpected dependency '+specifier);
 },module,module.exports);
 cache.set(name,module.exports);
 return module.exports;
}
const mapper=load('sales-to-post-po'),post=load('post-po-documents'),sales=load('sales-workflow');
const account={id:'uat-client',customer_number:'TEST-ONLY-10',legal_name:'TEST-only customer',created_at:'2026-10-20',fields:{
 business_type:'Layanan Teknologi Informasi',industry:'Teknologi Informasi',employee_band:'100-500',
 company_phone:'02155555555',npwp:'12.345.678.9-012.345',fax:'N/A',
 hq_address:'Test street',hq_province:'DKI Jakarta',hq_postal:'12345',
 billing_same_as_hq:'ya',
 primary_name:'Test Contact',primary_phone:'081234567890',primary_email:'testing@example.test',
 technical_name:'Test Technical',technical_phone:'081234567890',technical_email:'tech@example.test',
 billing_name:'Test Billing',billing_phone:'081234567890',billing_email:'billing@example.test',
 tax_name:'Test Tax',tax_phone:'081234567890',tax_email:'tax@example.test',
 customer_signatory:'Test Director',customer_signatory_title:'Director',
 defender_signatory:'Test Authorized',defender_signatory_title:'Director',
 maker:'Sales Test',reviewer:'Reviewer Test',executor:'PM Test'
}};
const deal={id:'uat-deal',company_id:account.id,company_name:account.legal_name,
 title:'VAPT Test Only',stage:'closed_won',estimated_value:1000000,created_at:'2026-10-20',
 fields:{service_family:'VAPT',po_number:'PO-TEST-10',po_date:'2026-10-20',
 quotation_number:'Q-TEST-10',po_amount_before_vat:'1000000',
 technical_scope:'Two test web applications',technical_specifications:'OWASP grey box',
 scope_quantity:'2 applications',project_site:'Test street',project_province:'DKI Jakarta',
 project_postal:'12345',project_pic_name:'Test PM',project_pic_phone:'081234567890',
 project_pic_email:'pm@example.test',payment_va:'BCA',contract_duration:'30 hari',
 implementation_timeline:'Kick-off then 30 days',scope_reconciliation:'Verified with test PO',
 payment_milestones:JSON.stringify([{label:'Down payment',amount:500000,trigger:'After PO'},
 {label:'Final payment',amount:500000,trigger:'After BAST'}])
 }};
test('reuse V.0426 registration/project data schema with source-grounded CRM values',()=>{
 const packet=mapper.prefillFromSales(account,deal,true,1000000);
 assert.equal(packet.registration.customerId,account.customer_number);
 assert.equal(packet.registration.businessType,'Layanan Teknologi Informasi');
 assert.equal(packet.registration.employeeBand,'100-500');
 assert.equal(packet.registration.billingSameAsHq,true);
 assert.equal(packet.project.poNumber,'PO-TEST-10');
 assert.equal(packet.project.projectPic.name,'Test PM');
 assert.equal(packet.project.projectFeeBeforeVat,1000000);
 assert.equal(packet.project.quotationAmountBeforeVat,1000000);
 assert.equal(packet.project.milestones.length,2);
 assert.equal(packet.project.milestones.reduce((sum,x)=>sum+x.amount,0),1000000);
 assert.equal(packet.project.durationValue,'30');
});
test('CRM does not forge original identity documents, attachment presence, or signatures',()=>{
 const packet=mapper.prefillFromSales(account,deal,true,1000000);
 assert.equal(packet.registration.primaryKtpNumber,'');
 assert.equal(packet.registration.npwpAttachmentConfirmed,false);
 assert.equal(packet.registration.ktpAttachmentConfirmed,false);
 const missing=post.validatePostPoPacket(packet);
 for(const field of ['primaryKtpNumber','npwpAttachmentConfirmed','ktpAttachmentConfirmed'])
  assert.ok(missing.some(x=>x.field===field),'Missing control: '+field);
});
test('PO missing verification and amount mismatch block output generation',()=>{
 const missing=mapper.prefillFromSales(account,deal,false,1000000);
 assert.equal(missing.project.poVerified,false);
 assert.ok(post.validatePostPoPacket(missing).some(x=>x.field==='poVerified'));
 const inconsistent=mapper.prefillFromSales(account,deal,true,999000);
 assert.ok(post.validatePostPoPacket(inconsistent).some(x=>x.field==='quotationAmountBeforeVat'));
});
test('unsupported milestone JSON stays empty and cannot pass readiness',()=>{
 const packet=mapper.prefillFromSales(account,{...deal,fields:{...deal.fields,payment_milestones:'invalid JSON'}},true,1000000);
 assert.deepEqual(packet.project.milestones,[]);
 assert.ok(post.validatePostPoPacket(packet).some(x=>x.field==='milestones'));
});
test('Won stage requires all preceding validation and never depends only on a PO number',()=>{
 const incomplete={...deal,fields:{po_number:'PO-TEST-10',po_date:'2026-10-20',
 po_amount_before_vat:'1000000',scope_reconciliation:'Sample scope confirmed',customer_decision:'approved'}};
 const missing=sales.requiredForStage('closed_won',incomplete,account);
 assert.ok(missing.includes('boq_id'));
 assert.ok(missing.includes('quotation_number'));
 assert.ok(missing.includes('technical_scope'));
 assert.equal(sales.stageTransition('negotiation','closed_won')!==null,true);
});
test('PO verifier identity must differ from the opportunity creator even for admin',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(route,/raw\.created_by\?\.trim\(\)\.toLowerCase\(\)===email\.trim\(\)\.toLowerCase\(\)/);
 assert.match(route,/Segregation of Duties/);
 assert.match(route,/confirmed_documents!==true/);
});

test('Sales can read/change only own deals and customer accounts, Presales is technical-only',()=>{
 const a=load('sales-access');
 assert.equal(a.canReadDeal('sales','sales.one@example.test','sales.one@example.test'),true);
 assert.equal(a.canReadDeal('sales','sales.two@example.test','sales.one@example.test'),false);
 assert.equal(a.canReadDeal('presales','presales@example.test','sales.one@example.test'),true);
 assert.equal(a.canEditAccount('sales','sales.two@example.test','sales.one@example.test'),false);
 assert.equal(a.canEditAccount('admin','admin@example.test','sales.one@example.test'),true);
 assert.equal(a.canChangeStage('approver','approver@example.test','sales.one@example.test'),false);
 assert.equal(a.canChangeStage('sales','sales.one@example.test','sales.one@example.test'),true);
 assert.equal(a.canEditDeal('presales','eng@example.test','sales.one@example.test',
  {technical_scope:'Test scope',methodology:'Grey-box'},false),true);
 assert.equal(a.canEditDeal('presales','eng@example.test','sales.one@example.test',
  {po_number:'PO-FAKE'},false),false);
 assert.equal(a.canEditDeal('presales','eng@example.test','sales.one@example.test',
  {technical_scope:'Test scope'},true),false);
 assert.equal(a.canEditDeal('sales','sales.two@example.test','sales.one@example.test',
  {quotation_number:'fake'},false),false);
});
test('server routes enforce authorization after looking up the Deal, not by trusting sent owner field',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(route,/canReadDeal\(role,email,row\.created_by\)/);
 assert.match(route,/canEditAccount\(role,email,row\.created_by\)/);
 assert.match(route,/canEditDeal\(role,email,row\.created_by/);
 assert.match(route,/canChangeStage\(role,email,row\.created_by\)/);
 assert.match(route,/canReadDeal\(auth\.identity\.role,auth\.identity\.email,raw\.created_by\)/);
});
