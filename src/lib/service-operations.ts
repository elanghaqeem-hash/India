import {serviceParameters} from './service-workflow';
import type {BoQIdentity,D1DB} from './boq-auth';
import {TENANT} from './sales-workflow';
import {canReadDeal} from './sales-access';
import {atomicSales,type FlowDeal} from './sales-transactions';
import {operationEvent,jakartaDate,financialSum} from './operations';
import {openDocument,type VaultDoc} from './document-vault';
import {boqTotals,type CostLine} from './boq-domain';
export type Project={id:string;opportunity_id:string;customer_id:string;release_id:string;title:string;service_family:string;po_number:string;baseline_json:string;budget_json:string;contract_cents:number;version:number;status:string;pm_email:string|null;start_date:string|null;end_date:string|null};
export type Contract={id:string;project_id:string;customer_id:string;model:string;start_date:string|null;end_date:string|null;status:string;version:number;configured_by:string|null;approved_by:string|null;notice_days:number;recurring_cents:number;renewal_cents:number|null;probability_pct:number;churn_risk:string;churn_reason:string};
export class ServiceError extends Error {constructor(message:string,public status=422){super(message);}}
export function check(ok:unknown,message:string,status=422):asserts ok {if(!ok)throw new ServiceError(message,status);}
export const financeRole=(role:string)=>['admin','finance'].includes(role);
export const cents=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<1e13&&Math.abs(v*100-Math.round(v*100))<0.001?Math.round(v*100):null;
export const daysBetween=(a:string,b:string)=>Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
export async function accessibleDeal(a:BoQIdentity,id:string){
 const d=await a.db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
 check(d,'Opportunity tidak ditemukan',404);check(canReadDeal(a.role,a.email,d.created_by),'Akses Opportunity ditolak',403);return d;
}
export const getProject=(db:D1DB,id:string)=>db.prepare('SELECT * FROM india_delivery_projects WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first<Project>();
/** Supporting originals reuse the encrypted Vault; arbitrary references are never accepted as BAST/invoice/payment proof. */
export async function supportingOriginal(db:D1DB,id:string,opportunity:string){
 const doc=await db.prepare("SELECT *,'' AS release_id FROM india_document_library WHERE tenant_id=? AND id=? AND opportunity_id=? AND kind='supporting' AND (retention_until IS NULL OR retention_until>=? OR legal_hold=1)").bind(TENANT,id,opportunity,jakartaDate()).first<VaultDoc>();
 check(doc,'Dokumen supporting asli pada Vault Opportunity yang sama wajib',409);await openDocument(db,doc,'library');return doc;
}
export async function projectWrite(a:BoQIdentity,d:FlowDeal,p:Project,expected:unknown,action:string,data:unknown,writes:ReturnType<D1DB['prepare']>[]){
 check(expected===p.version,'Versi proyek berubah; muat ulang',409);
 await atomicSales(a.db,"EXISTS(SELECT 1 FROM india_delivery_projects p JOIN india_sales_opportunities d ON d.id=p.opportunity_id AND d.tenant_id=p.tenant_id WHERE p.id=? AND p.tenant_id=? AND p.version=? AND d.stage='closed_won' AND d.flow_version=?)",[p.id,TENANT,p.version,d.flow_version],[...writes,a.db.prepare('UPDATE india_delivery_projects SET version=version+1 WHERE tenant_id=? AND id=?').bind(TENANT,p.id),operationEvent(a.db,'delivery',p.id,action,a.email,data)]);
}
export function publicProject(p:Project,role:string){
 const {budget_json,baseline_json,...out}=p;const baseline=JSON.parse(baseline_json) as Record<string,unknown>;
 // account_snapshot may contain tax/identity/billing details. Only approved technical scope belongs in delivery UI.
 const scope=(baseline.scope as {fields?:Record<string,string>}|undefined)?.fields||{};
 const clean=Object.fromEntries(['technical_scope','technical_specifications','scope_quantity','deliverables','delivery_model','project_site','project_pic_name','project_pic_email','implementation_timeline','contract_duration','license_or_sku','service_level','payment_milestones','contract_model'].map(k=>[k,scope[k]||'']));
 const costs=JSON.parse(budget_json) as CostLine[];
 return {...out,baseline:{...clean},...(financeRole(role)?{budget:costs,budget_idr:boqTotals([],costs,0).hpp}:{})};
}
export type Invoice={id:string;number:string;issue_date:string;due_date:string;amount_cents:number;vat_cents:number;paid_cents:number;status:string;created_by:string;milestone_id:string;document_id:string};
function sumCents(values:number[]){const n=values.reduce((s,v)=>{check(Number.isSafeInteger(v),'Nilai sen tidak valid');return s+BigInt(v);},0n);check(n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(-Number.MAX_SAFE_INTEGER),'Total melampaui presisi');return Number(n);}
export function cashSummary(invoices:Invoice[],asOf=jakartaDate()){
 const approved=invoices.filter(i=>i.status==='approved'),gross=(i:Invoice)=>i.amount_cents+i.vat_cents;
 const invoiced=sumCents(approved.map(gross)),paid=sumCents(approved.map(i=>i.paid_cents)),outstanding=invoiced-paid;
 const windowSales=sumCents(approved.filter(i=>daysBetween(i.issue_date,asOf)>=0&&daysBetween(i.issue_date,asOf)<90).map(gross));
 return {invoiced_idr:invoiced/100,paid_idr:paid/100,outstanding_idr:outstanding/100,overdue_idr:sumCents(approved.filter(i=>i.due_date<asOf).map(i=>gross(i)-i.paid_cents))/100,dso_90_days:windowSales>0?Math.round(outstanding*90/windowSales*100)/100:null,dso_method:'Outstanding gross invoice / gross invoices issued in trailing 90 days × 90; null if denominator is zero',as_of:asOf};
}
export function renewalState(c:Contract,asOf=jakartaDate()){
 const days=c.end_date?daysBetween(asOf,c.end_date):null;
 return {...c,days_to_expiry:days,alert:c.status==='draft'?'configuration_required':c.status==='churned'?'churned':days===null?'date_required':days<0?'expired':days<=c.notice_days?'renewal_due':'current',weighted_renewal_idr:c.status==='active'&&c.renewal_cents!==null?Math.round(c.renewal_cents*c.probability_pct/100)/100:0,mrr_idr:c.status==='active'&&c.start_date&&c.start_date<=asOf&&days!==null&&days>=0?c.recurring_cents/100:0};
}
export function validatedParameters(code:string,value:unknown){
 const fields=serviceParameters[code]||[];const obj=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const result:Record<string,string|number>={};
 for(const f of fields){const v=obj[f.key];check(f.numeric?typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e6:typeof v==='string'&&v.trim().length>=3&&v.length<=1500,'Parameter wajib: '+f.label);result[f.key]=f.numeric?v as number:(v as string).trim();}
 return result;
}
