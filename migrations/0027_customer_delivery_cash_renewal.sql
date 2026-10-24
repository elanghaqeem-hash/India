-- Additive A–E lifecycle. No legacy Won backfill or invented sign-offs.
CREATE TABLE india_customer_relations(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,child_id TEXT NOT NULL,parent_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('subsidiary','branch')),created_by TEXT NOT NULL,
 UNIQUE(tenant_id,child_id),CHECK(child_id!=parent_id),
 FOREIGN KEY(tenant_id,child_id) REFERENCES india_sales_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,parent_id) REFERENCES india_sales_accounts(tenant_id,id)
);
CREATE TABLE india_customer_records(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,customer_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('stakeholder','installed_product')),
 title TEXT NOT NULL,data_json TEXT NOT NULL CHECK(json_valid(data_json)),opportunity_id TEXT,created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,customer_id) REFERENCES india_sales_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE TABLE india_opportunity_relations(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,source_id TEXT NOT NULL,target_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('related','renewal','expansion')),contract_id TEXT,
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,source_id,target_id),UNIQUE(tenant_id,contract_id,kind),CHECK(source_id!=target_id),
 FOREIGN KEY(tenant_id,source_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,target_id) REFERENCES india_sales_opportunities(tenant_id,id)
);
CREATE TABLE india_delivery_projects(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,opportunity_id TEXT NOT NULL,customer_id TEXT NOT NULL,
 release_id TEXT NOT NULL,po_number TEXT NOT NULL,title TEXT NOT NULL,service_family TEXT NOT NULL,
 baseline_json TEXT NOT NULL CHECK(json_valid(baseline_json)),budget_json TEXT NOT NULL CHECK(json_valid(budget_json)),
 contract_cents INTEGER NOT NULL CHECK(contract_cents>0 AND contract_cents<9000000000000000),
 pm_email TEXT,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed')),
 start_date TEXT,end_date TEXT,version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,opportunity_id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES india_sales_accounts(tenant_id,id),FOREIGN KEY(release_id) REFERENCES india_sales_releases(id)
);
CREATE TABLE india_delivery_tasks(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,code TEXT NOT NULL,title TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')),detail TEXT NOT NULL DEFAULT '',
 due_date TEXT,period TEXT NOT NULL DEFAULT '',document_id TEXT,completed_by TEXT,
 UNIQUE(tenant_id,project_id,code,period),FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id)
);
CREATE TABLE india_delivery_milestones(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,title TEXT NOT NULL,trigger_text TEXT NOT NULL DEFAULT '',
 amount_cents INTEGER CHECK(amount_cents>0 AND amount_cents<9000000000000000),due_date TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','accepted')),document_id TEXT,accepted_by TEXT,
 created_by TEXT NOT NULL,UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id)
);
CREATE TABLE india_billing_invoices(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,milestone_id TEXT NOT NULL,number TEXT NOT NULL,
 issue_date TEXT NOT NULL,due_date TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 vat_cents INTEGER NOT NULL CHECK(vat_cents>=0),document_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 created_by TEXT NOT NULL,reviewed_by TEXT,review_notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenant_id,id),UNIQUE(tenant_id,number),
 FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,milestone_id) REFERENCES india_delivery_milestones(tenant_id,id),
 CHECK(status!='approved' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE TABLE india_billing_payments(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,invoice_id TEXT NOT NULL,reference TEXT NOT NULL,payment_date TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents!=0 AND abs(amount_cents)<9000000000000000),document_id TEXT NOT NULL,
 reversal_of TEXT,created_by TEXT NOT NULL,reviewed_by TEXT,review_notes TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenant_id,reference),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES india_billing_invoices(tenant_id,id),FOREIGN KEY(reversal_of) REFERENCES india_billing_payments(id),
 CHECK((reversal_of IS NULL AND amount_cents>0) OR (reversal_of IS NOT NULL AND amount_cents<0)),
 CHECK(status!='approved' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE UNIQUE INDEX india_payment_reversal ON india_billing_payments(reversal_of) WHERE reversal_of IS NOT NULL AND status!='rejected';
CREATE TABLE india_invoice_revenue_links(
 invoice_id TEXT NOT NULL REFERENCES india_billing_invoices(id),revenue_id TEXT NOT NULL UNIQUE REFERENCES india_sales_revenue(id),
 created_by TEXT NOT NULL,PRIMARY KEY(invoice_id,revenue_id)
);
CREATE TABLE india_service_contracts(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,project_id TEXT NOT NULL,customer_id TEXT NOT NULL,
 model TEXT NOT NULL DEFAULT 'OTC' CHECK(model IN ('OTC','MRC','managed_service','license','retainer','FlexGuard')),
 start_date TEXT,end_date TEXT,notice_days INTEGER NOT NULL DEFAULT 90 CHECK(notice_days BETWEEN 1 AND 365),
 recurring_cents INTEGER NOT NULL DEFAULT 0 CHECK(recurring_cents>=0),renewal_cents INTEGER CHECK(renewal_cents>0),
 probability_pct INTEGER NOT NULL DEFAULT 50 CHECK(probability_pct BETWEEN 0 AND 100),
 churn_risk TEXT NOT NULL DEFAULT 'unknown' CHECK(churn_risk IN ('unknown','low','medium','high')),churn_reason TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','expired','churned')),
 configured_by TEXT,approved_by TEXT,version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,project_id),FOREIGN KEY(tenant_id,project_id) REFERENCES india_delivery_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES india_sales_accounts(tenant_id,id),
 CHECK(status='draft' OR (configured_by IS NOT NULL AND approved_by IS NOT NULL AND lower(configured_by)!=lower(approved_by) AND start_date IS NOT NULL AND end_date IS NOT NULL))
);
CREATE VIEW india_delivery_source AS
 SELECT 'project-'||d.id AS id,d.tenant_id,d.id AS opportunity_id,d.company_id AS customer_id,r.id AS release_id,p.po_number,d.title,
 coalesce(json_extract(r.scope_snapshot,'$.fields.service_family'),'Other') AS service_family,
 json_object('scope',json(r.scope_snapshot),'account',json(r.account_snapshot),'po_number',p.po_number,'po_date',p.po_date,
 'po_amount_before_vat',p.po_amount_before_vat,'award_id',p.award_id,'boq_id',b.id,'boq_version',b.version,'boq_edit_seq',b.edit_seq,'payment_terms',b.payment_terms) AS baseline_json,
 b.cost_items_json AS budget_json,CAST(round(p.po_amount_before_vat*100) AS INTEGER) AS contract_cents,d.created_by
 FROM india_sales_opportunities d JOIN india_sales_po_checks p ON p.tenant_id=d.tenant_id AND p.opportunity_id=d.id
 JOIN india_sales_releases r ON r.id=p.release_id AND r.opportunity_id=d.id AND r.tenant_id=d.tenant_id AND r.status='approved'
 JOIN india_boq b ON b.id=p.boq_id AND b.tenant_id=d.tenant_id AND b.id=r.boq_id AND b.status='approved' AND b.edit_seq=r.boq_edit_seq
 WHERE d.stage='closed_won';
