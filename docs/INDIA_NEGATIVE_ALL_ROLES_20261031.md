# INDIA — Negative-Path Cross-Role Enterprise UAT

Date: 31 October 2026 · Owner: QA/Engineering · Scope: isolated source/SQLite tests · Company: Technotama.

**Status: AUTOMATED GATE ADDED; CI must be checked on this PR. LIVE ROLE UAT NOT RUN; OPERATIONAL RELEASE HOLD.**
Do not mark the ERP UAT catalog passed from synthetic fixtures or GitHub Actions.

## 1. Coverage baseline

- Identity taxonomy currently deployed: 8 login roles — Admin, Marketing, Sales (two different owners A/B), Presales, Finance, Approver, Legal, Viewer. Job titles such as HR, Procurement, SOC/VAPT/DFIR Operator, CFO and COO must not be mislabeled as additional authenticated login roles until independently approved identities, scoped capabilities, and enforcement are implemented.
- Canonical UI: 12 groups, 37 unique menu routes in \`src/lib/enterprise-navigation.ts\`. New test asserts all 8 × 37 menu role membership/denials, unknown roles fail closed, and every href resolves to an existing app page.
- BoQ: all 8 × 7 action/role permissions evaluated, including HPP cost visibility, approval and membership management.
- ERP route-level negative tests: organization, GL, procurement/AP, and cyber operations; cross-origin POST 8 × 4; role deny before writes; malformed IDs, journal imbalance, fractional cents, invalid PO and cyber incident metadata; no business-table writes and SQLite integrity check.
- Existing regression suites: \`test:india-negative\`, \`test:erp\`, SQL enterprise contract, \`test:menu-approval\`, \`test:release-controls\`.

## 2. Negative vectors for each group (not all run by this isolated suite)

| ID | Group | Mandatory negative vectors for genuinely signed business UAT |
|---|---|---|
| 01 | Executive/Workspace | unauthorized KPIs, Sales A/B data leak, stale SLA and export |
| 02 | Marketing/Lead | invalid lead source, duplicate lead, campaign overreach, attribution tampering |
| 03 | CRM/Customer | cross-owner IDOR, unapproved edit/delete, duplicate customer, malicious payload |
| 04 | Presales/Tender | absent scope/attachments, bypass of bid-readiness and resource check |
| 05 | Pricing/Approval | unauthorized HPP, negative/NaN amount, low-margin override, maker-checker violation |
| 06 | Delivery/PSA | forged project assignment, double timesheet, unapproved hours, missing original BAST |
| 07 | Contract-to-Cash/FlexGuard | duplicate invoice/payment, unbalanced token ledger, forged renewal and reversal |
| 08 | Vendor/OEM | unvalidated supplier, over-receipt, 3-way mismatch, cross-entity purchase |
| 09 | Analytics/AI | prompt PII/NPWP leakage, denied provider, cross-owner export, quota |
| 10 | Vault/Governance | wrong tenant, tampered digest, malware, truncated file, unauthorized original access |
| 11 | Admin | non-admin user creation, API key exfiltration, stale role or privilege revocation |
| 12 | ERP GL/AP/Cyber | unbalanced GL, self approval, stale journal, AP mismatch, SIEM replay, unreviewed case |

## 3. Live UAT scenario constraints

For **each** of 37 pages and each of the 8 currently defined login roles, execute a real account's permitted and denied access, a permitted business transaction, at least one failed validation, and one independent checker/replay test where applicable. For each negative test record:

\`case_id, source_sha, deployed_worker_version, environment, actor_identity_hash, role, org_scope, timestamp, endpoint, request_class, HTTP_status, before_count, after_count, immutable_audit_event_id, screenshot_or_trace_sha256, result, independent_reviewer\`.

Expected behavior for denied writes: 401 (no valid JWT), 403 (role/grant/tenant), 409 (stale version, conflicting state or duplicate) or 422 (invalid payload); **zero unauthorized mutations**, no customer PII in logs, and traceable audit evidence. Confirm the status actually corresponds to the denial being tested, not an unrelated crash.

### Required additional negative combinations

1. Revoked/disabled account still holding old signed JWT; immediate effective permission revocation and emergency cut-off (known implementation blocker).
2. Staff without approved org placement or capability grant; deny GL/AP, procurement and cyber even with a valid login role.
3. Approver self-review and collusion across org, finance, PO, AP and cyber; version-replay and rejected-final-state mutation.
4. 2 concurrent journal submissions, duplicate source keys, imbalance, locked/closed period, reversal into invalid period, snapshot reconciliation.
5. PO exceeds validated offer, partial/over receipt, AP invoice without receipt, duplicate invoice, payment without approved AP; bank/payment transfer disabled until audited integration.
6. Expired SOC/VAPT evidence and wrong project, duplicate external event/outbox replay; forbid any real SIEM/EDR destructive request without scoped sandbox authorization.
7. Uploaded executable pretending to be PDF/DOCX, zip bomb, bad SHA-256, wrong tenant, lost cryptographic key and unauthorized document delete.
8. Session logout/expired JWT, CSRF, IDOR, XSS, injection, abuse/rate limits, accessible mobile view and recovery without data loss.

## 4. Required operational gates

**Still not performed by this PR:** human Cloudflare Access sign-in for every role (no active production non-admin role population per certification report), independently scoped latest-schema staging database and Worker, live API/browser traces, malware scanner integration, SIEM/EDR sandbox, financial close/reversal and Treasury operational completion, independent backup/restore, and named Security/Finance/Legal/HR/Procurement/Cyber/Recovery/Release signoffs.

This branch changes only tests/workflow/documentation. **Do not merge to production as operational PASS, change live role grants, seed real data, send funds, or run real cyber response actions.**
