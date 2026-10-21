# INDIA — Negative Testing & Pre-Deployment UAT Gate
Tanggal: 21 Oktober 2026. PR target: Sales #12. PR integrasi: #17.

## Automated evidence and limitations
- Imported PR #15 negative domain tests N01–N36 and route-level Request/Response tests R01–R08 (total 44).
- P0 guards: cross-owner quotation, account-list isolation, account-to-opportunity ownership, strict calendar dates, AI outbound PII/NPWP check, and PO discrepancy > Rp0.01.
- CI runs all 44 tests plus Sales, Marketing, BoQ, Post-PO, quotation, AI, TypeScript, Next 16.4.2 production build and OpenNext Cloudflare packaging.
- Actual HTTP without Cloudflare configuration is exercised on a localhost production Next server. Unauthenticated CRM, BoQ and AI must fail closed (non-2xx).
- Chromium tests verify six simulated UI roles: admin, sales, presales, finance, approver and legal, including mobile rendering, plus unauthenticated UI. Mock API responses simulate roles; this is NOT authentic Cloudflare Access JWT verification.
- Screenshots contain only synthetic fixtures; short-lived GitHub Actions artifact: india-role-browser-fixtures.
- No writes to real customers/PO, production D1, active Worker or Access application for these tests.

## Negative coverage
| Group | IDs | Checks |
|---|---|---|
| Ownership | N01–N04, N25–N26, N33 | Cross-Sales account, opportunity, quotation and internal HPP |
| Stage | N05–N14 | Unknown fields, skipping steps, Won without PO, lost cause, missing BANT |
| Data validity | N15–N18, N27, N29, N36 | Negative price, incomplete HPP, impossible dates, Rp1 mismatch, leap day |
| Approval | N19–N23 | Maker-checker, discount/margin, duplicate submission, PO SoD |
| API and AI | N24, N28, N30–N32, N34–N35 | Closed demo routes, PII, consent, quota, provider tested, original-document evidence |
| Route contract | R01–R08 | Owner quotation, roster, account linking, own-PO, stage bypass, NPWP, CSRF, invalid JSON |

## Required real-session HTTP and browser UAT (not replaced by mocked fixtures)
Use a physically isolated staging D1 and an independent Cloudflare Access test app, not production. QA needs real permitted emails and independent browser sessions; .invalid fixture addresses cannot log in.

| ID | QA persona | Required observation |
|---|---|---|
| L01 | Unauthenticated | All protected APIs blocked; no customer data |
| L02 | Viewer | POST customer/BoQ denied 403 |
| L03 | Sales B | Sales A deal and quotation unreadable (403) |
| L04 | Sales B | Sales A customer unavailable for enumeration/conversion |
| L05 | Presales | Cannot edit price/PO/owner |
| L06 | Sales A | Stage jump to Won rejected 409 |
| L07 | Sales A | Draft/rejected BoQ cannot produce final quotation |
| L08 | BoQ maker as Admin | Own approval denied 403 |
| L09 | Approver | Invalid HPP/low-margin review denied as policy requires |
| L10 | Sales A | PO +Rp1 rejected 409 |
| L11 | Opportunity maker as Admin | Own PO verification denied 403 |
| L12 | Finance | Original PO evidence and independent review required |
| L13 | Sales/Presales | Malformed PDF/DOCX and oversized RKS rejected safely |
| L14 | Sales/Presales | Formatted NPWP/NIK/telephone/email blocked before AI call |
| L15 | Sales/Presales | Unconfirmed/untested AI request blocked |
| L16 | Two Sales sessions | Conflicting updates detected, no lost update |
| L17 | Sales + Finance + PM | Successful Won handover prepopulates both actual Word forms |
| L18 | Sales B | Lost deal recorded with reason and no false PO |
| L19 | Six browser roles | Desktop/mobile forms, CTA visibility, exports, no overlap |
| L20 | IT/Security | Audit, backup/restore, least privilege and recovery evidence |

## Mandatory release gates
1. All CI suites, 44 negative tests, localhost HTTP, mocked-browser UI and Cloudflare packaging green on the merged PR #12 final head.
2. PR #12 rebased or merged cleanly with main (Next.js 16.4.2) without losing security changes.
3. Cloudflare Access signed JWT + identity mapped to actual India role tested by QA accounts and session-isolated real browser tests.
4. L01–L20 have HTTP status, role, sanitized screenshot, D1 audit evidence and signed owner acceptance.
5. D1 rollback, backup, consistency, secrets, original Word templates and consent policies verified.
6. NO-GO and no production deployment until real multirole Access UAT and all gate evidence are available.
