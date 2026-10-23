# INDIA — Vendor, Resource & Solution Feasibility (22 October 2026)

## Status / branch lineage
- Branch: `feat/india-vendor-resource-feasibility-20261022`
- Parent: PR #25 (Tender Readiness), which itself builds on PR #24 (vendor and independent clause compliance).
- D1 migration: `0024_vendor_resource_feasibility.sql`; additive, with no fabricated resources or offers, and without auto-approval of existing deals.
- Release integration: migration 0022 is already allocated to Vault governance (PR #28) and 0023 to Tender–Vault integrity; feasibility is reserved at 0024 to prevent number collision.
- Production: **NOT DEPLOYED**. Do not merge this branch straight to main while PR #24/#25 are unmerged.

## New workflow
Opportunity → scoping → Feasibility Plan → resource roster → monthly allocation → Finance costing → supplier quote validation → independent feasibility review → solution/BoQ/quotation.

1. **Presales / Admin** establishes service line, delivery dates, quantity/complexity factors, 24x7 staffing (SOC), PM/QA effort and target margin.
2. **Finance / Admin** registers engineer effective PD/month and confidential internal HPP per PD. Profiles are tenant-scoped.
3. **Presales / Admin** allocates person-days by calendar month; global capacity check includes active reservations on all Opportunities.
4. **Finance / Admin** enters cost lines (license, subscription, supplier services, cloud, tooling, travel, miscellaneous). Optional supplier quotation must refer to a *validated* `india_vendor_offers` record on that Opportunity. Current price, unit, quantity/capacity and validity must match.
5. **Finance / Approver / Admin**, different from the plan maker **and from cost/allocation creators**, approves/rejects with an audit note.
6. Any changed opportunity detail, resource reservation, or cost line resets approval. SQL stage transitions and quotation DOCX export fail closed when an enrolled feasibility plan is no longer valid.
7. Sales and Presales cannot read engineer unit costs, cost unit prices, total HPP, or numeric gross margin through this API. Finance/Admin/Approver may review confidential values.

## Calculation
- VAPT: `assets x PD-per-asset x (1 + retest percentage / 100) + PM/QA PD`.
- SOC/MDR and Managed Security: `(coverage hours per day / 8) x staff per shift x coverage days per month x contract months + coordination PD`.
- FortiSIEM / GRC: `baseline PD + coordination PD`.
- Calculated PD rounded **up to 0.01 PD**.
- Internal HPP: sum of active allocations `PD x locked daily cost at allocation`.
- External HPP: sum of `quantity x periods x unit cost`.
- Indicative gross margin: `(Opportunity estimated_value_idr - total HPP) / estimated_value_idr x 100`. Reconcile against approved BoQ and tax before contractual quotation.
- Internal calendars are *monthly*, not day-by-day or individual work-shift rostering. A 24x7 on-call schedule still requires workforce rostering by delivery management.

## Explicit security constraints
- Cloudflare Access JWT verification using `authorizeBoQ`; real D1, no in-memory demo fallback.
- Tenant + Sales-owner authorization on every Opportunity operation; other roles limited by operation.
- Request size limit, origin check and optimistic Deal/Plan concurrency guard.
- SQL capacity constraints, unique active reservation per staff/month/Opportunity, FKs and immutable row-history. Cancelling a reservation does not erase its history; released capacity can be reallocated.
- Supplier quote expiration and validation are rechecked on every SQL stage advancement.
- The vendor register stores evidence references and SHA-256, **not original file bytes**. Connect to the secure Document Vault workstream before treating an offer as original-document verified.

## Release / UAT checklist (operator-executed; no production writes before approval)
- [ ] Review/merge dependent PR #24, then #25 according to their own green release gates.
- [ ] Take a **production-independent D1 UAT** backup/export; prove restoration into isolated database.
- [ ] Apply migration 0024 only after 0016 through 0023 on the isolated D1, including Vault governance 0022 and Tender–Vault integrity 0023 from PR #28. Check schema manifest, migration version, `PRAGMA foreign_key_check` and `PRAGMA quick_check`; verify no existing data altered or deleted.
- [ ] Execute engineer VAPT 2-app sizing, SOC 24x7 staffing, FortiSIEM license SKU and GRC consulting plan; independently verify expense, expiry and gross margin against BoQ.
- [ ] Test simultaneous Sales A/Sales B, Presales, Finance, Approver and Admin through **real signed Cloudflare Access JWT**, including inability for Sales B to view Sales A Opportunities and confidential HPP redaction.
- [ ] Reject overlapping reservations, negative/NaN amounts, stale prices, expired vendor quotes, same-maker approval and changed scope after approval.
- [ ] Verify SQL stage/quotation release gate, prior release control behaviour and approved proposal/BoQ immutability.
- [ ] Complete linked PR #23 original-file Vault verification and file retention/access audit before supplier-proof sign-off.
- [ ] Require CI typecheck, Next.js/Cloudflare bundle, migration/negative regression and reviewer sign-off.
- [ ] Only after successful isolated UAT and change management, schedule a controlled production migration/deployment and rollback plan.

## Limitations / phase 2
- Enrollment is **non-retroactive**: deals without a feasibility plan retain prior release gates; this avoids locking legacy transactions until phased rollout is approved. Require enrollment for newly initiated Opportunities in the production rollout policy.
- Resource costs are locked at allocation time but are not a payroll/pay-rate system; resource profile changes need controlled offboarding/new rate cards.
- Reservation is per month; day/shift leave management and supplier concurrency across multiple client bids require separate scheduling enhancements.
- Financial assessment uses Opportunity estimated revenue until formal Finance/BoQ reconciliation and does not implement automated IDR/foreign-currency FX conversion.
