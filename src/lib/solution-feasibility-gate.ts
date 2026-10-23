import type {D1DB} from './boq-auth';
import {TENANT} from './sales-workflow';
/** Advisory until a plan is enrolled. Once present, every stage + quotation rechecks the D1 gate. */
export async function feasibilityReady(db:D1DB,id:string){
 const row=await db.prepare(`SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM india_feasibility_plans p WHERE p.tenant_id=? AND p.opportunity_id=?
 ) THEN 1 WHEN EXISTS(
 SELECT 1 FROM india_solution_feasibility_gaps f WHERE f.tenant_id=? AND f.opportunity_id=? AND f.is_gap=0
 ) THEN 1 ELSE 0 END ready`).bind(TENANT,id,TENANT,id).first<{ready:number}>();
 return row?.ready===1;
}
