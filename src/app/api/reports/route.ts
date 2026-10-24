import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {loadSalesForecastRows} from '@/lib/sales-forecast-d1';
import {buildSalesForecast} from '@/lib/sales-forecast';
import {txt,integer,periodOK,jakartaDate,csvText,financialSum,operationEvent} from '@/lib/operations';
import {boqTotals,type BoQLine,type CostLine} from '@/lib/boq-domain';
import {canReadDeal} from '@/lib/sales-access';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const reportColumns:Record<string,string[]>={
 gross_margin:['id','customer','quotation_number','quoted_value_idr','estimated_hpp_idr','estimated_gross_profit_idr','estimated_margin_pct'],
 pipeline:['id','title','company_name','owner','stage','amount','probability','category','expected_close_date','weighted_amount','booked_amount','recognized_revenue'],
 marketing:['source','campaign','lead_count','qualified_count','converted_count','disqualified_count','conversion_pct'],
 profitability:['customer','recognized_revenue_idr','actual_cost_idr','provisional_gross_profit_idr','provisional_margin_pct','cost_entries','cost_coverage'],
 deal_intelligence:['id','title','stage','age_days','risk_level','gaps','next_action'],
};
const canView=(role:string,view:string)=>view==='marketing'?['admin','marketing','sales','finance','approver'].includes(role):['profitability','gross_margin'].includes(view)?['admin','finance'].includes(role):['admin','sales','finance','approver'].includes(role);
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 const url=new URL(req.url),view=url.searchParams.get('view')||'pipeline',period=url.searchParams.get('period')||jakartaDate().slice(0,7),owner=txt(url.searchParams.get('owner'),254).toLowerCase();
 if(!reportColumns[view]||!periodOK(period)||url.searchParams.get('format')&&!['csv','json'].includes(url.searchParams.get('format')||''))return fail('Jenis laporan, periode atau format tidak valid');
 if(!canView(role,view))return fail('Akses laporan ditolak',403);
 if(owner&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner))return fail('Filter Sales tidak valid');
 if(role==='sales'&&owner&&owner!==email)return fail('Sales hanya dapat membaca transaksi sendiri',403);
 const selected=role==='sales'?email:owner;
 const requested=(url.searchParams.get('columns')||'').split(',').filter(Boolean),columns=requested.length?requested:reportColumns[view];
 if(columns.length>15||columns.some(x=>!reportColumns[view].includes(x)))return fail('Kolom di luar daftar report builder');
 try{
  let rows:Record<string,unknown>[]=[],summary:Record<string,unknown>={};
  if(view==='marketing'){
   const restricted=role==='marketing'?' AND lower(l.created_by)=?':selected?' AND lower(l.assigned_sales_email)=?':'';
   const result=await db.prepare("SELECT l.source,coalesce(nullif(l.campaign,''),'Tanpa kampanye') AS campaign,count(*) AS lead_count,sum(CASE WHEN l.status IN ('qualified','converted') THEN 1 ELSE 0 END) AS qualified_count,sum(CASE WHEN l.status='converted' AND EXISTS(SELECT 1 FROM india_sales_lead_links b WHERE b.lead_id=l.id AND b.tenant_id=l.tenant_id) THEN 1 ELSE 0 END) AS converted_count,sum(CASE WHEN l.status='disqualified' THEN 1 ELSE 0 END) AS disqualified_count FROM india_marketing_leads l WHERE l.tenant_id=? AND substr(date(l.created_at,'+7 hours'),1,7)=?"+restricted+' GROUP BY l.source,l.campaign ORDER BY lead_count DESC,l.source,l.campaign').bind(TENANT,period,...(role==='marketing'?[email]:selected?[selected]:[])).all<{source:string;campaign:string;lead_count:number;qualified_count:number;converted_count:number;disqualified_count:number}>();
   rows=result.results.map(x=>({...x,conversion_pct:x.lead_count?Math.round(x.converted_count/x.lead_count*10000)/100:null}));
   summary={methodology:'Cohort Lead dibuat pada bulan terpilih; status dan tautan konversi terkini. Qualified mencakup Converted. Bukan historical snapshot status bulanan.'};
  }else{
   const forecast=buildSalesForecast(await loadSalesForecastRows(db,period,selected),period,jakartaDate());
   if(view==='pipeline'){rows=forecast.deals.filter(d=>d.included||d.booked_amount>0||d.recognized_revenue!==0);summary={...forecast.totals,issues:forecast.issues,methodology:'Forecast dan Booked Sales menggunakan sumber kanonik yang sama dengan Executive Dashboard.'};}
   if(view==='gross_margin'){
    const result=await db.prepare("SELECT d.id,a.legal_name AS customer,b.quotation_number,b.line_items_json,b.cost_items_json,b.vat_rate FROM india_sales_opportunities d JOIN india_sales_accounts a ON a.id=d.company_id AND a.tenant_id=d.tenant_id JOIN india_sales_releases r ON r.opportunity_id=d.id AND r.tenant_id=d.tenant_id AND r.status='approved' JOIN india_boq b ON b.id=r.boq_id AND b.edit_seq=r.boq_edit_seq AND b.status='approved' WHERE d.tenant_id=?"+(selected?' AND lower(d.created_by)=?':'')).bind(TENANT,...(selected?[selected]:[])).all<{id:string;customer:string;quotation_number:string;line_items_json:string;cost_items_json:string;vat_rate:number}>();
    const relevant=new Set(forecast.deals.filter(d=>d.included||d.booked_amount>0).map(d=>d.id));
    rows=result.results.filter(x=>relevant.has(x.id)).map(x=>{const totals=boqTotals(JSON.parse(x.line_items_json) as BoQLine[],JSON.parse(x.cost_items_json) as CostLine[],x.vat_rate);return {id:x.id,customer:x.customer,quotation_number:x.quotation_number,quoted_value_idr:totals.subtotal,estimated_hpp_idr:totals.hpp,estimated_gross_profit_idr:totals.gp,estimated_margin_pct:totals.margin};});summary={methodology:'Margin estimasi paket dan BoQ aktif yang telah disetujui, sebelum PPN, menurut estimasi closing kanonik atau verified booked pada bulan terpilih. Bukan margin realisasi; HPP hanya Finance/Admin.'};
   }
   if(view==='profitability'){
    const result=await db.prepare("SELECT a.legal_name AS customer,coalesce((SELECT sum(CASE WHEN c.reverses_id IS NULL THEN c.amount_idr ELSE -c.amount_idr END) FROM india_actual_costs c JOIN india_sales_opportunities d ON d.id=c.opportunity_id AND d.tenant_id=c.tenant_id WHERE c.tenant_id=a.tenant_id AND d.company_id=a.id AND c.period=? AND c.status='approved' "+(selected?' AND lower(d.created_by)=?':'')+"),0) AS actual_cost_idr,(SELECT count(*) FROM india_actual_costs c JOIN india_sales_opportunities d ON d.id=c.opportunity_id AND d.tenant_id=c.tenant_id WHERE c.tenant_id=a.tenant_id AND d.company_id=a.id AND c.period=? AND c.status='approved' "+(selected?' AND lower(d.created_by)=?':'')+") AS cost_entries FROM india_sales_accounts a WHERE a.tenant_id=?").bind(period,...(selected?[selected]:[]),period,...(selected?[selected]:[]),TENANT).all<{customer:string;actual_cost_idr:number;cost_entries:number}>();
    const names=new Set([...forecast.deals.filter(d=>d.recognized_revenue!==0).map(d=>d.company_name),...result.results.filter(x=>x.cost_entries).map(x=>x.customer)]);
    rows=Array.from(names).map(customer=>{const cost=result.results.find(x=>x.customer===customer),revenue=financialSum(forecast.deals.filter(d=>d.company_name===customer).map(d=>d.recognized_revenue)),actual=cost?.actual_cost_idr||0,gp=cost?.cost_entries?financialSum([revenue,-actual]):null;return {customer,recognized_revenue_idr:revenue,actual_cost_idr:cost?.cost_entries?actual:null,provisional_gross_profit_idr:gp,provisional_margin_pct:gp!==null&&revenue>0?Math.round(gp/revenue*10000)/100:null,cost_entries:cost?.cost_entries||0,cost_coverage:cost?.cost_entries?'Recorded costs only; closing completeness not certified':'No approved actual costs'};});
    summary={methodology:'Revenue yang disetujui independen minus register biaya aktual yang disetujui independen. Margin bersifat provisional hingga rekonsiliasi seluruh biaya selesai; tidak menggunakan estimasi HPP sebagai biaya aktual.'};
   }
   if(view==='deal_intelligence'){
    const meta=await db.prepare("SELECT d.id,d.created_at,(SELECT min(t.due_at) FROM india_sales_activity_tasks t WHERE t.tenant_id=d.tenant_id AND t.opportunity_id=d.id AND t.status='planned') AS next_due FROM india_sales_opportunities d WHERE d.tenant_id=?"+(selected?' AND lower(d.created_by)=?':'')).bind(TENANT,...(selected?[selected]:[])).all<{id:string;created_at:string;next_due:string|null}>();
    rows=forecast.deals.filter(d=>!['closed_won','closed_lost'].includes(d.stage)).map(d=>{
     const m=meta.results.find(x=>x.id===d.id),days=m?Math.max(0,Math.floor((Date.parse(jakartaDate())-Date.parse(m.created_at.slice(0,10)))/86400000)):null;
     const gaps=forecast.issues.filter(x=>x.id===d.id).map(x=>x.reason);if(d.overdue)gaps.push('Estimasi closing telah lewat');if(days!==null&&days>90)gaps.push('Deal aging >90 hari');if(!m?.next_due)gaps.push('Next activity belum dijadwalkan');else if(m.next_due.slice(0,10)<jakartaDate())gaps.push('Activity overdue');
     return {id:d.id,title:d.title,stage:d.stage,age_days:days,risk_level:gaps.length>=3?'high':gaps.length?'medium':'low',gaps:gaps.join('; ')||'Tidak ada gap pada pemeriksaan ini',next_action:gaps.length?'Review gap, verifikasi data dan tetapkan next action bersama pemilik deal':'Lanjutkan aktivitas sesuai jadwal'};
    });summary={methodology:'Rule-based deal intelligence pada data D1 terkini, seluruh deal terbuka dalam cakupan akses. AI opsional memakai ringkasan anonim setelah konfirmasi; AI tidak menetapkan persetujuan atau mengubah forecast.'};
   }
  }
  const definitions=await db.prepare('SELECT * FROM india_report_definitions WHERE tenant_id=? AND owner_email=? ORDER BY updated_at DESC LIMIT 100').bind(TENANT,email).all();
  if(url.searchParams.get('format')==='csv')return new Response(csvText(columns,rows.map(r=>columns.map(c=>r[c]))),{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="INDIA_'+view+'_'+period+'.csv"'}});
  const projected=rows.map(r=>Object.fromEntries(columns.map(c=>[c,r[c]])));
  return reply({success:true,role,identityEmail:email,view,period,columns,available_columns:reportColumns[view],rows:projected,summary,definitions:definitions.results,generated_at:new Date().toISOString()});
 }catch(e){return fail(String(e).includes('Presisi')?'Agregasi melampaui presisi; persempit filter.':'Laporan belum tersedia. Verifikasi migrasi 0026 dan keterhubungan data D1.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,10000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 try{
  if(p.action==='save_report'){
   const view=String(p.view);if(!reportColumns[view]||!canView(role,view))return fail('Akses jenis laporan ditolak',403);
   if(txt(p.title,240).length<3||!periodOK(p.period)||!Array.isArray(p.columns)||!p.columns.length||p.columns.length>15||p.columns.some(x=>typeof x!=='string'||!reportColumns[view].includes(x))||!Number.isSafeInteger(p.version)||Number(p.version)<0)return fail('Judul, periode, kolom dan versi laporan wajib valid');
   const id=safeID(p.id)?p.id as string:crypto.randomUUID(),version=Number(p.version),definition=JSON.stringify({view,period:p.period,columns:p.columns});
   const guard=version?'EXISTS(SELECT 1 FROM india_report_definitions WHERE tenant_id=? AND id=? AND owner_email=? AND version=?)':'NOT EXISTS(SELECT 1 FROM india_report_definitions WHERE id=?)';
   await atomicSales(db,guard,version?[TENANT,id,email,version]:[id],[db.prepare('INSERT INTO india_report_definitions(id,tenant_id,title,owner_email,definition_json,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,definition_json=excluded.definition_json,version=excluded.version,updated_at=CURRENT_TIMESTAMP').bind(id,TENANT,txt(p.title,240),email,definition,version+1),operationEvent(db,'report',id,'SAVE',email,{view,columns:p.columns,version:version+1})]);return reply({success:true,id,version:version+1},201);
  }
  if(!['admin','finance'].includes(role))return fail('Biaya aktual hanya Finance/Admin',403);
  if(p.action==='cost'){
   if(!safeID(p.opportunity_id)||!periodOK(p.period)||p.period>jakartaDate().slice(0,7)||!integer(p.amount_idr)||!['vendor','labor','license','travel','cloud','other'].includes(String(p.category))||txt(p.evidence_reference,400).length<8||!/^[a-f0-9]{64}$/.test(txt(p.evidence_sha256,64))||txt(p.notes,1800).length<12)return fail('Opportunity, periode, kategori, nilai rupiah bulat dan bukti biaya wajib valid');
   const deal=await db.prepare('SELECT id,created_by FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,p.opportunity_id as string).first<{id:string;created_by:string}>();if(!deal||!canReadDeal(role,email,deal.created_by))return fail('Opportunity tidak ditemukan',404);
   if(p.reverses_id&&!safeID(p.reverses_id))return fail('ID koreksi biaya tidak valid');
   const reversal=safeID(p.reverses_id)?p.reverses_id as string:null;
   let guard='EXISTS(SELECT 1 FROM india_sales_opportunities WHERE tenant_id=? AND id=?)',args:(string|number|null)[]=[TENANT,deal.id];
   if(reversal){guard+=" AND EXISTS(SELECT 1 FROM india_actual_costs WHERE tenant_id=? AND id=? AND opportunity_id=? AND status='approved' AND reverses_id IS NULL AND amount_idr=? AND category=? AND period<=?)";args.push(TENANT,reversal,deal.id,p.amount_idr,String(p.category),p.period);}
   const id=crypto.randomUUID();await atomicSales(db,guard,args,[db.prepare('INSERT INTO india_actual_costs(id,tenant_id,opportunity_id,period,category,amount_idr,evidence_reference,evidence_sha256,reverses_id,created_by,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,deal.id,p.period,String(p.category),p.amount_idr,txt(p.evidence_reference,400),txt(p.evidence_sha256,64),reversal,email,txt(p.notes,1800)),operationEvent(db,'actual_cost',id,'CREATE',email,{opportunity_id:deal.id,period:p.period,amount:p.amount_idr,reverses_id:reversal})]);return reply({success:true,id},201);
  }
  if(p.action==='review_cost'){
   if(!safeID(p.id)||typeof p.approve!=='boolean'||txt(p.notes,1000).length<12)return fail('ID, keputusan dan alasan review wajib');
   const row=await db.prepare('SELECT id,status,created_by FROM india_actual_costs WHERE tenant_id=? AND id=?').bind(TENANT,p.id as string).first<{id:string;status:string;created_by:string}>();if(!row)return fail('Biaya tidak ditemukan',404);if(row.created_by.toLowerCase()===email)return fail('Maker biaya tidak boleh mereview sendiri',403);if(row.status!=='draft')return fail('Biaya bukan draft',409);
   await atomicSales(db,"EXISTS(SELECT 1 FROM india_actual_costs WHERE tenant_id=? AND id=? AND status='draft')",[TENANT,row.id],[db.prepare('UPDATE india_actual_costs SET status=?,reviewed_by=? WHERE tenant_id=? AND id=?').bind(p.approve?'approved':'rejected',email,TENANT,row.id),operationEvent(db,'actual_cost',row.id,p.approve?'APPROVE':'REJECT',email,{notes:txt(p.notes,1000)})]);return reply({success:true});
  }
  if(p.action==='list_costs'){
   if(!periodOK(p.period))return fail('Periode wajib');const rows=await db.prepare('SELECT c.*,d.title FROM india_actual_costs c JOIN india_sales_opportunities d ON d.id=c.opportunity_id AND d.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.period=? ORDER BY c.created_at DESC LIMIT 500').bind(TENANT,p.period).all();return reply({success:true,items:rows.results});
  }
  return fail('Tindakan laporan tidak tersedia');
 }catch(e){return fail(/constraint|CONFLICT/.test(String(e))?'Data berubah, reversal tidak cocok atau revisi tidak diizinkan.':'Laporan/biaya tidak tersimpan; periksa database.',/constraint|CONFLICT/.test(String(e))?409:503);}
}
