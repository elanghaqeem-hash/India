# INDIA Admin Registration Center — implementation and release note

Routes (role Admin + verified Cloudflare Access + active D1 membership required for write):
- /settings/admin — central Admin menu with server-verified access
- /boq/users — existing user enrollment, role, unit and active status; protects last active Admin
- /settings/system — existing versioned parameters, independent approval and audit
- /settings/options — new D1 option registry with optimistic versioning and soft disable
- /settings/ai — existing AES-GCM AI API key vault with rotate/test/delete, never returns key

Backend:
- GET/POST /api/admin/options is Admin-only and audits changes in an atomic D1 batch
- GET /api/reference/options?group=... permits only authenticated INDIA users to read *active* options. Existing form dropdowns are not automatically rewired in this PR; future integrations should explicitly adopt this source.
- Existing /api/boq/members, /api/admin/system, and /api/ai/config continue to enforce Admin role.
- No new API secret persistence implementation; reuse INDIA AI credential vault. Generic third-party integration secrets remain Cloudflare Worker secret bindings.

Migration:
- Apply migrations/0031_admin_option_registry.sql to the target D1 environment using the existing controlled migration procedure and a verified backup.
- No seed data or destructive schema changes. Run migration exactly once; ledger version 31.
- Verify both option audit and read-only references, and regression on users/roles/AI settings.

Test:
- npm run typecheck
- npm run test:modules-13-15
- npm run test:ai
- npm run build
- Real Cloudflare Access UAT with separate Admin and non-Admin identities, D1 rollback/restore evidence, backup and sign-off are required before marking production ready.

Do not claim successful deployment, migration, Cloudflare Access UAT, key continuity or backups based on repository tests alone.
