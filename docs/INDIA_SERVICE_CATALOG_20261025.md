# INDIA service catalog expansion — 25 October 2026

The Lead and Sales service family catalog expands from 7 to 35 choices. Existing persisted names remain valid. Lead API validation, Sales selectors, BoQ compatibility and Post-PO use the same catalog. Lead and Post-PO selectors group services for navigation; Post-PO shows scope guidance per service.

| Service | Group | Compatible BoQ categories |
|---|---|---|
| VAPT | Offensive Security | VAPT |
| Red Team / Adversary Simulation | Offensive Security | VAPT |
| Attack Surface Management | Offensive Security | CTI, VAPT, TECHNOLOGY |
| SOC/MDR | Defensive Security | SOC |
| CTI | Defensive Security | CTI |
| Digital Risk Protection | Defensive Security | CTI, TECHNOLOGY |
| Incident Response/DFIR | Defensive Security | DFIR, IR |
| Incident Response Retainer | Defensive Security | IR, DFIR |
| Threat Hunting / Compromise Assessment | Defensive Security | SOC, DFIR |
| Managed Security | Defensive Security | SOC, TECHNOLOGY, Hardening |
| Cybersecurity Governance | Governance, Risk & Compliance | GRC, ISO, PDP, TRAINING |
| GRC / Risk Management | Governance, Risk & Compliance | GRC |
| ISO 27001 / ISMS | Governance, Risk & Compliance | ISO, GRC |
| ISO 27701 / Privacy Management | Governance, Risk & Compliance | ISO, PDP, GRC |
| PDP / Data Privacy | Governance, Risk & Compliance | PDP, GRC |
| DPO as a Service | Governance, Risk & Compliance | PDP, GRC |
| IT Audit / IT Assurance | Governance, Risk & Compliance | GRC |
| IT Governance / IT Risk | Governance, Risk & Compliance | GRC |
| ICOFR / Internal Control | Governance, Risk & Compliance | GRC |
| BCM / BCP / DRP | Governance, Risk & Compliance | GRC, ISO |
| Third Party / Vendor Risk Assessment | Governance, Risk & Compliance | GRC |
| Cybersecurity Technology | Technology & Implementation | TECHNOLOGY, Hardening |
| SIEM / SOAR Implementation | Technology & Implementation | TECHNOLOGY, SOC |
| IAM / PAM | Technology & Implementation | TECHNOLOGY, GRC |
| Network / Endpoint Security | Technology & Implementation | TECHNOLOGY, Hardening |
| Cloud Security | Technology & Implementation | TECHNOLOGY, Hardening, VAPT |
| Data Security / DLP | Technology & Implementation | TECHNOLOGY, PDP |
| DevSecOps / Secure Code Review | Technology & Implementation | VAPT, TECHNOLOGY |
| OT / ICS Security | Technology & Implementation | TECHNOLOGY, GRC, VAPT |
| Security Hardening | Technology & Implementation | Hardening, TECHNOLOGY |
| Cybersecurity Training / Awareness | Training & Advisory | TRAINING |
| Phishing Simulation | Training & Advisory | TRAINING, VAPT |
| vCISO / Cybersecurity Advisory | Training & Advisory | GRC |
| FlexGuard / Security Subscription | Training & Advisory | SOC, VAPT, CTI, GRC, IR, DFIR, TECHNOLOGY, TRAINING |
| Other | Layanan Lainnya | Lainnya, VAPT, SOC, CTI, ISO, PDP, GRC, DFIR, IR, TECHNOLOGY, Hardening, TRAINING |

## Compatibility

- No D1 schema migration, customer backfill, membership change or new price/SKU seed is introduced.
- New services map to existing BoQ categories. Selecting an Opportunity sets the mapped category on blank BoQ lines and preserves entered line descriptions/categories.
- Exact service family names survive actual Lead registration and conversion API handlers, and Post-PO prefill; new names no longer collapse to Other.
- This adds selectable service classifications, not new service delivery engines or an assertion of commercial certification. Feasibility continues to use its existing five cost models; new service families use the appropriate approved model.

## Validation

- TypeScript check passed.
- 434 regression test executions passed across the existing Cloudflare build test sequence, including the service catalog suite.
- Catalog integration suite persists and converts all 35 service families through actual handlers against isolated SQLite/D1 test adapters, checks every mapped BoQ category, and verifies exact Post-PO prefill. Authentication is synthetic test identity only.
- Next.js production compilation and OpenNext Cloudflare packaging passed with local dependencies.

## Release scope

This catalog change adds no D1 migration or remote data write. The user explicitly authorized repository publication and production deployment on 25 October 2026. Existing production recovery, migration and real Cloudflare Access UAT requirements still require actual verification; authorization does not mark them passed.
