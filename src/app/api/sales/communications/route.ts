import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {parseOpportunityEmail} from '@/lib/opportunity-email';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','sales','presales','finance','approver','legal'].includes(role))return fail('Akses ditolak',403);
 const id=new URL(req.url).searchParams.get('opportunity_id');if(!safeID(id))return fail('Pilih Opportunity',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(!canReadDeal(role,email,d.created_by))return fail('Akses Opportunity ditolak',403);
  const [messages,negotiations,releases]=await Promise.all([
   db.prepare('SELECT * FROM india_opportunity_emails WHERE tenant_id=? AND opportunity_id=? ORDER BY sent_at DESC LIMIT 250').bind(TENANT,id).all(),
   db.prepare('SELECT id,release_id,decision,amount_before_vat,notes,communication_id,created_by,created_at FROM india_sales_negotiations WHERE tenant_id=? AND opportunity_id=? ORDER BY rowid DESC LIMIT 100').bind(TENANT,id).all(),
   db.prepare('SELECT id,version,status FROM india_sales_releases WHERE tenant_id=? AND opportunity_id=? ORDER BY version DESC').bind(TENANT,id).all()
  ]);
  return reply({success:true,role,identityEmail:email,deal:{id,title:d.title,stage:d.stage,flow_version:d.flow_version},messages:messages.results,negotiations:negotiations.results,releases:releases.results});
 }catch{return fail('Riwayat email belum siap. Periksa migrasi 0017.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','sales'].includes(role))return fail('Impor email hanya Sales pemilik/Admin',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,1600000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 if(!safeID(p.opportunity_id)||(typeof p.raw_eml!=='string'&&typeof p.raw_eml_base64!=='string')||!['inbound','outbound'].includes(String(p.direction))||!Number.isSafeInteger(p.flow_version))return fail('Opportunity, arah email, versi dan file EML wajib',422);
 let message,source:Uint8Array;try{
  source=typeof p.raw_eml_base64==='string'?Uint8Array.from(atob(p.raw_eml_base64),x=>x.charCodeAt(0)):new TextEncoder().encode(p.raw_eml as string);
  if(source.byteLength>1024*1024)return fail('EML maksimum 1 MB',413);
  message=parseOpportunityEmail(new TextDecoder('utf-8',{fatal:true}).decode(source));
 }catch(e){return fail(String(e instanceof Error?e.message:e),422);}
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,p.opportunity_id as string).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(!canReadDeal(role,email,d.created_by))return fail('Akses Opportunity ditolak',403);
  if(d.flow_version!==p.flow_version)return fail('Data berubah; muat ulang',409);
  if(['closed_won','closed_lost'].includes(d.stage))return fail('Opportunity tertutup; komunikasi terkunci',409);
  const g=dealGuard(d),release=typeof p.release_id==='string'&&p.release_id?p.release_id:null;
  if(release){
   const r=await db.prepare("SELECT id FROM india_sales_releases WHERE tenant_id=? AND opportunity_id=? AND id=? AND status!='superseded'").bind(TENANT,d.id,release).first();
   if(!r)return fail('Paket aktif harus berasal dari Opportunity yang sama',409);
   g.condition+=" AND EXISTS(SELECT 1 FROM india_sales_releases WHERE id=? AND status!='superseded')";g.args.push(release);
  }
  if(message.in_reply_to){
   const parent=await db.prepare('SELECT opportunity_id FROM india_opportunity_emails WHERE tenant_id=? AND message_id=?').bind(TENANT,message.in_reply_to).first<{opportunity_id:string}>();
   if(parent&&parent.opportunity_id!==d.id)return fail('Thread email sudah terhubung ke Opportunity lain',409);
  }
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',source as Uint8Array<ArrayBuffer>))).map(x=>x.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID();
  await atomicSales(db,g.condition,g.args,[
   db.prepare('INSERT INTO india_opportunity_emails(id,tenant_id,opportunity_id,release_id,message_id,in_reply_to,subject,sender_email,recipient_emails,direction,sent_at,excerpt,source_sha256,imported_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,d.id,release,message.message_id,message.in_reply_to,message.subject,message.sender_email,JSON.stringify(message.recipient_emails),p.direction as string,message.sent_at,message.excerpt,hash,email),
   db.prepare("INSERT INTO india_sales_activities(id,tenant_id,opportunity_id,kind,subject,detail,created_by) VALUES (?,?,?,'email',?,?,?)").bind(crypto.randomUUID(),TENANT,d.id,message.subject,'EML '+p.direction+' / '+message.message_id+' / communication_id='+id,email),
   salesAudit(db,d.id,'EMAIL_IMPORTED',email,message.message_id+' / '+p.direction)
  ]);
  return reply({success:true,id,verification:'imported_unverified',message:'Email terhubung; keputusan negosiasi tetap melalui workflow persetujuan.'},201);
 }catch(e){return fail(/constraint/i.test(String(e))?'Email sudah diimpor atau data berubah; muat ulang.':'Impor gagal. Periksa migrasi 0017.',/constraint/i.test(String(e))?409:503);}
}
