# RTICORE · RTI Branding Migration (2026-11-01)

**Official application branding:** RTICORE (formerly INDIA).

**Official company branding:** RTI — PT Riset Teknologi Indonesia (formerly Technotama / DefendIT360).

## Applied scope

- Application title and metadata, login entry point, account and navigation menus, dashboards, CRM, Sales, Presales, ERP, reports, administration and AI assistant visible copy.
- Quotation UI, Word exports, Post-PO forms, terms and business copy; generated export filename now begins with RTICORE_RTI.
- Supporting business logic defaults, test data labels and test assertions.
- New `npm run test:branding` validation invoked by `build:cf`.

## Deliberately preserved for backward compatibility

The current GitHub repository is still `elanghaqeem-hash/India`. Its identity is independent of the application display name. Renaming it requires coordinated GitHub, deployment and remote settings changes.

The existing Cloudflare Worker name `india`, D1 binding `INDIA_DB`, `INDIA_ACCESS_*` variables, release/environment variables, existing SQL names, stable API paths, CSS/DOM IDs, workflow filenames, GitHub workflow definitions and audit evidence filenames remain unchanged. Renaming them as ordinary strings would break external integrations and historical traceability.

Historical audit artifacts and source specifications may still reference previous names as dated evidence. They are not the current product/company branding.

## Release checks

1. Confirm `npm run test:branding`, `npm run typecheck` and existing Cloudflare CI tests pass.
2. Validate login, desktop and mobile navigation, quotation previews/Word export, post-PO forms and reports in an isolated environment.
3. Merge approved PR into `main`, observe deployment and verify the live frontend; do not claim production completion without observed deployment proof.
4. Review contractual/legal name, registered company identifiers, addresses, invoice letterheads and legal terms with RTI before issuing real documents. Text rebranding does not independently authorize legal templates.
