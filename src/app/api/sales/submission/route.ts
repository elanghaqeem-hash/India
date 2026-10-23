import {requireVaultDocument,vaultError} from '@/lib/document-vault';
import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {safeID,TENANT,emailValid,dateValid} from '@/lib/sales-workflow';
import {sha256Valid,verifySubmissionRights,type Submission} from '@/lib/sales-submission';
import {atomicSales,currentRelease,dealGuard,salesAudit,transactionError,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const resp=(x:unknown,s=200)=>Response.json(x,{status:s,headers:privateHeaders});
const err=(message:string,s=400)=>resp({success:false,message},s);
type DealRow=FlowDeal & {id:string;company_id:string;title:string;stage:string;created_by:string;data_json:string};
type BoqRow={id:string;opportunity_id:string|null;version:number;quotation_number:string;status:string;customer_name:string;project_name:string};
const origin=(r:Request)=>!r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin;
const canSee=(role:string,email:string,owner:string)=>role!=='sales'||email.toLowerCase()===owner.toLowerCase();
const allowed=['admin','sales','finance','approver','presales'];
async function deal(db:D1DB,id:string){return db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<DealRow>();}
async function read(req:Request){const s=await req.text();if(s.length>10000)throw Error('Payload terlalu besar');
 const obj=JSON.parse(s) as Record<string,unknown>;if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error('Payload invalid');return obj;}
async function audit(db:D1DB,opp:string,action:string,actor:string,detail:string){await db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,'deal',opp,action,actor,detail.slice(0,300)).run();}
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!allowed.includes(role))return err('Role tidak diizinkan',403);
 const id=new URL(req.url).searchParams.get('opportunity_id')||'';
 if(!safeID(id))return err('ID opportunity tidak valid');
 try{const d=await deal(db,id);if(!d)return err('Opportunity tidak tersedia',404);
  if(!canSee(role,email,d.created_by))return err('Data Sales bukan milik akun Anda',403);
  const rows=await db.prepare('SELECT id,boq_id,quotation_number,boq_version,recipient_email,channel,sent_at,evidence_reference,evidence_sha256,status,created_by,verified_by,review_notes,created_at FROM india_sales_submissions WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 60')
   .bind(TENANT,id).all();
  return resp({success:true,role,submissions:rows.results,quotation_number:JSON.parse(d.data_json||'{}').quotation_number||''});
 }catch{return err('Schema submission belum siap; jalankan migrasi 0007',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['admin','sales'].includes(role))return err('Pencatatan pengiriman hanya oleh Sales atau Admin',403);
 if(!origin(req))return err('Origin ditolak',403);
 let p:Record<string,unknown>;
 try{p=await read(req);}catch{return err('Payload JSON tidak valid');}
 const id=String(p.opportunity_id||'');
 if(!safeID(id))return err('Opportunity ID wajib');
 try{
  const d=await deal(db,id);if(!d)return err('Opportunity tidak tersedia',404);
  if(!canSee(role,email,d.created_by))return err('Hanya Sales pemilik Opportunity',403);
  if(!['quotation_sent','negotiation','pending_po'].includes(d.stage))return err('Quotations dapat dicatat setelah tahap Quotation Sent, sebelum Closed Won',409);
  const f=JSON.parse(d.data_json||'{}') as Record<string,string>;
  const boq=await db.prepare('SELECT id,opportunity_id,version,quotation_number,status,customer_name,project_name FROM india_boq WHERE tenant_id=? AND id=?').bind(TENANT,f.boq_id||'').first<BoqRow>();
  if(!boq||boq.status!=='approved'||boq.opportunity_id!==d.id||f.quotation_number!==boq.quotation_number)
   return err('Approved BoQ dan quotation number harus cocok Opportunity',409);
  const acc=await db.prepare('SELECT legal_name FROM india_sales_accounts WHERE tenant_id=? AND id=?')
   .bind(TENANT,d.company_id).first<{legal_name:string}>();
  if(!acc||acc.legal_name.trim().toLowerCase()!==boq.customer_name.trim().toLowerCase()||
     d.title.trim().toLowerCase()!==boq.project_name.trim().toLowerCase())return err('Pelanggan atau proyek BoQ tidak cocok dengan master Sales',409);
  const channel=String(p.channel||''),recipient=String(p.recipient_email||'').trim().toLowerCase(),
   evidence=String(p.evidence_reference||'').trim(),digest=String(p.evidence_sha256||'').trim().toLowerCase(),
   sentAt=String(p.sent_at||'').trim();
  if(!['email','procurement_portal','physical'].includes(channel)||!emailValid(recipient)||
     evidence.length<8||evidence.length>400||!sha256Valid(digest)||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(sentAt)||!dateValid(sentAt.slice(0,10))||Number.isNaN(Date.parse(sentAt))||Date.parse(sentAt)>Date.now()+300000)
    return err('Channel, penerima, timestamp, bukti dokumen dan SHA-256 harus valid',422);
  const release=await currentRelease(db,id);
  if(!release||release.status!=='approved'||release.boq_id!==boq.id)return err('Proposal versi aktif harus approved sebelum submission',409);
  const approvedAt=release.approved_at?Date.parse(release.approved_at.replace(' ','T')+'Z'):NaN;
  if(!Number.isFinite(approvedAt)||Date.parse(sentAt)<approvedAt)return err('Waktu pengiriman harus setelah persetujuan proposal versi aktif',422);
  await requireVaultDocument(db,evidence,digest,id,release.id,'submission');
  const ref=crypto.randomUUID(),guard=dealGuard(d);
  await atomicSales(db,guard.condition,guard.args,[
   db.prepare('INSERT INTO india_sales_submissions(id,tenant_id,opportunity_id,boq_id,quotation_number,boq_version,recipient_email,channel,sent_at,evidence_reference,evidence_sha256,created_by,release_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ref,TENANT,id,boq.id,boq.quotation_number,boq.version,recipient,channel,sentAt,evidence,digest,email,release.id),
   db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),TENANT,'deal',id,'QUOTATION_SUBMITTED',email,boq.quotation_number+' v'+boq.version+' via '+channel)
  ]);
  return resp({success:true,id:ref,status:'reported',requiresReview:true},201);
 }catch(e){if(/VAULT_|OperationError/.test(String(e))){const v=vaultError(e);return err(v.message,v.status);}const t=transactionError(e);return err(t.message,t.status);}
}
export async function PATCH(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['admin','finance','approver'].includes(role))return err('Pemeriksaan bukti harus Finance/Approver/Admin',403);
 if(!origin(req))return err('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await read(req);}catch{return err('Payload JSON tidak valid');}
 const id=String(p.submission_id||'');if(!safeID(id))return err('Submission ID tidak valid');
 try{
  const row=await db.prepare('SELECT * FROM india_sales_submissions WHERE id=? AND tenant_id=?').bind(id,TENANT).first<Submission>();
  if(!row)return err('Submission tidak ditemukan',404);
  const deny=verifySubmissionRights(row,role,email);if(deny)return err(deny,403);
  const notes=String(p.review_notes||'').trim(),action=String(p.action||'');
  if(!['verified','rejected'].includes(action)||notes.length<15||notes.length>1500)return err('Status dan catatan pemeriksaan minimal 15 karakter wajib',422);
  if(action==='verified')await requireVaultDocument(db,row.evidence_reference,row.evidence_sha256,row.opportunity_id,(row as Submission & {release_id:string}).release_id,'submission');
  const parent=await deal(db,row.opportunity_id);if(!parent||['closed_won','closed_lost'].includes(parent.stage))return err('Opportunity tertutup',409);
  const guard=dealGuard(parent);
  guard.condition+=" AND EXISTS(SELECT 1 FROM india_sales_submissions WHERE id=? AND tenant_id=? AND status='reported')";guard.args.push(id,TENANT);
  await atomicSales(db,guard.condition,guard.args,[
   db.prepare("UPDATE india_sales_submissions SET status=?,verified_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND status='reported'").bind(action,email,notes,TENANT,id),
   salesAudit(db,row.opportunity_id,'QUOTATION_EVIDENCE_'+action.toUpperCase(),email,row.quotation_number+' '+notes.slice(0,80))
  ]);
  return resp({success:true,status:action,reviewer:email});
 }catch(e){if(/VAULT_|OperationError/.test(String(e))){const v=vaultError(e);return err(v.message,v.status);}const t=transactionError(e);return err(t.message,t.status);}
}
