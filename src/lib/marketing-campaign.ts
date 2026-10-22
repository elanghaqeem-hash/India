import {dateValid,emailValid} from './sales-workflow';
export type CampaignStatus='planned'|'active'|'paused'|'completed'|'cancelled';
export type CampaignChannel='webinar'|'event'|'partnership'|'outbound'|'referral'|'digital'|'other';
export const campaignChannels:CampaignChannel[]=['webinar','event','partnership','outbound','referral','digital','other'];
export const campaignStatuses:CampaignStatus[]=['planned','active','paused','completed','cancelled'];
export type CampaignInput={
 code:string;name:string;channel:CampaignChannel;status:CampaignStatus;
 owner_email:string;budget_idr:number;start_date:string;end_date:string;notes:string;
};
const clean=(x:unknown,max:number)=>typeof x==='string'?x.trim().slice(0,max):'';
export function validateCampaign(raw:unknown):CampaignInput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Campaign harus object');
 const p=raw as Record<string,unknown>;
 const input:CampaignInput={
  code:clean(p.code,60).toUpperCase(),name:clean(p.name,240).replace(/\s+/g,' '),
  channel:clean(p.channel,30) as CampaignChannel,status:clean(p.status,30) as CampaignStatus,
  owner_email:clean(p.owner_email,200).toLowerCase(),budget_idr:Number(p.budget_idr??0),
  start_date:clean(p.start_date,20),end_date:clean(p.end_date,20),notes:clean(p.notes,1200)
 };
 if(!/^[A-Z0-9][A-Z0-9_-]{2,59}$/.test(input.code))throw Error('Kode campaign 3-60 karakter alfanumerik, dash atau underscore');
 if(input.name.length<3||!campaignChannels.includes(input.channel)||!campaignStatuses.includes(input.status))
  throw Error('Nama, channel dan status campaign tidak valid');
 if(!emailValid(input.owner_email))throw Error('Email campaign owner harus valid');
 if(!Number.isSafeInteger(input.budget_idr)||input.budget_idr<0||input.budget_idr>1e13)
  throw Error('Anggaran campaign harus integer IDR positif');
 if((input.start_date&&!dateValid(input.start_date))||(input.end_date&&!dateValid(input.end_date)))
  throw Error('Tanggal campaign tidak valid');
 if(input.start_date&&input.end_date&&input.start_date>input.end_date)
  throw Error('Tanggal berakhir tidak boleh sebelum tanggal mulai');
 return input;
}
export function canEditCampaign(role:string):boolean{return role==='admin'||role==='marketing';}
export function canSelectCampaign(status:CampaignStatus):boolean{return status==='active';}
export function campaignProgress(n:{total:number;qualified:number;converted:number}){
 const total=Math.max(0,Number(n.total)||0),qualified=Math.max(0,Number(n.qualified)||0),
 converted=Math.max(0,Number(n.converted)||0);
 return {total,qualified,converted,conversionRate:total===0?0:Math.round(10000*converted/total)/100};
}
