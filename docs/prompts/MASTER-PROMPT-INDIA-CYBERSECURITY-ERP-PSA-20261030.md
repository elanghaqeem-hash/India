# MASTER EXECUTION PROMPT — INDIA CYBERSECURITY ENTERPRISE ERP + PSA
**Version:** 1.0 | **Date:** 30 October 2026 | **Company:** Technotama
**System:** INDIA — Integrated Cybersecurity Enterprise Resource Planning & Professional Services Automation
**Repository (source of truth):** https://github.com/elanghaqeem-hash/India
**Initial audited reference:** main@045298e9e0682ba6579d1b3a8f6a6f73962aa9d3; re-audit CURRENT HEAD first.
**Related audit:** docs/INDIA_CYBERSECURITY_ENTERPRISE_ERP_AUDIT_20261030.md
**Stack baseline:** Next.js, React, TypeScript, Cloudflare Workers/OpenNext, Cloudflare D1, Cloudflare Access; use existing tooling and inspect package/config before changes.

## 0. MANDATE
You are one integrated delivery team: Principal Enterprise Architect; Cybersecurity Services Domain Expert (VAPT/SOC/MDR/CTI/DFIR/GRC); PSA Specialist; Finance & Accounting/Controller; Procurement/Supply Chain Specialist; HRIS/Resource Planning; Database/Cloudflare; AppSec/Privacy; DevOps/SRE; UI/UX; QA/UAT. Implement an enterprise-grade operational ERP for all Technotama divisions, while **preserving existing Sales/Delivery, customer/Opportunity/project and Document Vault flows**. The result must be real, functional software with coherent end-to-end records, approvals, source code, migrations, tests, evidence, documentation and deployment readiness. This is NOT an instruction to label untested features PASS or deploy unsafe changes.

**Execution sequence:** inspect current reality → preserve and reuse → traceability/gap map → ADR/BRD/FRS → additive design → implement in dependency order → automated testing → isolated signed multi-role UAT → independently verified backup/restore and rollback → security/performance tests → controlled PR/merge → release approval → production deployment & post-deploy verification. Work through usable vertical slices; avoid giant unfinished refactors.

## 1. IMMUTABLE PRINCIPLES
1. Reuse canonical existing modules, tables and IDs. No second CRM, project, invoice, contract, catalog, wallet or Document Vault.
2. No destructive schema change; D1 migrations must be additive/versioned, idempotency/concurrency safe, reversible by independently verified backup or Time Travel plus verified restore, with lineage in schema ledger and manifest.
3. Authenticate every server mutation with Cloudflare Access signed JWT (issuer, audience, JWKS), active member, role, capabilities and object/customer/tenant ownership; no frontend-only authorization.
4. Separation of duties: maker cannot self-approve financial, vendor, sensitive configuration, client deliverable and ledger transactions; immutable before/after audit; actor and timestamp from verified context.
5. No hard-coded VAT/WHT/rate or legal tax conclusion; use effective-date parameterized validated rules approved by Finance and map PSAK 115 obligations to revenue recognition.
6. All money uses integer minor units and explicit currency and exchange-rate context; balanced double-entry, never float as a posted journal source.
7. Never manufacture fake actual customers/staff emails, real test evidence, live AI calls, Cloudflare signed sessions, backups, approvals or PASS results. Synthetic fixtures only on clearly labeled isolated UAT.
8. Do not change production Cloudflare D1/Worker/Access, expose secrets, drop original tables, purge clients or merge stale PRs without exact SHA/evidence/signoff.
9. Maintain existing Technotama/INDIA visible branding, but do NOT blindly rename legacy internal tenant keys, historical audit IDs or old schema names.
10. Every clickable control must be operational: correct validation, permissions, persistence, errors, optimistic locking, success state, audit and negative tests. No inert buttons, phantom save, orphan navigation or demo-only persistence.

## 2. REQUIRED BASELINE RECONCILIATION (DO THIS FIRST)
Review README/AGENTS if present, latest git log, open PRs and CI, code tree, app routes, API routes, migrations 0001–0032 and later, data models, D1 production and UAT bindings, Access, Document Vault, cron, AI, release docs, and 210-case UAT catalog. Create matrix: module; menu; API; DB; action; permission; workflow; tests; deployment; real UAT; gaps; severity; reuse reference; acceptance criteria. Use exact verified current SHA and bindings. Reconcile outstanding PR #64 and document audit PR #88 if still applicable; re-evaluate their current state rather than assume open. Historical read-only audit (30 October): source had extensive sales-to-cash modules, production D1 at version 0032 with 95 tables and quick_check OK; 2 active Admin and no active non-Admin roster; 0 records in sampled Opportunity/project/invoice/payment/contract/Vault/FlexGuard event tables; 7 AI providers, 5 enabled and 2 with historical successful probe records. These observations are NOT current production guarantees. Capture read-only state again and clearly label unverified claims.

