# INDIA Sprint 0 — Architecture Decision, Migration Map & Release Runbook

**Date:** 24 October 2026 WIB  
**Scope:** audit-and-reuse baseline; no production mutation.

## ADR-001 — Preserve canonical Sales Customer master and Opportunity ID

**Decision:** `india_sales_accounts` remains the only canonical customer master and `india_sales_opportunities` the only opportunity aggregate. Reuse `india_sales_lead_links` conversion and `india_customer_relations` group hierarchy; group membership is not an authorization grant. Keep `india_sales_releases` and BoQ revision snapshots as the approved commercial source. Reuse `india_delivery_projects`, `india_billing_invoices`, `india_billing_payments` and `india_service_contracts` introduced in 0027; do not create parallel masters.

**Why:** PRs #19/#20/#35/#36 are already integrated in `main`; duplicate data would damage ownership, reporting and audit.

## ADR-002 — Separate route allowlisting from actual authorization

**Decision:** `src/middleware.ts` is a fail-closed allowlist for availability, not the identity boundary. Explicitly permit the three protected enterprise handlers introduced by canonical 0026: `/api/partners`, `/api/reports`, `/api/admin/system`. Keep other legacy endpoints denied. Each permitted handler must continue to call `authorizeBoQ` and enforce roles/object ownership on the server. Add regression tests for permitted and denied paths.

**Why:** current middleware returned HTTP 503 before valid Access-protected business handlers were invoked.

**Consequences:** allowing an endpoint through middleware does not certify production schema readiness; handlers still fail closed on missing migrations, JWT or access policy.

## ADR-003 — Canonical migration ledger is not “max(version)”

| Canonical main version | Artifact | Dependencies |
|---|---|---|
| 0003–0012 | Core Sales / CRM / BoQ / proposal / award | Existing baseline; do not reapply blindly |
| 0013–0014 | Activity + Lead Intelligence | 0012 |
| 0015 | Encrypted original Document Vault | 0014; crypto key continuity |
| 0016–0020 | Tender/vendor, email, forecast, verified revenue and activity | 0015 |
| 0021 | `tender_bid_readiness.sql` | 0016; 0015 Vault |
| 0022 | `document_vault_governance.sql` | 0015; 0021 |
| 0023 | `tender_vault_integrity.sql` | 0021; 0022 |
| 0024 | `executive_sales_targets.sql` | 0020–0023 |
| 0025 | `vendor_resource_feasibility.sql` | 0021–0024 |
| 0026 | `partner_reporting_administration.sql` | 0025 |
| 0027 | `customer_delivery_cash_renewal.sql` | 0026 and Vault/PO integrity |

**Collisions to quarantine:** `0002` has two files on main (AI and BoQ historical evolution); branch #23 has noncanonical 0021 Vault; branches #26/#32 have noncanonical 0022 targets/postal; branch #27 has noncanonical 0024 feasibility; PR #39 has 0025 Mistral. `main`'s current 0021/0022/0025 are the authoritative canonical choices. Before importing any open-branch capability, rebase logically on `main`, compare objects/hashes and allocate fresh unique migration names where truly required. Never skip existing 0025 or rename an already-applied migration based solely on the highest ledger version.

**Consistency proof required:** exact applied versions, manifest paths, sqlite_master objects, file checksums, orphan checks, FK/quick_check, historical-data fingerprints, transaction log; include pre-/post-snapshot and rollback proof. A successful `PRAGMA quick_check` **alone** is not enough.

## ADR-004 — Ten group navigation reuses existing routes

1. Executive & Workspace → `/sales/executive`, `/sales/activities`, `/sales/forecast`
2. Marketing & Lead Intelligence → `/sales/campaigns`, `/sales/leads`, `/sales/lead-intelligence`
3. Customer 360 & CRM → `/customers`, `/sales/pipeline`, `/sales/communications`
4. Presales, Tender & Solution → `/scoping`, `/sales/feasibility`, `/sales/compliance`, `/sales/bid-readiness`
5. Commercial & Approval → `/boq`, `/pricing`, `/proposals`, `/sales/award`
6. Delivery & Service Operations → `/sales/delivery`
7. Contract-to-Cash & Renewal → `/sales/billing`, `/sales/revenue`, `/sales/renewals`
8. Vendor, OEM & Partners → `/partners`, `/sales/procurement`
9. Reporting, Analytics & AI → `/reports`, `/settings/ai` (AI registry remains Admin-only)
10. Document & Administration → `/sales/documents`, `/settings/system`

