// INDIA UAT multirole simulation: domain/role/doc gates, never a Cloudflare Access login substitute.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),JSZip=require('jszip');
const root=path.join(__dirname,'../src/lib');
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const src=fs.readFileSync(path.join(root,name+'.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};cache.set(name,mod.exports);
 new Function('require','module','exports',js)(x=>{
  if(x==='./sales-workflow')return load('sales-workflow');
  if(x==='./boq-domain')return load('boq-domain');
  if(x==='./post-po-documents')return load('post-po-documents');
  if(x==='jszip')return require('jszip');
  throw Error('Unknown test dependency: '+x);
 },mod,mod.exports);
 cache.set(name,mod.exports);return mod.exports;
}
const crm=load('sales-workflow'),access=load('sales-access'),boq=load('boq-domain'),approval=load('boq-workflow'),
 quotation=load('quotation-docx'),map=load('sales-to-post-po'),post=load('post-po-documents'),loss=load('sales-loss-report');
const users={salesA:'uat.sales.a@india.invalid',salesB:'uat.sales.b@india.invalid',
 presales:'uat.presales@india.invalid',finance:'uat.finance@india.invalid',
 approver:'uat.approver@india.invalid',admin:'uat.admin@india.invalid',viewer:'uat.viewer@india.invalid'};
const account={id:'uat-cust-won-20261020',legal_name:'PT UAT Cyber Won DATA SIMULASI',
 customer_number:'IND-UAT-1001',created_at:'2026-10-20',created_by:users.salesA,fields:{
 industry:'Teknologi Informasi',business_type:'Layanan Teknologi Informasi',employee_band:'100-500',
 company_phone:'08000000000',hq_address:'Alamat UAT nonfisik',hq_province:'DKI Jakarta',hq_postal:'12345',
 billing_same_as_hq:'ya',primary_name:'PIC UAT A',primary_phone:'08000000000',primary_email:users.salesA,
 technical_name:'PIC UAT Tech',technical_phone:'08000000000',technical_email:users.presales,
 billing_name:'PIC UAT Finance',billing_phone:'08000000000',billing_email:users.finance,
 tax_name:'PIC UAT Tax',tax_phone:'08000000000',tax_email:users.finance,npwp:'',fax:'N/A',
 customer_signatory:'UAT Signer',customer_signatory_title:'Director',
 defender_signatory:'UAT Signer',defender_signatory_title:'Sales Manager',
 maker:'UAT Maker',reviewer:'UAT Reviewer',executor:'UAT Executor'
 }};
const lines=[
 {description:'UAT VAPT Web Application 1',service_type:'VAPT',quantity:1,unit:'Aplikasi',unit_price:70000000},
 {description:'UAT VAPT Web Application 2',service_type:'VAPT',quantity:1,unit:'Aplikasi',unit_price:50000000}
];
const costs=[
 {code:'A',amount:40000000},{code:'B',amount:10000000},{code:'C',amount:5000000},
 {code:'D',amount:12000000},{code:'E',amount:8000000}
];
const deal={id:'uat-opp-won-20261020',company_id:account.id,company_name:account.legal_name,
 title:'VAPT Web UAT Multirole',stage:'prospecting',estimated_value:120000000,created_at:'2026-10-20',
 created_by:users.salesA,fields:{
 lead_source:'Referral UAT',sales_owner:users.salesA,expected_closing_date:'2026-11-15',
 service_family:'VAPT',contract_model:'One-Time',client_need:'Uji keamanan dua aplikasi simulasi',
 budget_status:'Tersedia - UAT',decision_maker:'UAT Sponsor',procurement_process:'Simulasi tender',
 discovery_notes:'Kebutuhan 2 aplikasi UAT telah disepakati',
 technical_scope:'Penetration testing dua web aplikasi sintetis',
 technical_specifications:'OWASP WSTG grey-box di lingkungan UAT',scope_quantity:'2 aplikasi',
 deliverables:'2 laporan dan 1 retest simulasi',delivery_model:'Remote',resourcing_model:'Shared',
 project_site:'Lokasi nonfisik UAT',project_province:'DKI Jakarta',project_postal:'12345',
 project_pic_name:'PIC UAT',project_pic_phone:'08000000000',project_pic_email:users.presales,
 boq_id:'uat-boq-won-20261020',implementation_timeline:'30 hari simulasi',contract_duration:'30 hari',
 costing_notes:'HPP A-E dihitung pada BoQ UAT oleh Finance',quotation_number:'UAT-QUOTE-001',
 quotation_sent_at:'2026-10-20',quotation_valid_days:'30',quotation_valid_until:'2026-11-19',
 quotation_sender_name:'Sales A UAT',quotation_sender_title:'Account Manager',
 next_action:'Konfirmasi penerimaan PO UAT',next_action_at:'2026-10-25',
 negotiation_notes:'Scope dan harga sama dengan quotation UAT',customer_decision:'approved',
 po_number:'UAT-PO-001',po_date:'2026-10-20',po_reference:'Bukti UAT-PO-001 simulasi',
 po_amount_before_vat:'120000000',scope_reconciliation:'Scope, nilai dan termin UAT sesuai BoQ approved',
 payment_terms:'50-50',payment_va:'BCA',payment_milestones:JSON.stringify([
 {label:'Termin Pertama UAT',amount:60000000,trigger:'Setelah PO'},
 {label:'Termin Akhir UAT',amount:60000000,trigger:'Setelah BAST'}]),
 methodology:'OWASP WSTG',exclusions:'Di luar dua aplikasi',team_composition:'UAT tester dan technical writer',
 asset_profile:'2 web applications',service_level:'Laporan akhir 30 hari kerja'
 }};
const makeProposal=()=>({
 id:'uat-boq-won-20261020',opportunity_id:deal.id,opportunity_name:deal.title,
 company_id:account.id,company_name:account.legal_name,quotation_number:'UAT-QUOTE-001',
 version:1,status:'approved',subtotal:120000000,vat_amount:13200000,grand_total:133200000,
 discount_pct:0,payment_terms:'50-50',valid_days:30,valid_until:'2026-11-19',client_tier:'A',
 selected_price_range:'standard',created_by:users.salesA,created_at:'2026-10-20',
 line_items:lines.map((x,i)=>({line_number:i+1,...x,line_total:x.quantity*x.unit_price}))
});
test('01 seven roles have no implicit viewer cost/write privilege',()=>{
 assert.equal(Object.keys(users).length,7);
 assert.equal(boq.can('viewer','create'),false);
 assert.equal(boq.can('viewer','approve'),false);
 assert.equal(boq.can('viewer','read_cost'),false);
 assert.equal(boq.can('finance','read_cost'),true);
 assert.equal(boq.can('sales','read_cost'),false);
 assert.equal(boq.can('presales','edit_cost'),false);
});
test('02 owner isolation: Sales B cannot edit Sales A; Admin can',()=>{
 assert.equal(access.canReadDeal('sales',users.salesB,users.salesA),false);
 assert.equal(access.canEditAccount('sales',users.salesB,users.salesA),false);
 assert.equal(access.canChangeStage('sales',users.salesB,users.salesA),false);
 assert.equal(access.canChangeStage('admin',users.admin,users.salesA),true);
 assert.equal(access.canEditDeal('sales',users.salesA,users.salesA,{quotation_number:'TEST'},true),true);
});
test('03 Presales may edit scoping and writer, but not PO, price, stages',()=>{
 assert.equal(access.canEditDeal('presales',users.presales,users.salesA,
 {technical_scope:'test',asset_profile:'2 applications',team_composition:'QA writer'},false),true);
 for(const forbidden of ['po_number','po_amount_before_vat','costing_notes','quotation_number','customer_decision'])
  assert.equal(access.canEditDeal('presales',users.presales,users.salesA,{[forbidden]:'tamper'},false),false);
 assert.equal(access.canChangeStage('presales',users.presales,users.salesA),false);
});
test('04 all stages follow strict sequential gate and required data',()=>{
 const order=['prospecting','qualified','discovery','solution_design','commercial_review',
 'quotation_sent','negotiation','pending_po','closed_won'];
 assert.deepEqual(crm.validateAccount(account),[]);
 assert.deepEqual(crm.requiredForStage('closed_won',deal,account),[]);
 for(let i=1;i<order.length;i++)assert.equal(crm.stageTransition(order[i-1],order[i]),null,'valid '+order[i]);
 assert.match(crm.stageTransition('prospecting','pending_po'),/bertahap/);
 assert.match(crm.stageTransition('negotiation','closed_won'),/Pending PO/);
 assert.match(crm.stageTransition('closed_won','negotiation'),/terkunci/);
 assert.ok(crm.requiredForStage('closed_won',{...deal,fields:{...deal.fields,po_number:''}},account).includes('po_number'));
});
test('05 BoQ costs and tax exactly reconcile with the approved quotation',()=>{
 const p=boq.validateBoQ({customer_name:account.legal_name,project_name:deal.title,
 quotation_number:'UAT-QUOTE-001',service_type:'VAPT',vat_rate:.11,payment_terms:'50-50',
 opportunity_id:deal.id,line_items:lines,cost_items:costs});
 const x=boq.boqTotals(p.line_items,p.cost_items,p.vat_rate);
 assert.equal(x.subtotal,120000000);assert.equal(x.vat_amount,13200000);
 assert.equal(x.grand_total,133200000);assert.equal(x.hpp,75000000);assert.equal(x.margin,37.5);
});
test('06 Maker submits but cannot approve own BoQ; independent Approver can',()=>{
 const r={status:'draft',created_by:users.salesA,line_items:lines,cost_items:costs,vat_rate:.11};
 assert.equal(approval.checkTransition('submit',r,{role:'sales',email:users.salesA}).note,'SUBMITTED');
 assert.throws(()=>approval.checkTransition('approve',{...r,status:'submitted'},{role:'admin',email:users.salesA}),/Segregation/);
 assert.equal(approval.checkTransition('approve',{...r,status:'submitted'},
 {role:'approver',email:users.approver}).note,'APPROVED');
 assert.throws(()=>approval.checkTransition('approve',{...r,status:'draft'},
 {role:'approver',email:users.approver}));
});
test('07 quote is a real valid Word file, not an approval/signature',async()=>{
 const bytes=quotation.createQuotationDocx(makeProposal(),'vapt',{
 signatoryName:'Sales A UAT',signatoryTitle:'Account Manager',
 methodology:deal.fields.methodology,scope:deal.fields.technical_scope,
 assets:deal.fields.asset_profile,team:deal.fields.team_composition,
 quotationDate:deal.fields.quotation_sent_at
 });
 const z=await JSZip.loadAsync(bytes),xml=await z.file('word/document.xml').async('string');
 assert.match(xml,/UAT-QUOTE-001/);
 assert.match(xml,/120\.000\.000/);assert.match(xml,/133\.200\.000/);
 assert.match(xml,/Sales A UAT/);assert.match(xml,/DRAFT UNTUK VERIFIKASI/);
 assert.doesNotMatch(xml,/Maria Hayu Utaminingtyas/);
});
test('08 Finance PO checker must differ from Sales maker; Won is gated',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(api,/raw\.created_by\?\.trim\(\)\.toLowerCase\(\)===email\.trim\(\)\.toLowerCase\(\)/);
 assert.match(api,/confirmed_documents!==true/);
 assert.match(api,/Math\.abs\(n-check\.subtotal\)>0\.01/);
 assert.match(api,/india_sales_po_checks/);
 assert.equal(users.finance===users.salesA,false);
 assert.ok(crm.requiredForStage('closed_won',{...deal,fields:{...deal.fields,customer_decision:'pending'}},account).includes('customer_decision (harus approved)'));
});
test('09 Post-PO maps the same PO and milestones but blocks absent KTP/attachments',()=>{
 const v=map.prefillFromSales({...account}, {...deal,stage:'closed_won'},true,120000000);
 assert.equal(v.project.poNumber,'UAT-PO-001');
 assert.equal(v.project.projectFeeBeforeVat,120000000);
 assert.equal(v.project.milestones.reduce((n,x)=>n+x.amount,0),120000000);
 assert.equal(v.registration.primaryKtpNumber,'');
 assert.equal(v.registration.npwpAttachmentConfirmed,false);
 assert.equal(v.registration.ktpAttachmentConfirmed,false);
 const findings=post.validatePostPoPacket(v);
 for(const name of ['primaryKtpNumber','ktpAttachmentConfirmed','npwpAttachmentConfirmed'])
  assert.ok(findings.some(x=>x.field===name),'Must detect missing '+name);
 assert.equal(post.isReadyForKickoff(v),false);
});
test('10 Lost can occur at prospecting with clear reason and make unsigned report',async()=>{
 const lost={...deal,id:'uat-opp-lost-20261020',stage:'closed_lost',created_by:users.salesB,
 fields:{lost_reason:'Kebutuhan ditunda',lost_notes:'Pelanggan simulasi menunda pembelian karena perubahan prioritas',sales_owner:users.salesB}};
 assert.equal(crm.stageTransition('prospecting','closed_lost'),null);
 assert.deepEqual(crm.requiredForStage('closed_lost',lost,account),[]);
 const bytes=await loss.createLossReportDocx(lost,account,'2026-10-20');
 const z=await JSZip.loadAsync(bytes),xml=await z.file('word/document.xml').async('string');
 assert.match(xml,/Kebutuhan ditunda/);assert.match(xml,/BELUM DISETUJUI/);
});
test('11 default AI chain must reject untested providers; does not generate false AI audit',()=>{
 const code=fs.readFileSync(path.join(root,'ai-credential-vault.ts'),'utf8');
 assert.match(code,/row\.tested_ok===1/);
 const assist=fs.readFileSync(path.join(__dirname,'../src/app/api/ai/assist/route.ts'),'utf8');
 assert.match(assist,/confirmed!==true/);
 assert.match(assist,/requiresReview:true/);
 assert.match(assist,/Batas maksimal 20/);
});
test('12 UAT D1 isolated Sales table fixes historical stage and user foreign-key defects',()=>{
 const migration=fs.readFileSync(path.join(__dirname,'../migrations/0004_india_sales_isolation.sql'),'utf8');
 assert.match(migration,/CREATE TABLE IF NOT EXISTS india_sales_accounts/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS india_sales_opportunities/);
 assert.match(migration,/discovery.*solution_design.*commercial_review.*quotation_sent/);
 const api=fs.readFileSync(path.join(__dirname,'../src/app/api/sales/route.ts'),'utf8');
 assert.match(api,/INTO india_sales_opportunities/);
 assert.match(api,/INTO india_sales_accounts/);
 assert.doesNotMatch(api,/FROM opportunities /);
});
