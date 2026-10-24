import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT} from '@/lib/sales-workflow';
import {loadSalesForecastRows} from '@/lib/sales-forecast-d1';
import {buildSalesForecast} from '@/lib/sales-forecast';
import {buildExecutiveSalesDashboard,type ExecutiveMeta,type SalesTarget,type SalesActivity,type SalesMember} from '@/lib/executive-sales';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {atomicSales,salesAudit} from '@/lib/sales-transactions';

export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
const periodOK=(s:unknown):s is string=>typeof s==='string'&&/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(s);
const emailOK=(s:unknown):s is string=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const jakartaDate=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const csv=(rows:{owner:string;target_idr:number|null;booked_idr:number;attainment_pct:number|null;pipeline_idr:number;weighted_idr:number;revenue_idr:number;won:number;lost:number;completed_tasks:number}[])=>{
 const cell=(v:unknown)=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';
 return '\uFEFF'+[['Sales','Target IDR','Booked IDR','Attainment %','Pipeline IDR','Weighted IDR','Revenue IDR','Won','Lost','Completed tasks'],...rows.map(x=>[x.owner,x.target_idr,x.booked_idr,x.attainment_pct,x.pipeline_idr,x.weighted_idr,x.revenue_idr,x.won,x.lost,x.completed_tasks])].map(x=>x.map(cell).join(',')).join('\r\n');
};
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!['admin','sales','finance','approver'].includes(role))return fail('Dashboard hanya untuk Sales, Finance, Approver atau Admin',403);
 const url=new URL(req.url),period=url.searchParams.get('period')||jakartaDate().slice(0,7),owner=(url.searchParams.get('owner')||'').toLowerCase().trim();
 if(!periodOK(period)||(owner&&!emailOK(owner)))return fail('Periode YYYY-MM atau Sales tidak valid',422);
 if(role==='sales'&&owner&&owner!==email)return fail('Sales tidak dapat membaca target atau transaksi rekan kerja',403);
 if(url.searchParams.get('format')&&!['csv'].includes(url.searchParams.get('format')||''))return fail('Format output tidak tersedia',422);
 const selected=role==='sales'?email:owner;
 const restriction=selected?' AND lower(d.created_by)=?':'';
 const targetRestriction=selected?' AND lower(owner_email)=?':'';
 const taskRestriction=selected?' AND lower(owner_email)=?':'';
 const rosterRestriction=selected?' AND lower(email)=?':'';
 try{
  const [rows,metaResult,targetsResult,activityResult,membersResult]=await Promise.all([
   loadSalesForecastRows(db,period,selected),
   db.prepare(
    "SELECT d.id,date(d.created_at,'+7 hours') AS created_at,"+
    " (SELECT count(*) FROM india_sales_releases r WHERE r.tenant_id=d.tenant_id AND r.opportunity_id=d.id AND r.proposal_snapshot IS NOT NULL) AS proposal_count,"+
    " (SELECT date(max(au.created_at),'+7 hours') FROM india_sales_audit au WHERE au.tenant_id=d.tenant_id AND au.entity_type='deal' AND au.entity_id=d.id AND au.to_stage='closed_lost') AS lost_closed_date,"+
    " json_extract(d.data_json,'$.service_family') AS service_family,json_extract(d.data_json,'$.lost_reason') AS lost_reason,"+
    " (SELECT count(*) FROM india_sales_submissions s WHERE s.tenant_id=d.tenant_id AND s.opportunity_id=d.id AND s.status='verified' AND substr(date(s.sent_at,'+7 hours'),1,7)=?) AS verified_submitted_period"+
    " FROM india_sales_opportunities d WHERE d.tenant_id=?"+restriction
   ).bind(period,TENANT,...(selected?[selected]:[])).all<ExecutiveMeta>(),
   db.prepare('SELECT owner_email,period,amount_idr,version,rationale FROM india_sales_targets WHERE tenant_id=? AND period=?'+targetRestriction)
    .bind(TENANT,period,...(selected?[selected]:[])).all<SalesTarget>(),
   db.prepare("SELECT owner_email,kind,count(*) AS count FROM india_sales_activity_tasks WHERE tenant_id=? AND status='completed' AND substr(date(completed_at,'+7 hours'),1,7)=?"+taskRestriction+" GROUP BY owner_email,kind")
    .bind(TENANT,period,...(selected?[selected]:[])).all<SalesActivity>(),
   db.prepare("SELECT email FROM india_members WHERE active=1 AND role='sales'"+rosterRestriction)
    .bind(...(selected?[selected]:[])).all<SalesMember>()
  ]);
  const forecast=buildSalesForecast(rows,period,jakartaDate());
  const data=buildExecutiveSalesDashboard(forecast,metaResult.results,targetsResult.results,activityResult.results,membersResult.results,jakartaDate());
  if(url.searchParams.get('format')==='csv')return new Response(csv(data.by_owner),{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="INDIA_Executive_Sales_'+period+'.csv"'}});
  return reply({success:true,role,identityEmail:email,generated_at:new Date().toISOString(),...data});
 }catch(e){
  return fail(String(e).includes('presisi')?'Agregasi melampaui presisi finansial; gunakan periode/filter Sales lebih kecil.':'Executive Dashboard belum tersedia. Verifikasi migrasi 0013/0018/0019/0024 dan keterhubungan D1.',503);
 }
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(role!=='admin')return fail('Hanya Admin/Sales Manager yang berwenang mengubah target',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let body:Record<string,unknown>;
 try{body=await readBoundedJSON(req,4000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 const period=body.period,owner=typeof body.owner_email==='string'?body.owner_email.toLowerCase().trim():null;
 const target=body.amount_idr,version=body.version,rationale=body.rationale;
 if(!periodOK(period)||!emailOK(owner)||!Number.isSafeInteger(target)||Number(target)<=0||Number(target)>=1e14||
 !Number.isSafeInteger(version)||Number(version)<0||typeof rationale!=='string'||rationale.trim().length<12||rationale.length>1000)
  return fail('Periode, akun Sales, nilai target rupiah positif, version dan alasan 12–1000 karakter wajib',422);
 try{
  const member=await db.prepare("SELECT email FROM india_members WHERE email=? AND role='sales' AND active=1").bind(owner).first();
  if(!member)return fail('Target hanya boleh diberikan kepada user Sales aktif di D1',422);
  const old=await db.prepare('SELECT version FROM india_sales_targets WHERE tenant_id=? AND period=? AND owner_email=?').bind(TENANT,period,owner).first<{version:number}>();
  if((old?.version||0)!==version)return fail('Target telah diperbarui oleh pengguna lain. Muat ulang sebelum menyimpan.',409);
  const nextVersion=Number(version)+1;
  const guard=old?
   "EXISTS(SELECT 1 FROM india_sales_targets WHERE tenant_id=? AND period=? AND owner_email=? AND version=?)":
   "NOT EXISTS(SELECT 1 FROM india_sales_targets WHERE tenant_id=? AND period=? AND owner_email=?)";
  const args:[string,string,string,...number[]]=[TENANT,period,owner,...(old?[Number(version)]:[])];
  await atomicSales(db,guard,args,[
   db.prepare('INSERT INTO india_sales_targets(tenant_id,period,owner_email,amount_idr,version,rationale,updated_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,period,owner_email) DO UPDATE SET amount_idr=excluded.amount_idr,version=excluded.version,rationale=excluded.rationale,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP')
    .bind(TENANT,period,owner,Number(target),nextVersion,rationale.trim(),email),
   db.prepare('INSERT INTO india_sales_target_events(id,tenant_id,period,owner_email,version,amount_idr,rationale,actor_email) VALUES(?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),TENANT,period,owner,nextVersion,Number(target),rationale.trim(),email),
   salesAudit(db,period+':'+owner,'TARGET_UPDATED',email,'Target Sales bulanan ditetapkan/revisi untuk '+period)
  ]);
  return reply({success:true,owner_email:owner,period,version:nextVersion},201);
 }catch(e){
  if(/FLOW_CONFLICT|constraint|TARGET_EVENT_IMMUTABLE/i.test(String(e)))return fail('Target berubah atau melanggar constraint; muat ulang.',409);
  return fail('Perubahan target tidak tersimpan. Periksa migrasi 0024.',503);
 }
}
