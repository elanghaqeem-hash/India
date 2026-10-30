import type {D1DB,BoQIdentity} from './boq-auth';
import {TENANT,safeID} from './sales-workflow';
import {atomicSales} from './sales-transactions';
import {operationEvent} from './operations';
import {privateHeaders} from './boq-auth';

export class ERPError extends Error{constructor(message:string,public status=422){super(message);}}
export function erpAssert(condition:unknown,message:string,status=422):asserts condition{if(!condition)throw new ERPError(message,status);}
export const erpReply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
export const erpError=(e:unknown)=>e instanceof ERPError?erpReply({success:false,message:e.message},e.status):
 erpReply({success:false,message:/constraint|CONFLICT|IMMUTABLE|INVALID|UNBALANCED|OVER_RECEIPT|MATCH|CAPACITY|SCOPE|FOREIGN KEY|UNIQUE/i.test(String(e))
 ?'Transaksi ditolak: referensi, versi, nominal atau pengendalian tidak valid.':'Modul ERP belum siap; periksa migrasi D1 0034–0037.'},/constraint|CONFLICT|IMMUTABLE|INVALID|UNBALANCED|OVER_RECEIPT|MATCH|CAPACITY|SCOPE|FOREIGN KEY|UNIQUE/i.test(String(e))?409:503);
export const erpId=(x:unknown):x is string=>safeID(x);
export const erpText=(x:unknown,min=3,max=240):x is string=>typeof x==='string'&&x.trim().length>=min&&x.length<=max;
export const erpPositiveCents=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>0&&Number(x)<900000000000000;
export const erpDate=(x:unknown):x is string=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
export const erpPeriod=(x:unknown):x is string=>typeof x==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(x);
export function erpOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new ERPError('Origin tidak diizinkan',403);}
export async function erpGrant(a:BoQIdentity,capability:string,unitId?:string){
 const q=await a.db.prepare('SELECT g.id FROM india_erp_capability_grants g JOIN india_members m ON lower(m.email)=lower(g.email) WHERE g.tenant_id=? AND lower(g.email)=? AND g.capability=? AND g.status=\'approved\' AND m.active=1 '+(unitId?'AND g.unit_id=?':'')+' LIMIT 1').bind(TENANT,a.email,capability,...(unitId?[unitId]:[])).first();
 if(!q)throw new ERPError('Hak akses ERP memerlukan grant independen untuk unit terkait',403);
}
export async function erpProjectUnit(db:D1DB,id:string){
 const row=await db.prepare("SELECT s.legal_entity_id FROM india_erp_project_scopes s JOIN india_delivery_projects p ON p.id=s.project_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=? AND s.project_id=? AND s.status='approved'").bind(TENANT,id).first<{legal_entity_id:string}>();
 if(!row)throw new ERPError('Legal entity proyek belum disetujui',409);
 return row.legal_entity_id;
}
export async function erpOpportunityUnit(db:D1DB,id:string){
 const row=await db.prepare("SELECT s.legal_entity_id FROM india_erp_opportunity_scopes s WHERE s.tenant_id=? AND s.opportunity_id=? AND s.status='approved'").bind(TENANT,id).first<{legal_entity_id:string}>();
 if(!row)throw new ERPError('Legal entity Opportunity belum disetujui',409);
 return row.legal_entity_id;
}
export async function erpAtom(a:BoQIdentity,guard:string,args:(string|number|null)[],writes:ReturnType<D1DB['prepare']>[],area:string,id:string,action:string,data:unknown){
 await atomicSales(a.db,guard,args,[...writes,operationEvent(a.db,area,id,action,a.email,data)]);
}
