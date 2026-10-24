# PR #32 postal integration — canonical source reuse, 24 October 2026 WIB

The open PR #32 contains usable reference lookup, 5-digit picker, hierarchical region selection, D1 validation, pinned importer and negative UAT regression. Its migration 0022 **collides** with canonical main migration 0022 Document Vault Governance. This port is additive migration 0029 after canonical 0028, not a blind merge of the old PR.

Read-only Cloudflare baseline: isolated UAT and shared UAT each have 83,712 national village rows; production has 10,668 compact post-code lookup rows, all with a ready import-state record. These contents existed before this branch. New source code alone does not imply deployment; never copy data or mark status ready without a verified full importer.

Use real Access JWT (not fixture) to verify Sales/Marketing writes and Viewer deny, physical Android/desktop, schema migration ledger, provenance/source licensing and correct PBD internal source key. Production remains HOLD pending independent backup, restore, rollout and signoff.
