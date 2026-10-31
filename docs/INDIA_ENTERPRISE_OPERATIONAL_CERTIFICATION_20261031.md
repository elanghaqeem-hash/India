# INDIA — Enterprise Operational Certification Assessment

**Assessment date:** 31 October 2026 (Asia/Jakarta)
**Company:** Technotama
**Scope:** All existing INDIA business groups, ERP/PSA extensions, signed Cloudflare Access, storage, security, recovery, integrations, and release.
**Production Git SHA reviewed:** `c6273948e641a41159a5479a770bc901765eaba4`
**Worker:** `india` / `dfdef248-5246-4310-b607-9c2956d11f75` (100% traffic verified via Cloudflare API)
**D1:** `8395dd84-1b7d-4eaf-9990-1d8e75a42cb5`, canonical migration max 0039.
**Certification verdict:** **NOT CERTIFIED — HOLD**. This is an independent-read-only technical assessment, not signoff by Technotama.

## Evidence verified from live connected services

| Assertion | Outcome | Evidence provenance |
|---|---|---|
| Source deployed and Worker version active | TECHNICAL PASS | Cloudflare Worker deployment `ab7bf6ab-9075-4ba1-9309-b776b77b6734`; build `1e68b853-bd88-4706-a998-9192b8dbeae8` completed success; pinned SHA |
| Source compilation and isolated functional simulation | TECHNICAL PASS | Build `npm run build:cf`, PR #97 isolated CI; tests do not constitute real authenticated business UAT |
| D1 canonical migrations 0001–0039 | TECHNICAL PASS | Live `MAX(version)=39`, `COUNT(*)=39` |
| D1 quick_check and foreign key | TECHNICAL PASS | `PRAGMA quick_check=ok`; foreign key violations=0 |
| Worker D1, Access, Vault/AI binding | CONFIGURATION PASS | `INDIA_DB`, `INDIA_ACCESS_AUD`, `INDIA_ACCESS_TEAM_DOMAIN`, `INDIA_AI_ENCRYPTION_KEY` and `INDIA_DOCUMENT_ENCRYPTION_KEY` present; secret VALUES not read |
| Real authorized role population | BLOCKED | Only **2 active Admin** members, **no** non-Admin on production; production Access policy is administrator-only |
| ERP legal org placement and finance/cyber grants | BLOCKED | `india_erp_org_units`, `india_erp_staff_org`, `india_erp_capability_grants` empty |
| Genuine Access JWT/OTP user acceptance | NOT RUN | No human signed transactions; do not count mocked signed identity in CI |
| Dedicated latest-schema UAT | BLOCKED | Shared UAT D1 version 0014; historical restored clone 0028, production 0039; no authorized dedicated current-schema candidate |
| Backup/restore independent assurance | BLOCKED | D1 Time Travel bookmark and an SQL export existed; no durable independent original backup SHA-256 and separately reconciled restore evidence is recorded |
| Physical mobile, accessibility, negative RBAC and business signoffs | NOT RUN | Must be performed by authorized actors on same pinned candidate |
| Full GL close/reversal, Treasury, complete HR, actual SIEM/EDR | INCOMPLETE | `0038`–`0039` define structures/guards, **not** complete operational service integrations or approved accounting processes |

## Module-level operational certificate matrix

Technical test coverage does not authorize an operational certificate. All categories below require a signed real-user scenario trace (including negative paths, audited original evidence, segregated maker/checker, and post-transaction reconciliation) on the SAME deployed commit.

| No. | Group | Technical/source validation | Real-user UAT and operational certificate |
|---|---|---|---|
| 01 | Executive & Workspace | Automated regression present | NOT CERTIFIED |
| 02 | Marketing & Lead Intelligence | Automated regression present | NOT CERTIFIED |
| 03 | Customer 360 & CRM | Automated regression present | NOT CERTIFIED |
| 04 | Presales, Tender & Solution | Automated regression present | NOT CERTIFIED |
| 05 | Pricing, Commercial & Approval | Automated regression present | NOT CERTIFIED |
| 06 | Project Delivery & PSA | Automated regression present | NOT CERTIFIED |
| 07 | Contract-to-Cash, Renewal & FlexGuard | Automated regression present | NOT CERTIFIED |
| 08 | Vendor, OEM & Partners | Automated regression present | NOT CERTIFIED |
| 09 | Reporting, Analytics & AI | Automated regression present | NOT CERTIFIED |
| 10 | Document Center & Governance | Automated regression present | NOT CERTIFIED |
| 11 | Administration | Automated regression present | NOT CERTIFIED |
| 12 | ERP GL/AP, Procurement & Cyber Operations | API/SQLite tests pass with synthetic identity; full finance/HR/SIEM workflows not delivered | NOT CERTIFIED |

