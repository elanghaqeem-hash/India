export const LEAD_STATUSES=['new','contacted','qualified','disqualified','converted'] as const;
export type LeadStatus=typeof LEAD_STATUSES[number];
export type LeadRole='admin'|'sales'|'presales'|'finance'|'approver'|'viewer';
export const canCreateLead=(role:string)=>role==='sales'||role==='admin';
export const canEditLead=(role:string,actor:string,owner:string)=>role==='admin'||(role==='sales'&&actor.toLowerCase()===owner.toLowerCase());
export function canTransition(from:LeadStatus,to:LeadStatus){
 return (from==='new'&&['contacted','disqualified'].includes(to))||
 (from==='contacted'&&['qualified','disqualified'].includes(to))||
 (from==='qualified'&&['converted','contacted'].includes(to));
}
export function normalizeEmail(value:unknown){return String(value||'').trim().toLowerCase();}
export function validateLead(value:Record<string,unknown>):string[]{
 const required=['company_name','contact_name','contact_email','service_interest','lead_source'];
 const missing=required.filter(k=>!String(value[k]||'').trim());
 const email=normalizeEmail(value.contact_email);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))missing.push('contact_email (format)');
 if(String(value.company_name||'').length>180)missing.push('company_name (maks 180)');
 if(String(value.contact_name||'').length>180)missing.push('contact_name (maks 180)');
 return missing;
}
export function validateQualification(value:Record<string,unknown>):string[]{
 const missing=['budget_status','decision_authority','requirement_summary','target_date','qualification_notes','contact_phone']
 .filter(k=>!String(value[k]||'').trim());
 const date=String(value.target_date||'');
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))missing.push('target_date (format YYYY-MM-DD)');
 const phone=String(value.contact_phone||'');
 if(phone&&!/^\+?[0-9][0-9\s().-]{7,19}$/.test(phone))missing.push('contact_phone (format)');
 return missing;
}
