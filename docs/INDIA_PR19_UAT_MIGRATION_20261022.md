# INDIA PR #19 — staged consolidation execution, 22 October 2026

## Outcome

PR #19 is the single consolidation candidate for PR #12 Sales and PR #18 Marketing. The isolated UAT D1 database now uses the canonical schema, migrations 0003–0011. The existing `india` Worker and its application-facing database were not changed. This evidence does not establish production readiness or a successful real Cloudflare Access login.

## Reused artifacts

- PR #19 branch `feat/india-marketing-sales-consolidation-20261022`, initial source `637931c5fdf47bd490df4d6575ff77029aad8e8f`.
- Existing canonical Marketing/Sales routes, responsive pages, Campaign master and PO/Finance/Legal gates from PR #12.
- PR #18 version-locked conversion, historical Lead events, exact schema fixtures and existing UAT records.
- Existing pre/post bridge SQL, migration 0011, preservation tests, HTTP/browser fixtures, 44 negative scenarios and real Access UAT guard/runbook.

## Backup and rollback evidence

The isolated UAT export was 34,123 bytes, SHA-256 `4617aae8c5ae185bf8d88809f59b7b2d686548f7562bd7bb36487903f4b7fe83`. Its restore passed locally and into a separate, unbound Cloudflare rehearsal database. No raw export, encrypted provider material, JWT, customer data or screenshots are committed here.

The exact bridge plan SHA-256 is `71452f157f6ab185d807fdd2c44d8e5b13f4ef0591f6547b65eb11bf63d1d91e`. It contains 80 statements, submitted as one D1 REST SQL batch. An initial DDL/DML probe and a late injected CHECK failure on the restored clone both rolled back completely. The late-failure check compared original table definitions, Leads, events, Customers, Opportunities, membership and migration versions. A subsequent successful rehearsal retained the complete original data and lineage.

Immediately before the actual UAT write, all eight snapshot query groups matched the verified export. The live `india` Worker was confirmed bound to a different database. No active INDIA Worker was bound to the UAT database. The UAT migration completed in one request, with assertions inside the same transaction.

## UAT preservation result

| Item | Before | After |
| --- | ---: | ---: |
| Leads | 2 | 2 |
| Converted Lead lineage | 2 embedded pairs | 2 canonical links, same IDs |
| Customer Accounts | 4 | 4 |
| Opportunities | 4 | 4 |
| Historical Lead events | 2 | 2 |
| Membership records | 7 | 7 |
| File provenance records | 0 | 11 |

Checks after migration: unlinked converted Leads **0**; orphan links **0**; duplicate normalized Customer names **0**; changed legacy Customer/Opportunity pairings **0**; foreign-key violations **0**; temporary migration tables **0**. Original Lead and event tables remain in immutable `*_phase18_archive` tables. Conversion timestamps now come from the historical CONVERT event, falling back to the original Lead update time, rather than the migration execution time.

Integer version 3 was missing from the old UAT ledger even though the Sales workflow tables already existed. The bridge verifies and preserves their data, then records the existing Sales provenance explicitly. Collided PR #18 integer versions 5/6 are also preserved in the file manifest; they are not treated as proof of canonical schema compatibility.

## Validation

- Consolidation suite: **25/25 PASS**, including schema preservation, rollback after rename and after data copy, corrupted lineage, unexpected columns, duplicate bridge rejection, production-target guard, actual route-handler ownership, audit-failure rollback and simultaneous conversion retry.
- Final combined local run: **196/196 PASS**, including browser subtests, with zero skips.
- Existing regression suites: Sales/Marketing/BoQ/Quotation/Post-PO/AI/security checks pass locally; the 44 negative scenarios are retained.
- Browser/HTTP fixture suite: **9/9 PASS**, six role interfaces on desktop/mobile plus unauthenticated access checks. Identity responses are test fixtures; this is not real Access authentication.
- TypeScript, Next.js 16.4.2 production build and OpenNext Cloudflare packaging: **PASS**.
- Both primary PR CI and Sales CI now run `npm run test:consolidation`; migrations are never run automatically by these workflows.

## Next stage and release gate

An isolated UAT Worker/hostname with the correct Access application and genuine distinct QA identities is still required for signed-JWT multirole HTTP/browser transactions. This session has not authenticated as Marketing, Sales A/B or Admin through Cloudflare Access. Do not substitute `.invalid` fixture addresses for real mailboxes, forge JWTs, disable Access or relabel fixture tests as live UAT.

Keep PR #19 Draft until this live authentication evidence is complete. PR #12 and PR #18 are source history and must not be merged alongside PR #19. Production merge, production database migration and Worker deployment remain pending the release gate.
