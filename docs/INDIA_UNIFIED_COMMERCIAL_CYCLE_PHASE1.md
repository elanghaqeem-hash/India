# INDIA — Unified Commercial Cycle / Phase 1

Status: IMPLEMENTATION CONTRACT, not deployed. Baseline: current main. Sales PR #12 is draft and conflicts with main; do not merge blindly.

## Single commercial transaction
Lead -> Qualified Lead -> Account -> Opportunity -> Bid/No Bid -> NDA & RKS/KAK -> Scoping -> Vendor/Capacity -> Approved BoQ -> Technical Proposal/SOW -> Approved Quotation -> Submitted -> Negotiation -> Award/PO -> Finance/Legal verification -> Closed Won -> Post-PO handover.

### Non-negotiable keys
lead_id (immutable) -> account_id + opportunity_id -> tender_id (optional) -> scope_revision_id -> boq_id + approved_version -> proposal_revision_id -> quotation_revision_id -> award_id -> po_verification_id -> handover_id. No data copied across stages without referential keys.

### Roles
Marketing: lead/campaign creation; Sales: qualify, convert, own deal, negotiate; Presales: scope, technical proposal; Delivery: capacity review; Finance: HPP, payment, PO reconciliation; Approver: approve commercial terms and exceptions (not own work); Legal: NDA, contract review; Viewer: read-only with field redaction; Admin: membership, not automatic override of SoD.

### P0 acceptance gates
1. All mutation endpoints require signed Access JWT, tenant + owner scoped D1 queries, RBAC and CSRF origin check. No demo store in production transactions.
2. Unique normalized lead and customer identity, idempotent conversion; no phantom default company; transactionally append audit events.
3. Scoping revisions, vendor quote validity, capacity, and BoQ approval linked to same opportunity; pricing snapshots immutable after approval.
4. Submission evidence includes immutable quotation version and recipient, channel, time and attachment checksum.
5. Negotiation amendments invalidate prior approval if price, scope, SLA, discount or payment terms change.
6. Won requires valid approved commercial version, PO/award evidence, reconciled subtotal, Legal/Finance clearance, no self-approval, no outstanding material scope mismatch.
7. Handover is separate from Won and requires verified source documents; PII encrypted and access restricted.
8. E2E tests for seven roles, duplicate lead, forbidden cross-owner access, stale versions, concurrent updates, invalid PO, expired quotation, rejection/revision, won/lost, rollback.
9. Migrate 0003 and 0004 only after backup and compatibility test; release via preview/staging, then controlled production deployment with rollback plan.

## Rollout
Phase 1: integration contract and safe schema on separate branch (this phase).
Phase 2: lead/campaign + conversion D1 API and UI.
Phase 3: opportunity-linked tender/RKS, scoping and feasibility.
Phase 4: proposal, pricing and approval snapshot.
Phase 5: submission, negotiation, award/PO and Closed Won evidence.
Phase 6: browser multirole UAT, production migration and controlled release.

## Definition of done
No mock customer values, no inaccessible menus masquerading as live, no stage bypass, all critical actions audited, UAT with real Cloudflare Access identities, DOCX/XLSX generated from same approved version, release verified against Worker binding.