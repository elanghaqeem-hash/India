# INDIA FlexGuard — immutable D1 ledger (0030)

## Reuse and scope
Uses canonical Customer, closed-Won Opportunity, independently approved FlexGuard Contract, Project, actual approved Invoice and net approved cash Collection from 0027. No new customer, contract, or financial register.

Ledger: ISSUE, TOPUP, RESERVE, RELEASE, DEBIT, REFUND and EXPIRY. Balances are derived from immutable events rather than mutable browser state; no optimistic browser balances and no fake tokens. Registration and independent approval use maker-checker. ISSUE/TOPUP require fully collected approved invoice belonging to same project, with one invoice allowed per wallet credit and total purchases constrained by the independently approved token entitlement. Reserve/debit/release are linked to same-customer Won Opportunity; DEBIT additionally decrypts and verifies original supporting Vault document. Refund references an original DEBIT and may not exceed it. SQL triggers enforce conservation and per-reservation caps atomically under concurrent D1 transactions.

### Limitations
A new entitlement is not yet amendable for later top-ups beyond approved quota; a new approved contract/entitlement workflow is required. Automatic scheduled expiry and contract amendment are not included; expiration event is manual after contract end and automatically prevents new usage on expiration. Return of unused reservation uses RELEASE; refund of consumed units uses REFUND. Neither is a bank refund. Do not count this as full billing integration.

CI includes a synthetic Python SQLite rehearsal of the ACTUAL 0030 migration, transaction denial cases, SoD, overuse, idempotency and no updates/deletes. This is not production UAT.

## Release gate
**BLOCKED for remote operational release** until independent native backup/restore, migration 0029/0030 on separate Access-protected clone, original Vault key continuity, genuine human Finance/Approver/Sales/Presales signed transactions, Android, observability and signoff. Never apply directly to production before 0013–0028 reconciliation.
