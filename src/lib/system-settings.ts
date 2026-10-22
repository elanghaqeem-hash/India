import type {D1DB} from './boq-auth';
import {TENANT} from './sales-workflow';
import {txt,positive} from './operations';
import {roles,boqTotals,type BoQLine,type CostLine} from './boq-domain';
export const resources=['partners','reports','sales','marketing','boq','ai'] as const;
export function apiResource(path:string){
 if(path.startsWith('/api/partners'))return 'partners';if(path.startsWith('/api/reports'))return 'reports';
 if(path.startsWith('/api/ai'))return 'ai';if(path.startsWith('/api/boq'))return 'boq';
 if(path.startsWith('/api/sales'))return 'sales';if(path.startsWith('/api/marketing'))return 'marketing';return null;
}
export async function effectiveSetting(db:D1DB,kind:string,key:string){const r=await db.prepare('SELECT data_json FROM india_effective_settings WHERE tenant_id=? AND kind=? AND setting_key=?').bind(TENANT,kind,key).first<{data_json:string}>();return r?JSON.parse(r.data_json) as Record<string,unknown>:null;}
export async function accessRestricted(db:D1DB,path:string,role:string){
 if(role==='admin')return false;const resource=apiResource(path);if(!resource)return false;
 const p=await effectiveSetting(db,'access',resource);return !!p&&Array.isArray(p.denied_roles)&&p.denied_roles.includes(role);
}
export function validateSetting(kind:string,key:string,p:Record<string,unknown>):Record<string,unknown>{
 if(!/^[a-z0-9][a-z0-9_-]{1,60}$/.test(key))throw Error('Kode pengaturan 2–61 karakter huruf kecil, angka, _ atau -');
 if(kind==='organization'){
  if(!['institution','directorate','division','unit','branch'].includes(String(p.level)))throw Error('Level organisasi tidak valid');
  if(p.parent_key&&(!/^[a-z0-9][a-z0-9_-]{1,60}$/.test(String(p.parent_key))||p.parent_key===key))throw Error('Parent organisasi tidak valid');
  if(p.level==='institution'&&p.parent_key)throw Error('Institusi tidak memiliki parent');
  if(p.level!=='institution'&&!p.parent_key)throw Error('Parent organisasi wajib');
  return {level:p.level,parent_key:p.parent_key||null};
 }
 if(kind==='approval'){
  if(key!=='boq'||typeof p.min_margin_pct!=='number'||!Number.isFinite(p.min_margin_pct)||p.min_margin_pct<25||p.min_margin_pct>100||!positive(p.approver_limit_idr))throw Error('BoQ: minimum margin 25–100%, batas nilai approver positif wajib');
  return {min_margin_pct:p.min_margin_pct,approver_limit_idr:p.approver_limit_idr};
 }
 if(kind==='numbering'){
  if(!['quotation','proposal','purchase'].includes(key)||!/^[-A-Z0-9]{2,20}$/.test(txt(p.prefix,20)))throw Error('Jenis nomor dan prefix huruf besar 2–20 karakter wajib');
  return {prefix:p.prefix};
 }
 if(kind==='template'){
  if(!['follow_up','partner_notice','internal_memo'].includes(key)||txt(p.body,4000).length<15||/<\/?[a-z]|<script/i.test(String(p.body)))throw Error('Template teks: pilih follow_up/partner_notice/internal_memo, 15–4000 karakter tanpa HTML');
  return {body:txt(p.body,4000),format:'text/plain'};
 }
 if(kind==='integration'){
  const url=new URL(String(p.endpoint));
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname==='localhost'||/^\d/.test(url.hostname)||url.hostname.endsWith('.local')||!url.hostname.includes('.'))throw Error('Endpoint HTTPS publik tanpa kredensial/query diperlukan');
  if(!/^[A-Z][A-Z0-9_]{2,80}$/.test(String(p.secret_binding))||txt(p.purpose,600).length<12)throw Error('Nama secret binding dan tujuan integrasi wajib');
  return {endpoint:url.toString(),secret_binding:p.secret_binding,purpose:txt(p.purpose,600),transport_status:'registered_only'};
 }
 if(kind==='access'){
  const denied=Array.isArray(p.denied_roles)?p.denied_roles:typeof p.denied_roles==='string'?p.denied_roles.split(',').map(x=>x.trim()).filter(Boolean):null;
  if(!resources.includes(key as typeof resources[number])||!denied||denied.some(x=>!roles.includes(x as typeof roles[number])||x==='admin'))throw Error('Resource dan daftar role terlarang valid wajib; Admin dipertahankan');
  return {denied_roles:Array.from(new Set(denied))};
 }
 throw Error('Jenis pengaturan tidak tersedia');
}
export async function enforceBoQApprovalPolicy(db:D1DB,row:{line_items_json:string;cost_items_json:string;vat_rate:number},role:string,reason:string){
 const policy=await effectiveSetting(db,'approval','boq');if(!policy)return;
 const totals=boqTotals(JSON.parse(row.line_items_json) as BoQLine[],JSON.parse(row.cost_items_json) as CostLine[],row.vat_rate);
 if(totals.grand_total>Number(policy.approver_limit_idr)&&role!=='admin')throw Error('Nilai melebihi batas Approval Matrix; Admin independen diperlukan');
 if((totals.margin??-Infinity)<Number(policy.min_margin_pct)&&(role!=='admin'||reason.trim().length<15))throw Error('Margin di bawah Approval Matrix; Admin independen dan alasan pengecualian wajib');
}
