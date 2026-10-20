-- TEST FIXTURE ONLY. DO NOT APPLY TO INDIA PRODUCTION/SHARED DATABASE.
-- Target database: india-uat-users-db (eaed652e-7322-4950-a304-dd50baa5de02).
-- The .invalid reserved addresses cannot receive email and have NO Cloudflare Access identity.
-- Registration is RBAC fixture data, not an authentication bypass or login credential.
INSERT OR IGNORE INTO india_members(email,role,active,created_by) VALUES
('uat.admin@india.invalid','admin',1,'INDIA_UAT_FIXTURE_20261020'),
('uat.sales.a@india.invalid','sales',1,'INDIA_UAT_FIXTURE_20261020'),
('uat.sales.b@india.invalid','sales',1,'INDIA_UAT_FIXTURE_20261020'),
('uat.presales@india.invalid','presales',1,'INDIA_UAT_FIXTURE_20261020'),
('uat.finance@india.invalid','finance',1,'INDIA_UAT_FIXTURE_20261020'),
('uat.approver@india.invalid','approver',1,'INDIA_UAT_FIXTURE_20261020'),
('uat.viewer@india.invalid','viewer',1,'INDIA_UAT_FIXTURE_20261020');
-- Active=0 mirrored rows in india-staging-db remain disabled and never authenticate.
-- Cleanup on UAT DB, after UAT:
-- DELETE FROM india_members WHERE created_by='INDIA_UAT_FIXTURE_20261020';
