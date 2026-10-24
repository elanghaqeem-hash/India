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

/** Reused by the canonical forecast Commit predicate, with Opportunity alias d. */
export const feasibilityReadySQL=`(NOT EXISTS(SELECT 1 FROM india_feasibility_plans fp WHERE fp.tenant_id=d.tenant_id AND fp.opportunity_id=d.id) OR EXISTS(SELECT 1 FROM india_solution_feasibility_gaps fg WHERE fg.tenant_id=d.tenant_id AND fg.opportunity_id=d.id AND fg.is_gap=0))`;
