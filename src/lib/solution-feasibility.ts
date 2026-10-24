// INDIA 0022 resource and solution feasibility: deterministic person-days, money and gap analysis.
export const serviceLines=['VAPT','SOC/MDR','FortiSIEM','GRC','Managed Security'] as const;
export type ServiceLine=typeof serviceLines[number];
export const costTypes=['license','subscription','supplier_service','tooling','cloud','travel','other'] as const;
export type FeasibilityPlan={
 id:string;opportunity_id:string;service_line:ServiceLine;start_date:string;end_date:string;months:number;
 asset_count:number;pd_per_asset:number;retest_pct:number;coordination_pd:number;base_pd:number;
 coverage_hours:number;staffing:number;coverage_days:number;required_pd:number;target_margin_pct:number;
 status:'draft'|'approved'|'rejected';version:number;created_by:string;reviewed_by:string|null;review_notes:string|null;
};
export type Allocation={id:string;person_id:string;allocation_month:string;work_role:string;person_days:number;
 daily_cost_snapshot:number;display_name:string;email:string;capacity_pd_month:number;active:number;total_pd_month:number;status:string};
export type Cost={id:string;cost_type:string;description:string;sku:string;unit:string;quantity:number;periods:number;
 unit_price_idr:number;supplier_offer_id:string|null;offer_status:string|null;vendor_status:string|null;
 offer_unit:string|null;offer_qty:number|null;offer_capacity:number|null;vendor_capacity:number|null;offer_unit_price:number|null;
 offer_expires:string|null;vendor_expires:string|null;vendor_name:string|null};
