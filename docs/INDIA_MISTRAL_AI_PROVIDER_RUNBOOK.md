# INDIA — Mistral AI (Provider #7), canonical 0028 rollout

**Source reconciliation (24 Oct 2026):** Reuses actual PR #39 AI registry, encrypted credential vault, and provider endpoint without replaying its conflicting `0025` migration. Main's `0025_vendor_resource_feasibility.sql` is retained. Production has ledger 0012, so this file **cannot** be applied to production until all canonical 0013–0027 migrations, backup, restore, key continuity and real Access UAT gates pass. No credentials are included.

## Source behavior
- Registered provider id: `mistral`; default model: `mistral-small-latest`; optional `mistral-large-latest`.
- Fixed outbound API endpoint: `https://api.mistral.ai/v1/chat/completions`, bearer authentication; no user-controlled endpoint.
- Existing Admin-only API Key form, AES-256-GCM D1 encryption, Test Connection, enable/disable, provider ordering and failover are reused.
- New provider starts disabled, untested, without API key. Existing providers and their priority remain untouched.
- Both `/api/ai/generate` and authorized `/api/ai/assist` use the shared registry and vault.

## Controlled rollout
1. Review/merge PR only after tests pass, confirm canonical 0028 migration is consistent with already-applied 0027 and does not replay 0025 Feasibility.
2. In the isolated UAT D1, capture a backup/export or a verified time-travel bookmark and row-count/integrity baseline. Do **not** restore over a live shared database.
3. Apply `migrations/0028_ai_mistral_provider.sql` in UAT. Verify existing provider rows, priorities, `key_iv`, `key_ciphertext`, `tested_at`, `tested_ok` are bit-for-bit unchanged, and the new `mistral` row has the next available priority, disabled, no key.
4. Deploy the branch to an isolated UAT Worker, preserving Cloudflare Access Admin authorization and session guards. Verify GET `/api/ai/config` shows seven providers, including Mistral, on Android and desktop.
5. Ensure the UAT Worker has a separate `INDIA_AI_ENCRYPTION_KEY` secret of 32 random bytes in base64 and **only UAT provider keys**. Enter Mistral API key via its Admin form, not through chat or repository. Test Connection must contact Mistral's real endpoint.
6. Validate wrong-key 401/422 handling without key leakage; enable Mistral; verify generation returns `providerUsed=Mistral AI` when selected by priority, and fallback when Mistral fails.
7. Check logs are free of credentials/prompt contents, confirm preservation of other providers, then approve a controlled production migration + release with a rollback plan.

## Post-migration checks (read-only)
```sql
SELECT provider_id,model,priority,enabled,
       (key_ciphertext IS NOT NULL) AS has_key,tested_ok
FROM india_ai_providers ORDER BY priority;
SELECT sql FROM sqlite_master WHERE name='india_ai_providers' AND type='table';
PRAGMA integrity_check;
```

## Release blockers
- Do not mark provider connected or activate it until a real Mistral key has passed the live probe.
- Code push or pull request alone does not update Cloudflare Worker runtime.
- Current UAT secret, access-session and D1 backup/restore gates must be independently verified before production.
