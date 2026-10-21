import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT,ACCOUNT_KEYS,cleanFields,safeID} from '@/lib/sales-workflow';
import {validateLead,leadTransition,toOpportunityFields,normalizeName,type LeadStatus,type LeadInput} from '@/lib/marketing-lead';
export const dynamic='force-dynamic';
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>respond({success:false,message},status);
const adminRoles=['admin','marketing','sales'];
type LeadRow={id:string;tenant_id:string;lead_number:string;account_name:string;source:string;campaign:string;campaign_id:string|null;
 service_family:string;contact_name:string;contact_email:string;assigned_sales_email:string;
 estimated_value_idr:number;expected_closing_date:string;qualification_json:string;status:LeadStatus;version:number;
 created_by:string;updated_by:string;created_at:string;updated_at:string};
const view=(r:LeadRow)=>({...r,qualification:JSON.parse(r.qualification_json||'{}'),qualification_json:undefined});
const sameRegistration=(r:LeadRow,v:LeadInput)=>
 r.account_name===v.account_name&&r.source===v.source&&r.campaign===v.campaign&&
 (r.campaign_id||'')===(v.campaign_id||'')&&r.service_family===v.service_family&&r.contact_name===v.contact_name&&
 r.contact_email===v.contact_email&&r.assigned_sales_email===v.assigned_sales_email&&
 r.estimated_value_idr===v.estimated_value_idr&&r.expected_closing_date===v.expected_closing_date;
const owner=(role:string,email:string,row:LeadRow)=>role==='admin'||role==='marketing'||(role==='sales'&&row.assigned_sales_email===email);
const origin=(req:Request)=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
const readLead=(db:D1DB,id:string)=>db.prepare('SELECT * FROM india_marketing_leads WHERE id=? AND tenant_id=?')
 .bind(id,TENANT).first<LeadRow>();
