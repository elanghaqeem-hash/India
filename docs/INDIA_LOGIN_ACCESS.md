# INDIA login flow — production (31 October 2026)

## Purpose

The INDIA production Worker is protected **at Worker level** by Cloudflare Access. As a result,
`https://india.elang-haqeem.workers.dev/login` will always display Cloudflare Access first
for an anonymous visitor. The Next.js login route cannot render before authentication.

The public login landing is a **separate, static-only Cloudflare Worker**, not a bypass of
the production identity boundary.

## URLs

- Public branded login entry: https://india-login.elang-haqeem.workers.dev/login
- Identical branded landing at: https://india-login.elang-haqeem.workers.dev/
- Cloudflare Access-protected production system: https://india.elang-haqeem.workers.dev/
- Public landing source: `infra/cloudflare/india-public-login.js`

## Flow

1. Visitor opens public branded login Worker.
2. The landing page has no passwords, cookies, OTP, user data, API routes, D1 bindings, or proxy.
3. Visitor clicks **Masuk dengan Cloudflare Access** and navigates to the protected INDIA Worker.
4. Cloudflare Access checks Identity Provider session and approved application policy **before**
   passing a request to the production Worker.
5. INDIA continues verifying server-side JWT, D1 membership and RBAC per API route.
6. Unauthenticated and unauthorized requests stay blocked by Cloudflare Access or the application.

## Security invariants

- Do **not** delete or weaken the production Worker-level Access application:
  `INDIA Technotama Production - Secure Business Platform`.
- Never expose a public API, production Worker alias, cached user data, or private D1 binding
  on the public login Worker.
- Access policies remain administered in Cloudflare Zero Trust.
- Public page is noindex, disallows frames, and uses no external scripts, tracking, or user data.

## Deploy and verification

- Commit changes to `infra/cloudflare/india-public-login.js` in GitHub.
- Upload this exact file as the `worker.js` module to Cloudflare Worker `india-login`.
- Ensure the `workers.dev` subdomain is enabled for that Worker.
- Check Cloudflare deployment shows 100% to new Worker version.
- In a private browser, confirm public login appears *without Access*.
- Click the sign-in button: the redirect must show Cloudflare Access before an unauthenticated
  visitor can access production.
- After authorized login, confirm dashboard routes and D1 permissions by role.
- After logout, verify expired session can no longer access protected data.

**Evidence as of 31 October 2026:** API upload and automatic deployment of `india-login`
succeeded and workers.dev subdomain was enabled. External browser smoke test remains necessary;
the tool environment could not resolve workers.dev DNS when testing from inside this session.
