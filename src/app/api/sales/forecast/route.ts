import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {validISODate} from '@/lib/lead-intelligence';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
import {buildSalesForecast,forecastCSV} from '@/lib/sales-forecast';
import {commitSQL,loadSalesForecastRows} from '@/lib/sales-forecast-d1';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','sales','finance','approver'].includes(role))return fail('Dashboard keuangan hanya Sales/Finance/Approver/Admin',403);
 const u=new URL(req.url),period=u.searchParams.get('period')||new Date(Date.now()+7*3600000).toISOString().slice(0,7),owner=u.searchParams.get('owner')||'';
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||(owner&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)))return fail('Periode YYYY-MM dan filter Sales harus valid',422);
 if(role==='sales'&&owner&&owner.toLowerCase()!==email)return fail('Akses Sales lain ditolak',403);
 const selected=role==='sales'?email:owner.toLowerCase();
 try{
  // One row per Opportunity; no joins that duplicate amount for multiple releases/documents.
  const rows=await loadSalesForecastRows(db,period,selected);
  const result=buildSalesForecast(rows,period,new Date(Date.now()+7*3600000).toISOString().slice(0,10));
  if(u.searchParams.get('format')==='csv')return new Response(forecastCSV(result.deals.filter(d=>d.included||d.booked_amount>0||d.recognized_revenue!==0)),{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="India_Forecast_'+period+'.csv"'}});
  return reply({success:true,role,identityEmail:email,generated_at:new Date().toISOString(),...result,notes:'Pipeline memakai estimasi Opportunity. Booked Sales memakai PO terverifikasi sebelum PPN pada bulan Closed Won; Revenue memakai register transaksi dengan referensi GL/invoice/BAST yang disahkan independen pada bulan pengakuan.'});
 }catch(e){return fail(String(e).includes('presisi rupiah')?String(e instanceof Error?e.message:e):'Forecast belum siap. Periksa migrasi 0018 dan integritas transaksi.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','sales'].includes(role))return fail('Forecast hanya diperbarui Sales pemilik/Admin',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,6000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 if(!safeID(p.opportunity_id)||!Number.isSafeInteger(p.flow_version)||!Number.isSafeInteger(p.forecast_version)||!validISODate(p.expected_close_date)||!['pipeline','best_case','commit','omit'].includes(String(p.category))||typeof p.reason!=='string'||p.reason.trim().length<12||p.reason.length>2000)return fail('Versi, estimasi closing, kategori dan alasan 12–2000 karakter wajib',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,p.opportunity_id as string).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(!canReadDeal(role,email,d.created_by))return fail('Akses Opportunity ditolak',403);
  if(d.flow_version!==p.flow_version||['closed_won','closed_lost'].includes(d.stage))return fail('Versi berubah atau Opportunity tertutup',409);
  const old=await db.prepare('SELECT version FROM india_sales_forecasts WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<{version:number}>();
  if((old?.version||0)!==p.forecast_version)return fail('Versi forecast berubah',409);
  const g=dealGuard(d);
  if(p.category==='commit'){
   const ready=await db.prepare('SELECT id FROM india_sales_opportunities d WHERE d.id=? AND '+commitSQL).bind(d.id).first();
   if(!ready)return fail('Commit memerlukan Pending PO, paket aktif dan negosiasi approved dengan submission terverifikasi',409);
   g.condition+=' AND EXISTS(SELECT 1 FROM india_sales_opportunities d WHERE d.id=? AND '+commitSQL+')';g.args.push(d.id);
  }
  g.condition+=old?' AND EXISTS(SELECT 1 FROM india_sales_forecasts WHERE tenant_id=? AND opportunity_id=? AND version=?)':' AND NOT EXISTS(SELECT 1 FROM india_sales_forecasts WHERE tenant_id=? AND opportunity_id=?)';g.args.push(TENANT,d.id,...(old?[old.version]:[]));
  const version=(old?.version||0)+1,snapshot=JSON.stringify({expected_close_date:p.expected_close_date,category:p.category,reason:p.reason.trim(),flow_version:d.flow_version});
  await atomicSales(db,g.condition,g.args,[
   db.prepare('INSERT INTO india_sales_forecasts(tenant_id,opportunity_id,expected_close_date,category,reason,version,updated_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,opportunity_id) DO UPDATE SET expected_close_date=excluded.expected_close_date,category=excluded.category,reason=excluded.reason,version=excluded.version,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').bind(TENANT,d.id,p.expected_close_date,p.category as string,p.reason.trim(),version,email),
   db.prepare('INSERT INTO india_sales_forecast_events(id,tenant_id,opportunity_id,version,snapshot_json,actor_email) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,d.id,version,snapshot,email),
   salesAudit(db,d.id,'FORECAST_UPDATED',email,p.category+' / '+p.expected_close_date+' / '+p.reason)
  ]);
  return reply({success:true,version});
 }catch(e){return fail(/constraint/i.test(String(e))?'Versi transaksi berubah; muat ulang.':'Forecast tidak tersimpan. Periksa migrasi 0018.',/constraint/i.test(String(e))?409:503);}
}