export type DealMeta={estimated_value_idr:number;data_json:string};
export function isoDate(x:unknown):x is string{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const d=new Date(x+'T00:00:00.000Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===x;
}
export function monthCount(start:string,end:string){
 if(!isoDate(start)||!isoDate(end)||end<start)return 0;
 return (Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1;
}
export function validMonth(x:unknown){return typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);}
const good=(n:unknown,max=1e9)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
export function requiredPersonDays(p:Record<string,unknown>){
 const line=p.service_line;
 const months=Number(p.months),coord=Number(p.coordination_pd),assets=Number(p.asset_count),
  effort=Number(p.pd_per_asset),retest=Number(p.retest_pct),base=Number(p.base_pd),
  hours=Number(p.coverage_hours),staff=Number(p.staffing),days=Number(p.coverage_days);
 if(!serviceLines.includes(line as ServiceLine)||![months,coord,assets,effort,retest,base,hours,staff,days].every(n=>good(n,1000000))||
 !Number.isInteger(months)||months<1||months>60||!Number.isInteger(assets)||retest>100)return null;
 if(line==='VAPT'&&(assets<1||effort<=0))return null;
 if((line==='SOC/MDR'||line==='Managed Security')&&(![8,12,24].includes(hours)||staff<1||!Number.isInteger(staff)||!Number.isInteger(days)||days<1||days>31))return null;
 if((line==='GRC'||line==='FortiSIEM')&&base<=0)return null;
 const total=line==='VAPT'?assets*effort*(1+retest/100)+coord:
  line==='SOC/MDR'||line==='Managed Security'?hours/8*staff*days*months+coord:base+coord;
 const value=Math.ceil(total*100)/100;
 return good(value,1000000)&&value>0?value:null;
}
export function validatePlan(p:Record<string,unknown>){
 const start=p.start_date,end=p.end_date;
 if(!isoDate(start)||!isoDate(end)||monthCount(start,end)!==p.months)throw Error('Tanggal proyek dan jumlah bulan kalender tidak konsisten');
 const n=requiredPersonDays(p);
 if(n===null)throw Error('Driver kalkulasi person-days tidak valid untuk jenis layanan');
 if(!good(p.target_margin_pct,99))throw Error('Target margin harus 0–99%');
 return {service_line:p.service_line as ServiceLine,start_date:start,end_date:end,months:p.months as number,
  asset_count:p.asset_count as number,pd_per_asset:p.pd_per_asset as number,retest_pct:p.retest_pct as number,
  coordination_pd:p.coordination_pd as number,base_pd:p.base_pd as number,
  coverage_hours:p.coverage_hours as number,staffing:p.staffing as number,coverage_days:p.coverage_days as number,
  required_pd:n,target_margin_pct:p.target_margin_pct as number};
}
export function evaluateFeasibility(plan:FeasibilityPlan|null,people:Allocation[],costs:Cost[],deal:DealMeta,now=new Date()){
 const gaps:string[]=[];
 if(!plan)return {ready:false,approval_ready:false,required_pd:0,allocated_pd:0,
  internal_cost_idr:null,external_cost_idr:null,total_cost_idr:null,revenue_idr:deal.estimated_value_idr,margin_pct:null,gaps:['Feasibility plan belum dibuat.']};
 const today=new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
 const fields=JSON.parse(deal.data_json||'{}') as Record<string,string>;
 const quoteUntil=isoDate(fields.quotation_valid_until)?fields.quotation_valid_until:today;
 const allocated=people.filter(x=>x.status==='active');
 const sumPD=allocated.reduce((s,x)=>s+x.person_days,0);
 if(sumPD+0.000001<plan.required_pd)gaps.push('Person-days belum cukup: perlu '+plan.required_pd+', teralokasi '+sumPD.toFixed(2)+'.');
 if(!allocated.length)gaps.push('Belum ada engineer yang dialokasikan.');
 for(const a of allocated){
  if(a.allocation_month<plan.start_date.slice(0,7)||a.allocation_month>plan.end_date.slice(0,7))gaps.push('Alokasi '+a.display_name+' di luar periode delivery.');
  if(!a.active)gaps.push('Engineer '+a.display_name+' nonaktif.');
  if(a.total_pd_month>a.capacity_pd_month+0.000001)gaps.push('Overcapacity '+a.display_name+' bulan '+a.allocation_month+'.');
 }
 if(plan.service_line==='FortiSIEM'&&!costs.some(x=>x.cost_type==='license'&&x.supplier_offer_id))gaps.push('FortiSIEM wajib memiliki lisensi dengan quotation vendor terkait.');
 if(['SOC/MDR','Managed Security'].includes(plan.service_line)&&!costs.some(x=>['license','subscription','cloud','tooling'].includes(x.cost_type)))gaps.push('SOC/MDR memerlukan biaya platform, cloud, tooling atau subscription.');
 for(const c of costs){
  if(c.supplier_offer_id){
   if(c.offer_status!=='validated'||c.vendor_status!=='validated')gaps.push('Quotation supplier '+c.description+' belum tervalidasi.');
   if(!c.offer_expires||c.offer_expires<today||c.offer_expires<quoteUntil||c.vendor_expires!<today||c.vendor_expires!<plan.start_date)gaps.push('Quotation/vendor '+c.description+' kedaluwarsa sebelum masa penawaran / delivery.');
   if(c.offer_unit!==c.unit||c.offer_unit_price!==c.unit_price_idr||c.offer_qty!<c.quantity*c.periods||c.offer_capacity!<c.quantity*c.periods||c.vendor_capacity!<c.offer_capacity!)gaps.push('Satuan, harga atau kapasitas supplier '+c.description+' tidak konsisten.');
  }
 }
 const internal=allocated.reduce((s,x)=>s+x.person_days*x.daily_cost_snapshot,0);
 const external=costs.reduce((s,x)=>s+x.quantity*x.periods*x.unit_price_idr,0);
 const amount=Number(deal.estimated_value_idr);
 const margin=amount>0?(amount-internal-external)/amount*100:null;
 if(!Number.isFinite(amount)||amount<=0||margin===null)gaps.push('Estimasi nilai Opportunity belum valid.');
 else if(margin+0.000001<plan.target_margin_pct)gaps.push('Gross margin '+margin.toFixed(2)+'% di bawah minimum '+plan.target_margin_pct+'%.');
 if(monthCount(plan.start_date,plan.end_date)!==plan.months)gaps.push('Periode rencana tidak valid.');
 if(Math.abs(plan.required_pd-(requiredPersonDays(plan as unknown as Record<string,unknown>)||0))>0.001)gaps.push('Driver person-days berubah dan harus direkalkulasi.');
 const approvalReady=gaps.length===0;
 if(plan.status!=='approved')gaps.push('Persetujuan independen Feasibility belum lengkap.');
 return {ready:approvalReady&&plan.status==='approved',approval_ready:approvalReady,
  required_pd:plan.required_pd,allocated_pd:Math.round(sumPD*100)/100,internal_cost_idr:internal,
  external_cost_idr:external,total_cost_idr:internal+external,revenue_idr:amount,
  margin_pct:margin===null?null:Math.round(margin*100)/100,gaps};
}
