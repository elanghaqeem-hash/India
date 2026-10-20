# India public UI preview

This change enables a **UI-only public preview**, not a full production system.

- All `/api/*` paths are explicitly blocked by Next.js middleware (HTTP 503).
- AI keys are never returned from the AI configuration GET response, even if the middleware is later changed.
- The demo Store is held only in runtime memory and contains **fictional sample entities**. Nothing is persisted server-side.
- The UI visibly identifies all data as examples. Do not use demo quotations, tenders, approvals, or pipeline figures for decisions.
- Worker deployment must not be marketed as fully operational.

Before production: proper authentication, RBAC, D1 persistence and migrations, server-only provider secrets, real client data import, tests, and lockfile regeneration are mandatory.

Working demo URL after deployment: https://india.elang-haqeem.workers.dev
