import type {buildSalesForecast} from './sales-forecast';

type Forecast=ReturnType<typeof buildSalesForecast>;
export type ExecutiveMeta={
 id:string;created_at:string;proposal_count:number;lost_closed_date:string|null;
 service_family:string|null;lost_reason:string|null;verified_submitted_period:number;
};
export type SalesTarget={owner_email:string;period:string;amount_idr:number;version:number;rationale:string};
export type SalesActivity={owner_email:string;kind:string;count:number};
export type SalesMember={email:string};

const normalized=(s:string)=>s.toLowerCase();
const moneySum=(values:number[])=>{
 const cents=values.reduce((n,x)=>{
  if(!Number.isFinite(x)||Math.abs(x)>=1e14)throw Error('Nilai keuangan tidak valid');
  return n+BigInt(Math.round(x*100));
 },0n);
 if(cents>BigInt(Number.MAX_SAFE_INTEGER)||cents< -BigInt(Number.MAX_SAFE_INTEGER))throw Error('Agregasi rupiah melebihi presisi; persempit filter');
 return Number(cents)/100;
};
const percentage=(numerator:number,denominator:number)=>denominator>0?Math.round(numerator/denominator*10000)/100:null;
const calendarDays=(created:string,today:string)=>{
 const date=created.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
 return Number.isFinite(days)&&days>=0?days:null;
};
export function buildExecutiveSalesDashboard(
 forecast:Forecast, meta:ExecutiveMeta[], targets:SalesTarget[], activities:SalesActivity[],
 members:SalesMember[],today:string
){
 const byId=new Map(meta.map(x=>[x.id,x]));
 const targetByOwner=new Map(targets.map(t=>[normalized(t.owner_email),t]));
 const activityMap=new Map<string,Record<string,number>>();
 for(const x of activities){
  const owner=normalized(x.owner_email);
  const kinds=activityMap.get(owner)||{};
  kinds[x.kind]=(kinds[x.kind]||0)+x.count;
  activityMap.set(owner,kinds);
 }
 const closedInPeriod=forecast.deals.filter(d=>{
  const m=byId.get(d.id);
  return d.stage==='closed_won'?d.booked_date?.startsWith(forecast.period)&&d.booked_amount>0:
   d.stage==='closed_lost'&&m?.lost_closed_date?.startsWith(forecast.period);
 });
 const won=closedInPeriod.filter(d=>d.stage==='closed_won');
 const lost=closedInPeriod.filter(d=>d.stage==='closed_lost');
 const hasProposal=(id:string)=>Number(byId.get(id)?.proposal_count||0)>0;
 const proposed=closedInPeriod.filter(d=>hasProposal(d.id));
 const proposedWon=won.filter(d=>hasProposal(d.id));
 const open=forecast.deals.filter(d=>d.stage!=='closed_won'&&d.stage!=='closed_lost');
 const agingBuckets=[
  {label:'0–30 hari',count:0,value_idr:0},
  {label:'31–60 hari',count:0,value_idr:0},
  {label:'61–90 hari',count:0,value_idr:0},
  {label:'>90 hari',count:0,value_idr:0},
 ];
 const agedDeals:{id:string;title:string;owner:string;stage:string;age_days:number;estimated_value_idr:number}[]=[];
 const qualityGaps=[...forecast.issues];
 for(const d of open){
  const days=calendarDays(byId.get(d.id)?.created_at||'',today);
  if(days===null){qualityGaps.push({id:d.id,title:d.title,reason:'Tanggal pembuatan Opportunity tidak valid untuk aging'});continue;}
  const bucket=days<=30?0:days<=60?1:days<=90?2:3;
  agingBuckets[bucket].count++;
  agingBuckets[bucket].value_idr=moneySum([agingBuckets[bucket].value_idr,d.amount||0]);
  agedDeals.push({id:d.id,title:d.title,owner:d.owner,stage:d.stage,age_days:days,estimated_value_idr:d.amount||0});
 }
 for(const d of forecast.deals.filter(x=>x.stage==='closed_lost'&&!byId.get(x.id)?.lost_closed_date)){
  qualityGaps.push({id:d.id,title:d.title,reason:'Closed Lost tanpa tanggal transisi di audit D1; tidak dihitung pada win/loss periode'});
 }
 const serviceMap=new Map<string,{service:string;revenue_idr:number;booked_idr:number;won_count:number}>();
 for(const d of forecast.deals){
  const service=byId.get(d.id)?.service_family?.trim()||'Belum diklasifikasikan';
  const s=serviceMap.get(service)||{service,revenue_idr:0,booked_idr:0,won_count:0};
  s.revenue_idr=moneySum([s.revenue_idr,d.recognized_revenue]);
  s.booked_idr=moneySum([s.booked_idr,d.booked_amount]);
  s.won_count+=Number(won.some(w=>w.id===d.id));
  serviceMap.set(service,s);
 }
 const owners=Array.from(new Set([...members.map(m=>normalized(m.email)),...forecast.deals.map(d=>normalized(d.owner))])).sort();
 const by_owner=owners.map(owner=>{
  const all=forecast.deals.filter(d=>normalized(d.owner)===owner);
  const closes=closedInPeriod.filter(d=>normalized(d.owner)===owner);
  const win=closes.filter(d=>d.stage==='closed_won').length;
  const loss=closes.filter(d=>d.stage==='closed_lost').length;
  const t=targetByOwner.get(owner);
  const booked=moneySum(all.map(d=>d.booked_amount));
  const tasks=activityMap.get(owner)||{};
  return {owner,target_idr:t?.amount_idr??null,target_version:t?.version||0,target_rationale:t?.rationale||'',
   booked_idr:booked,attainment_pct:t?percentage(booked,t.amount_idr):null,
   pipeline_idr:moneySum(all.filter(d=>d.included).map(d=>d.amount||0)),
   weighted_idr:moneySum(all.map(d=>d.weighted_amount)),revenue_idr:moneySum(all.map(d=>d.recognized_revenue)),
   won:win,lost:loss,win_rate_pct:percentage(win,win+loss),
   completed_tasks:Object.values(tasks).reduce((a,b)=>a+b,0),
   calls:tasks.call||0,meetings:tasks.meeting||0,visits:tasks.visit||0,follow_ups:tasks.follow_up||0};
 });
 const targetCoverage=by_owner.filter(o=>o.target_idr!==null);
 const totalTarget=targetCoverage.length===by_owner.length&&by_owner.length>0
  ?moneySum(targetCoverage.map(o=>o.target_idr!)):null;
 const booked=forecast.totals.booked_sales;
 const lossReasons=new Map<string,number>();
 for(const d of lost){
  const reason=byId.get(d.id)?.lost_reason?.trim()||'Alasan belum tercatat';
  lossReasons.set(reason,(lossReasons.get(reason)||0)+1);
 }
 const submitted=meta.filter(m=>m.verified_submitted_period>0).length;
 return {
  period:forecast.period,today,policy_version:forecast.policy_version,
  totals:{
   target_idr:totalTarget,target_defined:targetCoverage.length,target_required:by_owner.length,
   booked_idr:booked,attainment_pct:totalTarget?percentage(booked,totalTarget):null,
   target_gap_idr:totalTarget===null?null:moneySum([totalTarget,-booked]),
   open_pipeline_idr:forecast.totals.open_pipeline,
   weighted_pipeline_idr:forecast.totals.weighted_pipeline,
   recognized_revenue_idr:forecast.totals.recognized_revenue,
   open_deals_period:forecast.totals.open_count,open_all:open.length,
   won:won.length,lost:lost.length,win_rate_pct:percentage(won.length,closedInPeriod.length),
   proposals_verified_period:submitted,proposal_decisions:proposed.length,
   proposal_won:proposedWon.length,proposal_conversion_pct:percentage(proposedWon.length,proposed.length),
   completed_activities:by_owner.reduce((n,o)=>n+o.completed_tasks,0),
   data_gaps:qualityGaps.length,
  },
  by_owner,by_service:Array.from(serviceMap.values()).sort((a,b)=>b.revenue_idr-a.revenue_idr),
  aging:agingBuckets,oldest_open:agedDeals.sort((a,b)=>b.age_days-a.age_days).slice(0,20),
  loss_reasons:Array.from(lossReasons,([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count),
  by_stage:forecast.by_stage,
  issues:qualityGaps.slice(0,100),
  notes:{
   target:'Target per Sales/bulan di D1, diubah Admin dengan versioning; realisasi = nilai PO Closed Won yang telah terverifikasi, sebelum PPN.',
   pipeline:'Pipeline hanya Opportunity terbuka dengan expected closing di bulan terpilih; weighted memakai kebijakan stage-v1 dari modul Forecast.',
   win_loss:'Won/Lost dihitung pada bulan transisi final tercatat di audit. Won tanpa PO valid tidak dihitung; Lost tanpa audit masuk gap data.',
   proposal:'Konversi proposal = jumlah Won dengan proposal ÷ keputusan Won/Lost dengan proposal pada bulan terpilih. Submitted = distinct Opportunity dengan submission verified pada bulan tersebut.',
   revenue:'Revenue per layanan merupakan pengakuan yang disahkan di register D1 (GL/invoice/BAST); tidak disamakan dengan booked PO.',
   activity:'Produktivitas memakai task yang berstatus completed dengan completed_at pada bulan terpilih, bukan jadwal rencana.',
   aging:'Aging dihitung sejak pembuatan Opportunity yang masih terbuka pada hari akses dashboard (WIB).'
  }
 };
}
