# ICOP AI continuous conversation — genuine Admin Access + OpenRouter UAT

Date: 23 October 2026 (WIB). Candidate: PR #30, branch `fix/india-ai-chat-composer-mobile-20261022`.

## Real UAT status: BLOCKED, not PASS
- Connected Cloudflare inspection verified production Worker `india` has a D1-backed enabled/tested OpenRouter provider, priority 1, model `openai/gpt-4o-mini`, with an encrypted key. **No production key, secret or message body was retrieved.**
- The isolated `uat-india` Worker points to D1 `eaed652e-7322-4950-a304-dd50baa5de02` (not production D1) and has a genuine Cloudflare Access application with an Admin-capable D1 membership (two active Admin rows at inspection).
- `uat-india` is on release SHA `4f96492279b83817eb0f0bc6a7f5d1a78b5f6494`, **not** PR #30 candidate. It lacks `INDIA_AI_ENCRYPTION_KEY`.
- The isolated UAT database has **no configured OpenRouter record**. `uat-india-vault` likewise has no OpenRouter provider configuration.
- GitHub workflow [Real Admin Access + OpenRouter UAT #39867515822](https://github.com/elanghaqeem-hash/India/actions/runs/39867515822) executed the genuine runner and returned **BLOCKED_OR_FAIL** before any provider requests; reason: missing `INDIA_AI_CHAT_UAT_ACCESS_AUD` mapped from `secrets.INDIA_UAT_ACCESS_AUD` in the `india-uat` environment.
- These are independent prerequisites: fixing the Access AUD variable alone cannot make live UAT PASS, because the candidate Worker, UAT AI encryption and OpenRouter configuration are still missing. An actual signed **human** Admin Access JWT is also required.
- Earlier [isolated mock-browser UAT #39865478390](https://github.com/elanghaqeem-hash/India/actions/runs/39865478390) **PASS** does not qualify as OpenRouter/human session evidence.

## Safe release gates, in order
1. Deploy reviewed PR #30 candidate to a **dedicated isolated** UAT Worker. Verify its `INDIA_RELEASE_SHA` against the exact candidate commit and keep `INDIA_DB` on dedicated UAT D1 (never production). The real UAT runner is pinned to `uat-india` and the UAT D1 UUID; do not change these to point at production.
2. Provision a **fresh, independent** 32-byte base64 `INDIA_AI_ENCRYPTION_KEY` as a Worker secret on that UAT Worker. Do not copy or disclose production encryption material.
3. Using a separately authorized **UAT OpenRouter API key**, register OpenRouter on UAT via the Admin AI Connections UI, enable it and run the actual provider test; verify `enabled`, `testedOk`, and `hasKey`. Do not migrate or decrypt the production key. UAT database must already contain AI provider schema.
4. Configure GitHub environment `india-uat` with genuine, short-lived Admin Cloudflare Access JWT and exact email, UAT Access AUD/team domain, and a Cloudflare Worker-settings **read-only** token. Do not put JWT, API keys or other secrets into chat, code, PR or workflow logs.
5. Trigger the guarded real-provider workflow. It first checks Access JWT RS256 validity, Admin email and exact app audience, Worker D1 binding, isolated secret, release SHA, and OpenRouter status. It then calls the real `/api/ai/generate` chain with the same conversation history as the UI for 5 turns:
   1. Explain VAPT penetration testing;
   2. “Alat apa saja yang bisa digunakan untuk itu?”;
   3. Explain the two tools just mentioned;
   4. “Gunakan bahasa Indonesia saja”;
   5. Estimate person-days for that work, showing assumptions.
6. Record workflow URL and evidence that real model `providerUsed` is OpenRouter, model matches configured UAT model, answers stay on VAPT, Indonesian preference persists, and no unrelated cooking tools appear.
7. Request human Android Chrome/desktop signoff, then independently review PR #30 and proceed to controlled production deployment with rollback plan. **No auto-merge, no production writes.**

## Security notes
- Runner `scripts/india-ai-chat-live-uat.mjs` is read-only except for sending five anonymized prompts to the connected **isolated** external provider and the associated provider's normal billing; it does not alter deals or customer records.
- UAT prompts contain no real customer information. Provider output is not logged; logs contain checks, status and non-secret metadata.
- Real UAT without human JWT, isolated provider config or exact Worker revision must be marked **BLOCKED** and cannot be reclassified as PASS through mocked responses.
