# INDIA Enterprise ERP integration — execution evidence and release gate

**Date**: 2026-10-30 WIB. **Company**: Technotama. **Environment**: source branch and isolated GitHub Actions SQLite/D1-compatible harness. **Baseline**: PSA draft PR #89, original main `045298e9`. **Release status**: HOLD, NOT production certified.

## Artifact reuse and source-of-truth
- Existing `india_members`/Cloudflare Access signed JWT remain login identity; eight legacy roles preserved. New capability grants `india_erp_capability_grants` require separate Approver review; Admin has no implicit financial/cyber approval bypass.
- Canonical `india_sales_opportunities`, `india_delivery_projects`, `india_vendors`, `india_vendor_offers`, `india_document_library`, `india_operations_events`, `india_resource_allocations`, and PR #89 timesheets reused.
- D1 additive migrations: 0034 organizational/legal-entity scopes and capability grants; 0035 manual balanced GL; 0036 supplier PO/receipt/AP three-way match; 0037 VAPT/SOC/DFIR case metadata. No historical rows seeded, no legacy tables rewritten.
- APIs: `/api/erp/organization`, `/api/erp/ledger`, `/api/erp/procurement`, `/api/erp/cyber-operations`. Role-aware workbenches under `/erp/*`; SQL triggers provide second-line immutability controls. SQL D1 batch plus existing `india_sales_tx_guards` enforces failure rollback with audited operations.

## Verified technical tests — NOT genuine human UAT
On PR #93 integration CI, Node 24 with project dependencies:
- `tests/india-erp-foundation.test.cjs`: 5 isolated API/SQL tests covering no-seed migration, independently approved grant, balanced GL journal with immutable posting, vendor offer→PO→receipt→AP match, Vault-backed VAPT finding QA. These tests use synthetic signed-identity stubs in the existing harness; **not real Access JWT**.
- `tests/psa-timesheets.test.cjs`: 5 isolated PSA tests, including immutable certified time and 15/30/240/480-minute prorated cost.
- TypeScript and existing navigation/regression/functional gate verified by GitHub CI on exact commit only when GitHub reports success. Do not promote historical results to a changed head or claim live Access UAT.

## Read-only Cloudflare findings
- Production Worker `india` deployment version `642bc76f-d6ca-4cbb-9324-0564373140d7` is 100% traffic; D1 migration 0032, two active Admin accounts and zero operational non-Admin identities in production (read-only check).
- Available D1 databases total 10/10; production 0032, `india-uat-users-db` 0014 and isolated historic restore 0028. The old UAT databases are **not** upgraded/overwritten as a shortcut. Cloudflare Access includes shared `uat-india` but genuine signed multi-role sessions on a dedicated ERP candidate remain untested.
- No production migration, deployment, synthetic business transaction or change to live Access policy was performed in this integration.

## Blocker register / scope exclusions (remain blocked)
1. **Real Access UAT**: authorize true named users with actual signed sessions, at least Sales, Presales, Finance, Approver, Legal, HR, Procurement, SOC/VAPT and QA where applicable. Existing production roster lacks those roles; training or dummy users are not UAT acceptance.
2. **Dedicated D1 environment**: independent native backup/export SHA-256 and restore on safely isolated database; D1 free allocation currently 10/10. Obtain approved isolated resource/recovery plan without deleting old UAT or production.
3. **Complete WP2**: existing eight role taxonomy is retained; enterprise position/subrole mapping, historical effective-dated policy, HR assignment, approver matrix by threshold and customer object ABAC require further controlled work.
4. **Complete WP5/6/7**: current VAPT/SOC/DFIR are evidence-backed case coordination only, not full scanner/SIEM/EDR engine; GL supports manual balanced posting but not closing/reversal/automatic subledger reconciliation; AP has three-way match but no actual payment, tax policy, Treasury or payroll; Procurement pre-existing tender/vendor offer reuse but requisition and budget checks remain absent.
5. **Operational UAT**: all added 210 ERP scenarios in `docs/INDIA_ERP_UAT_210_CATALOG.json` are `NOT_RUN`; original 210 untouched. Only source/isolated automated paths executed.
6. **Release**: original Vault restore/integrity and encryption keys; genuine customer signoff/BAST; actual finance policy for PSAK 115 and Indonesia taxes; Android visual UAT; signed Finance/Security/Legal/Recovery approvals; source-to-Worker provenance, monitoring and verified rollback are still required.

## Human UAT execution protocol — only when isolated candidate and real roles are available
- Pin branch and source SHA, validate dedicated Worker Access bindings to isolated D1 and approved identity matrix. Record signer emails privately (never commit PII or JWT).
- Run real authenticated positive/negative role transitions for WP2 grants and project scope; PSA timesheet submit/review and forbidden self-review; balanced/unbalanced GL approval/post; vendor source/PO/receipt/invoice negative three-way; VAPT findings QA/closure, and cross-unit/tenant denied endpoints.
- Record each as `environment,worker_version,source_sha,actor,role,UTC_execution_time,case_id,result,request_trace,independent_db_query,Vault_document_sha,approver_signoff`. Preserve proof privately. Distinguish real UAT from synthetic CI.
- Reconcile read-only source totals and evidence after transactions; archive independent backup and restore fingerprint. Refuse any unapproved production mutation.

## Decision
PR #93 may be integrated into **non-production development** only after exact-head automated gates pass. Production remains BLOCKED until independent original recovery, actual Access/UAT sessions and ERP Finance/Security approval are complete. No PASS status is inferred from source presence.
