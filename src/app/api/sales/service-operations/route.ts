import {openDocument,type VaultDoc} from '@/lib/document-vault';
import {prerequisites} from '@/lib/service-workflow';
import {authorizeBoQ,privateHeaders,type D1Prepared} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,txt,jakartaDate,financialSum,periodOK} from '@/lib/operations';
import {validISODate} from '@/lib/lead-intelligence';
import {accessibleDeal,getProject,publicProject,financeRole,supportingOriginal,projectWrite,check,cents,cashSummary,renewalState,ServiceError,validatedParameters,type Contract,type Invoice} from '@/lib/service-operations';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const roles=['admin','sales','presales','finance','approver','legal'];
const error=(e:unknown)=>e instanceof ServiceError?fail(e.message,e.status):fail(/constraint|DELIVERY_CONFLICT|FLOW_CONFLICT/i.test(String(e))?'Versi, batas nilai, review atau keterkaitan transaksi berubah; muat ulang.':'Operasi belum tersedia. Periksa migrasi 0027 dan integritas Vault.',/constraint|DELIVERY_CONFLICT|FLOW_CONFLICT/i.test(String(e))?409:503);
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 if(!roles.includes(role))return fail('Akses delivery/cash/renewal ditolak',403);
 const u=new URL(req.url),id=u.searchParams.get('opportunity_id');
 if(!id&&u.searchParams.get('view')==='renewals'){
  try{const rows=await db.prepare("SELECT c.*,p.opportunity_id,p.title,a.customer_number,a.legal_name FROM india_service_contracts c JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id JOIN india_sales_opportunities d ON d.id=p.opportunity_id AND d.tenant_id=p.tenant_id JOIN india_sales_accounts a ON a.id=c.customer_id AND a.tenant_id=c.tenant_id WHERE c.tenant_id=? AND (?!='sales' OR lower(d.created_by)=?) ORDER BY c.end_date LIMIT 501").bind(TENANT,role,email).all<Contract>();
   const items=rows.results.slice(0,500).map(c=>renewalState(c));return reply({success:true,role,identityEmail:email,items,truncated:rows.results.length>500,mrr_idr:financialSum(items.map(c=>c.mrr_idr)),weighted_renewal_90d_idr:financialSum(items.filter(c=>c.days_to_expiry!==null&&c.days_to_expiry>=0&&c.days_to_expiry<=90).map(c=>c.weighted_renewal_idr))});
  }catch(e){return error(e);}
 }
 if(!safeID(id))return fail('Pilih Opportunity');
 try{
  const d=await accessibleDeal(a.identity,id),p=await getProject(db,id);
  if(!p)return reply({success:true,role,identityEmail:email,deal:{id:d.id,title:d.title,stage:d.stage,flow_version:d.flow_version},project:null,tasks:[],milestones:[],invoices:[],payments:[],contract:null});
  const [tasks,milestones,invoices,payments,c,assignments,revenues,links,cost]=await Promise.all([
   db.prepare('SELECT * FROM india_delivery_tasks WHERE tenant_id=? AND project_id=? ORDER BY period,code').bind(TENANT,p.id).all(),
   db.prepare('SELECT * FROM india_delivery_milestones WHERE tenant_id=? AND project_id=? ORDER BY rowid').bind(TENANT,p.id).all(),
   db.prepare("SELECT i.*,coalesce((SELECT sum(t.amount_cents) FROM india_billing_payments t WHERE t.invoice_id=i.id AND t.tenant_id=i.tenant_id AND t.status='approved'),0) AS paid_cents FROM india_billing_invoices i WHERE i.tenant_id=? AND i.project_id=? ORDER BY i.issue_date DESC,i.rowid DESC").bind(TENANT,p.id).all<Invoice>(),
   db.prepare('SELECT t.* FROM india_billing_payments t JOIN india_billing_invoices i ON i.id=t.invoice_id AND i.tenant_id=t.tenant_id WHERE i.tenant_id=? AND i.project_id=? ORDER BY t.rowid DESC').bind(TENANT,p.id).all(),
   db.prepare('SELECT * FROM india_service_contracts WHERE tenant_id=? AND project_id=?').bind(TENANT,p.id).first<Contract>(),
   ['admin','presales'].includes(role)?db.prepare("SELECT email,role FROM india_members WHERE active=1 AND role IN ('presales','admin') ORDER BY email LIMIT 200").all():{results:[]},
   db.prepare("SELECT r.id,r.amount_before_vat,r.recognition_date,r.invoice_reference,r.reversal_of FROM india_sales_revenue r WHERE r.tenant_id=? AND r.opportunity_id=? AND r.status='approved'").bind(TENANT,d.id).all<{id:string;amount_before_vat:number}>(),
   db.prepare('SELECT l.* FROM india_invoice_revenue_links l JOIN india_billing_invoices i ON i.id=l.invoice_id WHERE i.tenant_id=? AND i.project_id=?').bind(TENANT,p.id).all(),
   financeRole(role)?db.prepare("SELECT amount_idr,reverses_id FROM india_actual_costs WHERE tenant_id=? AND opportunity_id=? AND status='approved'").bind(TENANT,d.id).all<{amount_idr:number;reverses_id:string|null}>():null
  ]);
  const recognized=financialSum(revenues.results.map(x=>x.amount_before_vat));
  const costs=cost?financialSum(cost.results.map(x=>x.reverses_id?-x.amount_idr:x.amount_idr)):null;
  return reply({success:true,role,identityEmail:email,deal:{id:d.id,title:d.title,stage:d.stage,flow_version:d.flow_version},project:publicProject(p,role),tasks:tasks.results,milestones:milestones.results,invoices:invoices.results,payments:payments.results,contract:c?renewalState(c):null,assignments:assignments.results,revenue_entries:revenues.results,revenue_links:links.results,cash:cashSummary(invoices.results),recognized_revenue_idr:recognized,...(costs===null?{}:{actual_cost_idr:costs,provisional_profit_idr:financialSum([recognized,-costs]),profitability_status:'Provisional; closing seluruh biaya belum disertifikasi'})});
 }catch(e){return error(e);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 if(!roles.includes(role))return fail('Akses ditolak',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let v:Record<string,unknown>;try{v=await readBoundedJSON(req,15000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 if(!safeID(v.opportunity_id))return fail('Opportunity wajib');
 try{
  const d=await accessibleDeal(a.identity,v.opportunity_id);check(d.stage==='closed_won','Delivery memerlukan Closed Won dengan PO tervalidasi',409);
  const action=txt(v.action,40),p=await getProject(db,d.id);
  if(action==='handover'){
   check(['admin','presales'].includes(role),'Pembuatan draft untuk Won lama hanya Admin/Presales',403);
   if(p)return reply({success:true,id:p.id,already_exists:true});
   const source=await db.prepare('SELECT release_id FROM india_delivery_source WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<{release_id:string}>();check(source,'Won lama memerlukan rekonsiliasi paket approved dan PO',409);
   const originals=await db.prepare('SELECT * FROM india_document_vault WHERE tenant_id=? AND opportunity_id=? AND release_id=?').bind(TENANT,d.id,source.release_id).all<VaultDoc>();
   check(['proposal','submission','negotiation'].every(k=>originals.results.some(x=>x.kind===k))&&originals.results.some(x=>['po','spk'].includes(x.kind)),'Original paket Won lama belum lengkap; rekonsiliasi Vault terlebih dahulu',409);
   for(const doc of originals.results)await openDocument(db,doc);
   await atomicSales(db,"EXISTS(SELECT 1 FROM india_sales_opportunities WHERE tenant_id=? AND id=? AND flow_version=? AND stage='closed_won')",[TENANT,d.id,d.flow_version],[db.prepare('INSERT INTO india_delivery_projects(id,tenant_id,opportunity_id,customer_id,release_id,po_number,title,service_family,baseline_json,budget_json,contract_cents,created_by) SELECT * FROM india_delivery_source WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id),operationEvent(db,'delivery',d.id,'HANDOVER_REQUEST',email,{opportunity_id:d.id})]);
   check(await getProject(db,d.id),'Paket approved/PO lama perlu direkonsiliasi; draft tidak dibuat',409);return reply({success:true},201);
  }
  check(p,'Draft proyek belum tersedia',409);check(v.project_version===p.version,'Versi proyek berubah; muat ulang',409);
  const writes:D1Prepared[]=[],id=crypto.randomUUID();
  const technical=['admin','presales'].includes(role),financial=financeRole(role),reviewer=['admin','finance','approver'].includes(role);
  if(action==='assign'){
   check(technical,'Assignment hanya Admin/Presales',403);check(p.status==='draft','Assignment baseline hanya pada draft',409);
   check(typeof v.pm_email==='string'&&validISODate(v.start_date)&&validISODate(v.end_date)&&v.start_date<=v.end_date&&Number(v.end_date.slice(0,4))*12+Number(v.end_date.slice(5,7))-(Number(v.start_date.slice(0,4))*12+Number(v.start_date.slice(5,7)))<60,'PM dan periode proyek wajib valid');
   check(await db.prepare("SELECT email FROM india_members WHERE email=? AND active=1 AND role IN ('presales','admin')").bind(v.pm_email.toLowerCase()).first(),'PM harus anggota delivery aktif (Presales/Admin)',409);
   // No extra version bump: projectWrite owns CAS/version.
   writes.push(db.prepare('UPDATE india_delivery_projects SET pm_email=?,start_date=?,end_date=?,version=version+1 WHERE id=? AND tenant_id=?').bind(v.pm_email.toLowerCase(),v.start_date,v.end_date,p.id,TENANT));
   await atomicSales(db,'EXISTS(SELECT 1 FROM india_delivery_projects WHERE tenant_id=? AND id=? AND version=?)',[TENANT,p.id,p.version],[...writes,operationEvent(db,'delivery',p.id,'ASSIGN',email,{pm_email:v.pm_email,start_date:v.start_date,end_date:v.end_date})]);return reply({success:true});
  }else if(action==='task'){
   check(technical,'Workflow layanan hanya Admin/Presales',403);check(p.status!=='completed','Proyek sudah selesai',409);check(safeID(v.id)&&txt(v.detail,2000).length>=12&&validISODate(v.due_date),'Task, parameter/evidence dan deadline wajib');
   const task=await db.prepare('SELECT code,status FROM india_delivery_tasks WHERE id=? AND tenant_id=? AND project_id=?').bind(v.id as string,TENANT,p.id).first<{code:string;status:string}>();check(task&&task.status==='pending','Task sudah selesai/tidak tersedia',409);
   check(v.complete===true||v.complete===false,'Keputusan complete wajib');
   let doc:string|null=null;
   const params=validatedParameters(task.code,v.parameters);
   if(v.complete){
    for(const required of prerequisites[task.code]||[]){const done=await db.prepare("SELECT id FROM india_delivery_tasks WHERE tenant_id=? AND project_id=? AND code=? AND status='done'").bind(TENANT,p.id,required).first();check(done,'Selesaikan tahap '+required+' lebih dahulu',409);}
    check(safeID(v.document_id),'Dokumen supporting wajib untuk menyelesaikan task');await supportingOriginal(db,v.document_id,d.id);doc=v.document_id;}
   writes.push(db.prepare('UPDATE india_delivery_tasks SET detail=?,due_date=?,status=?,document_id=?,completed_by=? WHERE id=? AND tenant_id=? AND project_id=?').bind(JSON.stringify({notes:txt(v.detail,2000),parameters:params}),v.due_date,v.complete?'done':'pending',doc,v.complete?email:null,v.id as string,TENANT,p.id));
  }else if(action==='monthly_report'){
   check(technical,'Monthly report hanya Admin/Presales',403);check(p.service_family==='SOC/MDR'&&periodOK(v.period),'Monthly report memerlukan SOC/MDR dan periode valid');
   check(p.start_date&&p.end_date&&v.period>=p.start_date.slice(0,7)&&v.period<=p.end_date.slice(0,7),'Periode harus di dalam jadwal proyek',409);
   writes.push(db.prepare("INSERT INTO india_delivery_tasks(id,tenant_id,project_id,code,title,period) VALUES(?,?,?,'soc_report','Monthly service report',?)").bind(id,TENANT,p.id,v.period));
  }else if(action==='activate'||action==='complete'){
   check(technical,'Status proyek hanya Admin/Presales',403);
   if(action==='activate'){
    check(p.status==='draft'&&p.pm_email&&p.start_date&&p.end_date,'Assignment dan jadwal proyek wajib',409);
    const gaps=await db.prepare("SELECT id FROM india_delivery_tasks WHERE tenant_id=? AND project_id=? AND code LIKE 'kickoff_%' AND status!='done'").bind(TENANT,p.id).all();check(!gaps.results.length,'Kickoff checklist belum lengkap',409);
   }else{
    check(p.status==='active','Proyek harus aktif',409);
    const gap=await db.prepare("SELECT id FROM india_delivery_tasks WHERE tenant_id=? AND project_id=? AND status!='done'").bind(TENANT,p.id).first();check(!gap,'Workflow layanan belum selesai',409);
    if(p.service_family==='SOC/MDR'){
     const count=await db.prepare("SELECT count(*) n FROM india_delivery_tasks WHERE tenant_id=? AND project_id=? AND code='soc_report' AND period!='' AND status='done'").bind(TENANT,p.id).first<{n:number}>();
     const months=(Number(p.end_date!.slice(0,4))-Number(p.start_date!.slice(0,4)))*12+Number(p.end_date!.slice(5,7))-Number(p.start_date!.slice(5,7))+1;check(count?.n===months,'Laporan SOC seluruh bulan kontrak wajib selesai',409);
    }
   }
   writes.push(db.prepare('UPDATE india_delivery_projects SET status=?,version=version+1 WHERE tenant_id=? AND id=?').bind(action==='activate'?'active':'completed',TENANT,p.id));
   await atomicSales(db,'EXISTS(SELECT 1 FROM india_delivery_projects WHERE tenant_id=? AND id=? AND version=?)',[TENANT,p.id,p.version],[...writes,operationEvent(db,'delivery',p.id,action.toUpperCase(),email,{})]);return reply({success:true});
  }else if(action==='milestone'||action==='edit_milestone'){
   check(technical||financial,'Milestone hanya Admin/Presales/Finance',403);const amount=cents(v.amount_idr);check(amount&&amount<=p.contract_cents&&txt(v.title,240).length>=3&&txt(v.trigger_text,1000).length>=3&&validISODate(v.due_date),'Milestone, trigger, tanggal dan nilai wajib');
   const existing=action==='edit_milestone'&&safeID(v.id)?await db.prepare("SELECT id FROM india_delivery_milestones WHERE tenant_id=? AND project_id=? AND id=? AND status='draft'").bind(TENANT,p.id,v.id).first<{id:string}>():null;check(action!=='edit_milestone'||existing,'Pilih milestone draft',409);
   const total=await db.prepare('SELECT coalesce(sum(amount_cents),0) total FROM india_delivery_milestones WHERE tenant_id=? AND project_id=? AND id!=?').bind(TENANT,p.id,existing?.id||'').first<{total:number}>();check((total?.total||0)+amount<=p.contract_cents,'Jumlah milestone melampaui PO',409);
   if(existing)writes.push(db.prepare('UPDATE india_delivery_milestones SET title=?,trigger_text=?,amount_cents=?,due_date=?,created_by=? WHERE tenant_id=? AND id=?').bind(txt(v.title,240),txt(v.trigger_text,1000),amount,v.due_date,email,TENANT,existing.id));
   else writes.push(db.prepare('INSERT INTO india_delivery_milestones(id,tenant_id,project_id,title,trigger_text,amount_cents,due_date,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,TENANT,p.id,txt(v.title,240),txt(v.trigger_text,1000),amount,v.due_date,email));
  }else if(action==='accept_milestone'){
   check(technical||financial,'Review BAST hanya Admin/Presales/Finance',403);check(safeID(v.id)&&safeID(v.document_id),'Milestone dan dokumen BAST Vault wajib');await supportingOriginal(db,v.document_id,d.id);
   const m=await db.prepare('SELECT * FROM india_delivery_milestones WHERE tenant_id=? AND project_id=? AND id=?').bind(TENANT,p.id,v.id).first<{status:string;created_by:string;amount_cents:number}>();check(m&&m.status==='draft'&&m.amount_cents>0,'Milestone tidak valid',409);check(m.created_by.toLowerCase()!==email,'Reviewer BAST harus berbeda dari maker',403);
   writes.push(db.prepare("UPDATE india_delivery_milestones SET status='accepted',document_id=?,accepted_by=? WHERE tenant_id=? AND id=?").bind(v.document_id,email,TENANT,v.id));
  }else if(action==='invoice'){
   check(financial,'Invoice hanya Finance/Admin',403);const amount=cents(v.amount_idr),vat=v.vat_idr===0?0:cents(v.vat_idr);
   check(amount&&vat!==null&&safeID(v.milestone_id)&&safeID(v.document_id)&&txt(v.number,100).length>=3&&validISODate(v.issue_date)&&v.issue_date<=jakartaDate()&&validISODate(v.due_date)&&v.due_date>=v.issue_date,'Data invoice, PPN, jatuh tempo dan original wajib valid');
   check(await db.prepare("SELECT id FROM india_delivery_milestones WHERE id=? AND project_id=? AND tenant_id=? AND status='accepted'").bind(v.milestone_id,p.id,TENANT).first(),'BAST milestone belum diterima',409);await supportingOriginal(db,v.document_id,d.id);
   writes.push(db.prepare('INSERT INTO india_billing_invoices(id,tenant_id,project_id,milestone_id,number,issue_date,due_date,amount_cents,vat_cents,document_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,p.id,v.milestone_id,txt(v.number,100),v.issue_date,v.due_date,amount,vat,v.document_id,email));
  }else if(action==='payment'){
   check(financial,'Pembayaran hanya Finance/Admin',403);check(safeID(v.invoice_id)&&safeID(v.document_id)&&validISODate(v.payment_date)&&v.payment_date<=jakartaDate()&&txt(v.reference,150).length>=3,'Invoice, tanggal, referensi bank dan original wajib');
   const inv=await db.prepare("SELECT * FROM india_billing_invoices WHERE tenant_id=? AND project_id=? AND id=? AND status='approved'").bind(TENANT,p.id,v.invoice_id).first<Invoice>();check(inv&&v.payment_date>=inv.issue_date,'Invoice approved dan tanggal pembayaran valid wajib',409);await supportingOriginal(db,v.document_id,d.id);
   let amount=cents(v.amount_idr),reverse:string|null=null;
   if(v.reversal_of){check(safeID(v.reversal_of),'ID reversal tidak valid');const src=await db.prepare("SELECT * FROM india_billing_payments WHERE tenant_id=? AND id=? AND invoice_id=? AND status='approved' AND reversal_of IS NULL").bind(TENANT,v.reversal_of,v.invoice_id).first<{amount_cents:number;payment_date:string}>();check(src&&v.payment_date>=src.payment_date,'Sumber reversal tidak valid',409);amount=-src.amount_cents;reverse=v.reversal_of;}
   check(amount,'Jumlah pembayaran valid wajib');writes.push(db.prepare('INSERT INTO india_billing_payments(id,tenant_id,invoice_id,reference,payment_date,amount_cents,document_id,reversal_of,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,TENANT,v.invoice_id,txt(v.reference,150),v.payment_date,amount,v.document_id,reverse,email));
  }else if(action==='review_invoice'||action==='review_payment'){
   check(reviewer,'Review keuangan hanya Finance/Approver/Admin',403);check(safeID(v.id)&&typeof v.approve==='boolean'&&txt(v.notes,1500).length>=12,'ID, keputusan dan alasan review wajib');
   const invoice=action==='review_invoice',table=invoice?'india_billing_invoices':'india_billing_payments';
   const row=await db.prepare(invoice?'SELECT i.* FROM india_billing_invoices i WHERE i.tenant_id=? AND i.id=? AND i.project_id=?':'SELECT t.* FROM india_billing_payments t JOIN india_billing_invoices i ON i.id=t.invoice_id AND i.tenant_id=t.tenant_id WHERE t.tenant_id=? AND t.id=? AND i.project_id=?').bind(TENANT,v.id,p.id).first<{status:string;created_by:string;document_id:string}>();
   check(row&&row.status==='draft','Entri tidak tersedia/sudah direview',409);check(row.created_by.toLowerCase()!==email,'Maker tidak boleh review sendiri',403);await supportingOriginal(db,row.document_id,d.id);
   writes.push(db.prepare('UPDATE '+table+' SET status=?,reviewed_by=?,review_notes=? WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,txt(v.notes,1500),TENANT,v.id));
  }else if(action==='link_revenue'){
   check(financial,'Rekonsiliasi GL hanya Finance/Admin',403);check(safeID(v.invoice_id)&&safeID(v.revenue_id),'Invoice dan revenue approved wajib');
   const inv=await db.prepare("SELECT * FROM india_billing_invoices WHERE tenant_id=? AND id=? AND project_id=? AND status='approved'").bind(TENANT,v.invoice_id,p.id).first<Invoice>();
   const rev=await db.prepare("SELECT * FROM india_sales_revenue WHERE tenant_id=? AND id=? AND opportunity_id=? AND status='approved' AND reversal_of IS NULL").bind(TENANT,v.revenue_id,d.id).first<{amount_before_vat:number;invoice_reference:string}>();
   check(inv&&rev&&rev.invoice_reference===inv.number,'Nomor invoice dan revenue approved tidak cocok',409);
   const linked=await db.prepare('SELECT coalesce(sum(r.amount_before_vat),0) total FROM india_invoice_revenue_links l JOIN india_sales_revenue r ON r.id=l.revenue_id WHERE l.invoice_id=?').bind(inv.id).first<{total:number}>();check(Math.round(((linked?.total||0)+rev.amount_before_vat)*100)<=inv.amount_cents,'Alokasi revenue melampaui invoice',409);
   writes.push(db.prepare('INSERT INTO india_invoice_revenue_links(invoice_id,revenue_id,created_by) VALUES(?,?,?)').bind(inv.id,v.revenue_id,email));
  }else if(action==='configure_contract'||action==='approve_contract'||action==='churn'||action==='risk'||action==='create_follow_on'){
   const c=await db.prepare('SELECT * FROM india_service_contracts WHERE tenant_id=? AND project_id=?').bind(TENANT,p.id).first<Contract>();check(c&&v.contract_version===c.version,'Versi kontrak berubah',409);
   if(action==='configure_contract'){
    check(financial||role==='sales','Konfigurasi kontrak hanya Sales/Finance/Admin',403);check(c.status==='draft','Kontrak approved tidak dapat ditimpa',409);
    const renewal=cents(v.renewal_value_idr),recurring=v.recurring_monthly_idr===0?0:cents(v.recurring_monthly_idr);
    check(['OTC','MRC','managed_service','license','retainer','FlexGuard'].includes(String(v.model))&&validISODate(v.start_date)&&validISODate(v.end_date)&&v.start_date<=v.end_date&&Number.isInteger(v.notice_days)&&Number(v.notice_days)>=1&&Number(v.notice_days)<=365&&recurring!==null&&recurring<=p.contract_cents&&renewal&&Number.isInteger(v.probability_pct)&&Number(v.probability_pct)>=0&&Number(v.probability_pct)<=100&&['low','medium','high'].includes(String(v.churn_risk))&&txt(v.churn_reason,1500).length>=12,'Model, periode, notice, nilai renewal, MRR dan risiko churn wajib valid');
    check(v.model!=='OTC'||recurring===0,'Kontrak OTC memiliki MRR nol');
    writes.push(db.prepare('UPDATE india_service_contracts SET model=?,start_date=?,end_date=?,notice_days=?,recurring_cents=?,renewal_cents=?,probability_pct=?,churn_risk=?,churn_reason=?,configured_by=?,version=version+1 WHERE tenant_id=? AND id=?').bind(String(v.model),v.start_date,v.end_date,Number(v.notice_days),recurring,renewal,Number(v.probability_pct),String(v.churn_risk),txt(v.churn_reason,1500),email,TENANT,c.id));
   }else if(action==='approve_contract'){
    check(reviewer,'Approval kontrak hanya Finance/Approver/Admin',403);check(c.status==='draft'&&c.configured_by&&c.end_date&&c.renewal_cents,'Lengkapi konfigurasi kontrak',409);check(c.configured_by!==email,'Maker kontrak tidak boleh review sendiri',403);check(txt(v.notes,1500).length>=12,'Catatan review wajib');
    writes.push(db.prepare("UPDATE india_service_contracts SET status='active',approved_by=?,version=version+1 WHERE tenant_id=? AND id=?").bind(email,TENANT,c.id));
   }else if(action==='risk'){
    check(financial||role==='sales','Risiko churn hanya Sales/Finance/Admin',403);check(c.status==='active'&&['low','medium','high'].includes(String(v.churn_risk))&&txt(v.notes,1500).length>=12,'Kontrak aktif dan penilaian risiko wajib',409);
    writes.push(db.prepare('UPDATE india_service_contracts SET churn_risk=?,churn_reason=?,version=version+1 WHERE tenant_id=? AND id=?').bind(String(v.churn_risk),txt(v.notes,1500),TENANT,c.id));
   }else if(action==='churn'){
    check(financial||role==='sales','Keputusan churn hanya Sales/Finance/Admin',403);check(c.status==='active'&&txt(v.notes,1500).length>=12,'Kontrak aktif dan alasan churn wajib',409);
    writes.push(db.prepare("UPDATE india_service_contracts SET status='churned',churn_risk='high',churn_reason=?,version=version+1 WHERE tenant_id=? AND id=?").bind(txt(v.notes,1500),TENANT,c.id));
   }else{
    check(['admin','sales'].includes(role),'Follow-on Opportunity hanya Sales/Admin',403);check(c.status==='active'&&['renewal','expansion'].includes(String(v.kind))&&c.renewal_cents&&validISODate(v.expected_closing_date)&&v.expected_closing_date>=jakartaDate(),'Kontrak aktif, tipe dan target closing wajib',409);
    const owner=role==='sales'?email:d.created_by;
    check(await db.prepare("SELECT email FROM india_members WHERE email=? AND role='sales' AND active=1").bind(owner).first(),'Owner Sales sumber tidak aktif; perbaiki penugasan',409);
    const source=JSON.parse(d.data_json) as Record<string,string>,fields={lead_source:'Customer '+String(v.kind),sales_owner:owner,service_family:source.service_family||p.service_family,contract_model:source.contract_model||'Recurring',expected_closing_date:v.expected_closing_date,client_need:txt(v.notes,1500)||'Follow-on dari kontrak '+c.id};
    const value=v.kind==='renewal'?c.renewal_cents:cents(v.expansion_value_idr);check(value&&value>=100,'Nilai ekspansi wajib valid');
    writes.push(db.prepare("INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,data_json,created_by) VALUES(?,?,?,?,'prospecting',?,?,?)").bind(id,TENANT,d.company_id,(v.kind==='renewal'?'Renewal · ':'Expansion · ')+d.title,Math.round(value/100),JSON.stringify(fields),owner));
    writes.push(db.prepare('INSERT INTO india_opportunity_relations(id,tenant_id,source_id,target_id,kind,contract_id,created_by) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,d.id,id,String(v.kind),c.id,email));
   }
  }else return fail('Aksi tidak dikenal');
  // Project version serializes all financial and renewal mutations, including cross-row cap checks.
  await projectWrite(a.identity,d,p,v.project_version,action.toUpperCase(),{...v},writes);return reply({success:true,id},201);
 }catch(e){return error(e);}
}