## 3. ORGANIZATION & RBAC / SoD
Support hierarchical Group → legal entity → division → department → team → cost center → employee and project location. Roles include Admin, IAM, Executive/CEO/COO/CFO, Marketing, Sales A/B and Sales Manager, Presales/Solution Architect, Tender/Bid, Legal/Contract, PMO, Project Manager, VAPT Tester/Reviewer, SOC L1/L2/L3/Manager, DFIR, Cyber GRC Consultant, Resource Manager, HR, Procurement, Vendor/OEM, Finance AR/AP/GL/Treasury, Controller, Approver, Customer Success, Service Desk, Compliance/DPO, Internal Auditor and read-only Viewer. Extend existing eight-role model additively through capabilities; do not destroy memberships. Define per-role: menu, read, create, edit, delete/tombstone, submit, review, approve, download, export, post, reverse, close, re-open, admin; row/field/customer access; limits and multi-level delegation. Require minimum two independent real Admins for critical admin reviews; validate real users, no fabricated Access JWT. Treat customer portal users as distinct external principals.

## 4. TARGET INFORMATION ARCHITECTURE — 20 MENU GROUPS
Each menu/submenu must have URL, persistent API, validation, permissions, D1 schema and documented states. Include (1) Command Center & My Workspace (2) Marketing & Lead (3) Customer 360 & CRM (4) Presales/Tender/Scoping (5) Commercial/BoQ/Pricing/DoA (6) Contracts/Legal/Obligations (7) Project Portfolio & PSA (8) Cybersecurity Service Operations (VAPT, SOC/MDR, DFIR, CTI, GRC, Training, Cloud/OT, FlexGuard) (9) Service Desk & Customer Success (10) Finance AR/Billing/Collections/Revenue (11) Finance GL/AP/Treasury/Tax/Closing (12) Procurement/OEM/Partner (13) HR/Workforce/Resource/Timesheet (14) Assets/Inventory/License (15) FlexGuard Entitlements & Token Ledger (16) Planning/Budget/Forecast (17) Reporting/BI/AI (18) Secure Document Vault (19) Risk/Compliance/Audit/Security (20) Admin/Settings/Master Data/Integrations/Health.

Common UI actions, where applicable: add, edit, save, cancel, submit, approve, reject, return for revision, version/clone, attach, preview, download, import, export, search, sort, pagination, filters, archive/tombstone, restore by policy, view history, share by role, and controlled reversal. Never show unauthorized controls. Destructive actions need clear confirmation and soft-delete/retention where mandated. Sidebars left collapsible, mobile keyboard-safe, accessible, attractive modern enterprise UI, consistent tables/forms/modals and actionable errors; screen states loading/empty/error/success/denied/offline, no confusing demo data.

## 5. CANONICAL MASTER DATA AND ENTITY RELATIONSHIPS
Extend, do not fork: legal_entity, org_unit, employee/member, identity_capability, cost_center, customer, customer_contact, lead, campaign, opportunity, service_catalog/service_option, scoped_asset, tender, BoQ, quotation_release, approval_request, document, contract/contract_line/obligation, PO/award, project, WBS/task, milestone, resource_assignment, timesheet, ticket/incident/finding, delivery_evidence, acceptance/BAST, invoice/invoice_line, payment/allocation, revenue_schedule/recognition, AP supplier_bill, procurement_request, vendor, vendor_offer, purchase_order, goods_service_receipt, OEM_license, asset, budget, journal_header/journal_line, chart_of_accounts, fiscal_period, bank_reconciliation, audit_event, outbox_event, ERP integration job. Use foreign keys, unique canonical business keys, tenant/legal-entity/currency dimensions, server-generated IDs, immutable history and version/conflict checks. Existing IDs remain the primary integration references; external records have durable provider IDs. Add a data dictionary, ERD, CRUD matrix, API contract, glossary and lineage from customer→Opportunity→contract→project→invoice→journal.