## Required certification standard

1. **Completeness of test universe:** preserve historic `docs/INDIA_UAT_210_CATALOG.json` (210) and new `docs/INDIA_ERP_UAT_210_CATALOG.json` (210), total **420 distinct** release-scoped test cases. The 210 ERP cases are explicitly `NOT_RUN` in the source catalog. Catalog presence is not execution.
2. **Actual signed access:** independent real users for Admin, Marketing, Sales A/B, Presales/PM, Finance, Approver, Legal, Viewer, and enterprise roles Procurement, HR/Resource, SOC/VAPT/DFIR, with approved ERP grants/placement, signed JWT verification, cross-role deny tests and maker-checker SoD.
3. **Business E2E:** genuine lead → won → approved offer → PO → delivery and Vault → signed BAST → invoice → payment reconciliation; PSA time/cost; GL balanced journal/reversal/close; procurement requisition/receipts/AP; treasury disbursement; HR life cycle; SOC/VAPT/DFIR security evidence. Do not send real money or invoke real security response commands until separately authorized, instrumented and tested with external providers.
4. **Independent recovery:** original native SQL D1 backup protected offline, SHA-256 from actual bytes, restore to authorized isolated instance, before/after record counts, foreign keys, secrets continuity, rollback version and explicit RPO/RTO evidence; Time Travel bookmark is insufficient alone.
5. **Security:** production and UAT tenant isolation, IDOR/CSRF/XSS/session expiry, upload AV/original Vault encryption, customer PII, negative role and privilege revocation **effective** (currently modeled but not enforced on live access), rate limiting, SIEM event ingestion signed/idempotent, permission review.
6. **Operational observability:** user login, transaction audit, monitoring/log retention, incident response, alerting, DR and customer support SLA plus no P0/P1 unresolved defects.
7. **Human approval:** independently signed Security, Finance, Legal, HR, Procurement, Cyber Operations, Operations/Recovery and Release owner decision; approver cannot be sole maker of same transaction. Private signatures and original customer evidence must never be committed to GitHub.
8. **Cryptographically verified release receipt:** `scripts/india-release-evidence.mjs` must verify Ed25519 trusted release authority signature, exact source SHA, all mandatory gates, actual case evidence files/SHA-256, 210+210 signed real Access UAT, distinct identities, independent 8 function approvals and 0 high/critical open defects. No trust in an editable `PASS` flag without proof.

## Immediate blocker ownership

| Priority | Acceptance blocker | Accountable owner |
|---|---|---|
| P0 | Missing production non-Admin genuine identities and enterprise ERP approved grants | Technotama Admin / HR / Security |
| P0 | Dedicated Access-protected latest-schema test Worker/DB; 10 existing D1 databases occupied | Cloudflare owner / SRE |
| P0 | Native export SHA-256, independent original restore + fault-injection & rollback | DBA / SRE |
| P0 | 420 signed, real-role UAT cases with evidence per route; Android physical acceptance | QA/UAT Lead and 8 business owners |
| P0 | Effective grant revocation and role organization matrix; financial close/reversal, Treasury, HR and SIEM/EDR end-to-end | Engineering + business function owners |
| P0 | Release authority Ed25519 proof, independent named signoffs and verified zero P0/P1 | Security / Finance / Legal / HR / Procurement / Cyber / Operations / Release owner |

**Decision:** DO NOT issue an operational certificate, mark all modules PASS, fabricate actor signatures, or change production role policy/finance transactions merely to clear a gate. Current deployment may be *technically live* while this independent enterprise acceptance is **HOLD**.

**Release evidence reference:** [GitHub Issue #95](https://github.com/elanghaqeem-hash/India/issues/95). This report contains NO raw PII, credentials, JWTs or database dumps.
