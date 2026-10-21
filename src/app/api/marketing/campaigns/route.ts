import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {validateCampaign,canEditCampaign,canSelectCampaign,campaignProgress} from '@/lib/marketing-campaign';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
const ownOrigin=(req:Request)=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
const roles=['admin','marketing','sales'];
type CampaignRow={
 id:string;tenant_id:string;code:string;name:string;channel:string;status:string;
 owner_email:string;budget_idr:number;start_date:string;end_date:string;notes:string;
 revision:number;created_by:string;updated_by:string;created_at:string;updated_at:string;
 total_leads:number;qualified_leads:number;converted_leads:number;
};
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!roles.includes(role))return fail('Campaign hanya tersedia untuk Marketing, Sales dan Admin',403);
 try{
  const id=new URL(req.url).searchParams.get('id');
  if(id&&!safeID(id))return fail('Campaign ID tidak valid');
  // Sales only sees active campaign and aggregate of their own Leads; no PIC data leaves this endpoint.
  const q=`SELECT c.*,
    COUNT(l.id) AS total_leads,
    COALESCE(SUM(CASE WHEN l.status='qualified' THEN 1 ELSE 0 END),0) AS qualified_leads,
    COALESCE(SUM(CASE WHEN l.status='converted' THEN 1 ELSE 0 END),0) AS converted_leads
   FROM india_marketing_campaigns c
   LEFT JOIN india_marketing_leads l ON l.tenant_id=c.tenant_id AND l.campaign_id=c.id
      AND (?='all' OR l.assigned_sales_email=?)
   WHERE c.tenant_id=? AND (?='all' OR c.status='active') AND (? IS NULL OR c.id=?)
   GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 200`;
  const view=role==='sales'?'sales':'all';
  const r=await db.prepare(q).bind(view,email,TENANT,view,id||null,id||null).all<CampaignRow>();
  const campaigns=r.results.map(c=>{
   const progress=campaignProgress({total:c.total_leads,qualified:c.qualified_leads,converted:c.converted_leads});
   // Field-level redaction: Sales sees attribution performance, not Marketing budget or internal notes.
   if(role==='sales'){
    const {budget_idr,notes,created_by,updated_by,...publicCampaign}=c;
    void budget_idr;void notes;void created_by;void updated_by;
    return {...publicCampaign,...progress};
   }
   return {...c,...progress};
  });
  return reply({success:true,role,campaigns});
 }catch{return fail('Master Campaign belum tersedia. Jalankan migrasi 0009 dan 0010 sebelum aktivasi.',503);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!canEditCampaign(role))return fail('Campaign hanya dapat didaftarkan Marketing atau Admin',403);
 if(!ownOrigin(req))return fail('Origin permintaan tidak diizinkan',403);
 try{
  const raw=await req.text();if(raw.length>6000)return fail('Payload terlalu besar',413);
  const v=validateCampaign(JSON.parse(raw));
  const owner=await db.prepare('SELECT role,active FROM india_members WHERE email=?').bind(v.owner_email)
   .first<{role:string;active:number}>();
  if(!owner||owner.active!==1||!roles.includes(owner.role))
   return fail('Campaign owner harus anggota aktif Marketing, Sales atau Admin',422);
  const id=crypto.randomUUID();
  await db.batch([
   db.prepare('INSERT INTO india_marketing_campaigns(id,tenant_id,code,name,channel,status,owner_email,budget_idr,start_date,end_date,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,TENANT,v.code,v.name,v.channel,v.status,v.owner_email,v.budget_idr,v.start_date,v.end_date,v.notes,email,email),
   db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),TENANT,'campaign',id,'CREATE',email,v.code)
  ]);
  return reply({success:true,id,code:v.code,status:v.status},201);
 }catch(e){
  const err=String(e);
  if(/UNIQUE|constraint failed/i.test(err))return fail('Kode Campaign sudah digunakan atau constraint database tidak terpenuhi',409);
  if(/Campaign|Tanggal|Email|Anggaran|Kode|Nama/i.test(err))return fail(e instanceof Error?e.message:'Data Campaign tidak valid',422);
  return fail('Penyimpanan Campaign gagal. Periksa migrasi atau koneksi D1.',503);
 }
}
export async function PATCH(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!canEditCampaign(role))return fail('Perubahan Campaign hanya dapat dilakukan Marketing atau Admin',403);
 if(!ownOrigin(req))return fail('Origin permintaan tidak diizinkan',403);
 try{
  const raw=await req.text();if(raw.length>6000)return fail('Payload terlalu besar',413);
  const body=JSON.parse(raw);
  if(!body||typeof body!=='object'||!safeID(body.id))return fail('Campaign ID tidak valid');
  const revision=Number(body.revision);
  if(!Number.isSafeInteger(revision)||revision<1)return fail('Revisi campaign wajib valid',422);
  const current=await db.prepare('SELECT * FROM india_marketing_campaigns WHERE id=? AND tenant_id=?')
   .bind(body.id,TENANT).first<CampaignRow>();
  if(!current)return fail('Campaign tidak ditemukan',404);
  if(['completed','cancelled'].includes(current.status))
   return fail('Campaign sudah final dan terkunci; buat kampanye baru jika diperlukan',409);
  const v=validateCampaign({...current,...body});
  if(v.owner_email!==current.owner_email){
   const assigned=await db.prepare('SELECT role,active FROM india_members WHERE email=?')
    .bind(v.owner_email).first<{role:string;active:number}>();
   if(!assigned||assigned.active!==1||!roles.includes(assigned.role))
    return fail('Campaign owner baru harus anggota aktif',422);
  }
  if(!canSelectCampaign(v.status)&&!['planned','paused','completed','cancelled'].includes(v.status))
   return fail('Status campaign tidak valid');
  const changed=await db.prepare('UPDATE india_marketing_campaigns SET name=?,channel=?,status=?,owner_email=?,budget_idr=?,start_date=?,end_date=?,notes=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND revision=?')
   .bind(v.name,v.channel,v.status,v.owner_email,v.budget_idr,v.start_date,v.end_date,v.notes,email,body.id,TENANT,revision).run();
  if((changed as unknown as {meta?:{changes:number}}).meta?.changes!==1)
   return fail('Campaign berubah pada sesi lain. Muat ulang sebelum menyimpan',409);
  await db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),TENANT,'campaign',body.id,'UPDATE',email,current.status+' → '+v.status).run();
  return reply({success:true,id:body.id,revision:revision+1,status:v.status});
 }catch(e){
  const err=String(e);
  if(/UNIQUE|constraint failed/i.test(err))return fail('Data Campaign bertentangan dengan data lain',409);
  if(/Campaign|Tanggal|Email|Anggaran|Kode|Nama/i.test(err))return fail(e instanceof Error?e.message:'Data Campaign tidak valid',422);
  return fail('Campaign gagal diubah. Periksa data atau koneksi D1.',503);
 }
}
