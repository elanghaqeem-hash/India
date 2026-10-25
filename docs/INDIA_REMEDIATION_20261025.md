# INDIA Technotama — controlled remediation candidate

Base: `c3a4725ebc3c4c1c6f34f4683b83194cc5e3d4de`. This candidate is not a production approval.

PR #52 and #53 are merged into the candidate, preserving the main implementation of PR #56–#60. The canonical `/pricing` compatibility redirect remains in place; PR #37 must not restore the retired demo pricing workspace. Viewer receives the existing non-cost BoQ read route; mutation and cost permissions remain server-enforced.

AI request bodies now use the existing bounded streaming JSON reader. A single D1 `INSERT ... SELECT ... RETURNING` reserves the per-user outbound budget before a provider call, including failed calls. The existing audit schema stores request reservations without prompt, response or key material. No provider credential or production secret is copied.

User-facing branding and newly generated documents use Technotama. Tenant IDs, customer records, source migration history, internal field identifiers and archived customer documents retain their identity. Unverified contact details use explicit placeholders. The old approved user-uploaded Post-PO template remains historical: Legal must supply/approve the Technotama original and privacy terms before official issuance.

## Evidence and release authority

The production preflight still requires all existing D1, Access, encryption, backup and sign-off prerequisites. It additionally verifies an Ed25519 signed release receipt and the SHA-256 of every referenced evidence file. A bare `PASS` environment variable cannot authorize release.

Configure the independently approved public key as `INDIA_RELEASE_AUTHORITY_PUBLIC_KEY` in the protected `production` GitHub environment. Keep the signing private key with the authorized release authority; it is never generated or stored by the application. This code does not establish who the authorized authority is.

The manual workflow accepts `evidence_run_id` and downloads the fixed `india-production-release-evidence` artifact from that run. The artifact root contains `receipt.json` and relative evidence files. The envelope is `{payload, signature}`; the base64 signature covers the UTF-8 bytes of `JSON.stringify(payload)`. See `scripts/india-release-evidence.mjs` for the schema. Required payload fields include exact release SHA, production Worker/database, issuance/expiry (maximum 24 hours), all 19 gates, all 210 case IDs from `INDIA_UAT_210_CATALOG.json`, nine distinct verified Access identities across eight roles, Security/Finance/Operations/Release sign-offs, and zero open High/Critical defects. All mandatory cases require actual results and hashed evidence. The authority must verify original sessions and approvals before signing.

Before deployment, 18 prerequisite gates must PASS; deployment verification is evaluated after rollout, avoiding a circular requirement. No production rollout occurred in this remediation session.

## Reproducible local recovery rehearsal

Use `scripts/india-d1-release-rehearsal.py` with an original native export, its independently pinned SHA-256, the actual baseline, and a new output path. The script restores two separate SQLite databases, compares original data fingerprints, applies source migrations through 0030, injects a failure and checks rollback, then validates successful migration and preservation of the original column values. Only the exact expected disabled Mistral addition is allowed as a planned provider change. Local recovery is never reported as Cloudflare remote recovery.

## Toolchain security changes

Playwright is pinned to patched compatible 1.55.1. Narrow overrides update the vulnerable nested glob CLI to 10.5.0 and Miniflare's Undici to 7.30.1. The selector parser is pinned to 7.1.6; production Next.js/OpenNext builds and browser checks validate Tailwind compatibility. No automatic major framework migration or forced dependency downgrade is used.

## Remaining release prerequisites

Production D1 remains at 0012, shared UAT at 0014 and the unbound recovery clone at 0028. Canonical source extends through 0030. Seven INDIA databases have been inspected read-only; capacity is 10/10 account-wide. Native exports and local restore/rollback proof do not replace an independently verified Cloudflare recovery rehearsal. Do not restore an old bookmark onto changed data.

Deployment credentials are missing from GitHub Actions. Production/shared UAT lack the Document Vault encryption binding. The actual Access roster does not yet cover Marketing, Legal and Viewer. Real nine-identity UAT, AI credentials/testing, four complete business journeys, physical Android checks and authorized sign-offs remain mandatory. No NOT RUN or BLOCKED case is counted as PASS.
