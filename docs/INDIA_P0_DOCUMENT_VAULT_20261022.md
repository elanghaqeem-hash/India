# INDIA P0 — Stored originals and release gates

Date: 22 October 2026 (WIB).

PRs #19 and #20 are already merged into main. Migration 0012 is present in both production and isolated UAT, with clean foreign-key and integrity checks. This candidate continues from those artifacts; it does not replay their migrations or merge the old PRs again.

## Result

Original proposal files, submission receipts, customer negotiation decisions, and PO/SPK originals can be uploaded from their existing workspaces. The server calculates SHA-256, encrypts file bytes with AES-256-GCM, and commits the manifest, encrypted chunks and audit in one guarded D1 transaction. The immutable original belongs to one tenant, Opportunity, offer release and document purpose. No public file URL is created.

Downloads require the normal Cloudflare Access identity and D1 role/ownership check. They authenticate the ciphertext, compare the original checksum and commit a download audit before returning an attachment with private no-store headers. Sales B cannot access Sales A documents. Finance, Legal and Approver cannot upload original evidence as its maker. Presales can upload proposals.

Proposal, submission, negotiation and PO handlers validate the stored original. Database triggers also enforce matching evidence; the Won transition requires all four original types for the current release. Existing maker–checker checks remain in force. Material revisions retain earlier files and approvals as history and require a new offer package.

The submission timestamp input now uses local time with second precision, preserving correct ordering after proposal approval.

Supported originals: PDF, DOCX, PNG, JPEG and EML, maximum 8 MiB. Extension and file signature/OOXML structure are checked. No claim of malware scanning is made.

## Storage and migration

R2 is not enabled on the connected account. This candidate therefore uses encrypted D1 chunks of at most 256 KiB before base64 encoding. The independent Worker secret `INDIA_DOCUMENT_ENCRYPTION_KEY` must be 32 cryptographically random bytes encoded as base64. It is separate from the AI credential key. Provision and retain it through the private Cloudflare secret channel; never commit a value or replace an existing key during a code rollout.

Migration `0015_secure_document_vault.sql` depends on schema 0012 and is independent of reserved activity migration 0013 and Lead intelligence migration 0014. It records version 15 without treating absent 13/14 as an error. Existing open offer versions are superseded with a revalidation audit; original rows and closed history are preserved. PO-check invalidation is retained in the immutable history introduced by 0012. No automatic migration is added to CI.

## Evidence

- 231 local non-browser checks passed, with zero failures or skips. This includes 17 new vault tests and the updated 26 actual-handler transaction tests.
- The transaction fixture uploads actual synthetic original bytes and uses the server-returned reference and digest. It no longer substitutes arbitrary archive strings for evidence.
- Tests include the full Won cycle, eight-MiB round trip, encryption/key failure, checksum/ciphertext corruption, immutable originals, cross-owner/role denial, unsafe file names, disguised files, stale releases, upload/download audit failures and complete migration rollback.
- Ten browser/HTTP checks passed against the built application, including mobile/desktop upload through actual route handlers with test-only identities. The browser cycle uploads all four originals, reviews submission and PO through Finance/Legal pages, downloads the original PO and reaches Won.
- TypeScript and Next.js production build passed. OpenNext Cloudflare packaging passed after using an independent dependency tree.
- A separate unbound Cloudflare rehearsal database was restored from the verified schema-0012 UAT artifact. All 40 restored tables matched exactly. A deliberate failure after the final migration-0015 statement rolled back every schema/data change. The successful migration preserved all 39 existing data tables, extending only the migration ledger; foreign keys were clean and quick_check returned ok.
- Twenty-three SQL transactions recorded from the actual handlers were replayed against that remote D1 clone with synthetic test identities. The result was Closed Won, four encrypted original documents, 20 transaction audits, independent Finance/Legal reviews, clean foreign keys and no leftover transaction guards. This is a remote transaction rehearsal, not a live HTTP identity test.

## Operational gate

Genuine Cloudflare Access multirole HTTP/browser UAT remains blocked: the current allow policy has one real administrator; Sales A, Sales B, Presales, Finance, Approver and Viewer remain fixture addresses, and Legal membership is absent. Eight distinct human identities are needed for the seven roles because Sales isolation requires two users. The existing private UAT runner and artifacts can be reused once those identities and secure sessions are available. Do not promote fixture identity results to human authentication evidence.

The new vault candidate must remain a staged release until its database migration, independent encryption secret, browser evidence and genuine Access acceptance are complete. Production is not changed by this candidate's tests. Review the exact new source and migration before promotion; retain the migrated schema and originals when rolling code back.
