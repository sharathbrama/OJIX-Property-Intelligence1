# P0 Progress Tracker

**Updated:** 15 October 2026, 11:30 IST
**Status terms:** Not Started / In Progress / Blocked / Ready for Verification / Done. Done requires acceptance artifact and verification evidence.

| ID | Priority / status | Work | Evidence / acceptance | Owner role | Blocker / next checkpoint |
|---|---|---|---|---|---|
| P0-A1 | P0 — Ready for Verification | Remove fabricated title chain, default coordinates, demo GIS findings, schematic parcel/raster and fake PDF | 15 Oct API suite (427/427), production build/type checks passed; read-only map point check returned unknown with no source data | API + Web leads | No licensed GIS layer or full browser E2E evidence. Continue with E2E plan rows 7-9 in isolated staging. |
| P0-A2 | P0 — Ready for Verification | Remove fake search defaults and extent; reject missing identifiers | UI defaults removed; source query tests and 427-test suite pass | API + Web leads | Persisted intake/browser path still needs staging verification. |
| P0-A3 | P0 — Ready for Verification | Report escaping, honest unknown states, source-document links | Report escaping/evidence tests and API suite pass; typecheck/build pass | Report/API lead | Authorized live link resolution and stable immutable document version/page anchor remain unverified. |
| P0-B1 | P0 — In Progress | End-to-end auth/property/document/review/report workflow + tenant isolation | 15 Oct: API `/health` returned `status: ok`, MariaDB connected; `npm test`: 427 passed, 0 failed. Role/tenant and document-security API tests included. Read-only map UI check confirmed unknown/no-source state. Property CRUD, upload/retrieval, persistence and report browser paths remain NOT RUN. | QA + API lead + Security | Do not use client/production data. Run remaining browser workflow only in isolated synthetic staging and attach IDs, timestamps, API responses and DB assertions. |
| P0-C1 | P0 — In Progress | Production identity and complete authorization route matrix | API tests pass role/tenant access cases; health reports local development identity | Identity owner + Security | Firebase project, approved pilot identities, production config and deployed route-by-route checks remain required. |
| P0-D1 | P0 — Blocked | Private durable document store, malware quarantine, lifecycle, access/export audit | Provider/IAM config, upload/denial/deletion tests | Storage/Platform + Security | Cloud project/IAM/budget; retention and legal-hold decision. |
| P0-D2 | P0 — Blocked | OCR decision/provider if required | Provider terms, golden corpus, target threshold, async/retry proof | Product + Security/Legal | Choose manual-first pilot or OCR pilot; provider/corpus unavailable. |
| P0-E1 | P0 — Blocked | Trusted GIS source and geometry rules | License, publisher, date, CRS, checksum, known cases, rule version/results | Data steward + GIS + Legal | Licensed datasets and source permissions not supplied. |
| P0-F1 | P0 — Blocked | Real deterministic PDF and report approval | Renderer output; immutable snapshot; evidence appendix; approved template and reviewer record | Report/API + Legal/Product | Renderer/provider and approver/template decision. |
| P0-G1 | P0 — Blocked | Production target, secrets, monitoring, backups and restore | Architecture record; least-privilege IAM; measured RPO/RTO restore; load and alerts | Tech/Cloud/Platform | Product/Tech decision, cloud project, budget, workload, NFR, RPO/RTO. |
| P0-H1 | P0 — Not Started | Controlled pilot release gate | One full controlled workflow and signed QA/security/legal acceptance | Product + QA + pilot operator | All P0 prerequisites above. |

**Next checkpoint:** Product/Tech confirms decision owners, environment access, pilot scope and engineering capacity; Engineering Manager reforecasts and publishes milestone target dates within two working days after those inputs arrive. Until then, report effort/status and blockers only; do not invent dates.

