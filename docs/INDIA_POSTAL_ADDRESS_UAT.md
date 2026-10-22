# INDIA — Kode pos & cascading wilayah (UAT gate)

## Scope
- Shared headquarters address editor in \`/sales/leads\` conversion and \`/sales/pipeline\` Customer registration/edit.
- Postal search is served **from INDIA D1**, authorized by Cloudflare Access. No unverified client-side third-party APIs, no dummy rows.
- Region fields remain in the existing \`india_sales_accounts.data_json\`: \`hq_postal\`, \`hq_province\`, \`hq_province_code\`, \`hq_regency\`, \`hq_regency_code\`, \`hq_district\`, \`hq_district_code\`, \`hq_village\`, \`hq_village_code\`, \`hq_village_kind\`. Existing document generation keeps the original names.
- Postal 5 digits → candidate matches → province → regency/city → district → village/kelurahan. When the postal code changes, clear **all** previous region choices. Reset descendants when an ancestor changes. Server independently verifies postal/region on write.
- Never auto-guess a single village when a postal code has multiple matches.

## Data provenance
Pinned reference: \`mrayhanfadil/kodepos-id\` at commit \`33d362f827030606ab15a4f29a42c22c2eba3c7b\`, scraped 2026-08-21 from nomor.net and administrative code references (see upstream README). Source estimates 83,712 village rows across 38 provinces; not an official guarantee of current delivery validity. Verify discrepancies against PT Pos Indonesia/Kemendagri. No personal or CRM data sent upstream. Reassess source quality and redistribution permissions before production usage.

## Controlled rollout
1. Back up **UAT** D1 before altering schema; verify backup restore on an isolated database. Confirm migration numbering with other open PRs **before merging** (0022 is scoped to this base branch).
2. Run \`npx wrangler d1 execute india-staging-db --local --file=migrations/0022_indonesia_postal_reference.sql\` for local validation, then apply to isolated UAT D1 with the correct \`--remote\` target. Do not assume \`wrangler.jsonc\` is pointing at production.
3. Generate import parts: \`python3 scripts/import-indonesia-postal.py --out /tmp/india-postal-uat\` (requires network), or provide an independently downloaded pinned \`--csv\`. Review manifest and source/legal status.
4. **Only after confirming UAT binding & backup**, import parts one by one: \`for f in /tmp/india-postal-uat/*.sql; do npx wrangler d1 execute india-staging-db --remote --file="$f" || break; done\`. Abort on failures and reconcile before proceeding. Never run bulk import against production automatically.
5. Verify \`SELECT COUNT(*) AS rows, COUNT(DISTINCT postal_code) AS postals, COUNT(DISTINCT province_code) AS provinces FROM india_postal_areas;\` matches manifest (expect >80k rows, 38 provinces).
6. Real Cloudflare Access UAT for Admin/Sales A/Sales B/Marketing: 401 no session; 403 incorrect role; 422 malformed postal; valid matched postal displays multiple options; 5-digit not found leaves selection unavailable; 503 when unseeded; stale selected village on another postal rejected; cross-role Customer update forbidden; audit persists on account update.
7. Android and desktop: ensure inputs visible (no horizontal overflow), select can scroll, reset dependent dropdowns on postal/province/regency change, customer data never carries between Leads.
8. Run \`npm run typecheck\`, \`npm run test:marketing\`, \`npm run test:sales\`, and full CI; **no production deploy before gates pass**.

## Rollback
App rollback: redeploy previous verified commit. Reference table migration is additive; keep it for forensics. For staged data correction use a reviewed and backed-up data refresh, never a blanket deletion of customer records.