## 6. REVENUE OPERATIONS — REUSE EXISTING SALES
Marketing source, campaign, lead, duplicate checks, qualification, customer hierarchy/NPWP, Opportunity, product/service selection, RKS/RFP/RFQ, tender mandatory compliance, bid/no-bid scoring, scoping and assets, resource feasibility, BoQ costing, price/discount/margin/FX, multi-level DoA, quotation revision/version, submission original proof, negotiation, approved PO/SPK, Closed Won or Lost, customer-facing agreements, renewal and cross-sell. No stage may bypass verified latest approved scope, price, original document or proper maker/checker. Maintain direct/indirect/channel/partner models, recurring/subscription/one-time, multi-year and multi-currency contracts, payment milestones, price validity and amendment lineage.

## 7. PSA — PROJECT-TO-PROFIT SERVICE ENGINE
From Won transaction generate ONE canonical project and approved baseline referencing immutable commercial scope, SOW, price, dates and original evidence. Support project charter, WBS, tasks/dependencies, resource plans/skill checks, work calendar, capacity and utilization, time entry and approval, expenses/travel, subcontractors, license costs, committed vs actual cost, scope change request & variation order, project issues/risks, deliverable QC/review, evidence & acceptance, BAST, invoice trigger and close. Project financials show Budget, Actual, Committed, Estimate to Complete, EAC, Revenue Recognized, Gross Margin with definitions and audit. No labor allocation exceeds available capacity without explicit documented exception. Approved timesheets cannot be silently modified. Project closure blocked for missing BAST, open obligations, unapproved timesheets or unresolved costs.

## 8. SERVICE-SPECIFIC CYBERSECURITY OPERATIONS
- **VAPT/pentest:** signed Authorization to Test / Rules of Engagement, allowed IP/domain/app/API/endpoints, scope exclusions, test window, staff qualifications, safe tools/credentials reference, findings CWE/CVE/CVSS 4.0 vector and base score, severity triage, screenshots/evidence Vault, independent QA, client acknowledgement, remediation and retest, versioned final report, signoff and BAST; no unapproved testing.
- **SOC/MDR:** client onboarding, CMDB/monitored asset & tenant SIEM connector references, log-source coverage and health, shifts L1–L3, cases, severity, time-to-detect/respond, escalation, customer approval for disruptive actions, threat hunting, SLA pause/holiday clocks, incident closure, monthly report, subscriptions and license renewals; orchestrate existing SIEM/EDR, do not pretend INDIA is itself a SIEM.
- **DFIR:** incident declaration, evidence chain of custody, acquisition hash/owner, case timeline, legal hold, containment authorization, response and recovery actions, RCA, handover and lessons learned.
- **Cyber GRC/BCM/PDP:** client control library, assessment, evidence, control testing, maturity score and gaps, remediation action plan, governance signoffs, consulting deliverables; integrate TotalARC only via approved API, do not duplicate its SoT.
- **CTI/Threat Hunting:** scoped intelligence products, indicators metadata/classification, research tasks, report delivery, subscriptions and approval; do not disclose sensitive customer intelligence cross-tenant.
- **OT/ICS, Cloud, Training, Red Team and Technology Delivery:** separately configurable scoping fields, asset types, safety approvals, capacity/resource requirements, method/outputs and SLA without pretending all services follow VAPT-specific steps.
- **FlexGuard:** retain immutable ISSUE/TOPUP/RESERVE/DEBIT/RELEASE/REFUND/EXPIRY event ledger; prohibit double consumption and negative available balance; tie work order, delivery, accepted evidence and Finance treatment to canonical project/contract. Reconcile balance with entitlement.

## 9. FULL FINANCE ERP AND ACCOUNTING
Create approved COA by legal entity, cost center, projects and fiscal periods; journal templates, unposted/draft/approved/posted/reversed state machine, double-entry posting (total debits=credits per currency/book), sequential controlled posting reference, immutable posted entries, lock/close periods, controlled reversal/reopen and dated effective exchange rates. Cover:
- AR: invoices/subscriptions/usage/BAST, VAT and other tax configuration, collections and exact allocation, credits, over/underpayments, AR aging, DSO, customer statements and reconciliations.
- Revenue: booking != billing != cash != recognized revenue. Configure performance obligations, allocation, time-based or milestone fulfillment and deferred/accrued schedules aligned with approved accounting policy and PSAK 115 (former PSAK 72). Require Finance certification before GL posting, including reversal/period correction.
- AP & expenses: vendor invoice, uniqueness, purchase-order/receipt 3-way match, advances, claims, reimbursements, approval and treasury handoff; bank statement import with reconciliation.
- Controlling: cost centers, staffing rates, direct labor, vendor/subcontractor/OEM costs, committed vs actual, COGS, gross margin, utilization, budgets and variances.
- Outputs: trial balance, journal, subledger reconciliation, balance sheet, P&L, cash flow, AR/AP aging, revenue bridge, deferred revenue and management packs. No bank transfer triggered merely by creating an approved invoice: require dedicated treasury authorization/integration.
- All tax rates/withholding/faktur/e-invoice/Coretax requirements are effective-dated configurable, reviewed by Finance and Legal against CURRENT official rules; never hard-code assumed legal treatment. Create balancing, FX, duplicate, reversal and year/month-close negative tests.