const trim=(x:unknown,max=200)=>typeof x==='string'?x.trim().slice(0,max):'';
async function loadSalesOwner(db:D1DB,email:string){
 return db.prepare("SELECT role,active FROM india_members WHERE email=?").bind(email)
  .first<{role:string;active:number}>();
}
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!adminRoles.includes(role))return fail('Akses Lead hanya untuk Marketing, Sales dan Admin',403);
 const url=new URL(req.url),id=url.searchParams.get('id')||'';
 try{
  if(id){
   if(!safeID(id))return fail('Lead ID tidak valid');
   const r=await readLead(db,id);
   if(!r)return fail('Lead tidak tersedia',404);
   if(!owner(role,email,r))return fail('Lead ini bukan tugas Sales Anda',403);
   const [activities,link]=await Promise.all([
    db.prepare('SELECT kind,summary,next_action_at,created_by,created_at FROM india_marketing_activities WHERE tenant_id=? AND lead_id=? ORDER BY created_at DESC LIMIT 60').bind(TENANT,id).all(),
    db.prepare('SELECT customer_id,opportunity_id,converted_by,converted_at FROM india_sales_lead_links WHERE tenant_id=? AND lead_id=?').bind(TENANT,id).first()
   ]);
   return respond({success:true,lead:view(r),activities:activities.results,link});
  }
  const result=await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 250').bind(TENANT).all<LeadRow>();
  return respond({success:true,role,leads:result.results.filter(r=>owner(role,email,r)).map(view)});
 }catch{return fail('Database Marketing belum siap. Migrasi 0004 dan 0005 wajib dijalankan.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!adminRoles.includes(role))return fail('Tidak berwenang',403);
 if(!origin(req))return fail('Origin tidak diizinkan',403);
 let p:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>16000)return fail('Payload terlalu besar',413);p=JSON.parse(raw);
  if(!p||Array.isArray(p)||typeof p!=='object')return fail('Payload tidak valid');}
 catch{return fail('JSON tidak valid');}
 try{
  if(p.entity==='lead'){
   const v=validateLead(p);
   const requestKey=trim(p.request_key,64);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))
    return fail('Request ID lead tidak valid. Muat ulang formulir untuk membuat ID baru.',422);
   const repeated=await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? AND created_by=? AND request_key=?')
    .bind(TENANT,email,requestKey).first<LeadRow>();
   if(repeated){
    // A retry must work even if its source campaign was paused after the first commit.
    if(repeated.campaign_id&&repeated.campaign_id===v.campaign_id)v.campaign=repeated.campaign;
    if(!sameRegistration(repeated,v))return fail('Request ID sudah digunakan untuk data Lead berbeda. Buat permintaan baru.',409);
    return respond({success:true,id:repeated.id,lead_number:repeated.lead_number,status:repeated.status,already_created:true});
   }
   // New Leads, unlike retries, must reference an active campaign.
   if(v.campaign_id){
    const selected=await db.prepare('SELECT name,status FROM india_marketing_campaigns WHERE id=? AND tenant_id=?')
     .bind(v.campaign_id,TENANT).first<{name:string;status:string}>();
    if(!selected||selected.status!=='active')return fail('Campaign tidak ada atau tidak aktif. Pilih campaign aktif.',409);
    v.campaign=selected.name;
   }
   if(role==='sales'&&v.assigned_sales_email!==email)return fail('Sales hanya dapat mendaftarkan lead sendiri',403);
   const assignee=await loadSalesOwner(db,v.assigned_sales_email);
   if(!assignee||assignee.active!==1||!['sales','admin'].includes(assignee.role))return fail('Sales owner harus akun aktif dengan role Sales/Admin',422);
   const id=crypto.randomUUID(),lead_number='LD-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+id.slice(0,8).toUpperCase();
   await db.batch([
    db.prepare('INSERT INTO india_marketing_leads(id,tenant_id,lead_number,account_name,source,campaign,campaign_id,service_family,contact_name,contact_email,assigned_sales_email,estimated_value_idr,expected_closing_date,qualification_json,status,created_by,updated_by,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
     .bind(id,TENANT,lead_number,v.account_name,v.source,v.campaign,v.campaign_id||null,v.service_family,v.contact_name,v.contact_email,v.assigned_sales_email,v.estimated_value_idr,v.expected_closing_date,JSON.stringify(v.qualification),'new',email,email,requestKey),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
     .bind(crypto.randomUUID(),TENANT,'lead',id,'CREATE',email,'Lead '+lead_number)
   ]);
   return respond({success:true,id,lead_number,status:'new'},201);
  }
  if(p.entity==='activity'){
   if(!safeID(p.id))return fail('Lead ID tidak valid');
   const row=await readLead(db,p.id as string);
   if(!row)return fail('Lead tidak ditemukan',404);
   if(!owner(role,email,row))return fail('Lead bukan milik pengguna',403);
   const kind=trim(p.kind,30),summary=trim(p.summary,2000),date=trim(p.next_action_at,25);
   if(!['call','email','meeting','follow_up','note'].includes(kind)||summary.length<3||
     (date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))return fail('Jenis, deskripsi atau jadwal tidak valid');
   const id=crypto.randomUUID();
   await db.batch([
    db.prepare('INSERT INTO india_marketing_activities(id,tenant_id,lead_id,kind,summary,next_action_at,created_by) VALUES (?,?,?,?,?,?,?)')
     .bind(id,TENANT,row.id,kind,summary,date||null,email),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
     .bind(crypto.randomUUID(),TENANT,'lead',row.id,'ACTIVITY',email,kind)
   ]);
   return respond({success:true,id},201);
  }
  if(p.entity==='convert'){
   if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('x-india-lead-action')!=='convert')return fail('Origin atau konfirmasi konversi tidak valid',403);
   if(!safeID(p.id))return fail('Lead ID tidak valid');
   const row=await readLead(db,p.id as string);
   if(!row)return fail('Lead tidak ditemukan',404);
   if(!['sales','admin'].includes(role)||(role==='sales'&&row.assigned_sales_email!==email))
    return fail('Konversi hanya oleh Sales penanggung jawab atau Admin',403);
   if(row.status==='converted'){
    const linked=await db.prepare('SELECT customer_id,opportunity_id FROM india_sales_lead_links WHERE tenant_id=? AND lead_id=?')
     .bind(TENANT,row.id).first<{customer_id:string;opportunity_id:string}>();
    if(!linked)return fail('Lead bertanda converted tetapi referensi Opportunity tidak ditemukan; hubungi Admin',409);
    return respond({success:true,lead_id:row.id,...linked,already_converted:true});
   }
   if(!Number.isSafeInteger(p.version)||Number(p.version)!==row.version)return fail('Versi Lead berubah; muat ulang data',409);
   const q=JSON.parse(row.qualification_json||'{}') as Record<string,string>;
   const missing=leadTransition(row.status,'converted',q);
   if(missing.length)return respond({success:false,message:'Lead belum Qualified',missing},409);
   if(row.estimated_value_idr<=0||!row.expected_closing_date)return fail('Nilai peluang dan tanggal closing harus lengkap sebelum konversi',422);
   const title=trim(p.opportunity_title,240);
   if(title.length<3)return fail('Nama proyek/opportunity wajib diisi',422);
   const existing=await db.prepare('SELECT id,legal_name,created_by FROM india_sales_accounts WHERE tenant_id=? AND lower(trim(legal_name))=?')
    .bind(TENANT,normalizeName(row.account_name)).first<{id:string;legal_name:string;created_by:string}>();
   if(existing&&existing.created_by.toLowerCase()!==row.assigned_sales_email.toLowerCase())return fail('Customer milik Sales lain; butuh persetujuan perpindahan akses',409);
   const customerId=existing?.id||crypto.randomUUID(),opportunityId=crypto.randomUUID();
   const contact:Record<string,string>={
    primary_name:row.contact_name,primary_email:row.contact_email,
    ...(q.contact_phone?{primary_phone:q.contact_phone}:{})
   };
   const leadInput:LeadInput={
    account_name:row.account_name,source:row.source,campaign:row.campaign,service_family:row.service_family,
    contact_name:row.contact_name,contact_email:row.contact_email,assigned_sales_email:row.assigned_sales_email,
    estimated_value_idr:row.estimated_value_idr,expected_closing_date:row.expected_closing_date,qualification:q
   };
   const fields=toOpportunityFields(leadInput,row.id);
   const statements=[db.prepare("UPDATE india_marketing_leads SET status='converted',version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='qualified' AND version=? AND assigned_sales_email=?")
     .bind(email,row.id,TENANT,row.version,row.assigned_sales_email)];
   if(!existing)statements.push(db.prepare('INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,data_json,created_by) VALUES (?,?,?,?,?,?)')
    .bind(customerId,TENANT,row.account_name,'IND-'+crypto.randomUUID().slice(0,12).toUpperCase(),JSON.stringify(cleanFields(contact,ACCOUNT_KEYS)),row.assigned_sales_email));
   statements.push(
    db.prepare("INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,data_json,created_by) VALUES (?,?,?,?,?,?,?,?)")
     .bind(opportunityId,TENANT,customerId,title,'prospecting',row.estimated_value_idr,JSON.stringify(fields),row.assigned_sales_email),
    db.prepare('INSERT INTO india_sales_lead_links(tenant_id,lead_id,customer_id,opportunity_id,converted_by) VALUES (?,?,?,?,?)')
     .bind(TENANT,row.id,customerId,opportunityId,email),
    db.prepare("INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,from_status,to_status,detail) VALUES (?,?,?,?,?,?,?,?)")
     .bind(crypto.randomUUID(),TENANT,row.id,'CONVERT',email,'qualified','converted','Customer '+customerId+' / Opportunity '+opportunityId),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
     .bind(crypto.randomUUID(),TENANT,'lead',row.id,'CONVERT',email,'Opportunity '+opportunityId),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,from_stage,to_stage,summary) VALUES (?,?,?,?,?,?,?,?)')
     .bind(crypto.randomUUID(),TENANT,'deal',opportunityId,'CREATE',row.assigned_sales_email,null,'prospecting','Lead '+row.lead_number)
   );
   const results=await db.batch(statements) as Array<{success?:boolean;meta?:{changes?:number}}>;
   if(results.length!==statements.length||results.some(r=>r.success===false||r.meta?.changes!==1))return fail('Transaksi konversi berubah secara bersamaan; periksa Lead',409);
   return respond({success:true,lead_id:row.id,customer_id:customerId,opportunity_id:opportunityId},201);
  }
  return fail('Aksi Marketing tidak terdaftar');
 }catch(e){
  // A concurrent client retry may race with the first committed INSERT. The unique
  // request key guarantees a single registration; return its stable identifier.
  if(p.entity==='lead'&&typeof p.request_key==='string'){
   try{
    const same=await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? AND created_by=? AND request_key=?')
     .bind(TENANT,email,p.request_key).first<LeadRow>();
    if(same){
     const original=validateLead(p);
     if(original.campaign_id){
      const campaign=await db.prepare('SELECT name FROM india_marketing_campaigns WHERE id=? AND tenant_id=?')
       .bind(original.campaign_id,TENANT).first<{name:string}>();
      if(campaign)original.campaign=campaign.name;
     }
     if(!sameRegistration(same,original))return fail('Request ID sudah digunakan untuk data Lead berbeda. Buat permintaan baru.',409);
     return respond({success:true,id:same.id,lead_number:same.lead_number,status:same.status,already_created:true});
    }
   }catch{/* Original error below. */}
  }
  if(p.entity==='convert'&&safeID(p.id)){
   try{
    const lead=await readLead(db,p.id as string);
    if(lead&&['admin','sales'].includes(role)&&(role==='admin'||lead.assigned_sales_email===email)&&lead.status==='converted'){
     const same=await db.prepare('SELECT customer_id,opportunity_id FROM india_sales_lead_links WHERE tenant_id=? AND lead_id=?')
      .bind(TENANT,lead.id).first<{customer_id:string;opportunity_id:string}>();
     if(same)return respond({success:true,lead_id:lead.id,...same,already_converted:true});
    }
   }catch{/* Original error below. */}
  }
  if(String(e).includes('UNIQUE')||String(e).includes('constraint'))return fail('Data duplikat atau telah dikonversi; muat ulang dan periksa Lead/Customer',409);
  return fail('Transaksi Marketing gagal. Periksa data, tabel migrasi atau koneksi.',503);
 }
}
export async function PATCH(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!adminRoles.includes(role))return fail('Tidak berwenang',403);
 if(!origin(req))return fail('Origin ditolak',403);
 let p:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>16000)return fail('Payload terlalu besar',413);p=JSON.parse(raw);}
 catch{return fail('JSON tidak valid');}
 if(!safeID(p.id))return fail('Lead ID tidak valid');
 try{
  const row=await readLead(db,p.id as string);
  if(!row)return fail('Lead tidak ditemukan',404);
  if(!owner(role,email,row))return fail('Lead bukan milik pengguna',403);
  const target=trim(p.status,50) as LeadStatus;
  if(!['new','assigned','qualified','disqualified'].includes(target))return fail('Status tidak diizinkan');
  const qualify={...JSON.parse(row.qualification_json||'{}'),...((p.qualification&&typeof p.qualification==='object')?p.qualification:{})};
  const v=validateLead({...row,qualification:qualify});
  const missing=leadTransition(row.status,target,v.qualification);
  if(missing.length)return respond({success:false,message:'Gate Lead belum terpenuhi',missing},409);
  if(role==='marketing'&&target==='qualified'&&!v.contact_email&&!v.contact_name)
   return fail('Isi minimal satu identitas kontak sebelum kualifikasi',422);
  if(!Number.isSafeInteger(p.version)||Number(p.version)!==row.version)return fail('Versi Lead berubah; muat ulang data',409);
  const update=await db.prepare("UPDATE india_marketing_leads SET status=?,qualification_json=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status=? AND version=? AND qualification_json=?")
   .bind(target,JSON.stringify(v.qualification),email,row.id,TENANT,row.status,row.version,row.qualification_json).run();
  if((update as unknown as {meta?:{changes:number}}).meta?.changes===0)return fail('Lead berubah pada sesi lain, muat ulang',409);
  await db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,from_stage,to_stage) VALUES (?,?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),TENANT,'lead',row.id,'STAGE',email,row.status,target).run();
  return respond({success:true,status:target});
 }catch{return fail('Perubahan Lead gagal. Pastikan parameter dan migrasi telah lengkap.',503);}
}
