# INDIA A–E: Customer → Delivery → Cash → Renewal

Candidate depends on `feat/india-modules-13-15-completion-20261022` at `0a30cde863895536fd92a18578c0e48b87a80b82`. Additive migration: `0027_customer_delivery_cash_renewal.sql`, after reconciled 0015/0022/0023 and 0024–0026. No production deployment or remote migration is performed by this change.

## Entry points

- `/customers`: canonical D1 customer account, accessible company hierarchy, stakeholder records, installed products linked to Won, Lead conversion lineage, Opportunity relationships, activity/email metadata, contracts and invoice collections. This replaces the browser demo Customer page; registration and core account edits reuse Sales CRM.
- `/sales/delivery`: immutable approved scope/account/PO/BoQ baseline; actual approved BoQ cost snapshot restricted to Finance/Admin. Draft creation is part of the Won database transaction. A single PM with active allocation in an approved Feasibility plan and active Presales/Admin membership is copied with project dates. Missing or ambiguous assignment remains unassigned until an authorized user selects a PM. Kickoff completion requires supporting originals. SOC reporting months are generated from the assigned project schedule, at most 60 calendar months.
- `/sales/billing`: signed BAST acceptance → draft invoice → independent approval → draft bank collection → independent approval; partial collections, exact reviewed reversals, outstanding and overdue. Cumulative net invoice amount cannot exceed accepted milestone or approved PO. Collections include VAT and cannot exceed approved invoice gross amount.
- `/sales/renewals`: OTC/MRC/managed service/license/retainer/FlexGuard contract configuration, independent approval, monthly recurring amount, renewal total and probability, dated expiry notice queue, churn assessment, and creation of same-customer renewal/expansion Opportunities at Prospecting. A contract permits one renewal and one expansion link. New Opportunities do not inherit old BoQ, PO, approvals or original-document decisions.

## Source and metric semantics

Customer primary key and customer number are reused through `india_sales_lead_links` → Opportunity → project → contract/invoice/payment; no second customer master is introduced. Unconverted Leads remain prospects until canonical conversion. Sales can only see their own Opportunities and accessible customer accounts; company/group relationships do not grant ownership of other deals. Supporting documents retain original encrypted bytes, existing role-checked download and audit controls. After Won, only supporting originals can be added; sales-package original types remain locked and Closed Lost stays locked. Finance may upload only supporting originals after Won.

Delivery is a draft workflow. Milestones only copy valid supplied payment-milestone data from the approved source; absent amounts, dates and unrecorded sign-offs are not fabricated. Missing terms must be completed as draft milestones. Source baseline is immutable. VAPT, SOC/MDR, GRC and Technology have distinct structured parameters and prerequisite checks. Task completion authenticates stored original bytes; an original is still subject to human substantive review.

Revenue is **not** recognized automatically from an invoice or bank collection. Existing independently approved revenue is linked to an approved invoice with matching invoice number and allocation limit. Profitability uses all-period approved net revenue minus approved net actual costs from the existing reporting register. It is provisional until Finance certifies complete cost closing. DSO = outstanding gross approved invoices / gross approved invoices issued in trailing 90 days × 90; it is null when the denominator is zero. MRR is an explicit approved monthly amount, not the full contract value divided by guessed duration. Renewal total and weighted value are separate from recognized revenue and existing sales pipeline reports.

Expiry notices are an in-app queue, calculated from actual approved contract dates. No email/WhatsApp delivery, Cron deployment, automatic recurring invoice issuance, external ERP posting, license activation or automatic FlexGuard token consumption is claimed. Contract snapshot amendments and correction/cancellation of approved invoices require a subsequent controlled workflow; current invoice rejection is available before approval, payments use reversals. Customer relation/history records are append-only in this release. Queue/roster results are bounded; a truncated result is not a whole-company total.

## Validation

- `npm run test:service-operations`: actual handlers + isolated SQLite, encrypted four-original lifecycle through Won, maker-checker, financial caps, partial payment/reversal, structured service parameters, source reuse, own-Sales isolation, audited rollback, migration rollback, old-Won handover, MRR/churn and invoice/revenue reconciliation.
- `npm run test:consolidation`: existing canonical Marketing–Sales conversion and isolation regressions.
- Existing `build:cf` suites include the new acceptance suite; Next.js and OpenNext Worker packaging must pass.
- `node tests/run-service-browser.cjs`: local production build; desktop Chromium and Pixel 7 emulation; actual route handlers and isolated D1-compatible SQLite with test identities. This is not live Access JWT or a physical Android test.

A pre-existing Lead Intelligence test used a UTC date for a Jakarta-date validation rule; its test clock now uses Jakarta date to avoid false failures between 00:00 and 06:59 WIB. No production nurturing rule is relaxed.

## Controlled release gates

1. Review stacked dependencies, source migration manifest, exact candidate commit and diff. The main production schema is older than this feature candidate; never apply 0027 alone to an unreconciled production database.
2. Back up remote isolated UAT D1 and restore to a separate UAT database, preserving Vault encryption key continuity and immutable originals/checksums. Apply the required migration sequence atomically, verify FK/quick_check and demonstrate rollback.
3. Test actual separate Access identities: Sales A/B, Presales/delivery PM, Finance maker, independent Approver, Legal and Admin; verify no cross-owner access, cost leakage or self-review. CI headers exist only in the fixture harness and cannot authenticate deployed application routes.
4. Verify complete workflow with real business documents: source proposal/receipt/decision/PO → automatic draft → PM/kickoff → service evidence → BAST → invoice → partial collection/reversal → GL and actual cost reconciliation → contract notice → renewal Opportunity. Run physical Android and desktop UAT.
5. Review storage capacity, retention, malware handling, operational monitoring, reconciliation and release approval before any migration or production rollout. This branch contains no deployment step.