## 10. PROCUREMENT, OEM, INVENTORY AND HR
Procure-to-pay: requisition → budget check → vendor due diligence/conflict check → RFQ/RFP/quotes & comparative evaluation → DoA → purchase order → partial goods/services receipt → OEM/license validation → supplier invoice/3-way match → AP/payment → performance. Preserve supplier quote evidence and secure license entitlements; independent reviewer; prohibit over-receipt, duplicate vendor invoice, self-approval and wrong entity/currency. Include company-issued and client-owned asset separation, custody, software/license subscription dates, serial/warranty, stock changes and asset return/disposal.

HR/workforce: employee profile (sensitive-field permissions), employment status, skills/certification expiry, onboarding/offboarding, role changes, utilization calendar, leave, attendance integration, timesheet, compensation rate classes, project assignment, payroll-ready exports/integrations. Payroll secrets and banking information belong only to separately authorized HR/Finance roles; do not log them. Capacity and cost calculations derive from certified assignments and approved timesheets.

## 11. CONTRACTS, CUSTOMER SERVICE AND PSA SUPPORT
Unified customer agreements (NDA, MSA, SOW, PO/SPK, amendments), obligation registry, renewal notice periods, billing intervals, warranty/license terms, managed service entitlements, penalties/service credits (only when contractually approved), service desk tickets, priority/impact/SLA, escalation, customer approval, CSAT/NPS, contract health/churn and renewal opportunities; customer portal if approved, with separate constrained external identity and no exposure of internal costing or other customers.

## 12. REPORTS & VERIFIED BUSINESS METRICS
Executive, Division Head, PMO, Service Delivery, SOC, VAPT, Finance, HR, Procurement, Sales and Compliance dashboards. Metrics must be defined in a semantic KPI registry with owner, source, formula, time zone, filters and reconciliation tests. Required: pipeline weighted and conversion, won/lost, bookings, backlog, billed, collected, recognized and deferred revenue; ARR/MRR from valid subscription periods; project WIP/profitability; certified utilization, billability and capacity; SOC MTTD/MTTR/SLA attainment; VAPT remediation ageing and retest turnaround; renewals and churn; procurement spend & savings, vendor SLA; AR/AP aging, DSO, cashflow, GL trial balance; personnel certifications; security incidents and UAT/release health. Distinguish forecast vs actual, provisional vs certified. Any KPI unable to reconcile to authoritative transaction tables must be visibly marked unavailable/partial, not estimated as actual.

## 13. AI AND INTEGRATION GOVERNANCE
Reuse existing provider registry (OpenAI/Gemini/Claude/Groq/OpenRouter/DeepSeek/Mistral as actually present); Admin-owned test/key rotation/enable/disable/priority/fallback/timeouts/cost budgets; no secret reveal. Real provider test in authorized isolated environment; historical test metadata isn't current live availability. Limit prompts and retrieval to authorized customer/role files, PII masking, prompt-injection containment, audit and human approval. AI may recommend tender classification, scoping, effort, report drafting and executive explanations but must not self-approve bids, issue tokens, process payments, post GL or close incidents.

Design adapters for CRM/email/calendar, approved SIEM/EDR/ITSM, scanner integrations, tax/finance exports, bank statements, payroll, OEM license APIs, TotalARC. Integrations require service accounts with scoped credentials, per-client consent, signed webhooks, idempotency, retries/backoff/dead-letter queues and reconciliation. Missing credentials must surface as disabled/unverified; no simulated live integration.

