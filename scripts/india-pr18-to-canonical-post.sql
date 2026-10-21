-- Post-bridge after PR12 canonical 0005..0010 and consolidated 0011.
-- Preserve ID, owner, contact, source, campaign and historic audit. Archive originals.
-- PR18 Qualified has no procurement field: downgrade only unconverted 'qualified'
-- to assigned, requiring requalification rather than inventing procurement answers.
INSERT INTO india_marketing_leads(
 id,tenant_id,lead_number,account_name,source,campaign,service_family,
 contact_name,contact_email,assigned_sales_email,estimated_value_idr,
 expected_closing_date,qualification_json,status,created_by,updated_by,
 created_at,updated_at,version
)
SELECT l.id,l.tenant_id,'LD-PR18-'||replace(l.id,'-',''),l.company_name,
 l.lead_source,l.campaign_code,l.service_interest,l.contact_name,
 l.contact_email,l.owner_email,COALESCE(o.estimated_value_idr,0),
 l.target_date,
 json_object(
   'need',l.requirement_summary,'budget_status',l.budget_status,
   'decision_maker',l.decision_authority,'procurement_process','',
   'discovery_notes',l.qualification_notes,'contact_phone',l.contact_phone,
   'target_next_action',CASE WHEN l.status='qualified'
     THEN 'Confirm procurement process before requalification' ELSE '' END
 ),
 CASE l.status WHEN 'contacted' THEN 'assigned'
     WHEN 'qualified' THEN 'assigned' ELSE l.status END,
 l.created_by,l.owner_email,l.created_at,l.updated_at,l.version
FROM india_marketing_leads_phase18_archive l
LEFT JOIN india_sales_opportunities o ON o.tenant_id=l.tenant_id
 AND o.id=l.converted_opportunity_id;
-- The canonical lineage is the separate 1:1 bridge rather than duplicate IDs on the lead.
INSERT INTO india_sales_lead_links(tenant_id,lead_id,customer_id,opportunity_id,converted_by)
SELECT l.tenant_id,l.id,l.converted_account_id,l.converted_opportunity_id,
 COALESCE((SELECT e.actor_email FROM india_marketing_lead_events_phase18_archive e
   WHERE e.tenant_id=l.tenant_id AND e.lead_id=l.id AND e.action='CONVERT'
   ORDER BY e.created_at DESC LIMIT 1),l.owner_email)
FROM india_marketing_leads_phase18_archive l
WHERE l.status='converted';
INSERT INTO india_marketing_lead_events(
 id,tenant_id,lead_id,action,actor_email,from_status,to_status,detail,created_at
)
SELECT id,tenant_id,lead_id,action,actor_email,from_status,to_status,detail,created_at
FROM india_marketing_lead_events_phase18_archive;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES
 ('migrations/0005_india_lead_management.sql','phase18-pr18'),
 ('migrations/0006_india_lead_conversion_integrity.sql','phase18-pr18'),
 ('migrations/0005_marketing_lead_flow.sql','canonical-pr12'),
 ('migrations/0006_bid_and_requirements.sql','canonical-pr12'),
 ('migrations/0007_quotation_submission.sql','canonical-pr12'),
 ('migrations/0008_po_legal_evidence.sql','canonical-pr12'),
 ('migrations/0009_lead_request_idempotency.sql','canonical-pr12'),
 ('migrations/0010_marketing_campaigns.sql','canonical-pr12');
