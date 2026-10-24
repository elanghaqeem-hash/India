import type {D1DB,D1Prepared} from './boq-auth';
export type FlowDeal={id:string;company_id:string;title:string;stage:string;estimated_value_idr:number;data_json:string;created_by:string;flow_version:number};
export type SalesRelease={id:string;tenant_id:string;opportunity_id:string;version:number;status:'scoped'|'proposed'|'approved'|'superseded';scope_snapshot:string;account_snapshot:string;scope_notes:string;scoped_by:string;proposal_reference:string|null;proposal_sha256:string|null;proposal_notes:string|null;proposed_by:string|null;boq_id:string|null;boq_version:number|null;boq_edit_seq:number|null;approved_by:string|null;approved_at:string|null};
export const currentRelease=(db:D1DB,id:string)=>db.prepare("SELECT * FROM india_sales_releases WHERE tenant_id='defendit360' AND opportunity_id=? AND status!='superseded'").bind(id).first<SalesRelease>();
export const salesAudit=(db:D1DB,id:string,action:string,email:string,summary='',from:string|null=null,to:string|null=null)=>
 db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary,from_stage,to_stage) VALUES (?,?,?,?,?,?,?,?,?)')
 .bind(crypto.randomUUID(),'defendit360','deal',id,action,email,summary.slice(0,300),from,to);
/** D1 batch is one transaction. A failed optimistic guard or audit rolls back all writes. */
export async function atomicSales(db:D1DB,condition:string,args:(string|number|null)[],writes:D1Prepared[]){
 const token=crypto.randomUUID();
 return db.batch([
  db.prepare('INSERT INTO india_sales_tx_guards(id,ok) SELECT ?,CASE WHEN ('+condition+') THEN 1 ELSE 0 END').bind(token,...args),
  ...writes,
  db.prepare('DELETE FROM india_sales_tx_guards WHERE id=?').bind(token)
 ]);
}
export function dealGuard(d:FlowDeal){
 return {condition:"EXISTS(SELECT 1 FROM india_sales_opportunities WHERE id=? AND tenant_id='defendit360' AND flow_version=?)",args:[d.id,d.flow_version]};
}
export function transactionError(e:unknown){
 return /FLOW_CONFLICT|COMPLIANCE_CONFLICT|READINESS_CONFLICT|REVENUE_CONFLICT|FEASIBILITY_CONFLICT|RESOURCE_CAPACITY_CONFLICT|CHECK constraint|UNIQUE constraint|FOREIGN KEY constraint/i.test(String(e))
  ?{status:409,message:'Data atau persetujuan berubah. Muat ulang; scope, proposal, submission, negosiasi dan PO harus memakai versi paket yang sama.'}
  :{status:503,message:'Transaksi tidak tersimpan. Periksa database dan migrasi 0012.'};
}
export function poSnapshot(f:Record<string,string>){return JSON.stringify({po_number:f.po_number||'',po_date:f.po_date||'',po_reference:f.po_reference||'',po_amount_before_vat:f.po_amount_before_vat||'',scope_reconciliation:f.scope_reconciliation||''});}
