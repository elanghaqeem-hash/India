/** Deterministic v1 scoring: no generated intent or invented engagement. */
export type LeadTemperature='Hot'|'Warm'|'Cold';
export type ReasonCode='NO_BUDGET'|'NO_AUTHORITY'|'TIMING_LATER'|'NO_FIT'|'NO_RESPONSE'|'DUPLICATE'|'INVALID_CONTACT'|'OTHER';
export const reasonCodes:ReasonCode[]=['NO_BUDGET','NO_AUTHORITY','TIMING_LATER','NO_FIT','NO_RESPONSE','DUPLICATE','INVALID_CONTACT','OTHER'];
const softReasons=new Set<ReasonCode>(['NO_BUDGET','TIMING_LATER','NO_RESPONSE']);
export type ScorableLead={
 status:string; service_family:string; contact_email:string; estimated_value_idr:number;
 expected_closing_date:string; qualification_json?:string; qualification?:Record<string,string>;
 calls?:number; emails?:number; meetings?:number; follow_ups?:number;
};
export type ScoreResult={score:number;temperature:LeadTemperature;policy_version:'v1';breakdown:{bant:number;fit:number;engagement:number};explanation:string[]};
const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
export function computeLeadScore(row:ScorableLead):ScoreResult{
 let q:Record<string,string>={};
 if(row.qualification&&typeof row.qualification==='object')q=row.qualification;
 else if(row.qualification_json){try{q=JSON.parse(row.qualification_json)||{};}catch{/* legacy malformed: no invented fields */}}
 const notes:string[]=[];
 const need=clean(q.need),budget=clean(q.budget_status).toLowerCase(),authority=clean(q.decision_maker),procurement=clean(q.procurement_process);
 const needPoints=need.length>=8?20:need?10:0;
 if(needPoints)notes.push('Kebutuhan terdokumentasi');
 let budgetPoints=0;
 if(budget&&!/(no budget|not available|unavailable|tidak ada|belum tersedia|tidak tersedia|ditunda|rejected|none)/i.test(budget)){
  budgetPoints=/(approved|available|allocated|secured|confirmed|tersedia|disetujui|dialokasikan)/i.test(budget)?15:8;
 }
 if(budgetPoints)notes.push('Status anggaran tercatat (bukan bukti PO)');
 const bant=needPoints+budgetPoints+(authority.length>=3?15:0)+(procurement?10:0);
 const fit=(clean(row.service_family)?5:0)+(clean(row.contact_email)?10:0)+(Number(row.estimated_value_idr)>0?5:0)+(clean(row.expected_closing_date)?5:0);
 const count=(v:unknown)=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
 const engagement=Math.min(15,count(row.calls)*3+count(row.emails)*2+count(row.meetings)*7+count(row.follow_ups)*3);
 if(engagement)notes.push('Aktivitas tercatat; belum tentu respons positif klien');
 const score=Math.min(100,bant+fit+engagement);
 const temperature:LeadTemperature=score>=75?'Hot':score>=45?'Warm':'Cold';
 return {score,temperature,policy_version:'v1',breakdown:{bant,fit,engagement},explanation:notes};
}
export function canReactivate(reason:unknown){return softReasons.has(reason as ReasonCode);}
export function isReasonCode(reason:unknown):reason is ReasonCode{return typeof reason==='string'&&reasonCodes.includes(reason as ReasonCode);}
export function suggestedCadence(temperature:LeadTemperature){return temperature==='Hot'?7:temperature==='Warm'?14:30;}
export function validISODate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function advanceDate(value:string,days:number){
 if(!validISODate(value)||![7,14,30,60,90].includes(days))throw Error('Jadwal nurture tidak valid');
 const d=new Date(value+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
