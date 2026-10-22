import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {validDigest,awardReviewAllowed,validAwardForWon,type AwardDoc} from '@/lib/sales-award';
import {atomicSales,currentRelease,dealGuard,salesAudit,transactionError,poSnapshot,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const res=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const deny=(message:string,status=400)=>res({success:false,message},status);
const trustedOrigin=(r:Request)=>!r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin;
type Deal=FlowDeal & {id:string;stage:string;created_by:string;data_json:string};
const readDeal=(db:D1DB,id:string)=>db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<Deal>();
const allowed=['admin','sales','presales','finance','approver','legal'];
const visible=(role:string,email:string,d:Deal)=>role!=='sales'||d.created_by.toLowerCase()===email.toLowerCase();
async function payload(r:Request){const body=await r.text();if(body.length>13000)throw Error('Payload terlalu besar');
 const obj=JSON.parse(body) as Record<string,unknown>;
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON harus object');
 return obj;
}
const text=(x:unknown,n=300)=>typeof x==='string'?x.trim().slice(0,n):'';
async function audit(db:D1DB,opp:string,action:string,email:string,summary:string){
 await db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
 .bind(crypto.randomUUID(),TENANT,'deal',opp,action,email,summary.slice(0,300)).run();
}
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;if(!allowed.includes(role))return deny('Hak akses tidak tersedia',403);
 const id=new URL(req.url).searchParams.get('opportunity_id')||'';
 if(!safeID(id))return deny('Opportunity ID tidak valid');
 try{
  const deal=await readDeal(db,id);if(!deal)return deny('Opportunity tidak ditemukan',404);
  if(!visible(role,email,deal))return deny('Deal bukan milik Sales Anda',403);
  const r=await db.prepare('SELECT * FROM india_sales_award_documents WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 50').bind(TENANT,id).all<AwardDoc>();
  const poNumber=JSON.parse(deal.data_json||'{}').po_number||'';
  return res({success:true,role,po_number:poNumber,documents:r.results,hasDualVerifiedPO:r.results.some(x=>validAwardForWon(x,poNumber))});
 }catch{return deny('Award/PO registry belum tersedia. Migrasi 0008 wajib.',503);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;
 if(!['admin','sales'].includes(role))return deny('Pencatatan award hanya Sales/Admin',403);
 if(!trustedOrigin(req))return deny('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await payload(req);}catch{return deny('Payload tidak valid');}
 const opportunityId=text(p.opportunity_id,100);if(!safeID(opportunityId))return deny('ID Opportunity harus valid');
 try{
  const deal=await readDeal(db,opportunityId);if(!deal)return deny('Opportunity tidak ditemukan',404);
  if(!visible(role,email,deal))return deny('Opportunity bukan milik Sales Anda',403);
  if(!['negotiation','pending_po'].includes(deal.stage))return deny('Award asli hanya dapat diregistrasi sebelum Closed Won pada tahap Negotiation/Pending PO',409);
  const f=JSON.parse(deal.data_json||'{}') as Record<string,string>;
  const kind=text(p.document_kind,20),number=text(p.document_number,180),archive=text(p.archive_reference,400),
   digest=text(p.original_sha256,64),filename=text(p.file_name,180);
  if(!['po','spk','contract','award_letter'].includes(kind)||number.length<3||archive.length<8||
     !validDigest(digest))return deny('Jenis, nomor dokumen, referensi arsip, dan SHA-256 asli harus diisi',422);
  if(['po','spk'].includes(kind)&&number.toLowerCase()!==String(f.po_number||'').trim().toLowerCase())
   return deny('Nomor PO/SPK harus sama dengan po_number pada Sales Form',409);
  const release=await currentRelease(db,opportunityId);
  if(!release||release.status!=='approved')return deny('Proposal approved versi aktif wajib untuk registrasi PO',409);
  const docId=crypto.randomUUID(),guard=dealGuard(deal);
  await atomicSales(db,guard.condition,guard.args,[
   db.prepare('INSERT INTO india_sales_award_documents(id,tenant_id,opportunity_id,document_kind,document_number,file_name,archive_reference,original_sha256,created_by,release_id,po_data_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(docId,TENANT,opportunityId,kind,number,filename,archive,digest.toLowerCase(),email,release.id,poSnapshot(f)),
   db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),TENANT,'deal',opportunityId,'AWARD_EVIDENCE_REGISTER',email,kind+' '+number)
  ]);
  return res({success:true,id:docId,verified:false,requiresFinanceAndLegal:true},201);
 }catch(e){const t=transactionError(e);return deny(t.message,t.status);}
}
export async function PATCH(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!['finance','approver','legal'].includes(role))return deny('Pemeriksa khusus Finance atau Legal diperlukan',403);
 if(!trustedOrigin(req))return deny('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await payload(req);}catch{return deny('Payload tidak valid');}
 const id=text(p.document_id,100),kind=text(p.review_kind,20);
 if(!safeID(id)||!['finance','legal'].includes(kind))return deny('ID atau jenis review tidak valid');
 try{
  const doc=await db.prepare('SELECT * FROM india_sales_award_documents WHERE id=? AND tenant_id=?').bind(id,TENANT).first<AwardDoc>();
  if(!doc)return deny('Dokumen award tidak ditemukan',404);
  const issue=awardReviewAllowed(doc,role,email,kind as 'finance'|'legal');
  if(issue)return deny(issue,403);
  const notes=text(p.review_notes,1500);if(notes.length<15)return deny('Catatan review bukti asli minimal 15 karakter',422);
  const field=kind==='finance'?'finance':'legal';
  const sql=field==='finance'
   ?"UPDATE india_sales_award_documents SET finance_reviewed_by=?,finance_reviewed_at=CURRENT_TIMESTAMP,finance_review_notes=? WHERE id=? AND tenant_id=? AND finance_reviewed_by IS NULL"
   :"UPDATE india_sales_award_documents SET legal_reviewed_by=?,legal_reviewed_at=CURRENT_TIMESTAMP,legal_review_notes=? WHERE id=? AND tenant_id=? AND legal_reviewed_by IS NULL";
  const parent=await readDeal(db,doc.opportunity_id);if(!parent||['closed_won','closed_lost'].includes(parent.stage))return deny('Opportunity tertutup',409);
  const guard=dealGuard(parent);
  guard.condition+=' AND EXISTS(SELECT 1 FROM india_sales_award_documents WHERE id=? AND '+field+'_reviewed_by IS NULL)';guard.args.push(id);
  await atomicSales(db,guard.condition,guard.args,[db.prepare(sql).bind(email,notes,id,TENANT),salesAudit(db,doc.opportunity_id,'AWARD_'+field.toUpperCase()+'_REVIEW',email,doc.document_number)]);
  return res({success:true,review_kind:field,reviewed_by:email});
 }catch(e){const t=transactionError(e);return deny(t.message,t.status);}
}
