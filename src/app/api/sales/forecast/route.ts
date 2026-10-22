import {tenderReadySQL} from '@/lib/tender-readiness';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {validISODate} from '@/lib/lead-intelligence';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
import {buildSalesForecast,forecastCSV,type ForecastRow} from '@/lib/sales-forecast';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
const commitSQL=`EXISTS(SELECT 1 FROM india_sales_releases r JOIN india_sales_negotiations n ON n.release_id=r.id
 JOIN india_sales_submissions s ON s.id=n.submission_id AND s.status='verified' AND s.release_id=r.id
 JOIN india_boq b ON b.id=r.boq_id AND b.status='approved' AND b.edit_seq=r.boq_edit_seq
 WHERE r.tenant_id=d.tenant_id AND r.opportunity_id=d.id AND r.status='approved' AND n.decision='approved'
 AND n.rowid=(SELECT max(n2.rowid) FROM india_sales_negotiations n2 WHERE n2.release_id=r.id) AND d.stage='pending_po' AND ${tenderReadySQL})`;
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','sales','finance','approver'].includes(role))return fail('Dashboard keuangan hanya Sales/Finance/Approver/Admin',403);
 const u=new URL(req.url),period=u.searchParams.get('period')||new Date(Date.now()+7*3600000).toISOString().slice(0,7),owner=u.searchParams.get('owner')||'';
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||(owner&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)))return fail('Periode YYYY-MM dan filter Sales harus valid',422);
 if(role==='sales'&&owner&&owner.toLowerCase()!==email)return fail('Akses Sales lain ditolak',403);
 const selected=role==='sales'?email:owner.toLowerCase();
 try{
  // One row per Opportunity; no joins that duplicate amount for multiple releases/documents.
  const rows=await db.prepare(`SELECT d.*,a.legal_name AS company_name,f.expected_close_date,f.category,f.version AS forecast_version,f.reason,
   (SELECT coalesce(sum(rv.amount_before_vat),0) FROM india_sales_revenue rv WHERE rv.tenant_id=d.tenant_id AND rv.opportunity_id=d.id AND rv.status='approved' AND substr(rv.recognition_date,1,7)=?) AS recognized_revenue_idr,
   CASE WHEN ${commitSQL} THEN 1 ELSE 0 END AS commit_ready,
   (SELECT p.po_amount_before_vat FROM india_sales_po_checks p JOIN india_sales_releases r ON r.id=p.release_id AND r.status='approved'
    JOIN india_sales_award_documents aw ON aw.id=p.award_id AND aw.release_id=r.id
    WHERE p.tenant_id=d.tenant_id AND p.opportunity_id=d.id AND r.opportunity_id=d.id AND r.tenant_id=d.tenant_id
    AND aw.finance_reviewed_by IS NOT NULL AND aw.legal_reviewed_by IS NOT NULL
    AND lower(aw.finance_reviewed_by)!=lower(aw.legal_reviewed_by) AND aw.document_number=p.po_number
    AND abs(p.po_amount_before_vat-p.quotation_amount_before_vat)<0.01) AS verified_po_amount,
   (SELECT date(max(au.created_at),'+7 hours') FROM india_sales_audit au WHERE au.tenant_id=d.tenant_id AND au.entity_type='deal' AND au.entity_id=d.id AND au.to_stage='closed_won') AS booked_date,
   (SELECT p.po_number FROM india_sales_po_checks p WHERE p.tenant_id=d.tenant_id AND p.opportunity_id=d.id) AS po_number
   FROM india_sales_opportunities d JOIN india_sales_accounts a ON a.id=d.company_id AND a.tenant_id=d.tenant_id
   LEFT JOIN india_sales_forecasts f ON f.tenant_id=d.tenant_id AND f.opportunity_id=d.id
   WHERE d.tenant_id=? ${selected?'AND lower(d.created_by)=?':''} ORDER BY d.created_at DESC`).bind(period,TENANT,...(selected?[selected]:[])).all<ForecastRow>();
  const result=buildSalesForecast(rows.results,period,new Date(Date.now()+7*3600000).toISOString().slice(0,10));
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
