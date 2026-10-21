import {NextResponse} from 'next/server';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {canCreateLead,canEditLead,canTransition,normalizeEmail,validateLead,validateQualification,LEAD_STATUSES,type LeadStatus} from '@/lib/lead-workflow';
const out=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const tenant='defendit360';
type Lead={id:string;tenant_id:string;status:LeadStatus;owner_email:string;version:number;[key:string]:unknown};
const columns=['company_name','contact_name','contact_email','contact_phone','service_interest','lead_source','campaign_code','qualification_notes','budget_status','decision_authority','requirement_summary','target_date'] as const;
const pick=(body:Record<string,unknown>)=>Object.fromEntries(columns.map(k=>[k,String(body[k]??'').trim().slice(0,2000)]));
const isUniqueError=(e:unknown)=>/UNIQUE constraint failed/i.test(String(e));
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;
 const id=new URL(req.url).searchParams.get('id');
 if(id){
  const lead=await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? AND id=?').bind(tenant,id).first<Lead>();
  if(!lead)return out({success:false,message:'Lead tidak ditemukan'},404);
  if(role==='sales'&&lead.owner_email!==email)return out({success:false,message:'Tidak berwenang'},403);
  return out({success:true,lead});
 }
 const rows=role==='sales'?
 await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? AND owner_email=? ORDER BY created_at DESC LIMIT 200').bind(tenant,email).all():
 await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200').bind(tenant).all();
 return out({success:true,leads:rows.results});
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;
 if(!canCreateLead(role))return out({success:false,message:'Role tidak dapat membuat lead'},403);
 if(new URL(req.url).origin!==req.headers.get('origin'))return out({success:false,message:'Origin tidak sesuai'},403);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return out({success:false,message:'JSON tidak valid'},400);}
 const data=pick(body);data.contact_email=normalizeEmail(data.contact_email);
 const missing=validateLead(data);if(missing.length)return out({success:false,missing},422);
 const id=crypto.randomUUID(),event=crypto.randomUUID();
 try{
 await db.batch([
 db.prepare('INSERT INTO india_marketing_leads(id,tenant_id,company_name,contact_name,contact_email,contact_phone,service_interest,lead_source,campaign_code,qualification_notes,budget_status,decision_authority,requirement_summary,target_date,owner_email,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,tenant,...columns.map(k=>data[k]),email,email),
 db.prepare('INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,to_status) VALUES (?,?,?,?,?,?)').bind(event,tenant,id,'CREATE',email,'new')
 ]);
 return out({success:true,id,status:'new'},201);
 }catch(e){return out({success:false,message:isUniqueError(e)?'Lead aktif dengan email dan perusahaan sama sudah terdaftar':'Gagal menyimpan lead'},isUniqueError(e)?409:500);}
}
export async function PATCH(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;
 if(new URL(req.url).origin!==req.headers.get('origin'))return out({success:false,message:'Origin tidak sesuai'},403);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return out({success:false,message:'JSON tidak valid'},400);}
 const id=String(body.id||'');const version=Number(body.version);const next=String(body.status||'') as LeadStatus;
 if(!id||!Number.isSafeInteger(version)||version<1||!LEAD_STATUSES.includes(next))return out({success:false,message:'ID, versi, atau status tidak valid'},400);
 const current=await db.prepare('SELECT * FROM india_marketing_leads WHERE id=? AND tenant_id=?').bind(id,tenant).first<Lead>();
 if(!current)return out({success:false,message:'Lead tidak ditemukan'},404);
 if(!canEditLead(role,email,current.owner_email))return out({success:false,message:'Role atau kepemilikan tidak sesuai'},403);
 if(current.version!==version)return out({success:false,message:'Data telah berubah, muat ulang'},409);
 if(!canTransition(current.status,next)||next==='converted')return out({success:false,message:'Transisi tidak diperbolehkan; konversi memerlukan transaksi terpisah'},422);
 if(next==='qualified'){
  const missing=validateQualification(current);
  if(missing.length)return out({success:false,missing},422);
 }
 const event=crypto.randomUUID();
 try{
 const result=await db.prepare('UPDATE india_marketing_leads SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND version=? AND status=?').bind(next,id,tenant,version,current.status).run();
 if(!result.success)return out({success:false,message:'Pembaruan gagal'},500);
 await db.prepare('INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,from_status,to_status) VALUES (?,?,?,?,?,?,?)').bind(event,tenant,id,'STAGE',email,current.status,next).run();
 return out({success:true,id,status:next,version:version+1});
 }catch{return out({success:false,message:'Transaksi tidak selesai; periksa audit'},500);}
}
