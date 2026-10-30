# INDIA ERP Enterprise Extension — 30 October 2026

**Project:** Technotama INDIA · **Repository:** elanghaqeem-hash/India
**Development branch:** feat/india-erp-enterprise-close-treasury-p2p-hr-siem-20261030
**Upstream:** PR #93 (WP2/Finance/Procurement/Cyber) → PR #89 (PSA).
**Release:** NOT APPROVED. Cloudflare production D1 and Worker have not been migrated/deployed by this work.

## Architecture and implemented incremental workflows

| Package | Changes | New controls | Limitations |
| --- | --- | --- | --- |
| WP2 Role matrix | 0038, 0043; organization API | Historical eight login roles retained; approved employee scope + capability grants; audited independent request/review/revoke; versioned role-policy changes; CAS, immutable audit | Enterprise role taxonomy beyond existing eight Access login roles, position transfer/retention, effective-dated policy evaluation, privileged emergency access require further implementation |
| WP6 GL | 0039; ledger API | Posted original → exactly matching reversing draft → independent journal approval → posting; period close request/reviewer; pending journals and changed totals abort close; immutable closed periods | No complete AR/AP/treasury automatic subledger mappings, PSAK or tax engine, financial statement consolidation, year-end close, multi-currency |
| Treasury / AP Payment | 0039; treasury API | AP-approved payment instruction, masked bank account, maker/checker, independent bank-evidence recording, final verified settlement, AP outstanding view | NO bank transfer initiation. No real bank connector, bank statement import, payment rails, reconciliation tolerance, FX or statutory tax calculation |
| WP7 P2P | 0040; procurement API | Approved legal-entity budget → requisition → approved existing vendor offer → PO budget commitment → original receipt → AP 3-way match | Legacy PO creation without requisition remains for backward compatibility; mandatory policy migration, vendor invoice tax, returns, PO change-order, supplier portal and settlement approval matrix remain partial |
| WP8 HR | 0041; hr API | Existing member + independently approved staff org → employee activation/offboarding, role lock, leave policy/approvals, skills, asset register, custody/return/retirement | No payroll, salary/PII plaintext tables, statutory deductions, multi-location holiday calendar, employee self-service portal, recruiting/performance, HR document confidentiality workflow |
| WP5 Cyber connectors | 0042; security-integrations API | Cloudflare secret-based SIEM/EDR outbound HTTPS allowlist, independent activation, reviewed canonical case only, durable idempotency key, transactional claim/send/finalize, bounded retries, non-sensitive metadata payload | Generic webhook adapter, not vendor-native SIEM/EDR API integration. No real credentials/endpoint, ingestion verification, live detection content, SOAR bidirectional workflow or live response command execution |

## Access and segregation rules
1. Cloudflare Access signed JWT + existing `india_members` remains the only login identity.
2. ERP API checks role and existing identity; the independently approved staff unit, separately approved capability grant, role-capability matrix and legal-entity object mapping must also allow the transaction.
3. `Admin` does not receive GL posting/HR privileges without an explicit grant and matching operation role; approval users cannot approve records they created.
4. Changes to roles/grants are append-only history or controlled request→review status transitions; no implied bulk reactivation. HR offboarding deactivates the existing login membership and blocks effective ERP access.
5. VAT and withholding rates, payroll amount, salary, personal IDs and bank account full numbers are never invented or seeded. Treasury record uses masked account representation. All financial money values are integer IDR cents.

## Isolated test plan
Run `npm run test:erp`, `npm run test:erp:extensions`, `npm run test:psa-timesheets`, `npm run typecheck`, `npm run gate:automated`, `npm run build` on the same exact commit. Record independent GitHub checks and failing logs. New extension tests execute authorized route handlers through an actual in-memory SQLite D1-compatible transaction adapter with **synthetic identity stubs**. SIEM positive send uses **mocked** HTTPS receiver and synthetic egress secret; it is not external service acceptance.

## Real UAT prerequisites / release gates
- Dedicated isolated Cloudflare Worker + D1 account/resources, native original backup/export SHA-256, verified independent restore and rollback.
- Actual Cloudflare Access signed human sessions from distinct Finance, Approver, Procurement, HR, SOC/VAPT and Security; no test emails counted as real user acceptance.
- Reconcile representative source invoice, bank statement, AP/AR, posted GL, period close, budget and supplier changes with original Vault evidence and immutable log.
- Mandatory negative tests: cross-unit and cross-tenant IDOR, expired/grant-revoked users, SoD, repeated/replayed payment, duplicate vendor invoice, over-budget PO, unauthorized or redirected SIEM endpoint, retry exhaustion, isolated restore.
- Independent written Finance, Operations, Security, HR, Legal and Recovery approval; static and dynamic security scans, live Android browser acceptance.
- Real SIEM/EDR endpoint/credential secrets and vendor-specific contract/specification approval before enabling transport. External HTTP 2xx only demonstrates receiver acceptance, not end-to-end security event ingestion.

## Non-production rollout
Merge extension PR into **development PR #93 only** after all exact-head CI checks are successful. This branch is intentionally a draft until separate real UAT evidence and production gates are satisfied. No `wrangler d1 migrations apply --remote`, production Access user changes or Worker traffic changes from this work.