CREATE TRIGGER india_delivery_won AFTER UPDATE OF stage ON india_sales_opportunities WHEN NEW.stage='closed_won' AND OLD.stage!='closed_won'
BEGIN
 INSERT INTO india_delivery_projects(id,tenant_id,opportunity_id,customer_id,release_id,po_number,title,service_family,baseline_json,budget_json,contract_cents,created_by)
 SELECT * FROM india_delivery_source WHERE opportunity_id=NEW.id AND tenant_id=NEW.tenant_id;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_delivery_projects WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id) THEN RAISE(ABORT,'DELIVERY_CONFLICT: approved source required') END;
END;
CREATE TRIGGER india_delivery_initial AFTER INSERT ON india_delivery_projects BEGIN
 INSERT INTO india_delivery_tasks(id,tenant_id,project_id,code,title)
 SELECT NEW.id||'-'||value,NEW.tenant_id,NEW.id,value,
 CASE value WHEN 'kickoff_scope' THEN 'Konfirmasi scope baseline' WHEN 'kickoff_access' THEN 'Akses, NDA dan jadwal kickoff' WHEN 'kickoff_team' THEN 'Tim delivery dan PIC pelanggan'
 WHEN 'vapt_scope' THEN 'Testing scope, aset dan rules of engagement' WHEN 'vapt_test' THEN 'Pelaksanaan testing' WHEN 'vapt_report' THEN 'Laporan VAPT' WHEN 'vapt_retest' THEN 'Retest dan closure findings'
 WHEN 'soc_logs' THEN 'Onboarding log source dan use case' WHEN 'soc_sla' THEN 'SLA, eskalasi dan service window' WHEN 'soc_report' THEN 'Monthly service report'
 WHEN 'grc_assessment' THEN 'Assessment dan evidence' WHEN 'grc_gap' THEN 'Gap analysis' WHEN 'grc_remediation' THEN 'Remediation dan action plan'
 WHEN 'tech_license' THEN 'SKU, lisensi dan entitlement' WHEN 'tech_implementation' THEN 'Implementasi dan acceptance test' WHEN 'tech_support' THEN 'Support, warranty dan eskalasi'
 ELSE 'Deliverable dan acceptance layanan' END
 FROM json_each(CASE WHEN NEW.service_family='VAPT' THEN '["kickoff_scope","kickoff_access","kickoff_team","vapt_scope","vapt_test","vapt_report","vapt_retest"]'
 WHEN NEW.service_family IN ('SOC/MDR','Managed Security') THEN '["kickoff_scope","kickoff_access","kickoff_team","soc_logs","soc_sla","soc_report"]'
 WHEN NEW.service_family IN ('GRC','Cybersecurity Governance') THEN '["kickoff_scope","kickoff_access","kickoff_team","grc_assessment","grc_gap","grc_remediation"]'
 WHEN NEW.service_family IN ('FortiSIEM','Cybersecurity Technology') THEN '["kickoff_scope","kickoff_access","kickoff_team","tech_license","tech_implementation","tech_support"]'
 ELSE '["kickoff_scope","kickoff_access","kickoff_team","service_deliverable"]' END);
 INSERT INTO india_delivery_milestones(id,tenant_id,project_id,title,trigger_text,amount_cents,created_by)
 SELECT NEW.id||'-ms-'||key,NEW.tenant_id,NEW.id,coalesce(json_extract(value,'$.label'),'Termin '||(key+1)),coalesce(json_extract(value,'$.trigger'),''),
 CASE WHEN json_type(value,'$.amount') IN ('integer','real') AND json_extract(value,'$.amount')>0 THEN CAST(round(json_extract(value,'$.amount')*100) AS INTEGER) ELSE NULL END,NEW.created_by
 FROM json_each(CASE WHEN json_valid(json_extract(NEW.baseline_json,'$.scope.fields.payment_milestones')) AND json_type(json_extract(NEW.baseline_json,'$.scope.fields.payment_milestones'))='array' THEN json_extract(NEW.baseline_json,'$.scope.fields.payment_milestones') ELSE '[]' END) WHERE key<20;
 INSERT INTO india_service_contracts(id,tenant_id,project_id,customer_id,model)
 VALUES('contract-'||NEW.opportunity_id,NEW.tenant_id,NEW.id,NEW.customer_id,CASE WHEN json_extract(NEW.baseline_json,'$.scope.fields.contract_model')='Recurring' THEN 'MRC' ELSE 'OTC' END);
 INSERT INTO india_operations_events(id,tenant_id,area,entity_id,action,actor_email,snapshot_json)
 VALUES(lower(hex(randomblob(16))),NEW.tenant_id,'delivery',NEW.id,'AUTO_HANDOVER',NEW.created_by,json_object('release_id',NEW.release_id,'customer_id',NEW.customer_id,'po_number',NEW.po_number));
