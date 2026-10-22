import {validISODate} from './lead-intelligence';
export const forecastProbability:Record<string,number>={prospecting:10,qualified:25,discovery:35,solution_design:50,commercial_review:60,quotation_sent:70,negotiation:80,pending_po:90,closed_won:100,closed_lost:0};
export type ForecastRow={id:string;title:string;company_name:string;created_by:string;stage:string;estimated_value_idr:number;data_json:string;flow_version:number;
 expected_close_date:string|null;category:string|null;forecast_version:number|null;reason:string|null;verified_po_amount:number|null;booked_date:string|null;po_number:string|null;commit_ready:number;recognized_revenue_idr?:number};
const amount=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<1e14;
export function buildSalesForecast(rows:ForecastRow[],period:string,today:string){
 const issues:{id:string;title:string;reason:string}[]=[];
 const deals=rows.map(r=>{
  let f:Record<string,unknown>={};try{const x=JSON.parse(r.data_json);if(!x||typeof x!=='object'||Array.isArray(x))throw Error();f=x;}catch{issues.push({id:r.id,title:r.title,reason:'Data Opportunity tidak valid'});}
  const close=r.expected_close_date||(typeof f.expected_closing_date==='string'?f.expected_closing_date:'');
  const probability=forecastProbability[r.stage];
  let category=r.category||(['negotiation','pending_po'].includes(r.stage)?'best_case':'pipeline');
  if(category==='commit'&&!r.commit_ready){category='best_case';issues.push({id:r.id,title:r.title,reason:'Commit turun ke Best Case: persetujuan paket/negosiasi berubah'});}
  const open=!['closed_won','closed_lost'].includes(r.stage),validAmount=amount(r.estimated_value_idr)&&probability!==undefined;
  if(!validAmount)issues.push({id:r.id,title:r.title,reason:'Nilai peluang atau tahap tidak valid; dikeluarkan dari agregasi'});
  if(open&&!validISODate(close))issues.push({id:r.id,title:r.title,reason:'Tanggal estimasi closing belum valid'});
  if(r.stage==='closed_won'&&(!amount(r.verified_po_amount)||!validISODate(r.booked_date)))issues.push({id:r.id,title:r.title,reason:'Closed Won tanpa PO/Finance/Legal/paket/tanggal closing terverifikasi; belum dihitung sebagai booked sales'});
  const included=open&&validAmount&&category!=='omit'&&validISODate(close)&&close.startsWith(period);
  const recognized=typeof r.recognized_revenue_idr==='number'&&Number.isFinite(r.recognized_revenue_idr)?r.recognized_revenue_idr:0;
  const booked=r.stage==='closed_won'&&amount(r.verified_po_amount)&&validISODate(r.booked_date)&&r.booked_date.startsWith(period);
  return {id:r.id,title:r.title,company_name:r.company_name,owner:r.created_by,stage:r.stage,flow_version:r.flow_version,
   amount:validAmount?r.estimated_value_idr:null,amount_source:'opportunity_estimate',probability:probability??0,category,expected_close_date:close,
   forecast_version:r.forecast_version||0,reason:r.reason||'',included,weighted_amount:included?Math.round(r.estimated_value_idr*probability)/100:0,
   overdue:open&&validISODate(close)&&close<today,booked_amount:booked?r.verified_po_amount!:0,booked_date:r.booked_date,po_number:r.po_number,recognized_revenue:recognized};
 });
 const sum=(values:number[])=>{const cents=values.reduce((n,v)=>n+BigInt(Math.round(v*100)),0n);if(cents>BigInt(Number.MAX_SAFE_INTEGER)||cents< -BigInt(Number.MAX_SAFE_INTEGER))throw Error('Agregasi melampaui presisi rupiah yang didukung; persempit periode/filter');return Number(cents)/100;};
 const group=(key:'stage'|'owner')=>Array.from(new Set(deals.map(d=>d[key]))).map(label=>{
  const a=deals.filter(d=>d[key]===label);return {label,count:a.length,pipeline:sum(a.filter(d=>d.included).map(d=>d.amount!)),weighted:sum(a.map(d=>d.weighted_amount)),booked:sum(a.map(d=>d.booked_amount)),revenue:sum(a.map(d=>d.recognized_revenue))};
 });
 const active=deals.filter(d=>d.included);
 return {period,policy_version:'stage-v1',totals:{open_pipeline:sum(active.map(d=>d.amount!)),weighted_pipeline:sum(active.map(d=>d.weighted_amount)),
  commit:sum(active.filter(d=>d.category==='commit').map(d=>d.amount!)),best_case:sum(active.filter(d=>['commit','best_case'].includes(d.category)).map(d=>d.amount!)),
  booked_sales:sum(deals.map(d=>d.booked_amount)),recognized_revenue:sum(deals.map(d=>d.recognized_revenue)),open_count:active.length,overdue_count:deals.filter(d=>d.overdue).length,quality_gap_count:issues.length},
  by_stage:group('stage'),by_owner:group('owner'),deals,issues};
}
export function forecastCSV(rows:ReturnType<typeof buildSalesForecast>['deals']){
 const cell=(v:unknown)=>'"'+(typeof v==='number'?String(v):String(v??'').replace(/^[\s]*[=+@-]/,m=>"'"+m)).replace(/"/g,'""')+'"';
 return '\uFEFF'+[['Opportunity ID','Opportunity','Customer','Sales','Stage','Estimated IDR','Probability %','Category','Expected Close','Weighted IDR','Verified Booked IDR','Booked Date','PO','Verified Revenue IDR'],...rows.map(d=>[d.id,d.title,d.company_name,d.owner,d.stage,d.amount,d.probability,d.category,d.expected_close_date,d.weighted_amount,d.booked_amount,d.booked_date,d.po_number,d.recognized_revenue])].map(r=>r.map(cell).join(',')).join('\r\n');
}
