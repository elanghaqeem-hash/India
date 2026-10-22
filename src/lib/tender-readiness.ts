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
 AND EXISTS(SELECT 1 FROM india_sales_requirements r WHERE r.tenant_id=d.tenant_id AND r.opportunity_id=d.id AND r.kind IN ('rks','kak','rfp','rfq')
 AND r.status='reviewed' AND r.compliance_status='compliant' AND r.reviewed_by IS NOT NULL AND length(r.file_reference)>0 AND length(r.source_content_hash)=64
 AND EXISTS(SELECT 1 FROM india_tender_compliance_items c WHERE c.requirement_id=r.id AND c.mandatory=1)
 AND NOT EXISTS(SELECT 1 FROM india_tender_compliance_gaps c WHERE c.requirement_id=r.id AND c.mandatory=1 AND c.is_gap=1))))`;
export async function tenderReady(db:D1DB,id:string){return !!await db.prepare('SELECT id FROM india_sales_opportunities d WHERE d.tenant_id=? AND d.id=? AND '+tenderReadySQL).bind('defendit360',id).first();}
export function guardTender(g:{condition:string;args:(string|number|null)[]},id:string){g.condition+=' AND EXISTS(SELECT 1 FROM india_sales_opportunities d WHERE d.id=? AND d.tenant_id=? AND '+tenderReadySQL+')';g.args.push(id,'defendit360');}
