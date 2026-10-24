const {Harness,users,tenant,expect}=require('./sales-flow-harness.cjs');
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
function fixture(maxVersion=Infinity){const h=new Harness(true,true,maxVersion).seed();for(const [k,email] of Object.entries(users))h.sql.prepare('INSERT OR IGNORE INTO india_members(email,role,active) VALUES(?,?,1)').run(email,k==='other'?'sales':k==='admin2'?'admin':k);return h;}
async function upload(h,kind='supporting',role='finance',opp='opp-qa'){
 const library=['supporting','quotation','nda','rks','kak'].includes(kind);const release=library?null:h.release()?.id;
 const q=new URLSearchParams({opportunity_id:opp,kind,filename:kind+'-'+crypto.randomUUID()+'.pdf',...(release?{release_id:release}:{})});
 const route=library?'sales/document-vault':'sales/vault';
 const r=await h.load('src/app/api/'+route+'/route.ts').POST(new Request('https://flow.invalid/api/'+route+'?'+q,{method:'POST',headers:{'x-test-role':role,Origin:'https://flow.invalid'},body:Buffer.from('%PDF-1.7\nQA original '+kind+' '+crypto.randomUUID())}));
 return {status:r.status,body:await r.json()};
}
async function won(h=fixture(),family='VAPT'){
 h.sql.prepare("UPDATE india_sales_opportunities SET data_json=json_set(data_json,'$.service_family',?)").run(family);
 const service=({'SOC/MDR':'SOC','Cybersecurity Governance':'GRC','Cybersecurity Technology':'TECHNOLOGY'})[family]||'VAPT';
 h.sql.prepare("UPDATE india_boq SET service_type=?,line_items_json=json_set(line_items_json,'$[0].service_type',?)").run(service,service);
 await expect(h.flow('scope','presales'),201);
 const proposal=await expect(upload(h,'proposal','sales'),201);
 await expect(h.flow('propose','sales',{proposal_reference:proposal.body.reference,proposal_sha256:proposal.body.sha256}),200);
 await expect(h.flow('approve','approver'),200);
 for(const s of ['solution_design','commercial_review','quotation_sent'])await expect(h.stage(s),200);
 const receipt=await expect(upload(h,'submission','sales'),201);
 const sub=await expect(h.call('sales/submission','POST','sales',{opportunity_id:'opp-qa',channel:'email',recipient_email:'pic@flow.invalid',sent_at:new Date().toISOString(),evidence_reference:receipt.body.reference,evidence_sha256:receipt.body.sha256}),201);
 await expect(h.call('sales/submission','PATCH','finance',{submission_id:sub.body.id,action:'verified',review_notes:'Original submission independently verified'}),200);
 await expect(h.stage('negotiation'),200);
 const decision=await expect(upload(h,'negotiation','sales'),201);
 await expect(h.flow('negotiate','sales',{decision:'approved',amount_before_vat:1000000,evidence_reference:decision.body.reference,evidence_sha256:decision.body.sha256}),201);
 await expect(h.stage('pending_po'),200);
 const po=await expect(upload(h,'po','sales'),201);
 const award=await expect(h.call('sales/award','POST','sales',{opportunity_id:'opp-qa',document_kind:'po',document_number:'QA-PO-01',file_name:po.body.file_name,archive_reference:po.body.reference,original_sha256:po.body.sha256}),201);
 for(const role of ['finance','legal'])await expect(h.call('sales/award','PATCH',role,{document_id:award.body.id,review_kind:role,review_notes:'Original PO scope and amount independently checked'}),200);
 await expect(h.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);
 await expect(h.stage('closed_won'),200);return h;
}
const project=h=>h.sql.prepare("SELECT * FROM india_delivery_projects WHERE opportunity_id='opp-qa'").get();
const contract=h=>h.sql.prepare('SELECT * FROM india_service_contracts').get();
const operation=(h,role,action,p={})=>h.call('sales/service-operations','POST',role,{opportunity_id:'opp-qa',project_version:project(h)?.version,contract_version:contract(h)?.version,action,...p});
async function milestone(h,amount=1000000){const doc=await expect(upload(h),201);const m=await expect(operation(h,'presales','milestone',{title:'Final delivery acceptance',trigger_text:'Signed customer BAST',amount_idr:amount,due_date:today()}),201);await expect(operation(h,'finance','accept_milestone',{id:m.body.id,document_id:doc.body.id}),201);return {id:m.body.id,document:doc.body.id};}
async function invoice(h,amount=1000000){const m=await milestone(h,amount);const i=await expect(operation(h,'finance','invoice',{milestone_id:m.id,document_id:m.document,number:'INV-'+crypto.randomUUID(),issue_date:today(),due_date:today(),amount_idr:amount,vat_idr:110000}),201);await expect(operation(h,'approver','review_invoice',{id:i.body.id,approve:true,notes:'Independent accepted BAST and invoice reconciliation'}),201);return {id:i.body.id,document:m.document};}
async function configure(h,extra={}){return expect(operation(h,'sales','configure_contract',{model:'MRC',start_date:today(),end_date:'2026-12-31',notice_days:90,recurring_monthly_idr:100000,renewal_value_idr:1200000,probability_pct:80,churn_risk:'low',churn_reason:'Customer satisfaction and confirmed service consumption',...extra}),201);}
module.exports={fixture,won,upload,operation,project,contract,milestone,invoice,configure,today,expect,tenant,users};
