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
 if(!['sales','admin'].includes(role))return out({success:false,message:'Data lead khusus Sales/Admin'},403);
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
 if(req.headers.get('origin')!==new URL(req.url).origin)return out({success:false,message:'Origin tidak sesuai'},403);
 let body:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>18000)return out({success:false,message:'Payload terlalu besar'},413);
  body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw Error('JSON');}
 catch{return out({success:false,message:'JSON tidak valid'},400);}
 const id=String(body.id||'');const version=body.version;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(version)||Number(version)<1)
  return out({success:false,message:'ID atau versi tidak valid'},400);
 const current=await db.prepare('SELECT * FROM india_marketing_leads WHERE id=? AND tenant_id=?').bind(id,tenant).first<Lead>();
 if(!current)return out({success:false,message:'Lead tidak ditemukan'},404);
 if(!canEditLead(role,email,current.owner_email))return out({success:false,message:'Bukan pemilik lead atau Admin'},403);
 if(current.version!==version)return out({success:false,message:'Data berubah. Muat ulang sebelum menyimpan'},409);
 if(current.status==='converted'||current.status==='disqualified')return out({success:false,message:'Lead sudah ditutup'},409);
 const next=body.status===undefined?current.status:String(body.status) as LeadStatus;
 if(!LEAD_STATUSES.includes(next)||next==='converted')return out({success:false,message:'Status tidak diizinkan'},422);
 const patches=body.fields===undefined?{}:body.fields;
 if(!patches||typeof patches!=='object'||Array.isArray(patches))return out({success:false,message:'Field tidak valid'},422);
 const patch=patches as Record<string,unknown>;
 const allowed=new Set<string>(columns);
 const entries=Object.entries(patch);
 if(entries.some(([k,v])=>!allowed.has(k)||typeof v!=='string'||(v as string).length>2000))
  return out({success:false,message:'Field perubahan tidak dikenal atau terlalu panjang'},422);
 if(next!==current.status&&!canTransition(current.status,next))
  return out({success:false,message:'Tahapan harus berurutan'},422);
 if(next===current.status&&entries.length===0)return out({success:false,message:'Tidak ada perubahan'},400);
 const cleaned=Object.fromEntries(entries.map(([k,v])=>[k,k==='contact_email'?normalizeEmail(v):(v as string).trim()]));
 const merged={...current,...cleaned};
 const missing=validateLead(merged);
 if(missing.length)return out({success:false,message:'Data lead belum valid',missing},422);
 if(next==='qualified'){
  const incomplete=validateQualification(merged);
  if(incomplete.length)return out({success:false,message:'Kualifikasi belum lengkap',missing:incomplete},422);
 }
 const event=crypto.randomUUID();
 const setFields=entries.map(([key])=>key+'=?').join(',');
 const updateSQL='UPDATE india_marketing_leads SET '+(setFields?setFields+',':'')+
  'status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND version=? AND status=?';
 const bindings=[...entries.map(([key])=>String(cleaned[key])),next,tenant,id,current.version,current.status];
 try{
 const changes=await db.batch([
  db.prepare(updateSQL).bind(...bindings),
  db.prepare('INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,from_status,to_status,detail) SELECT ?,tenant_id,id,?,?,?,?,? FROM india_marketing_leads WHERE tenant_id=? AND id=? AND version=? AND status=?')
  .bind(event,next===current.status?'EDIT':'STAGE',email,current.status,next,entries.map(e=>e[0]).join(','),tenant,id,current.version+1,next),
 ]) as Array<{success?:boolean;meta?:{changes?:number}}>;
 if(changes.length!==2||changes.some(c=>c.success===false)||changes.some(c=>c.meta?.changes!==1))
  return out({success:false,message:'Pembaruan bersamaan terdeteksi. Muat ulang data'},409);
 return out({success:true,id,status:next,version:current.version+1});
 }catch(e){
  const duplicate=/UNIQUE constraint/i.test(String(e));
  return out({success:false,message:duplicate?'Lead duplikat terdeteksi':'Pembaruan dibatalkan seluruhnya'},duplicate?409:500);
 }
}
