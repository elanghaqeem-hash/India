import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {atomicSales,dealGuard,salesAudit,transactionError,type FlowDeal} from '@/lib/sales-transactions';
import {tenderReady} from '@/lib/tender-readiness';
import {buildBidReport,matrixCSV,checklistCSV,reportCSV,validDeadline,shaValid,checklistCategories,milestoneKinds,
 type Bid,type Requirement,type Clause,type Deadline,type Checklist} from '@/lib/bid-readiness';
export const dynamic='force-dynamic';
const roles=['admin','sales','presales','finance','approver'];
const reply=(v:unknown,s=200)=>Response.json(v,{status:s,headers:privateHeaders});
const fail=(message:string,s=400)=>reply({success:false,message},s);
const string=(x:unknown,max=400)=>typeof x==='string'&&x.length<=max?x.trim():'';
const iso=(x:unknown)=>typeof x==='string'&&validDeadline(x);
type Row={id:string;version:number;created_by:string;status:string;category?:string;document_name?:string;evidence_reference?:string;evidence_sha256?:string;due_at?:string;milestone?:string};
async function snapshot(db:import('@/lib/boq-auth').D1DB,id:string){
 const [bid,requirements,clauses,checklist,deadlines]=await Promise.all([
  db.prepare('SELECT channel,bid_decision,decided_by,tender_number,tender_deadline FROM india_sales_bids WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first<Bid>(),
  db.prepare("SELECT id,kind,title,status,compliance_status,file_reference,source_content_hash,reviewed_by FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=? AND kind IN ('rks','kak','rfp','rfq') ORDER BY created_at").bind(TENANT,id).all<Requirement>(),
  db.prepare('SELECT id,requirement_id,clause_reference,category,mandatory,requirement_text,response_text,status,compliance_status,is_gap,evidence_reference,evidence_sha256,reviewed_by FROM india_tender_compliance_gaps WHERE tenant_id=? AND opportunity_id=? ORDER BY requirement_id,clause_reference').bind(TENANT,id).all<Clause>(),
  db.prepare('SELECT * FROM india_tender_checklist WHERE tenant_id=? AND opportunity_id=? ORDER BY category,item_code LIMIT 250').bind(TENANT,id).all<Checklist>(),
  db.prepare('SELECT * FROM india_tender_deadlines WHERE tenant_id=? AND opportunity_id=? ORDER BY due_at LIMIT 20').bind(TENANT,id).all<Deadline>()
 ]);
 return {bid,requirements:requirements.results,clauses:clauses.results,checklist:checklist.results,deadlines:deadlines.results};
}
async function context(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return {error:a.response};
 const {db,email,role}=a.identity;
 if(!roles.includes(role))return {error:fail('Role tidak berhak mengakses paket penawaran',403)};
 const id=new URL(req.url).searchParams.get('opportunity_id')||'';
 if(!safeID(id))return {error:fail('Opportunity ID tidak valid',422)};
 const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
 if(!d)return {error:fail('Opportunity tidak ditemukan',404)};
 if(!canReadDeal(role,email,d.created_by))return {error:fail('Opportunity bukan milik Sales Anda',403)};
 return {db,email,role,id,d};
}
export async function GET(req:Request){
 try{
  const c=await context(req);if(c.error)return c.error;
  const {db,id,d,role,email}=c as Required<Pick<typeof c,'db'|'id'|'d'|'role'|'email'>>;
  const data=await snapshot(db,id),report=buildBidReport(data.bid,data.requirements,data.clauses,data.checklist,data.deadlines);
  // The SQL predicate is the authoritative concurrency-safe release gate.
  const sqlReady=await tenderReady(db,id);
  report.ready=report.ready&&sqlReady;
  if(!sqlReady&&!report.gaps.length)report.gaps.push('Kontrol SQL atas paket penawaran masih menolak rilis.');
  const output=new URL(req.url).searchParams.get('output');
  if(output){
   if(!['matrix','checklist','report'].includes(output))return fail('Jenis output tidak dikenal',422);
   const csv=output==='matrix'?matrixCSV(data.clauses,data.requirements):output==='checklist'?checklistCSV(data.checklist):reportCSV(report,id,d.title);
   return new Response(csv,{status:200,headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8',
    'Content-Disposition':'attachment; filename="india-'+output+'-'+id+'.csv"'}});
  }
  return reply({success:true,role,identityEmail:email,deal:{id,title:d.title,stage:d.stage,flow_version:d.flow_version},
   ...data,report,sqlReady});
 }catch{return fail('Bid Readiness belum tersedia. Pastikan migrasi 0016 dan 0021 terpasang.',503);}
}
export async function POST(req:Request){
 try{
  const a=await authorizeBoQ(req);if(!a.ok)return a.response;
  const {db,email,role}=a.identity;
  if(!roles.includes(role))return fail('Akses transaksi ditolak',403);
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
  let p:Record<string,unknown>;
  try{p=await readBoundedJSON(req,16000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
  if(!safeID(p.opportunity_id)||!Number.isSafeInteger(p.flow_version))return fail('Opportunity dan versi wajib',422);
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,p.opportunity_id as string).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);
  if(!canReadDeal(role,email,d.created_by))return fail('Opportunity bukan milik Sales Anda',403);
  if(d.flow_version!==p.flow_version)return fail('Opportunity berubah, muat ulang',409);
  if(!['prospecting','qualified','discovery','solution_design'].includes(d.stage))return fail('Revisi tender hanya pada tahapan Solution Design atau sebelumnya',409);
  const action=string(p.action,40),id=crypto.randomUUID(),g=dealGuard(d),writes=[];
  if(['deadline','revise_deadline'].includes(action)){
   if(!['admin','sales','presales'].includes(role))return fail('Hanya Sales/Presales/Admin membuat jadwal',403);
   const kind=string(p.milestone,40),due=string(p.due_at,40),notes=string(p.notes,1000);
   if(!milestoneKinds.includes(kind as typeof milestoneKinds[number])||!iso(due)||notes.length<5)return fail('Milestone, timestamp ISO dengan zona waktu, dan catatan wajib',422);
   if(action==='deadline'){
    writes.push(db.prepare('INSERT INTO india_tender_deadlines(id,tenant_id,opportunity_id,milestone,due_at,notes,created_by) VALUES (?,?,?,?,?,?,?)')
     .bind(id,TENANT,d.id,kind,due,notes,email));
   }else{
    if(!safeID(p.id)||!Number.isSafeInteger(p.version))return fail('Versi deadline diperlukan',422);
    const old=await db.prepare('SELECT * FROM india_tender_deadlines WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,p.id as string).first<Row>();
    if(!old||old.version!==p.version||old.milestone!==kind)return fail('Versi deadline berubah atau jenis milestone tidak cocok',409);
    g.condition+=' AND EXISTS(SELECT 1 FROM india_tender_deadlines WHERE id=? AND version=?)';g.args.push(old.id,old.version);
    writes.push(db.prepare("UPDATE india_tender_deadlines SET due_at=?,notes=?,created_by=?,status='draft',reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL,version=version+1 WHERE id=?")
     .bind(due,notes,email,old.id));
   }
  }else if(['item','revise_item'].includes(action)){
   if(!['admin','sales','presales'].includes(role))return fail('Hanya Sales/Presales/Admin membuat checklist',403);
   const code=string(p.item_code,50),category=string(p.category,30),label=string(p.label,250),
    document=string(p.document_name,180),ref=string(p.evidence_reference,400),hash=string(p.evidence_sha256,64).toLowerCase(),
    source=string(p.source_clause_id,80),due=string(p.due_at,40);
   if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,49}$/.test(code)||!checklistCategories.includes(category as typeof checklistCategories[number])||label.length<5
    ||typeof p.mandatory!=='boolean'||(hash&&!shaValid(hash))||(due&&!iso(due))||(source&&!safeID(source)))
    return fail('Kode unik, kategori, mandatory, detail dokumen dan format evidence harus valid',422);
   if(source){
    const clause=await db.prepare('SELECT id FROM india_tender_compliance_items WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,source).first();
    if(!clause)return fail('Klausul evidence bukan milik Opportunity',409);
   }
   if(action==='item'){
    writes.push(db.prepare('INSERT INTO india_tender_checklist(id,tenant_id,opportunity_id,item_code,category,label,mandatory,document_name,evidence_reference,evidence_sha256,source_clause_id,due_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
     .bind(id,TENANT,d.id,code,category,label,p.mandatory?1:0,document,ref,hash,source||null,due||null,email));
   }else{
    if(!safeID(p.id)||!Number.isSafeInteger(p.version))return fail('ID/version checklist wajib',422);
    const old=await db.prepare('SELECT * FROM india_tender_checklist WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,p.id as string).first<Row>();
    if(!old||old.version!==p.version)return fail('Checklist versi lama, muat ulang',409);
    g.condition+=' AND EXISTS(SELECT 1 FROM india_tender_checklist WHERE id=? AND version=?)';g.args.push(old.id,old.version);
    writes.push(db.prepare("UPDATE india_tender_checklist SET item_code=?,category=?,label=?,mandatory=?,document_name=?,evidence_reference=?,evidence_sha256=?,source_clause_id=?,due_at=?,created_by=?,status='draft',checked_by=NULL,checked_at=NULL,review_notes=NULL,version=version+1 WHERE id=?")
     .bind(code,category,label,p.mandatory?1:0,document,ref,hash,source||null,due||null,email,old.id));
   }
  }else if(['review_deadline','review_item'].includes(action)){
   if(!safeID(p.id)||!Number.isSafeInteger(p.version)||typeof p.approve!=='boolean'||string(p.review_notes,1000).length<12)
    return fail('ID, versi, keputusan dan catatan review minimal 12 karakter wajib',422);
   const isDeadline=action==='review_deadline',table=isDeadline?'india_tender_deadlines':'india_tender_checklist';
   const row=await db.prepare('SELECT * FROM '+table+' WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,p.id as string).first<Row>();
   if(!row)return fail('Data review tidak tersedia',404);
   if(row.version!==p.version||row.status!=='draft')return fail('Item sudah direview atau berubah versinya',409);
   if(row.created_by.toLowerCase()===email.toLowerCase())return fail('Pembuat tidak boleh melakukan review sendiri',403);
   const reviewRoles=isDeadline?['admin','approver']:row.category==='technical'?['admin','presales']:['admin','finance','approver'];
   if(!reviewRoles.includes(role))return fail('Reviewer tidak memiliki kewenangan kategori ini',403);
   if(isDeadline&&row.milestone==='submission'&&p.approve&&Date.parse(row.due_at!)<=Date.now())
    return fail('Tidak dapat mengesahkan deadline submission yang sudah lewat',409);
   if(!isDeadline&&p.approve&&(!row.document_name||!row.evidence_reference||row.evidence_reference.length<8||!shaValid(row.evidence_sha256||'')||(row.due_at&&Date.parse(row.due_at)<=Date.now())))
    return fail('Nama file, referensi, SHA-256 dan tenggat dokumen harus valid sebelum ready',409);
   g.condition+=' AND EXISTS(SELECT 1 FROM '+table+" WHERE id=? AND version=? AND status='draft')";g.args.push(row.id,row.version);
   if(isDeadline){
    writes.push(db.prepare("UPDATE india_tender_deadlines SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?")
     .bind(p.approve?'approved':'rejected',email,string(p.review_notes,1000),row.id));
   }else{
    writes.push(db.prepare("UPDATE india_tender_checklist SET status=?,version=version+1,checked_by=?,review_notes=?,checked_at=CURRENT_TIMESTAMP WHERE id=?")
     .bind(p.approve?'ready':'rejected',email,string(p.review_notes,1000),row.id));
   }
  }else return fail('Aksi Bid Readiness tidak terdaftar',422);
  writes.push(salesAudit(db,d.id,'BID_READINESS_'+action.toUpperCase(),email,string(p.item_code,50)||string(p.milestone,40)||string(p.review_notes,100)));
  try{await atomicSales(db,g.condition,g.args,writes);}
  catch(e){
   const t=transactionError(e);
   return fail(/UNIQUE|READINESS_CONFLICT|FLOW_CONFLICT|constraint/i.test(String(e))?'Benturan versi, kode checklist duplikat atau paket belum memenuhi persyaratan.':t.message,
    /UNIQUE|READINESS_CONFLICT|FLOW_CONFLICT|constraint/i.test(String(e))?409:t.status);
  }
  return reply({success:true,id,status:'saved'},201);
 }catch{return fail('Transaksi Bid Readiness gagal. Periksa migrasi 0021 dan koneksi D1.',503);}
}