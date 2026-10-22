-- INDIA 0022: additive resource/cost feasibility. Depends on 0016 and 0021.
-- No seed, no backfill, no retroactive approval. All financial amounts are IDR.
CREATE TABLE india_feasibility_plans(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 service_line TEXT NOT NULL CHECK(service_line IN ('VAPT','SOC/MDR','FortiSIEM','GRC','Managed Security')),
 start_date TEXT NOT NULL, end_date TEXT NOT NULL, months INTEGER NOT NULL CHECK(months BETWEEN 1 AND 60),
 asset_count INTEGER NOT NULL DEFAULT 0 CHECK(asset_count BETWEEN 0 AND 100000),
 pd_per_asset REAL NOT NULL DEFAULT 0 CHECK(pd_per_asset>=0 AND pd_per_asset<=1000),
 retest_pct REAL NOT NULL DEFAULT 0 CHECK(retest_pct BETWEEN 0 AND 100),
 coordination_pd REAL NOT NULL DEFAULT 0 CHECK(coordination_pd BETWEEN 0 AND 100000),
 base_pd REAL NOT NULL DEFAULT 0 CHECK(base_pd BETWEEN 0 AND 100000),
 coverage_hours INTEGER NOT NULL DEFAULT 0 CHECK(coverage_hours IN (0,8,12,24)),
 staffing INTEGER NOT NULL DEFAULT 0 CHECK(staffing BETWEEN 0 AND 200),
 coverage_days INTEGER NOT NULL DEFAULT 0 CHECK(coverage_days BETWEEN 0 AND 31),
 required_pd REAL NOT NULL CHECK(required_pd>0 AND required_pd<=1000000),
 target_margin_pct REAL NOT NULL CHECK(target_margin_pct BETWEEN 0 AND 99),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by TEXT NOT NULL COLLATE NOCASE, reviewed_by TEXT, review_notes TEXT, reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 CHECK(status!='approved' OR (reviewed_by IS NOT NULL AND lower(reviewed_by)!=lower(created_by)))
);
CREATE TABLE india_resource_people(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE,
 display_name TEXT NOT NULL, skills TEXT NOT NULL,
 capacity_pd_month REAL NOT NULL CHECK(capacity_pd_month>0 AND capacity_pd_month<=31),
 daily_cost_idr REAL NOT NULL CHECK(daily_cost_idr>=0 AND daily_cost_idr<1e12),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,email), UNIQUE(tenant_id,id)
);
CREATE TABLE india_resource_allocations(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 person_id TEXT NOT NULL, allocation_month TEXT NOT NULL CHECK(length(allocation_month)=7),
 work_role TEXT NOT NULL, person_days REAL NOT NULL CHECK(person_days>0 AND person_days<=31),
 daily_cost_snapshot REAL NOT NULL CHECK(daily_cost_snapshot>=0 AND daily_cost_snapshot<1e12),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id,person_id,allocation_month), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES india_resource_people(tenant_id,id)
);
CREATE INDEX india_alloc_calendar ON india_resource_allocations(tenant_id,person_id,allocation_month,status);
CREATE TABLE india_feasibility_costs(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 cost_type TEXT NOT NULL CHECK(cost_type IN ('license','subscription','supplier_service','tooling','cloud','travel','other')),
 description TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL,
 quantity REAL NOT NULL CHECK(quantity>0 AND quantity<=1000000),
 periods INTEGER NOT NULL CHECK(periods BETWEEN 1 AND 60),
 unit_price_idr REAL NOT NULL CHECK(unit_price_idr>=0 AND unit_price_idr<1e13),
 supplier_offer_id TEXT, created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,opportunity_id,supplier_offer_id), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,opportunity_id) REFERENCES india_sales_opportunities(tenant_id,id),
 FOREIGN KEY(tenant_id,supplier_offer_id) REFERENCES india_vendor_offers(tenant_id,id),
 CHECK(cost_type!='license' OR length(sku)>=2),
 CHECK(supplier_offer_id IS NULL OR unit_price_idr>0)
);
CREATE INDEX india_feasibility_costs_opportunity ON india_feasibility_costs(tenant_id,opportunity_id);
CREATE TABLE india_feasibility_history(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, opportunity_id TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 action TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER india_feasibility_history_immutable_u BEFORE UPDATE ON india_feasibility_history
 BEGIN SELECT RAISE(ABORT,'FEASIBILITY_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_feasibility_history_immutable_d BEFORE DELETE ON india_feasibility_history
 BEGIN SELECT RAISE(ABORT,'FEASIBILITY_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER india_feasibility_plan_history BEFORE UPDATE ON india_feasibility_plans
BEGIN
 INSERT INTO india_feasibility_history(id,tenant_id,opportunity_id,entity_type,entity_id,snapshot_json,action,actor)
 VALUES(lower(hex(randomblob(16))),OLD.tenant_id,OLD.opportunity_id,'plan',OLD.id,
 json_object('status',OLD.status,'version',OLD.version,'service_line',OLD.service_line,'start_date',OLD.start_date,
 'end_date',OLD.end_date,'required_pd',OLD.required_pd,'target_margin_pct',OLD.target_margin_pct,
 'created_by',OLD.created_by,'reviewed_by',OLD.reviewed_by,'review_notes',OLD.review_notes),
 'BEFORE_UPDATE',NEW.created_by);
END;
CREATE TRIGGER india_feasibility_alloc_insert BEFORE INSERT ON india_resource_allocations
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM india_resource_people p WHERE p.id=NEW.person_id AND p.tenant_id=NEW.tenant_id AND p.active=1
  AND NEW.person_days+coalesce((SELECT sum(a.person_days) FROM india_resource_allocations a WHERE a.tenant_id=NEW.tenant_id AND a.person_id=NEW.person_id AND a.allocation_month=NEW.allocation_month AND a.status='active'),0)
  <=p.capacity_pd_month
 ) THEN RAISE(ABORT,'RESOURCE_CAPACITY_CONFLICT') END;
END;
CREATE TRIGGER india_feasibility_alloc_update BEFORE UPDATE OF person_days,allocation_month,person_id,status ON india_resource_allocations
WHEN NEW.status='active'
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM india_resource_people p WHERE p.id=NEW.person_id AND p.tenant_id=NEW.tenant_id AND p.active=1
  AND NEW.person_days+coalesce((SELECT sum(a.person_days) FROM india_resource_allocations a WHERE a.tenant_id=NEW.tenant_id AND a.person_id=NEW.person_id AND a.allocation_month=NEW.allocation_month AND a.status='active' AND a.id!=OLD.id),0)
  <=p.capacity_pd_month
 ) THEN RAISE(ABORT,'RESOURCE_CAPACITY_CONFLICT') END;
END;
CREATE TRIGGER india_feasibility_plan_scope AFTER UPDATE OF title,data_json,estimated_value_idr,company_id ON india_sales_opportunities
WHEN (OLD.title!=NEW.title OR OLD.data_json!=NEW.data_json OR OLD.estimated_value_idr!=NEW.estimated_value_idr OR OLD.company_id!=NEW.company_id)
BEGIN
 UPDATE india_feasibility_plans SET status='draft',reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP
 WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.id AND status='approved';
END;
CREATE TRIGGER india_feasibility_alloc_history AFTER INSERT ON india_resource_allocations
BEGIN
 INSERT INTO india_feasibility_history(id,tenant_id,opportunity_id,entity_type,entity_id,snapshot_json,action,actor)
 VALUES(lower(hex(randomblob(16))),NEW.tenant_id,NEW.opportunity_id,'allocation',NEW.id,
 json_object('person_id',NEW.person_id,'month',NEW.allocation_month,'days',NEW.person_days,'unit_cost',NEW.daily_cost_snapshot),
 'CREATE',NEW.created_by);
 UPDATE india_feasibility_plans SET status='draft',reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,version=version+1
 WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.opportunity_id AND status='approved';
END;
CREATE TRIGGER india_feasibility_alloc_cancel AFTER UPDATE OF status ON india_resource_allocations
WHEN OLD.status!=NEW.status BEGIN
 INSERT INTO india_feasibility_history(id,tenant_id,opportunity_id,entity_type,entity_id,snapshot_json,action,actor)
 VALUES(lower(hex(randomblob(16))),NEW.tenant_id,NEW.opportunity_id,'allocation',NEW.id,json_object('old_status',OLD.status,'new_status',NEW.status),'STATUS_CHANGE',NEW.created_by);
 UPDATE india_feasibility_plans SET status='draft',reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,version=version+1
 WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.opportunity_id AND status='approved';
END;
CREATE TRIGGER india_feasibility_cost_history AFTER INSERT ON india_feasibility_costs
BEGIN
 INSERT INTO india_feasibility_history(id,tenant_id,opportunity_id,entity_type,entity_id,snapshot_json,action,actor)
 VALUES(lower(hex(randomblob(16))),NEW.tenant_id,NEW.opportunity_id,'cost',NEW.id,
 json_object('cost_type',NEW.cost_type,'description',NEW.description,'qty',NEW.quantity,'periods',NEW.periods,'unit_price',NEW.unit_price_idr,'supplier_offer_id',NEW.supplier_offer_id),
 'CREATE',NEW.created_by);
 UPDATE india_feasibility_plans SET status='draft',reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,version=version+1
 WHERE tenant_id=NEW.tenant_id AND opportunity_id=NEW.opportunity_id AND status='approved';
END;
CREATE TRIGGER india_feasibility_cost_delete BEFORE DELETE ON india_feasibility_costs
BEGIN
 INSERT INTO india_feasibility_history(id,tenant_id,opportunity_id,entity_type,entity_id,snapshot_json,action,actor)
 VALUES(lower(hex(randomblob(16))),OLD.tenant_id,OLD.opportunity_id,'cost',OLD.id,
 json_object('cost_type',OLD.cost_type,'description',OLD.description,'qty',OLD.quantity,'periods',OLD.periods,'unit_price',OLD.unit_price_idr,'supplier_offer_id',OLD.supplier_offer_id),
 'DELETE',OLD.created_by);
 UPDATE india_feasibility_plans SET status='draft',reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,version=version+1
 WHERE tenant_id=OLD.tenant_id AND opportunity_id=OLD.opportunity_id AND status='approved';
END;
-- Resource availability and quote expiry are rechecked by SQL at every forward Sales stage.
CREATE VIEW india_solution_feasibility_gaps AS
SELECT p.tenant_id,p.opportunity_id,p.id,p.status,
 CASE WHEN p.status!='approved' OR p.reviewed_by IS NULL OR lower(p.reviewed_by)=lower(p.created_by)
 OR date(p.end_date)<date(p.start_date)
 OR coalesce((SELECT sum(a.person_days) FROM india_resource_allocations a
  WHERE a.tenant_id=p.tenant_id AND a.opportunity_id=p.opportunity_id AND a.status='active'),0)<p.required_pd
 OR EXISTS(SELECT 1 FROM india_resource_allocations a JOIN india_resource_people e ON e.id=a.person_id AND e.tenant_id=a.tenant_id
  WHERE a.tenant_id=p.tenant_id AND a.opportunity_id=p.opportunity_id AND a.status='active' AND
  (e.active!=1 OR a.allocation_month<substr(p.start_date,1,7) OR a.allocation_month>substr(p.end_date,1,7)
   OR (SELECT coalesce(sum(x.person_days),0) FROM india_resource_allocations x
       WHERE x.tenant_id=a.tenant_id AND x.person_id=a.person_id AND x.allocation_month=a.allocation_month AND x.status='active')>e.capacity_pd_month))
 OR EXISTS(SELECT 1 FROM india_feasibility_costs c LEFT JOIN india_vendor_offers o ON o.id=c.supplier_offer_id AND o.tenant_id=c.tenant_id AND o.opportunity_id=c.opportunity_id
   LEFT JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id
   WHERE c.tenant_id=p.tenant_id AND c.opportunity_id=p.opportunity_id AND c.supplier_offer_id IS NOT NULL
   AND (o.id IS NULL OR o.status!='validated' OR v.status!='validated' OR date(o.valid_until)<date('now','+7 hours')
   OR date(v.valid_until)<date('now','+7 hours') OR date(o.valid_until)<date(coalesce(nullif(json_extract((SELECT data_json FROM india_sales_opportunities d WHERE d.tenant_id=p.tenant_id AND d.id=p.opportunity_id),'$.quotation_valid_until'),''),p.start_date))
   OR date(v.valid_until)<date(p.start_date) OR o.unit!=c.unit OR o.unit_price_idr!=c.unit_price_idr OR o.quantity<c.quantity*c.periods OR o.capacity_confirmed<c.quantity*c.periods OR v.capacity_units<o.capacity_confirmed))
 OR (p.service_line='FortiSIEM' AND NOT EXISTS(SELECT 1 FROM india_feasibility_costs c WHERE c.tenant_id=p.tenant_id AND c.opportunity_id=p.opportunity_id AND c.cost_type='license' AND c.supplier_offer_id IS NOT NULL))
 OR (p.service_line IN ('SOC/MDR','Managed Security') AND NOT EXISTS(SELECT 1 FROM india_feasibility_costs c WHERE c.tenant_id=p.tenant_id AND c.opportunity_id=p.opportunity_id AND c.cost_type IN ('license','subscription','cloud','tooling')))
 OR (SELECT estimated_value_idr FROM india_sales_opportunities d WHERE d.id=p.opportunity_id AND d.tenant_id=p.tenant_id)<=0
 OR (100*(1-(
   coalesce((SELECT sum(a.person_days*a.daily_cost_snapshot) FROM india_resource_allocations a WHERE a.tenant_id=p.tenant_id AND a.opportunity_id=p.opportunity_id AND a.status='active'),0)
  +coalesce((SELECT sum(c.quantity*c.periods*c.unit_price_idr) FROM india_feasibility_costs c WHERE c.tenant_id=p.tenant_id AND c.opportunity_id=p.opportunity_id),0)
 )/(SELECT estimated_value_idr FROM india_sales_opportunities d WHERE d.id=p.opportunity_id AND d.tenant_id=p.tenant_id)))<p.target_margin_pct
 THEN 1 ELSE 0 END AS is_gap
FROM india_feasibility_plans p;
CREATE TRIGGER india_feasibility_stage_gate BEFORE UPDATE OF stage ON india_sales_opportunities
WHEN NEW.stage!=OLD.stage AND NEW.stage IN ('commercial_review','quotation_sent','negotiation','pending_po','closed_won')
 AND EXISTS(SELECT 1 FROM india_feasibility_plans p WHERE p.tenant_id=NEW.tenant_id AND p.opportunity_id=NEW.id)
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM india_solution_feasibility_gaps f WHERE f.tenant_id=NEW.tenant_id AND f.opportunity_id=NEW.id AND f.is_gap=1)
 THEN RAISE(ABORT,'FEASIBILITY_CONFLICT: resources, supplier quotation or cost review invalid') END;
END;
INSERT OR IGNORE INTO india_schema_file_manifest(path,source_branch) VALUES('migrations/0022_vendor_resource_feasibility.sql','vendor-resource-feasibility');
INSERT INTO india_schema_migrations(version) VALUES(22);
