import type {D1DB} from './boq-auth';
/** Reused at stage, export/submission and forecast commit boundaries. d is the Opportunity SQL alias. */
const required=`(EXISTS(SELECT 1 FROM india_sales_bids b WHERE b.tenant_id=d.tenant_id AND b.opportunity_id=d.id AND (b.channel!='direct' OR b.bid_decision='no_go'))
 OR lower(coalesce(json_extract(d.data_json,'$.procurement_process'),'')) LIKE '%tender%'
 OR lower(coalesce(json_extract(d.data_json,'$.procurement_process'),'')) LIKE '%rfp%'
 OR lower(coalesce(json_extract(d.data_json,'$.procurement_process'),'')) LIKE '%rfq%'
 OR lower(coalesce(json_extract(d.data_json,'$.procurement_process'),'')) LIKE '%lpse%'
 OR lower(coalesce(json_extract(d.data_json,'$.procurement_process'),'')) LIKE '%spse%'
 OR lower(coalesce(json_extract(d.data_json,'$.procurement_process'),'')) LIKE '%pengadaan%')`;
export const tenderReadySQL=`(NOT ${required} OR (
 EXISTS(SELECT 1 FROM india_sales_bids b WHERE b.tenant_id=d.tenant_id AND b.opportunity_id=d.id AND b.bid_decision='go' AND b.decided_by IS NOT NULL)
 AND EXISTS(SELECT 1 FROM india_sales_requirements r WHERE r.tenant_id=d.tenant_id AND r.opportunity_id=d.id AND r.kind IN ('rks','kak','rfp','rfq'))
 AND NOT EXISTS(SELECT 1 FROM india_sales_requirements r WHERE r.tenant_id=d.tenant_id AND r.opportunity_id=d.id AND r.kind IN ('rks','kak','rfp','rfq')
 AND (r.status!='reviewed' OR r.compliance_status!='compliant' OR r.reviewed_by IS NULL OR length(r.file_reference)=0 OR length(r.source_content_hash)!=64
 OR NOT EXISTS(SELECT 1 FROM india_tender_compliance_items c WHERE c.requirement_id=r.id AND c.mandatory=1)
 OR EXISTS(SELECT 1 FROM india_tender_compliance_gaps c WHERE c.requirement_id=r.id AND c.mandatory=1 AND c.is_gap=1)))
 AND EXISTS(SELECT 1 FROM india_tender_deadlines t WHERE t.tenant_id=d.tenant_id AND t.opportunity_id=d.id AND t.milestone='submission' AND t.status='approved' AND t.reviewed_by IS NOT NULL AND datetime(t.due_at)>datetime('now'))
 AND (SELECT count(DISTINCT c.category) FROM india_tender_checklist c WHERE c.tenant_id=d.tenant_id AND c.opportunity_id=d.id AND c.mandatory=1)=3
 AND NOT EXISTS(SELECT 1 FROM india_tender_checklist c WHERE c.tenant_id=d.tenant_id AND c.opportunity_id=d.id AND c.mandatory=1
 AND (c.status!='ready' OR c.checked_by IS NULL OR lower(c.checked_by)=lower(c.created_by)
 OR length(c.document_name)=0 OR length(c.evidence_reference)<8 OR length(c.evidence_sha256)!=64
 OR (c.due_at IS NOT NULL AND datetime(c.due_at)<datetime('now'))))
))`;
export async function tenderReady(db:D1DB,id:string){return !!await db.prepare('SELECT id FROM india_sales_opportunities d WHERE d.tenant_id=? AND d.id=? AND '+tenderReadySQL).bind('defendit360',id).first();}
export function guardTender(g:{condition:string;args:(string|number|null)[]},id:string){g.condition+=' AND EXISTS(SELECT 1 FROM india_sales_opportunities d WHERE d.id=? AND d.tenant_id=? AND '+tenderReadySQL+')';g.args.push(id,'defendit360');}