## 14. SECURITY, PRIVACY, CONTROL AND PLATFORM HARDENING
Reference frameworks: UU 27/2022 PDP (official JDIH), NIST CSF 2.0, OWASP ASVS 5.0, ISO 27001/27002 where applicable, ISO 20000-1 for service management as relevant, FIRST CVSS 4.0 for vulnerabilities, and applicable SAK/PSAK 115. Verify each current version and sector-specific applicability before production; keep control matrix and primary source URLs. End-to-end guardrail: Cloudflare Access JWT + D1 active role, RBAC/ABAC and ownership/tenant isolation, rate limit, CSRF/origin, XSS and injection validation, encrypted Vault originals, checksum integrity, upload MIME/magic size limits and malware workflow, classified evidence access, secure logs, key lifecycle, secret storage, retention/legal hold, Data Protection Impact Assessment where triggered, audit immutability, backup/restore RPO/RTO and tested incident response. Use D1 for canonical relational data; preserve current encrypted Vault backend and use R2 only after verified design/permissions and migration. No direct user secrets or payloads in GitHub or logs.

## 15. SYSTEM QUALITY, API AND DATABASE RULES
Use typed request/response validation, optimistic version checks, server-side transactional guards, atomic D1 batches, server-generated unique transaction numbers, money integer minor units, explicit date/UTC+Asia/Jakarta conversion and calendar rules, actionable failures and conditional consistency. Durable outbox + retry for external side effects; never assume distributed transactions with email, OEM or financial partners. Design rollbackable interface evolution, migrations hash manifest, scripts for integrity, old data backfill with preview/dry-run and explicit business signoff, and fail-closed external service states.

## 16. PHASED IMPLEMENTATION / WORK PACKAGES
**WP0 — Current-state audit & baseline freeze:** repo/current branches/CI, API/menu/DB inventory, current Worker and D1 linkage, release evidence, test catalog. Deliver actual gap matrix/ADR/traceability, not estimates.
**WP1 — Stabilization:** live Access real roster, Admin safety, save/edit/delete, customer/lead/catalog, option registry, scoping upload and document Vault, legacy preview segregation, service menu testing. No production write until backup gate.
**WP2 — Canonical entities and org/RBAC:** hierarchical employee/cost center, capabilities/SoD/DoA, unified approval/action inbox, canonical IDs, audit/event contracts, role-aware navigation.
**WP3 — Sales/Commercial integration:** CRM → scoping → tender → BoQ/price → quotation → award → contract/PO with immutable source releases and document references.
**WP4 — PSA core:** projects, WBS, resourcing, capacity, assignment, certified timesheet, cost, milestones/change control, BAST.
**WP5 — Cyber Ops:** service templates, VAPT findings/retest and approval; SOC onboarding/cases/SLA; DFIR/evidence chain; GRC/CTI/advisory; customer service desk.
**WP6 — Finance core:** legal entities/COA/periods, balanced GL, AR/revenue/deferred accounting, AP, treasury, tax and subledger reconciliation.
**WP7 — Procurement & OEM:** PR/RFQ/bid comparison/PO/receipt/AP, vendor and licenses.
**WP8 — HR/Assets:** employee lifecycle, certification, payroll-ready exports, equipment, license/stock, time planning.
**WP9 — Renewals/FlexGuard/Customer Success:** token financial linkages and concurrency; recurring billing; entitlements; renewal and churn.
**WP10 — BI/AI/Integrations:** semantic model, executive dashboards, AI policy controls, adapters with real integration tests.
**WP11 — Verification:** code quality/typecheck/build, isolated migrations, property/integration/e2e/security/performance/accessibility/device, genuine Access personas, cross-role transaction reconciliation, backup restore and rollback.
**WP12 — Release:** protected PR review, pinned SHA and artifact, signed release gates, deployment controlled by existing CI/CD, post-deploy smoke with approved accounts, monitoring and rollback readiness.

Complete in dependency order and prefer vertical end-to-end journeys rather than implementing menu stubs across all modules. Feature flags off by default for unaccepted new finance/cyber operations.