END;
CREATE TRIGGER india_project_baseline_frozen BEFORE UPDATE ON india_delivery_projects
WHEN NEW.baseline_json!=OLD.baseline_json OR NEW.budget_json!=OLD.budget_json OR NEW.contract_cents!=OLD.contract_cents OR NEW.release_id!=OLD.release_id OR NEW.customer_id!=OLD.customer_id OR NEW.opportunity_id!=OLD.opportunity_id OR NEW.tenant_id!=OLD.tenant_id OR NEW.version!=OLD.version+1
BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable approved baseline/version'); END;
CREATE TRIGGER india_invoice_approve BEFORE UPDATE OF status ON india_billing_invoices WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_delivery_projects p JOIN india_delivery_milestones m ON m.project_id=p.id AND m.tenant_id=p.tenant_id WHERE p.id=NEW.project_id AND p.tenant_id=NEW.tenant_id AND m.id=NEW.milestone_id AND m.status='accepted'
 AND (SELECT coalesce(sum(i.amount_cents),0) FROM india_billing_invoices i WHERE i.tenant_id=p.tenant_id AND i.project_id=p.id AND i.status='approved')+NEW.amount_cents<=p.contract_cents
 AND (SELECT coalesce(sum(i.amount_cents),0) FROM india_billing_invoices i WHERE i.milestone_id=m.id AND i.status='approved')+NEW.amount_cents<=m.amount_cents)
 THEN RAISE(ABORT,'DELIVERY_CONFLICT: invoice exceeds accepted milestone or PO') END;
