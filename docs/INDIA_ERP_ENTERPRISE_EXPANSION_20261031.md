# INDIA Enterprise expansion WP2/WP5/WP6/WP7/WP8 — implementation gate

31 October 2026. Branch based on draft PR #93. **Source changes only, production HOLD.**

## New additive D1 structures
- 0038: Access change requests and organizational role matrix; GL period close and reversal requests; Treasury bank-tokenized payment instructions; purchase requisitions; HR employee profiles and leave; SIEM/EDR connector configuration and immutable deduplicated event receipts.
- 0039: SQL fail-closed controls for financial close with no unposted journal, reversal from posted original to open period, AP-approved payment and immutable payment transitions, active user/unit validation for access changes.
- External security connector secrets must reside in Cloudflare encrypted bindings, never D1 or GitHub. Connector metadata is **not a live integration**. No outbound SIEM/EDR ingestion is claimed.
- Treasury is **not enabled for bank transfers**. Bank API contract, mTLS, webhook verification, beneficiary validation, approval limits, fraud controls and reconciliation must be implemented and certified before enablement.
- HR currently represents identity-linked employee and leave foundations, **not complete HR/payroll**. Employee contracts, payroll tax/BPJS, attendance, compensation, recruitment, performance, statutory reporting and signed workflows remain to implement.
- Close and reversal requests are foundations; **do not mark as operational financial close** until API, reconciliation, reversal journal generation, role approval and repeatable tests are delivered.
- Access revocation is modeled as immutable maker/checker requests, but effective authorization enforcement on approved revocation and emergency revocation, hierarchy delegation and role matrix activation remain outstanding. Existing grant API remains in PR #93; no misleading WP2 COMPLETE.
- P2P requisition is foundation; budget reservations, tender, receiving, supplier payment, VAT/WHT and three-way cross-document reconciliation remain incomplete.

## Release blockers
Real Cloudflare Access human multi-role UAT, dedicated restored D1, source-to-deployment provenance, signed Finance/Legal/Security approvals, tested bank and SIEM/EDR sandboxes, independent rollback. Preserve existing production migration 0032 and no write to shared UAT. All UAT catalog cases remain NOT_RUN until independently evidenced.
