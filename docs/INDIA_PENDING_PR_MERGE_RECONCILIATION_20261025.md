# INDIA — pending PR merge reconciliation, 25 October 2026

Base after PR #61: `453088ca12697f8d4cfc9ecc1860883d0cf10695`.

This integration preserves every original PR head in Git ancestry while reconciling its changes against the newer canonical implementation. Superseded implementations are resolved to the current code; they are not restored over the existing security and data model. This is a source merge only, not a production release.

| PR | Original head | Reconciliation |
|---|---|---|
| #37 | `d055bc5928020c35453193921560d3818f811c19` | Pricing/AI request repair is already covered by `/pricing` → canonical `/boq`, authenticated `/api/ai/assist`, consent and bounded outbound calls in AIWorkbench. Preserve canonical routing; do not revive the retired appStore pricing page or unused range helper. |
| #34 | `4f96492279b83817eb0f0bc6a7f5d1a78b5f6494` | Port automatic-code hydration fix and disabled input into the current Campaign form. Preserve active owner picker, activation, deletion/audit and Lead protections from PR #57/#58/#60. Rebase browser fixture to the current owner selector and success message. |
| #28 | `c9e8887e87f53b82ed7f9bc2e5b2553400009df6` | Vault/tender integration already uses canonical 0022/0023 and stronger original-document authentication. Preserve the already-rehearsed historical 0015 SQL hash; the proposed metadata-only backfill is not applied without physical remote reconciliation. Remote manifest gap remains in the release register. |
| #27 | `43923b82dfe7c1faabced48c560f7d356a7ab273` | Feasibility APIs, person-days, resources, OEM costs and source tests are already in canonical 0025 and modules 13–15. Preserve current modules, Vault gates, middleware and 0024 executive targets; do not add the old competing 0024 migration. |
| #23 | `2ae72bfb65547a05a33b040e99a9db0f6d3c1c71` | Canonical Vault 0015/0022/0023 and current original reauthentication are retained, including stronger authenticateWonOriginals logic absent in the old branch. No duplicate governance 0021 migration is introduced. |
| #22 | `64d24b50758b55e08d20c515073a761d77412e4b` | Lead scoring/nurturing/disqualification/reactivation are already in canonical 0014/0020. Historical UAT evidence remains available in original branch history and existing runbooks; it does not become new UAT evidence. |
| #21 | `e4685eb86442b9b0eeb161e9b39656bae859aa27` | Port schema-0013-compatible Cron detection and versioned due-date nurture alerts with active Sales/Admin recipients and soft-disqualification checks. Retain expanded idempotency/negative tests. No Cron deployment or schedule/binding change. |
| #18 | `883bc82b356e4399971bcc3097ebdf0901a1c7cb` | Atomic Lead conversion, customer ownership, postal references and real-Access guards are already consolidated through canonical Marketing/Sales migrations and APIs. Retain canonical /api/marketing/leads and lead links; do not add duplicate lead tables/endpoints/alternate navigation. |
| #15 | `060920322dcedc025318c3ca654010327f261170` | Negative security protections are already integrated and expanded to the 44-case canonical suite. Preserve latest ownership, PII checks, bounded JSON, AI quota reservations and new dependency pins. Old parent PR #12 was already merged; retarget this historical PR to main for ancestry reconciliation. |
| #2 | `ced1e7f524a1a5c81dcf8afbc94d9a4926ca53ec` | Canonical D1/Access, admin health, AI credential vault and immutable FlexGuard 0030 supersede the original standalone init/wallet path. Keep current Worker/D1 bindings and migration numbering; the old parallel wallet implementation and duplicate init migration are retired. |

All original head SHAs are retained as parents of the reconciliation commit. Canonical source regression, typecheck, builds and CI must pass before merging this reconciliation PR. Existing production NO-GO, real Access UAT, remote recovery and sign-off prerequisites remain unchanged.
