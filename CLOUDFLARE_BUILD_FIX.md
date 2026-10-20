# Cloudflare India — Next.js/OpenNext Compatibility Fix

Status: **staging candidate, not production ready**.

## Root cause

Cloudflare's Wrangler auto-setup detected `Next.js 14.2.35` and installed OpenNext `1.20.12`. That adapter requires Next.js `>=15.5.28 <16` (or supported 16.x); the auto-generated build therefore always aborted.

## Changes in this branch

- Upgrade Next.js to 15.5.28 and keep React 18.3.1.
- Pin OpenNext 1.20.12 and Wrangler 4.151.2.
- Commit a non-interactive Wrangler config targeting **india** and OpenNext build output.
- Add explicit Cloudflare build/deploy scripts.
- Temporarily remove outdated npm lockfile until npm can regenerate a matching lock on an online builder (use `npm install --package-lock-only` then commit the new lock).

## CI settings

Build: `npm run build:cf`
Deploy: `npm run deploy:cf` (production only after security and persistence remediation).

Do **not** run `npx wrangler deploy` on a project without checked-in configuration. Never use `--dangerouslyUseUnsupportedNextVersion`.

## Security/runtime blockers (separate from dependency fix)

- `src/lib/store.ts` imports Node's `fs` and persists to local disk; Cloudflare Workers provide no durable writable filesystem. This must be replaced with real database storage (D1 etc.).
- `src/app/api/ai/config/route.ts` must not return provider `apiKey` from the API response, and all mutating routes need authentication/authorization.
- The in-memory seed data must not be presented as production customer records.
- Verify build, preview endpoints, and access controls before the first production deploy.

Cloudflare docs: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
