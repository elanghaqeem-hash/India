import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {computeLeadScore,canReactivate,isReasonCode,validISODate,advanceDate,suggestedCadence} from '@/lib/lead-intelligence';
export const dynamic='force-dynamic';
const allowed=['admin','marketing','sales'];
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const failure=(message:string,status=400)=>response({success:false,message},status);
const text=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const privileged=(role:string)=>role==='admin'||role==='marketing';
type Lead={id:string;tenant_id:string;lead_number:string;account_name:string;source:string;campaign:string;
 status:string;version:number;qualification_json:string;service_family:string;contact_email:string;assigned_sales_email:string;
 estimated_value_idr:number;expected_closing_date:string;contact_name:string};
type Plan={lead_id:string;state:string;cadence_days:number;channel:string;version:number;next_touch_at:string;touch_count:number;last_touch_at:string|null};
const today=()=>new Date().toISOString().slice(0,10);
const access=(role:string,email:string,r:Lead)=>privileged(role)||r.assigned_sales_email===email;
async function lead(db:D1DB,id:string){return db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? AND id=?').bind(TENANT,id).first<Lead>();}
const visible=(role:string)=>privileged(role)?1:0;
function changes(result:unknown){const r=result as {success?:boolean;meta?:{changes?:number}};return r?.success!==false&&r?.meta?.changes===1;}
async function write(db:D1DB,statements:ReturnType<D1DB['prepare']>[]) {
 const result=await db.batch(statements) as unknown[];
 return result.length===statements.length&&result.every(changes);
}
function authorizeWrite(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
async function body(req:Request){
 const raw=await req.text();if(raw.length>12000)throw Error('Payload melebihi batas');
 const value=JSON.parse(raw) as Record<string,unknown>;
 if(!value||Array.isArray(value)||typeof value!=='object')throw Error('JSON harus object');
 return value;
}
const ownerSql="l.tenant_id=? AND (?=1 OR l.assigned_sales_email=?)";
const summarySql=`
 FROM india_marketing_leads l
 LEFT JOIN india_sales_lead_links link ON link.tenant_id=l.tenant_id AND link.lead_id=l.id
 LEFT JOIN india_sales_opportunities opp ON opp.tenant_id=link.tenant_id AND opp.id=link.opportunity_id
 WHERE ${ownerSql}`;
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!allowed.includes(role))return failure('Tidak berwenang mengakses Lead Intelligence',403);
 const url=new URL(req.url),mode=url.searchParams.get('mode')||'queue',id=url.searchParams.get('id')||'';
 try{
  if(mode==='detail'){
   if(!safeID(id))return failure('Lead ID tidak valid',422);
   const r=await lead(db,id);if(!r)return failure('Lead tidak ditemukan',404);
   if(!access(role,email,r))return failure('Lead bukan milik pengguna',403);
   const [plan,disqualification,events]=await Promise.all([
    db.prepare('SELECT * FROM india_lead_nurture_plans WHERE tenant_id=? AND lead_id=?').bind(TENANT,id).first(),
    db.prepare('SELECT * FROM india_lead_disqualifications WHERE tenant_id=? AND lead_id=?').bind(TENANT,id).first(),
    db.prepare('SELECT event_type,actor_email,reason_code,detail,created_at FROM india_lead_intelligence_events WHERE tenant_id=? AND lead_id=? ORDER BY created_at DESC LIMIT 100').bind(TENANT,id).all()
   ]);
   return response({success:true,lead:{id:r.id,lead_number:r.lead_number,account_name:r.account_name,status:r.status,version:r.version,assigned_sales_email:r.assigned_sales_email},
    plan,disqualification,events:events.results});
  }
  if(mode==='analytics'){
   const bound=[TENANT,visible(role),email] as (string|number)[];
   const [overall,bySource,byOwner,byReason]=await Promise.all([
    db.prepare(`SELECT count(*) total,sum(CASE WHEN l.status='qualified' THEN 1 ELSE 0 END) qualified,
      sum(CASE WHEN link.lead_id IS NOT NULL THEN 1 ELSE 0 END) converted,
      sum(CASE WHEN opp.stage='closed_won' THEN 1 ELSE 0 END) won,
      sum(CASE WHEN l.status='disqualified' THEN 1 ELSE 0 END) disqualified
      ${summarySql}`).bind(...bound).first(),
    db.prepare(`SELECT l.source label,count(*) total,
      sum(CASE WHEN link.lead_id IS NOT NULL THEN 1 ELSE 0 END) converted,
      sum(CASE WHEN opp.stage='closed_won' THEN 1 ELSE 0 END) won
      ${summarySql} GROUP BY l.source ORDER BY total DESC LIMIT 100`).bind(...bound).all(),
    db.prepare(`SELECT l.assigned_sales_email label,count(*) total,
      sum(CASE WHEN link.lead_id IS NOT NULL THEN 1 ELSE 0 END) converted,
      sum(CASE WHEN opp.stage='closed_won' THEN 1 ELSE 0 END) won
      ${summarySql} GROUP BY l.assigned_sales_email ORDER BY total DESC LIMIT 100`).bind(...bound).all(),
    db.prepare(`SELECT coalesce(d.reason_code,'LEGACY_UNCLASSIFIED') label,count(*) total
      FROM india_marketing_leads l LEFT JOIN india_lead_disqualifications d
       ON d.lead_id=l.id AND d.tenant_id=l.tenant_id AND d.active=1
      WHERE l.status='disqualified' AND ${ownerSql}
      GROUP BY coalesce(d.reason_code,'LEGACY_UNCLASSIFIED') ORDER BY total DESC`).bind(...bound).all()
   ]);
   return response({success:true,overall,by_source:bySource.results,by_owner:byOwner.results,by_reason:byReason.results,
    definition:'Converted = link Customer/Opportunity exists; Won = linked Opportunity at closed_won. Includes all visible Leads (not just paged queue).'});
  }
  if(mode!=='queue')return failure('Mode tidak terdaftar',422);
  const rows=await db.prepare(`SELECT l.id,l.lead_number,l.account_name,l.source,l.campaign,l.status,l.version,l.qualification_json,
   l.service_family,l.contact_email,l.assigned_sales_email,l.estimated_value_idr,l.expected_closing_date,
   coalesce(a.calls,0) calls,coalesce(a.emails,0) emails,coalesce(a.meetings,0) meetings,coalesce(a.follow_ups,0) follow_ups,
   p.state nurture_state,p.next_touch_at,p.version plan_version,p.channel nurture_channel,p.cadence_days,
   d.reason_code,d.reason_text
   FROM india_marketing_leads l
   LEFT JOIN (
    SELECT tenant_id,lead_id,
     sum(CASE WHEN kind='call' THEN 1 ELSE 0 END) calls,
     sum(CASE WHEN kind='email' THEN 1 ELSE 0 END) emails,
     sum(CASE WHEN kind='meeting' THEN 1 ELSE 0 END) meetings,
     sum(CASE WHEN kind='follow_up' THEN 1 ELSE 0 END) follow_ups
    FROM india_marketing_activities GROUP BY tenant_id,lead_id
   ) a ON a.tenant_id=l.tenant_id AND a.lead_id=l.id
   LEFT JOIN india_lead_nurture_plans p ON p.tenant_id=l.tenant_id AND p.lead_id=l.id
   LEFT JOIN india_lead_disqualifications d ON d.tenant_id=l.tenant_id AND d.lead_id=l.id AND d.active=1
   WHERE ${ownerSql} ORDER BY l.updated_at DESC LIMIT 500`).bind(TENANT,visible(role),email).all();
  const leads=rows.results.map(r=>{const score=computeLeadScore(r as unknown as Parameters<typeof computeLeadScore>[0]);
   const o=r as Record<string,unknown>;const {qualification_json,...rest}=o;
   return {...rest,...score,reason_code:o.reason_code||(o.status==='disqualified'?'LEGACY_UNCLASSIFIED':null)};});
  return response({success:true,leads,limit:500});
 }catch{return failure('Lead Intelligence belum tersedia; periksa migrasi 0014 dan koneksi D1',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!allowed.includes(role))return failure('Tidak berwenang',403);
 if(!authorizeWrite(req))return failure('Origin tidak diizinkan',403);
 let p:Record<string,unknown>;
 try{p=await body(req);}catch{return failure('JSON tidak valid atau terlalu besar',400);}
 const id=text(p.id,100),action=text(p.action,30);
 if(!safeID(id))return failure('Lead ID tidak valid',422);
 if(!Number.isSafeInteger(p.version))return failure('Versi Lead wajib dan harus integer',422);
 try{
  const r=await lead(db,id);if(!r)return failure('Lead tidak ditemukan',404);
  if(!access(role,email,r))return failure('Lead bukan milik pengguna',403);
  if(p.version!==r.version)return failure('Versi Lead berubah; muat ulang',409);
  if(r.status==='converted')return failure('Lead Converted tidak dapat diubah',409);
  const audit=(name:string,desc:string,version:number)=>
   db.prepare("INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) SELECT ?,tenant_id,'lead',id,?,?,? FROM india_marketing_leads WHERE tenant_id=? AND id=? AND version=?")
    .bind(crypto.randomUUID(),name,email,desc,TENANT,id,version);
  const event=(kind:string,reason:string|null,desc:string,version:number)=>
   db.prepare('INSERT INTO india_lead_intelligence_events(id,tenant_id,lead_id,event_type,actor_email,reason_code,detail) SELECT ?,tenant_id,id,?,?,?,? FROM india_marketing_leads WHERE tenant_id=? AND id=? AND version=?')
    .bind(crypto.randomUUID(),kind,email,reason,desc,TENANT,id,version);
  if(action==='disqualify'){
   if(r.status==='disqualified')return failure('Lead sudah Disqualified',409);
   if(!isReasonCode(p.reason_code))return failure('Reason code wajib dari katalog resmi',422);
   const reason=text(p.reason_text,500);if(reason.length<3)return failure('Jelaskan alasan (minimum 3 karakter)',422);
   const q=JSON.parse(r.qualification_json||'{}') as Record<string,string>;
   q.disqualification_reason=reason;
   const score=computeLeadScore(r),cadence=suggestedCadence(score.temperature),soft=canReactivate(p.reason_code);
   const statements=[
    db.prepare("UPDATE india_marketing_leads SET status='disqualified',qualification_json=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND version=? AND status IN ('new','assigned','qualified')")
     .bind(JSON.stringify(q),email,TENANT,id,r.version),
    db.prepare(`INSERT INTO india_lead_disqualifications(lead_id,tenant_id,reason_code,reason_text,active,changed_by)
     SELECT id,tenant_id,?,?,1,? FROM india_marketing_leads WHERE id=? AND tenant_id=? AND version=? AND status='disqualified'
     ON CONFLICT(lead_id) DO UPDATE SET reason_code=excluded.reason_code,reason_text=excluded.reason_text,active=1,changed_by=excluded.changed_by,changed_at=CURRENT_TIMESTAMP`)
     .bind(p.reason_code,reason,email,id,TENANT,r.version+1),
    db.prepare(`INSERT INTO india_lead_nurture_plans(lead_id,tenant_id,state,cadence_days,channel,next_touch_at,created_by,updated_by)
     SELECT id,tenant_id,?,?,?,?,?,? FROM india_marketing_leads WHERE id=? AND tenant_id=? AND version=? AND status='disqualified'
     ON CONFLICT(lead_id) DO UPDATE SET state=excluded.state,cadence_days=excluded.cadence_days,channel=excluded.channel,
      next_touch_at=excluded.next_touch_at,version=india_lead_nurture_plans.version+1,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
     .bind(soft?'active':'cancelled',cadence,'follow_up',advanceDate(today(),cadence),email,email,id,TENANT,r.version+1),
    event('DISQUALIFY',p.reason_code,reason,r.version+1),
    audit('DISQUALIFY',p.reason_code+': '+reason,r.version+1)
   ];
   if(!await write(db,statements))return failure('Lead berubah secara bersamaan',409);
   return response({success:true,status:'disqualified',nurture:soft?'active':'cancelled',next_review_at:soft?advanceDate(today(),cadence):null});
  }
  if(action==='reactivate'){
   if(r.status!=='disqualified')return failure('Hanya Lead Disqualified yang dapat diaktifkan kembali',409);
   const d=await db.prepare('SELECT reason_code FROM india_lead_disqualifications WHERE tenant_id=? AND lead_id=? AND active=1')
    .bind(TENANT,id).first<{reason_code:string}>();
   if(!d||!canReactivate(d.reason_code))return failure('Reason tidak dapat diaktifkan otomatis; perlu review Admin',409);
   if(!r.contact_name&&!r.contact_email)return failure('Kontak Lead harus dilengkapi sebelum reaktivasi',422);
   const result=await write(db,[
    db.prepare("UPDATE india_marketing_leads SET status='assigned',version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND version=? AND status='disqualified'")
     .bind(email,TENANT,id,r.version),
    db.prepare('UPDATE india_lead_disqualifications SET active=0,changed_by=?,changed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND lead_id=? AND active=1 AND EXISTS(SELECT 1 FROM india_marketing_leads WHERE tenant_id=? AND id=? AND status='assigned' AND version=?)')
     .bind(email,TENANT,id,TENANT,id,r.version+1),
    // Preserve existing schedule as a legitimate next action, unless already completed.
    event('REACTIVATE',d.reason_code,'Reactivated to assigned; BANT must be revalidated before conversion',r.version+1),
    audit('REACTIVATE',d.reason_code,r.version+1)
   ]);
   if(!result)return failure('Reaktivasi berbenturan dengan transaksi lain',409);
   return response({success:true,status:'assigned'});
  }
  if(['plan','touch','pause','resume','complete'].includes(action)){
   if(!['new','assigned','disqualified'].includes(r.status))return failure('Lead sudah Qualified; nurturing tidak berlaku',409);
   if(r.status==='disqualified'){
    const reason=await db.prepare('SELECT reason_code FROM india_lead_disqualifications WHERE tenant_id=? AND lead_id=? AND active=1').bind(TENANT,id).first<{reason_code:string}>();
    if(!reason||!canReactivate(reason.reason_code))return failure('Nurturing tidak diizinkan untuk hard-disqualified atau reason legacy',409);
   }
   const current=await db.prepare('SELECT * FROM india_lead_nurture_plans WHERE tenant_id=? AND lead_id=?').bind(TENANT,id).first<Plan>();
   const cadence=Number(p.cadence_days??current?.cadence_days),channel=text(p.channel??current?.channel,30);
   if(![7,14,30,60,90].includes(cadence)||!['call','email','meeting','follow_up'].includes(channel))
    return failure('Cadence atau channel tidak valid',422);
   const planVer=p.plan_version;
   if(current&&(!Number.isSafeInteger(planVer)||planVer!==current.version))return failure('Plan berubah; muat ulang',409);
   if(!current&&action!=='plan')return failure('Nurture plan belum dibuat',409);
   const nextDate=text(p.next_touch_at??current?.next_touch_at,10);
   if(!validISODate(nextDate))return failure('Tanggal aktivitas tidak valid',422);
   if(action==='plan'&&nextDate<today())return failure('Jadwal awal tidak boleh di masa lalu',422);
   let state='active',next=nextDate,summary='';
   if(action==='touch'){
    if(current?.state!=='active')return failure('Hanya plan aktif yang dapat mencatat aktivitas',409);
    summary=text(p.summary,500);if(summary.length<3)return failure('Ringkasan aktivitas wajib (minimal 3 karakter)',422);
    next=advanceDate(today(),cadence);
   }else if(action==='pause'){state='paused';if(current?.state!=='active')return failure('Hanya plan aktif yang dapat dijeda',409);}
   else if(action==='resume'){if(current?.state!=='paused')return failure('Hanya plan paused yang dapat dilanjutkan',409);next=nextDate<today()?today():nextDate;}
   else if(action==='complete'){state='completed';if(!['active','paused'].includes(current?.state||''))return failure('Plan tidak aktif',409);}
   const nextVer=(current?.version||0)+1,statements:ReturnType<D1DB['prepare']>[]=[];
   if(!current){
    statements.push(db.prepare(`INSERT INTO india_lead_nurture_plans(lead_id,tenant_id,state,cadence_days,channel,next_touch_at,created_by,updated_by)
      SELECT id,tenant_id,'active',?,?,?,?,? FROM india_marketing_leads
      WHERE id=? AND tenant_id=? AND version=? AND status IN ('new','assigned','disqualified')`)
     .bind(cadence,channel,next,email,email,id,TENANT,r.version));
   }else{
    statements.push(db.prepare(`UPDATE india_lead_nurture_plans
      SET state=?,cadence_days=?,channel=?,next_touch_at=?,last_touch_at=CASE WHEN ?='touch' THEN ? ELSE last_touch_at END,
       touch_count=touch_count+CASE WHEN ?='touch' THEN 1 ELSE 0 END,version=version+1,
       updated_by=?,updated_at=CURRENT_TIMESTAMP
      WHERE tenant_id=? AND lead_id=? AND version=? AND EXISTS(
       SELECT 1 FROM india_marketing_leads WHERE tenant_id=? AND id=? AND version=? AND status IN ('new','assigned','disqualified'))`)
     .bind(state,cadence,channel,next,action,today(),action,email,TENANT,id,current.version,TENANT,id,r.version));
   }
   const ensurePlan=(sql:string,values:(string|number|null)[])=>
    db.prepare(sql).bind(...values);
   if(action==='touch')statements.push(ensurePlan(
    `INSERT INTO india_marketing_activities(id,tenant_id,lead_id,kind,summary,next_action_at,created_by)
     SELECT ?,tenant_id,lead_id,?,?,?,? FROM india_lead_nurture_plans WHERE tenant_id=? AND lead_id=? AND version=? AND state='active'`,
    [crypto.randomUUID(),channel,summary,next,email,TENANT,id,nextVer]));
   const kind=action==='plan'?'PLAN':action==='touch'?'TOUCH':action==='pause'?'PAUSE':action==='resume'?'RESUME':'COMPLETE';
   statements.push(ensurePlan(
    `INSERT INTO india_lead_intelligence_events(id,tenant_id,lead_id,event_type,actor_email,detail)
     SELECT ?,tenant_id,lead_id,?,?,? FROM india_lead_nurture_plans WHERE tenant_id=? AND lead_id=? AND version=?`,
    [crypto.randomUUID(),kind,email,action==='touch'?summary:'Cadence '+cadence+' days; next '+next,TENANT,id,nextVer]));
   statements.push(ensurePlan(
    `INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary)
     SELECT ?,tenant_id,'lead',lead_id,?,?,? FROM india_lead_nurture_plans WHERE tenant_id=? AND lead_id=? AND version=?`,
    [crypto.randomUUID(),'NURTURE_'+kind,email,'Next '+next,TENANT,id,nextVer]));
   if(!await write(db,statements))return failure('Nurture plan berubah atau transaksi dibatalkan',409);
   return response({success:true,state,next_touch_at:next,plan_version:nextVer});
  }
  return failure('Aksi tidak dikenal',422);
 }catch(e){
  if(String(e).includes('UNIQUE')||String(e).includes('constraint'))return failure('Benturan versi atau aturan database',409);
  return failure('Transaksi Lead Intelligence gagal. Periksa migrasi 0014.',503);
 }
}
