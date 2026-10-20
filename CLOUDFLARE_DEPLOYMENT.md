# India: ChatGPT - GitHub - Cloudflare

## Confirmed connections on 20 October 2026

- GitHub: elanghaqeem-hash/India, main, ChatGPT GitHub connector has write permission.
- Cloudflare account: 208155f241d4da84e1a6a9b44b7a8d28.
- Cloudflare Worker: india.
- Cloudflare Workers Builds repository integration: connected to GitHub India, main, auto-build enabled.
- Investigated build: 9851d076-3636-4f81-a7db-da39e8ca508f — FAILED.
- Failure: Next.js 14.2.35 incompatible with auto-configured OpenNext Cloudflare 1.20.12.
- Production app deployment status: NOT VERIFIED; Worker still reports dashboard-template deployment.

Dashboard:
https://dash.cloudflare.com/208155f241d4da84e1a6a9b44b7a8d28/workers/services/view/india/production

## Auto push and deploy

1. ChatGPT GitHub connector commits approved code edits directly to GitHub. It does not independently monitor a user's Windows files.
2. To auto-commit changes saved locally on Windows, run start-auto-push.bat in the Git working folder. Git login/network access is required, and the watcher must remain open. Run manual-push.bat for a single push.
3. Every new push to main triggers Cloudflare Workers Builds while its GitHub grant and auto-build setting remain enabled.
4. Production deployment requires a successful build and deploy. A GitHub push alone is NOT evidence that production was updated.

## P0 blocking items before a green production release

- Upgrade/migrate Next.js to a supported Cloudflare adapter. Cloudflare currently recommends vinext for Next.js. Test first on a nonproduction branch.
- Fix the filesystem-backed persistence in src/lib/store.ts. Local fs writes are not durable Cloudflare Workers storage; use a real persistent database, with tenant-aware authorization.
- Secure src/app/api/ai/config/route.ts: GET currently includes provider config properties that can include raw API keys. Mutations currently lack admin authentication. Keep actual provider credentials only in server-side secrets.
- Confirm that seed CRM and tender data are sample records rather than live records.
- Add proper Wrangler configuration targeting Worker india, plus CI typecheck/test gates and smoke testing in previews. Avoid automatic migration during production deploy.
- Do not bypass unsupported Next.js version checks or publish live API keys to fix a CI build.

## Verification checklist

- New GitHub main commit SHA is visible.
- A Cloudflare build event appears for that same commit SHA.
- Build succeeds with supported tooling.
- Worker deployment version changes and points to that tested build.
- Live site and core API routes pass smoke tests, persistence and access control work.

Cloudflare docs:
https://developers.cloudflare.com/workers/ci-cd/builds/
https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
