#!/usr/bin/env python3
"""Isolated, synthetic SQL rehearsal. Never queries production or human credentials."""
import sqlite3
from pathlib import Path

db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("""
CREATE TABLE india_schema_migrations(version INTEGER PRIMARY KEY);
INSERT INTO india_schema_migrations VALUES(29);
CREATE TABLE india_schema_file_manifest(path TEXT,source_branch TEXT);
CREATE TABLE india_sales_accounts(id TEXT,tenant_id TEXT,PRIMARY KEY(tenant_id,id));
CREATE TABLE india_sales_opportunities(id TEXT PRIMARY KEY,tenant_id TEXT,company_id TEXT,stage TEXT);
CREATE TABLE india_delivery_projects(id TEXT PRIMARY KEY,tenant_id TEXT,customer_id TEXT,opportunity_id TEXT);
CREATE TABLE india_service_contracts(id TEXT PRIMARY KEY,tenant_id TEXT,project_id TEXT,customer_id TEXT,model TEXT,status TEXT,end_date TEXT, UNIQUE(tenant_id,id));
CREATE TABLE india_billing_invoices(id TEXT PRIMARY KEY,tenant_id TEXT,project_id TEXT,status TEXT,amount_cents INTEGER,vat_cents INTEGER);
CREATE TABLE india_billing_payments(id TEXT PRIMARY KEY,tenant_id TEXT,invoice_id TEXT,status TEXT,amount_cents INTEGER);
INSERT INTO india_sales_accounts VALUES('acct','defendit360');
INSERT INTO india_sales_opportunities VALUES('opp','defendit360','acct','closed_won');
INSERT INTO india_delivery_projects VALUES('proj','defendit360','acct','opp');
INSERT INTO india_service_contracts VALUES('cont','defendit360','proj','acct','FlexGuard','active','2099-12-31');
INSERT INTO india_billing_invoices VALUES('inv','defendit360','proj','approved',100000,11000);
INSERT INTO india_billing_payments VALUES('pay','defendit360','inv','approved',111000);
""")
sql=Path('migrations/0030_flexguard_immutable_ledger.sql').read_text()
db.executescript(sql)
assert db.execute('SELECT max(version) FROM india_schema_migrations').fetchone()[0]==30
db.execute("""INSERT INTO india_flexguard_wallets(id,tenant_id,customer_id,contract_id,entitlement_units,created_by)
VALUES('wallet','defendit360','acct','cont',10,'finance@example.test')""")
def reject(sql,params=()):
 try:
  db.execute(sql,params)
 except sqlite3.IntegrityError:
  return
 raise AssertionError('Expected rejected statement: '+sql[:90])
reject("UPDATE india_flexguard_wallets SET status='active',approved_by='finance@example.test',approved_notes='not same maker' WHERE id='wallet'")
db.execute("""UPDATE india_flexguard_wallets SET status='active',approved_by='approver@example.test',approved_notes='Independent entitlement signed' WHERE id='wallet'""")
def event(k,units,request,invoice=None,opp=None,source=None,doc=None):
 return db.execute("""INSERT INTO india_flexguard_events
 (id,tenant_id,wallet_id,kind,units,invoice_id,opportunity_id,source_event_id,document_id,request_key,actor_email,explanation)
 VALUES(?, 'defendit360','wallet',?,?,?,?,?,?,?,'worker@example.test','Actual approved workflow')""",
 (request,k,units,invoice,opp,source,doc,request))
event('ISSUE',10,'issue-00000000001',invoice='inv')
reject("""INSERT INTO india_flexguard_events(id,tenant_id,wallet_id,kind,units,invoice_id,request_key,actor_email,explanation)
 VALUES('fake','defendit360','wallet','TOPUP',1,'inv','topup-00000000001','f','Duplicate paid source')""")
reject("""INSERT INTO india_flexguard_events(id,tenant_id,wallet_id,kind,units,invoice_id,request_key,actor_email,explanation)
 VALUES('fake2','defendit360','wallet','TOPUP',1,'unknown','topup-00000000002','f','Unknown invoice')""")
event('RESERVE',4,'reserve-000000001',opp='opp')
reject("""INSERT INTO india_flexguard_events(id,tenant_id,wallet_id,kind,units,opportunity_id,request_key,actor_email,explanation)
 VALUES('bad','defendit360','wallet','RESERVE',7,'opp','reserve-000000002','f','Exceeds available')""")
event('DEBIT',3,'debit-0000000001',opp='opp',source='reserve-000000001',doc='vault-document-123')
reject("""INSERT INTO india_flexguard_events(id,tenant_id,wallet_id,kind,units,opportunity_id,source_event_id,document_id,request_key,actor_email,explanation)
 VALUES('bad2','defendit360','wallet','DEBIT',2,'opp','reserve-000000001','vault-document-123','debit-0000000002','f','Exceeds reserve')""")
event('REFUND',2,'refund-000000001',source='debit-0000000001')
reject("""INSERT INTO india_flexguard_events(id,tenant_id,wallet_id,kind,units,source_event_id,request_key,actor_email,explanation)
 VALUES('bad3','defendit360','wallet','REFUND',2,'debit-0000000001','refund-000000002','f','Exceeds consumed')""")
event('RELEASE',1,'release-000000001',opp='opp',source='reserve-000000001')
reject("UPDATE india_flexguard_events SET units=20 WHERE id='issue-00000000001'")
reject("DELETE FROM india_flexguard_events WHERE id='issue-00000000001'")
rows=db.execute("SELECT kind,units FROM india_flexguard_events ORDER BY rowid").fetchall()
available=reserved=consumed=expired=issued=0
for k,n in rows:
 if k in ('ISSUE','TOPUP'):issued+=n;available+=n
 elif k=='RESERVE':available-=n;reserved+=n
 elif k=='RELEASE':available+=n;reserved-=n
 elif k=='DEBIT':reserved-=n;consumed+=n
 elif k=='REFUND':consumed-=n;available+=n
 elif k=='EXPIRY':available-=n;expired+=n
assert (issued,available,reserved,consumed,expired)==(10,9,0,1,0)
assert db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print('FlexGuard synthetic migration, immutable guards, SoD, idempotency, payment and balances PASS')
