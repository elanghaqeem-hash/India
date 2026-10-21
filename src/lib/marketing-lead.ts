import {dateValid,emailValid,phoneValid, type SalesFields} from './sales-workflow';

export type LeadStatus='new'|'assigned'|'qualified'|'disqualified'|'converted';
export type LeadQualification={
 need:string; budget_status:string; decision_maker:string; procurement_process:string;
 discovery_notes:string; contact_phone:string; target_next_action:string; disqualification_reason:string;
};
export const leadStatuses:LeadStatus[]=['new','assigned','qualified','disqualified','converted'];
export const qualificationKeys=new Set<keyof LeadQualification>([
 'need','budget_status','decision_maker','procurement_process','discovery_notes',
 'contact_phone','target_next_action','disqualification_reason'
]);
export type LeadInput={
 account_name:string;source:string;campaign:string;service_family:string;
 contact_name:string;contact_email:string;assigned_sales_email:string;
 estimated_value_idr:number;expected_closing_date:string;qualification:Record<string,string>;
};
const allowedService=new Set(['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other']);
const safe=(s:unknown,max=240)=>typeof s==='string'?s.trim().slice(0,max):'';
export function validateLead(input:unknown):LeadInput{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Lead harus object');
 const p=input as Record<string,unknown>,q:Record<string,string>={};
 if(p.qualification!==undefined){
  if(!p.qualification||typeof p.qualification!=='object'||Array.isArray(p.qualification))throw Error('Qualification bukan object');
  for(const [k,v] of Object.entries(p.qualification)){
   if(!qualificationKeys.has(k as keyof LeadQualification)||typeof v!=='string'||v.length>2000)throw Error('Field qualification tidak dikenal / terlalu panjang');
   q[k]=v.trim();
  }
 }
 const amount=p.estimated_value_idr===undefined||p.estimated_value_idr===''?0:Number(p.estimated_value_idr);
 const v:LeadInput={
  account_name:safe(p.account_name).replace(/\s+/g,' '),source:safe(p.source,100),campaign:safe(p.campaign,160),
  service_family:safe(p.service_family,60),contact_name:safe(p.contact_name,160),
  contact_email:safe(p.contact_email,200).toLowerCase(),
  assigned_sales_email:safe(p.assigned_sales_email,200).toLowerCase(),
  estimated_value_idr:amount,expected_closing_date:safe(p.expected_closing_date,20),qualification:q
 };
 if(v.account_name.length<3||!v.source||!allowedService.has(v.service_family))throw Error('Nama calon pelanggan, sumber lead dan produk/layanan wajib');
 if(!emailValid(v.assigned_sales_email))throw Error('Sales owner harus email valid');
 if(v.contact_email&&!emailValid(v.contact_email))throw Error('Email PIC tidak valid');
 if(!Number.isSafeInteger(amount)||amount<0||amount>1e14)throw Error('Estimasi nilai tidak valid');
 if(v.expected_closing_date&&!dateValid(v.expected_closing_date))throw Error('Tanggal closing tidak valid');
 if(q.contact_phone&&!phoneValid(q.contact_phone))throw Error('Nomor telepon kontak tidak valid');
 return v;
}
export function leadTransition(from:LeadStatus,to:LeadStatus,qualification:Record<string,string>):string[]{
 if(from==='converted')return ['Lead yang sudah dikonversi tidak bisa diubah'];
 if(from==='disqualified')return ['Lead sudah Disqualified; buat lead baru untuk reaktivasi terkontrol'];
 if(to===from)return [];
 if(to==='assigned'&&from==='new')return [];
 if(to==='qualified'&&['new','assigned','qualified'].includes(from)){
  return ['need','budget_status','decision_maker','procurement_process'].filter(k=>!qualification[k]?.trim());
 }
 if(to==='disqualified')return qualification.disqualification_reason?.trim()?[]:['disqualification_reason'];
 if(to==='converted')return from==='qualified'?[]:['Lead harus Qualified sebelum konversi'];
 return ['Transisi status lead tidak diizinkan'];
}
export function toOpportunityFields(lead:LeadInput,leadId:string):SalesFields{
 return {
  lead_source:lead.source,sales_owner:lead.assigned_sales_email,
  service_family:lead.service_family,expected_closing_date:lead.expected_closing_date,
  client_need:lead.qualification.need||'',budget_status:lead.qualification.budget_status||'',
  decision_maker:lead.qualification.decision_maker||'',procurement_process:lead.qualification.procurement_process||'',
  discovery_notes:lead.qualification.discovery_notes||'',
  opportunity_notes:'Converted from Lead '+leadId+(lead.campaign?' (Campaign: '+lead.campaign+')':'')
 };
}
export function normalizeName(x:string):string{return x.trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');}