END;
CREATE TRIGGER india_payment_approve BEFORE UPDATE OF status ON india_billing_payments WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM india_billing_invoices i WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.invoice_id AND i.status='approved' AND NEW.payment_date>=i.issue_date
 AND (SELECT coalesce(sum(p.amount_cents),0) FROM india_billing_payments p WHERE p.invoice_id=i.id AND p.status='approved')+NEW.amount_cents BETWEEN 0 AND i.amount_cents+i.vat_cents)
 THEN RAISE(ABORT,'DELIVERY_CONFLICT: payment exceeds outstanding') END;
 SELECT CASE WHEN NEW.reversal_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM india_billing_payments p WHERE p.id=NEW.reversal_of AND p.invoice_id=NEW.invoice_id AND p.tenant_id=NEW.tenant_id AND p.status='approved' AND p.reversal_of IS NULL AND p.amount_cents=-NEW.amount_cents AND NEW.payment_date>=p.payment_date)
 THEN RAISE(ABORT,'DELIVERY_CONFLICT: exact approved reversal required') END;
END;
CREATE INDEX india_delivery_customer ON india_delivery_projects(tenant_id,customer_id);
CREATE INDEX india_delivery_task_project ON india_delivery_tasks(tenant_id,project_id,period);
CREATE INDEX india_delivery_invoice_project ON india_billing_invoices(tenant_id,project_id,status,due_date);
CREATE INDEX india_delivery_payment_invoice ON india_billing_payments(tenant_id,invoice_id,status);
CREATE INDEX india_contract_renewal_date ON india_service_contracts(tenant_id,status,end_date);
INSERT INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0027_customer_delivery_cash_renewal.sql','customer-delivery-cash-renewal');
INSERT INTO india_schema_migrations(version) VALUES(27);

CREATE TRIGGER india_customer_relations_no_delete BEFORE DELETE ON india_customer_relations BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_customer_records_no_delete BEFORE DELETE ON india_customer_records BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_opportunity_relations_no_delete BEFORE DELETE ON india_opportunity_relations BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_delivery_projects_no_delete BEFORE DELETE ON india_delivery_projects BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_delivery_tasks_no_delete BEFORE DELETE ON india_delivery_tasks BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_delivery_milestones_no_delete BEFORE DELETE ON india_delivery_milestones BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_billing_invoices_no_delete BEFORE DELETE ON india_billing_invoices BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_billing_payments_no_delete BEFORE DELETE ON india_billing_payments BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_invoice_revenue_links_no_delete BEFORE DELETE ON india_invoice_revenue_links BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;

CREATE TRIGGER india_service_contracts_no_delete BEFORE DELETE ON india_service_contracts BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: retain lifecycle history'); END;
CREATE TRIGGER india_billing_invoices_frozen BEFORE UPDATE ON india_billing_invoices WHEN OLD.status!='draft' OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.project_id IS NOT OLD.project_id OR NEW.milestone_id IS NOT OLD.milestone_id OR NEW.number IS NOT OLD.number OR NEW.issue_date IS NOT OLD.issue_date OR NEW.due_date IS NOT OLD.due_date OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.vat_cents IS NOT OLD.vat_cents OR NEW.document_id IS NOT OLD.document_id OR NEW.created_by IS NOT OLD.created_by BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable financial snapshot'); END;
CREATE TRIGGER india_billing_payments_frozen BEFORE UPDATE ON india_billing_payments WHEN OLD.status!='draft' OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.invoice_id IS NOT OLD.invoice_id OR NEW.reference IS NOT OLD.reference OR NEW.payment_date IS NOT OLD.payment_date OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.document_id IS NOT OLD.document_id OR NEW.reversal_of IS NOT OLD.reversal_of OR NEW.created_by IS NOT OLD.created_by BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable financial snapshot'); END;
CREATE TRIGGER india_delivery_milestone_frozen BEFORE UPDATE ON india_delivery_milestones WHEN OLD.status='accepted' BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: accepted BAST immutable'); END;
CREATE TRIGGER india_customer_relation_cycle BEFORE INSERT ON india_customer_relations BEGIN
 SELECT CASE WHEN EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_id UNION SELECT r.parent_id FROM india_customer_relations r JOIN ancestors a ON r.child_id=a.id WHERE r.tenant_id=NEW.tenant_id) SELECT 1 FROM ancestors WHERE id=NEW.child_id) THEN RAISE(ABORT,'DELIVERY_CONFLICT: customer hierarchy cycle') END;
