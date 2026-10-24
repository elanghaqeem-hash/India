import {feasibilityReadySQL} from '@/lib/solution-feasibility-gate';
import {tenderReadySQL} from '@/lib/tender-readiness';
import {TENANT} from '@/lib/sales-workflow';
import type {D1DB} from '@/lib/boq-auth';
import type {ForecastRow} from '@/lib/sales-forecast';

// Canonical one-row-per-Opportunity D1 source reused by Forecast and Executive.
export const commitSQL=`EXISTS(SELECT 1 FROM india_sales_releases r JOIN india_sales_negotiations n ON n.release_id=r.id
 JOIN india_sales_submissions s ON s.id=n.submission_id AND s.status='verified' AND s.release_id=r.id
 JOIN india_boq b ON b.id=r.boq_id AND b.status='approved' AND b.edit_seq=r.boq_edit_seq
 WHERE r.tenant_id=d.tenant_id AND r.opportunity_id=d.id AND r.status='approved' AND n.decision='approved'
 AND n.rowid=(SELECT max(n2.rowid) FROM india_sales_negotiations n2 WHERE n2.release_id=r.id) AND d.stage='pending_po' AND ${tenderReadySQL} AND ${feasibilityReadySQL})`;
export async function loadSalesForecastRows(db:D1DB,period:string,selected:string):Promise<ForecastRow[]>{
  const rows=await db.prepare(`SELECT d.*,a.legal_name AS company_name,f.expected_close_date,f.category,f.version AS forecast_version,f.reason,
   (SELECT coalesce(sum(rv.amount_before_vat),0) FROM india_sales_revenue rv WHERE rv.tenant_id=d.tenant_id AND rv.opportunity_id=d.id AND rv.status='approved' AND substr(rv.recognition_date,1,7)=?) AS recognized_revenue_idr,
   CASE WHEN ${commitSQL} THEN 1 ELSE 0 END AS commit_ready,
   (SELECT p.po_amount_before_vat FROM india_sales_po_checks p JOIN india_sales_releases r ON r.id=p.release_id AND r.status='approved'
    JOIN india_sales_award_documents aw ON aw.id=p.award_id AND aw.release_id=r.id
    WHERE p.tenant_id=d.tenant_id AND p.opportunity_id=d.id AND r.opportunity_id=d.id AND r.tenant_id=d.tenant_id
    AND aw.finance_reviewed_by IS NOT NULL AND aw.legal_reviewed_by IS NOT NULL
    AND lower(aw.finance_reviewed_by)!=lower(aw.legal_reviewed_by) AND aw.document_number=p.po_number
    AND abs(p.po_amount_before_vat-p.quotation_amount_before_vat)<0.01) AS verified_po_amount,
   (SELECT date(max(au.created_at),'+7 hours') FROM india_sales_audit au WHERE au.tenant_id=d.tenant_id AND au.entity_type='deal' AND au.entity_id=d.id AND au.to_stage='closed_won') AS booked_date,
   (SELECT p.po_number FROM india_sales_po_checks p WHERE p.tenant_id=d.tenant_id AND p.opportunity_id=d.id) AS po_number
   FROM india_sales_opportunities d JOIN india_sales_accounts a ON a.id=d.company_id AND a.tenant_id=d.tenant_id
   LEFT JOIN india_sales_forecasts f ON f.tenant_id=d.tenant_id AND f.opportunity_id=d.id
   WHERE d.tenant_id=? ${selected?'AND lower(d.created_by)=?':''} ORDER BY d.created_at DESC`).bind(period,TENANT,...(selected?[selected]:[])).all<ForecastRow>();
  return rows.results;
}
