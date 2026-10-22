import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales,transactionError} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const error=(message:string,status=400)=>reply({success:false,message},status);
const sameOrigin=(req:Request)=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
const str=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max+1):'';
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const types=['visit','call','meeting','follow_up'];
type Task={id:string;tenant_id:string;lead_id:string|null;opportunity_id:string|null;owner_email:string;kind:string;status:string;revision:number;start_at:string;due_at:string;reminder_at:string;subject:string};
async function member(db:D1DB,email:string){return db.prepare('SELECT role,active FROM india_members WHERE email=?').bind(email).first<{role:string;active:number}>();}
async function target(db:D1DB,kind:string,id:string){
 if(kind==='lead')return db.prepare('SELECT id,assigned_sales_email AS owner_email,status FROM india_marketing_leads WHERE tenant_id=? AND id=?').bind(TENANT,id).first<{id:string;owner_email:string;status:string}>();
 return db.prepare('SELECT id,created_by AS owner_email,stage AS status FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<{id:string;owner_email:string;status:string}>();
}
const date=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v))return null;
 const d=new Date(v);return Number.isFinite(d.getTime())?d:null;};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['sales','admin'].includes(role))return error('Kalender hanya untuk Sales atau Admin/Sales Manager',403);
 const u=new URL(req.url),owner=str(u.searchParams.get('owner'),200).toLowerCase();
 if(owner&&!emailPattern.test(owner))return error('Email filter tidak valid',422);
 if(role==='sales'&&owner&&owner!==email)return error('Tidak dapat melihat agenda Sales lain',403);
 const selected=role==='sales'?email:owner;
 try{
  const where='t.tenant_id=?'+(selected?' AND t.owner_email=?':'');
  const bind=[TENANT,...(selected?[selected]:[])];
  const [tasks,events,alerts,slas,owners,managers]=await Promise.all([
   db.prepare(`SELECT t.*,coalesce(l.account_name,a.legal_name,'') AS customer_name,coalesce(l.lead_number,o.title,'') AS target_name
    FROM india_sales_activity_tasks t LEFT JOIN india_marketing_leads l ON l.id=t.lead_id AND l.tenant_id=t.tenant_id
    LEFT JOIN india_sales_opportunities o ON o.id=t.opportunity_id AND o.tenant_id=t.tenant_id
    LEFT JOIN india_sales_accounts a ON a.id=o.company_id AND a.tenant_id=t.tenant_id
    WHERE ${where} ORDER BY t.due_at ASC LIMIT 500`).bind(...bind).all(),
   db.prepare(`SELECT e.*,t.subject,t.owner_email,t.lead_id,t.opportunity_id FROM india_sales_activity_events e
    JOIN india_sales_activity_tasks t ON t.id=e.task_id WHERE ${where} ORDER BY e.at DESC,e.rowid DESC LIMIT 250`).bind(...bind).all(),
   db.prepare('SELECT * FROM india_sales_activity_alerts WHERE tenant_id=? AND recipient_email=? ORDER BY created_at DESC LIMIT 100').bind(TENANT,email).all(),
   db.prepare(`SELECT s.*,l.account_name,l.lead_number,l.status AS lead_status FROM india_sales_lead_sla s
    JOIN india_marketing_leads l ON l.id=s.lead_id AND l.tenant_id=s.tenant_id
    WHERE s.tenant_id=? ${selected?'AND s.owner_email=?':''} AND l.status NOT IN ('converted','disqualified')
    ORDER BY s.response_due_at ASC LIMIT 250`).bind(...bind).all(),
   db.prepare("SELECT email,role FROM india_members WHERE active=1 AND role IN ('sales','admin') ORDER BY email").all(),
   db.prepare('SELECT sales_email,manager_email FROM india_sales_team_managers WHERE tenant_id=?').bind(TENANT).all<{sales_email:string;manager_email:string}>()
  ]);
  return reply({success:true,role,identityEmail:email,tasks:tasks.results,events:events.results,alerts:alerts.results,
   slas:slas.results,owners:role==='admin'?owners.results:[{email,role}],managers:role==='admin'?managers.results:managers.results.filter(m=>m.sales_email===email),
   serverNow:new Date().toISOString()});
 }catch{return error('Modul belum siap; verifikasi migrasi D1 0013',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['sales','admin'].includes(role))return error('Hanya Sales/Admin dapat membuat jadwal',403);
 if(!sameOrigin(req))return error('Origin tidak diizinkan',403);
 let p:Record<string,unknown>;
 try{const s=await req.text();if(s.length>12000)return error('Payload terlalu besar',413);p=JSON.parse(s);
 if(!p||Array.isArray(p)||typeof p!=='object')return error('Payload tidak valid');}catch{return error('JSON tidak valid',400);}
 try{
  if(p.action==='assign_manager'){
   if(role!=='admin')return error('Hanya Admin dapat memetakan Sales Manager',403);
   const sales=str(p.sales_email).toLowerCase(),manager=str(p.manager_email).toLowerCase();
   if(!emailPattern.test(sales)||!emailPattern.test(manager)||sales===manager)return error('Email Sales dan Manager harus berbeda dan valid',422);
   const [s,m]=await Promise.all([member(db,sales),member(db,manager)]);
   if(!s||s.role!=='sales'||s.active!==1||!m||m.role!=='admin'||m.active!==1)return error('Sales harus aktif dan Manager harus anggota aktif dengan role Admin',422);
   await db.batch([
    db.prepare('INSERT INTO india_sales_team_managers(tenant_id,sales_email,manager_email,assigned_by) VALUES (?,?,?,?) ON CONFLICT(tenant_id,sales_email) DO UPDATE SET manager_email=excluded.manager_email,assigned_by=excluded.assigned_by,assigned_at=CURRENT_TIMESTAMP').bind(TENANT,sales,manager,email),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
     .bind(crypto.randomUUID(),TENANT,'activity_manager',sales,'ASSIGN_MANAGER',email,'Escalation owner '+manager)
   ]);
   return reply({success:true,sales_email:sales,manager_email:manager});
  }
  if(p.action!=='schedule')return error('Aksi tidak dikenal',422);
  const scope=str(p.scope,20),targetId=str(p.target_id,80),kind=str(p.kind,20);
  const subject=str(p.subject,200),detail=str(p.detail,2000),start=date(p.start_at),due=date(p.due_at);
  if(!['lead','opportunity'].includes(scope)||!safeID(targetId)||!types.includes(kind)||subject.length<3||subject.length>200||detail.length>2000||!start||!due)return error('Target, jenis, subjek dan waktu UTC ISO wajib valid',422);
  const now=Date.now();
  if(start.getTime()<now-86400000||due.getTime()<now-60000||due.getTime()<start.getTime()||due.getTime()>now+366*86400000)
   return error('Jadwal harus valid dan dalam 366 hari',422);
  const t=await target(db,scope,targetId);
  if(!t)return error('Lead/Opportunity tidak ditemukan',404);
  if(['converted','disqualified','closed_won','closed_lost'].includes(t.status))return error('Tidak dapat membuat jadwal baru untuk Lead/Opportunity tertutup',409);
  if(role==='sales'&&t.owner_email.toLowerCase()!==email)return error('Target bukan milik Sales ini',403);
  const assignee=await member(db,t.owner_email);
  if(!assignee||assignee.active!==1||!['admin','sales'].includes(assignee.role))return error('Sales penanggung jawab tidak aktif',409);
  const policy=await db.prepare('SELECT reminder_minutes FROM india_sales_activity_policy WHERE tenant_id=?').bind(TENANT).first<{reminder_minutes:number}>();
  const reminder=new Date(start.getTime()-(policy?.reminder_minutes??30)*60000).toISOString();
  const id=crypto.randomUUID(),ev=crypto.randomUUID(),audit=crypto.randomUUID();
  await db.batch([
   db.prepare('INSERT INTO india_sales_activity_tasks(id,tenant_id,lead_id,opportunity_id,owner_email,kind,subject,detail,start_at,due_at,reminder_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,TENANT,scope==='lead'?targetId:null,scope==='opportunity'?targetId:null,t.owner_email,kind,subject,detail,start.toISOString(),due.toISOString(),reminder,email),
   db.prepare('INSERT INTO india_sales_activity_events(id,tenant_id,task_id,action,actor_email,detail) VALUES (?,?,?,?,?,?)').bind(ev,TENANT,id,'scheduled',email,subject),
   db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
    .bind(audit,TENANT,scope==='lead'?'lead':'deal',targetId,'ACTIVITY_SCHEDULED',email,kind+' '+subject)
  ]);
  return reply({success:true,id},201);
 }catch(e){const x=transactionError(e);return error(x.message,x.status);}
}
export async function PATCH(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['sales','admin'].includes(role))return error('Tidak berwenang',403);
 if(!sameOrigin(req))return error('Origin tidak diizinkan',403);
 let p:Record<string,unknown>;
 try{const s=await req.text();if(s.length>12000)return error('Payload terlalu besar',413);p=JSON.parse(s);
 if(!p||Array.isArray(p)||typeof p!=='object')return error('Payload tidak valid');}catch{return error('JSON tidak valid',400);}
 try{
  if(p.action==='read_alert'){
   const key=str(p.alert_key,160);if(key.length<4||key.length>160)return error('ID alert tidak valid',422);
   await db.prepare('UPDATE india_sales_activity_alerts SET read_at=coalesce(read_at,CURRENT_TIMESTAMP) WHERE alert_key=? AND tenant_id=? AND recipient_email=?')
    .bind(key,TENANT,email).run();
   return reply({success:true});
  }
  const action=str(p.action,30),id=str(p.id,80);
  if(!['complete','cancel','reschedule'].includes(action)||!safeID(id)||!Number.isSafeInteger(p.revision))return error('Aksi, ID atau revisi tidak valid',422);
  const task=await db.prepare('SELECT * FROM india_sales_activity_tasks WHERE tenant_id=? AND id=?').bind(TENANT,id).first<Task>();
  if(!task)return error('Aktivitas tidak ditemukan',404);
  if(role==='sales'&&task.owner_email.toLowerCase()!==email)return error('Hanya owner boleh mengubah jadwal',403);
  if(task.status!=='planned'||task.revision!==p.revision)return error('Jadwal berubah atau telah ditutup; refresh',409);
  const details=str(p.outcome,2000),now=new Date(),writes=[];
  if(action==='complete'&&details.length<3)return error('Hasil interaksi wajib dicatat minimal 3 karakter',422);
  if(action==='cancel'&&details.length<3)return error('Alasan pembatalan wajib dicatat',422);
  if(action==='reschedule'){
   const start=date(p.start_at),due=date(p.due_at);
   if(!start||!due||start.getTime()<now.getTime()-86400000||due.getTime()<now.getTime()-60000||due<start||due.getTime()>now.getTime()+366*86400000)return error('Jadwal pengganti tidak valid',422);
   const policy=await db.prepare('SELECT reminder_minutes FROM india_sales_activity_policy WHERE tenant_id=?').bind(TENANT).first<{reminder_minutes:number}>();
   const remind=new Date(start.getTime()-(policy?.reminder_minutes??30)*60000).toISOString();
   writes.push(db.prepare("UPDATE india_sales_activity_tasks SET start_at=?,due_at=?,reminder_at=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='planned' AND revision=?")
    .bind(start.toISOString(),due.toISOString(),remind,id,TENANT,task.revision));
  }else{
   writes.push(db.prepare("UPDATE india_sales_activity_tasks SET status=?,outcome=?,completed_at=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='planned' AND revision=?")
    .bind(action==='complete'?'completed':'cancelled',details,action==='complete'?now.toISOString():null,id,TENANT,task.revision));
  }
  if(action==='complete'&&task.lead_id&&['call','visit','meeting'].includes(task.kind)){
   // A manually completed customer contact is the first verified SLA response; notes/follow-up do not count.
   writes.push(db.prepare('UPDATE india_sales_lead_sla SET first_response_at=coalesce(first_response_at,?) WHERE tenant_id=? AND lead_id=? AND first_response_at IS NULL')
    .bind(now.toISOString(),TENANT,task.lead_id));
  }
  writes.push(db.prepare('INSERT INTO india_sales_activity_events(id,tenant_id,task_id,action,actor_email,detail) VALUES (?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),TENANT,id,action==='complete'?'completed':action==='cancel'?'cancelled':'rescheduled',email,details||'Jadwal diperbarui'));
  writes.push(db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),TENANT,task.lead_id?'lead':'deal',task.lead_id||task.opportunity_id,'ACTIVITY_'+action.toUpperCase(),email,details.slice(0,300)));
  await atomicSales(db,'EXISTS(SELECT 1 FROM india_sales_activity_tasks WHERE id=? AND tenant_id=? AND revision=? AND status=?)',[id,TENANT,task.revision,'planned'],writes);
  return reply({success:true,id,revision:task.revision+1});
 }catch(e){const x=transactionError(e);return error(x.message,x.status);}
}