END;
CREATE TRIGGER india_customer_relation_frozen BEFORE UPDATE ON india_customer_relations BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable customer relationship'); END;
CREATE TRIGGER india_customer_record_frozen BEFORE UPDATE ON india_customer_records BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable customer history'); END;
CREATE TRIGGER india_opp_relation_frozen BEFORE UPDATE ON india_opportunity_relations BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable opportunity relationship'); END;
CREATE TRIGGER india_revenue_link_frozen BEFORE UPDATE ON india_invoice_revenue_links BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: immutable revenue link'); END;
CREATE TRIGGER india_contract_frozen BEFORE UPDATE ON india_service_contracts
WHEN NEW.version!=OLD.version+1 OR NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.project_id!=OLD.project_id OR NEW.customer_id!=OLD.customer_id
 OR (OLD.status!='draft' AND (NEW.model!=OLD.model OR NEW.start_date IS NOT OLD.start_date OR NEW.end_date IS NOT OLD.end_date OR NEW.notice_days!=OLD.notice_days OR NEW.recurring_cents!=OLD.recurring_cents OR NEW.renewal_cents IS NOT OLD.renewal_cents OR NEW.configured_by IS NOT OLD.configured_by OR NEW.approved_by IS NOT OLD.approved_by OR NEW.probability_pct!=OLD.probability_pct OR NEW.status NOT IN ('active','expired','churned')))
BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: approved contract snapshot is immutable'); END;
CREATE TRIGGER india_project_pm_active BEFORE UPDATE OF pm_email ON india_delivery_projects WHEN NEW.pm_email IS NOT NULL AND NOT EXISTS(SELECT 1 FROM india_members WHERE email=NEW.pm_email AND active=1 AND role IN ('presales','admin'))
BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: PM must be an active delivery member'); END;
CREATE TRIGGER india_project_source BEFORE INSERT ON india_delivery_projects WHEN NOT EXISTS(SELECT 1 FROM india_delivery_source s WHERE s.id=NEW.id AND s.tenant_id=NEW.tenant_id AND s.opportunity_id=NEW.opportunity_id AND s.customer_id=NEW.customer_id AND s.release_id=NEW.release_id AND s.baseline_json=NEW.baseline_json AND s.budget_json=NEW.budget_json AND s.contract_cents=NEW.contract_cents)
BEGIN SELECT RAISE(ABORT,'DELIVERY_CONFLICT: project must use the approved source snapshot'); END;
-- Reuse an unambiguous PM already allocated in an approved Feasibility plan.
CREATE VIEW india_delivery_planned_pm AS
 SELECT f.tenant_id,f.opportunity_id,min(e.email) pm_email,f.start_date,f.end_date
 FROM india_feasibility_plans f JOIN india_resource_allocations a ON a.tenant_id=f.tenant_id AND a.opportunity_id=f.opportunity_id AND a.status='active' AND lower(trim(a.work_role)) IN ('pm','project manager','project_manager')
 JOIN india_resource_people e ON e.tenant_id=a.tenant_id AND e.id=a.person_id AND e.active=1
 JOIN india_members m ON lower(m.email)=lower(e.email) AND m.active=1 AND m.role IN ('presales','admin')
 WHERE f.status='approved' GROUP BY f.tenant_id,f.opportunity_id HAVING count(DISTINCT lower(e.email))=1;
CREATE TRIGGER india_delivery_assign_planned_pm AFTER INSERT ON india_delivery_projects
WHEN EXISTS(SELECT 1 FROM india_delivery_planned_pm x WHERE x.tenant_id=NEW.tenant_id AND x.opportunity_id=NEW.opportunity_id)
BEGIN
 UPDATE india_delivery_projects SET pm_email=(SELECT x.pm_email FROM india_delivery_planned_pm x WHERE x.tenant_id=NEW.tenant_id AND x.opportunity_id=NEW.opportunity_id),
 start_date=(SELECT x.start_date FROM india_delivery_planned_pm x WHERE x.tenant_id=NEW.tenant_id AND x.opportunity_id=NEW.opportunity_id),
 end_date=(SELECT x.end_date FROM india_delivery_planned_pm x WHERE x.tenant_id=NEW.tenant_id AND x.opportunity_id=NEW.opportunity_id),version=version+1 WHERE id=NEW.id AND tenant_id=NEW.tenant_id;
END;
CREATE TRIGGER india_delivery_soc_months AFTER UPDATE OF start_date,end_date ON india_delivery_projects
WHEN NEW.service_family='SOC/MDR' AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL
BEGIN
 INSERT OR IGNORE INTO india_delivery_tasks(id,tenant_id,project_id,code,title,period)
 SELECT NEW.id||'-soc-'||month,NEW.tenant_id,NEW.id,'soc_report','Monthly service report',month FROM (
 WITH RECURSIVE months(month,n) AS (SELECT substr(NEW.start_date,1,7),1 UNION ALL SELECT strftime('%Y-%m',month||'-01','+1 month'),n+1 FROM months WHERE month<substr(NEW.end_date,1,7) AND n<60)
 SELECT month FROM months);
END;