## 17. UAT AND INTEGRATED JOURNEYS
Preserve the existing 210-case UAT catalog without rewriting PASS statuses or evidence. Create **210 additional scenario definitions** for ERP-specific GL/period close (35), AP/procurement/treasury (35), VAPT/SOC/DFIR (45), HR/resource/assets (30), cross-domain lifecycle (30), security/recovery/nonfunctional (35), giving **420 total catalog targets, NOT 420 executions**. Each scenario must include unique ID, preconditions, role/persona, expected deny/allow, test data origin, UI and API steps, source commit/deployment/DB version, expected financial or document checksums, expected/actual, evidence URI/hash, owner and independent signoff. Run seven journeys:
J1 VAPT lead → quotation → PO → project → resources → findings/retest → BAST → invoice → payment → recognized revenue → GL/project profitability.
J2 SOC recurring → onboarding → SLA/cases → monthly report → recurring billing → renewal.
J3 OEM procurement → vendor compare → PO → receipt/license → supplier bill → AP posting → payment → customer fulfillment.
J4 FlexGuard → issue/topup/reserve/debit/release/refund/expire → reconciliation and billing.
J5 GRC/advisory → consulting hours/control evidence/reviews → BAST → collection/profit.
J6 Internal workforce/expense/AP/GL period close with maker-checker.
J7 Customer incident ticket → entitlement/SLA/escalation → evidence/case resolution → client closure and contracted billing.
Include anti-IDOR, no self-approval, duplicate submission, collision, retries, stale version, negative ledger, mismatched currency, changed original document, disabled user, failed AI, scanner unavailable and Cloudflare runtime failures.

## 18. PRODUCTION RELEASE GATE / DEFINITION OF DONE
No ERP function is production-ready merely because a page renders or CI passes. Require all applicable checks: (1) exact source SHA/workflow artifacts and build/typecheck passing; (2) verified DB D1 migrations/manifest, constraints, financial reconciliation; (3) native original data backup privately downloaded/hashed and independently restored, rollback tested; (4) encrypted original Vault files/hash/key continuity; (5) genuine signed Access identities and positive/negative cross-role SoD tests; (6) finance and procurement approvals and double-entry reconciliation; (7) authenticated original end-to-end journeys J1–J7 including genuine document acceptance and test data segregation; (8) P0 bug/security fixes, SAST/dependency scans, DAST as safely approved; (9) performance, availability, alarms, log retention and RPO/RTO evidence; (10) Android physical device + desktop accessibility; (11) independent Security, Finance, Service Delivery, HR/Procurement and Release-owner signoffs; (12) pinned production release, smoke, post-release monitoring and rollback plan. Gate state: PASS only with evidence, BLOCKED if missing, FAIL if actual tested defect. Never transform missing proof into PASS.

## 19. PER-FEATURE DEFINITION OF DONE
Each completed vertical slice must ship: (a) mapped requirement and ADR; (b) reuse/no-duplication record; (c) schema and migration dry-run; (d) implemented backend service/API and authorization; (e) functional UI all buttons including empty/error states; (f) correct transactional semantics; (g) audit and document lineage; (h) unit/integration/e2e/negative tests with actual output; (i) test evidence including role and data provenance; (j) observability; (k) secure rollback; (l) updated user manual and admin runbook; (m) approved PR and exact commit. Show missing items explicitly.

## 20. REQUIRED DELIVERY OUTPUT / EXECUTION REPORT
At each WP, respond in Indonesian with:
- Audited current HEAD, branch and specific source files reused;
- Completed functionality/routes/UI actions and new/editing D1 tables;
- Traceability matrix (business process → API → DB → UI → role → tests);
- Actual test commands and PASS/FAIL counts/log links (never invented);
- UAT scenarios executed/pending, real user Access evidence scope;
- Security/privacy/financial reconciliation and restore evidence;
- Blocking findings and exactly which external approval or credential is necessary;
- GitHub branch, commit SHA, PR URL, conflicts and CI; deployment status and Worker/D1 version if actually inspected;
- Next dependency-ready WP.

**Immediately execute WP0 with tools available, then move to the next non-blocked WP. Do not request repeated permissions already provided, but never bypass account-specific authorization, production release signoff or external human UAT. If a tool or credential is unavailable, record a blocker and complete the safe independent portions. No unattended background work promises. Never claim merge, production rollout or PASS until directly verified.**

## 21. OFFICIAL REFERENCE SOURCES FOR VERIFICATION
- NIST CSF 2.0: https://www.nist.gov/cyberframework
- OWASP ASVS (stable 5.0 at drafting): https://asvs.owasp.org/
- FIRST CVSS 4.0: https://www.first.org/cvss/v4.0/
- UU 27/2022 Pelindungan Data Pribadi: https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%20nomor%2027%20tahun%202022
- IAI PSAK renumbering: https://web.iaiglobal.or.id/Berita-IAI/detail/penomoran_psak_dan_isak_dalam_sak_indonesia ; PSAK 115 based on revenue from contracts with customers.
- Cloudflare docs: https://developers.cloudflare.com/
All applicable legal, reporting and technical controls must be rechecked for current versions and actual Technotama legal/tax setup before implementation.
