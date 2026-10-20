/** Role- and field-level guards for INDIA's D1 Sales API. */
export type SalesRole='admin'|'sales'|'presales'|'finance'|'approver'|'viewer';
const sameEmail=(a:string|undefined|null,b:string|undefined|null)=>
 !!a && !!b && a.trim().toLowerCase()===b.trim().toLowerCase();
export const canReadDeal=(role:SalesRole,email:string,creator:string|null|undefined)=>
 role!=='sales'||sameEmail(email,creator);
// The customer directory follows the same Sales ownership boundary as opportunities.
export const canReadAccount=(role:SalesRole,email:string,creator:string|null|undefined)=>
 role!=='sales'||sameEmail(email,creator);
export const canEditAccount=(role:SalesRole,email:string,creator:string|null|undefined)=>
 role==='admin'||(role==='sales'&&sameEmail(email,creator));
export const canChangeStage=(role:SalesRole,email:string,creator:string|null|undefined)=>
 role==='admin'||(role==='sales'&&sameEmail(email,creator));
export const PRESALES_FIELDS=new Set([
 'discovery_notes','technical_scope','technical_specifications','scope_quantity','service_level',
 'delivery_model','resourcing_model','deliverables','project_site','project_province',
 'project_postal','project_pic_name','project_pic_phone','project_pic_email',
 'implementation_timeline','contract_duration','license_or_sku','asset_profile',
 'methodology','exclusions','team_composition',
]);
export function canEditDeal(role:SalesRole,email:string,creator:string|null|undefined,fields:Record<string,string>,
 hasTitleOrValueChange:boolean):boolean{
 if(role==='admin')return true;
 if(role==='sales')return sameEmail(email,creator);
 if(role==='presales')return !hasTitleOrValueChange && Object.keys(fields).every(k=>PRESALES_FIELDS.has(k));
 return false;
}
