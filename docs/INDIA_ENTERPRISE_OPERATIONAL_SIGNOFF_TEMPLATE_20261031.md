# INDIA Enterprise Operational Acceptance — Signoff Form (UNSIGNED TEMPLATE)

**This is not a certificate and confers no authorization.** Keep signed/filled copies only in restricted evidence storage; do not commit names, emails, JWT, source document data, signatures or secret IDs to this public repository.

## Release metadata (must be provided by authorized SRE)
- Environment: `production` or dedicated Access-protected `uat-india-*`
- Source SHA (40 hex): **TBD**
- Worker script and version: **TBD**
- D1 name/UUID and schema: **TBD**
- Original native SQL export SHA-256 and private immutable archive reference: **TBD**
- Independently restored D1 UUID and integrity/reconciliation report: **TBD**
- Previous Worker version, rollback execution and observed RTO/RPO: **TBD**
- Tested real Access issuer/audience and private actor identity roster reference: **TBD**

## Module-specific acceptance record (repeat for all 12 groups)

| Evidence component | Required | Status |
|---|---|---|
| Module and accountable process owner | Named approved actor with role and approval limit | NOT VERIFIED |
| Applicable UAT case IDs | All cases from the legacy and ERP catalogs associated with the module | NOT VERIFIED |
| Source SHA, Worker version, D1 schema | Exact release candidate; reproducible trace | NOT VERIFIED |
| Real signed session and role | Cloudflare Access JWT verified server-side; no impersonation | NOT VERIFIED |
| Positive and negative test cases | Actual business data, role-denied paths, repeat/idempotency | NOT VERIFIED |
| Independent maker/checker | Distinct authenticated actor subjects; effective SoD | NOT VERIFIED |
| Immutable audit and original Vault | Original document SHA-256, review, retention/legal hold | NOT VERIFIED |
| Database reconciliation | Before/after canonical row or ledger amount counts | NOT VERIFIED |
| Defects and exception review | Open P0/P1 must be 0, P2 formally accepted | NOT VERIFIED |
| Mobile/accessibility where relevant | Physical Android plus desktop observed | NOT VERIFIED |
| Monitoring, recovery, SLA | Event traces, alerting, backup, signed restore | NOT VERIFIED |

## Function owner approvals (signed separately)

| Function | Accountable decision | Recorded evidence reference |
|---|---|---|
| Security / DPO | TBD — not approved | TBD |
| Finance / Controller | TBD — not approved | TBD |
| Operations / SRE / Recovery | TBD — not approved | TBD |
| Release Authority | TBD — not approved | TBD |
| Legal / Compliance | TBD — not approved | TBD |
| HR | TBD — not approved | TBD |
| Procurement | TBD — not approved | TBD |
| Cybersecurity Operations | TBD — not approved | TBD |

## Decision

- **NOT CERTIFIED / HOLD** until all 420 distinct legacy and ERP UAT scenarios have immutable release-bound evidence, all mandatory functions have independently signed approval, zero unresolved high/critical defects, and the release authority-signed receipt passes `verifyReleaseEvidence`.
- Do not enter `PASS` or `APPROVED` here without primary evidence.
- Controller of the Ed25519 release signing private key must be independent of the development actor. Only the trusted corresponding public key belongs in the CI production environment.
- Financial settlement, live endpoint scanning and SIEM/EDR response actions require explicit external production access approvals, not only signed schema checks.