**Blocker:** current `AppShell`/Navbar uses a client-side, selectable *demo* role and artificial pending count, not a signed Access identity. Do not drive role-aware menus from that field. First add a read-only authenticated current-user endpoint reusing the existing auth service, then group the existing links and apply least-privilege client filtering as UX only. The backend remains the security authority.

## ADR-005 — Real release evidence, not repo merge

**Cloudflare read-only snapshot:** Production Worker `india` uses the separate production D1 with ledger max 0012. Shared `uat-india` uses a different D1 with max 0014. The full restored **isolated** clone now records versions 0003–0027 (25 ledger rows), has 0027 manifest registration, and passed quick_check + foreign_key_check when checked. This is **not** evidence of the migration executor identity, backup hash, key continuity, rollback, or signed UAT. No production schema mutation is authorized.

### Controlled release checklist
- [ ] Source/PR reviews, independent ownership and exact-head CI PASS
- [ ] Canonical SQL filenames + object ledger checksum reconciliation PASS
- [ ] Native pre-migration backup hash and independent restore verified
- [ ] Isolated failure-injection + rollback rehearsal proves unchanged data
- [ ] Clone 0027 integrity, migration provenance, encrypted original-document continuity PASS
- [ ] Dedicated combined UAT Worker deployed to isolated clone, secrets and Access audience verified
- [ ] Distinct real-person Admin, Sales A/B, Presales PM, Finance, Approver, Legal login and negative tests PASS
- [ ] Real original proposal/PO, Won, project, BAST, invoice, partial payment/reversal, GL and renewal lifecycle PASS
- [ ] Real provider transport/consent, service reports, OEM evidence and monitored Cron checks PASS
- [ ] Physical Android plus desktop, accessibility and performance UAT PASS
- [ ] Security owner, Finance owner, operational rollback owner and release approver sign-off
- [ ] Separate explicit production authorization after the above evidence

### Rollback strategy
1. **Before change:** record exact Worker version ID, D1 current bookmark, canonical manifest and full independent SQL backup + SHA-256; store encryption key continuity proof without recording key text.
2. **For UAT:** use unbound isolated clone. Do not bind production/shared UAT, and do not overwrite a clone that changed since the snapshot. Failure injection must not be rehearsed on a shared or production database.
3. **During release:** use controlled deploy/version pin; monitor 401/403/5xx, D1 errors, vault checksum failures, billing and cross-owner denies. Any discrepancy stops new writes.
4. **On failure:** roll back the Worker to a verified previous version. Schema rollbacks require separately reviewed, data-preserving reversal/restoration and validated write freeze; Worker rollback alone is not sufficient if schema/data changed.
5. **Verify:** Access and integrity checks, no missing records, no duplicate postings, journal and financial balance. Record incident/audit evidence and reopen gate.

## Backlog and dependencies
| Order | Small PR scope | Prerequisite | Completion evidence |
|---|---|---|---|
| P0-1 | Restore access to three existing secured enterprise handlers | Main at audited SHA | Middleware regression CI + review |
| P0-2 | Reconcile clone 0027 provenance/backup, verify encrypted Vault originals and rollback | Authenticated read-only UAT access | Native backup hash, forced rollback, full integrity |
| P0-3 | Isolated UAT Worker with genuine signed roles and financial/document transactions | P0-2 + approved users/secrets | Signed logins, negative tests, financial reconciliation |
| P1-1 | 10-group navigation + genuine identity-based UI context | Read-only Access identity endpoint | Responsive/physical Android and server permission tests |
| P1-2 | Preserve #34 Campaign UX and #37 Pricing Advisor without duplicated services | P0 baseline | Rebased minimal diffs, CI regression |
| P1-3 | Reconcile #39 Mistral provider and #32 postal import collision | Canonical migration reconciliation | Distinct migration, protected provider UAT |
| P2-1 | Expand service workflows and financial amendment lifecycle | P0 end-to-end verified | Source-linked approval and reversal tests |
| P2-2 | True external integration adapters and alerts | Security, provider contract, monitoring | Connection + actual transaction proof |

## Evidence grading
`PASS` only for performed read-only Cloudflare query checks and committed source changes; `NOT RUN` for this feature branch CI until completion; `BLOCKED` for real signed Access, physical Android and production release. Do not recycle earlier green PR status as verification of this branch head.
