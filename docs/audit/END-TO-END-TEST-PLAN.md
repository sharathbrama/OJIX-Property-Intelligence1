# End-to-End Test Plan — OJIX Property Intelligence

**Revision:** 15 October 2026  
**Current result:** API integration suite PASS (427/427) against local API and MariaDB; API health returned `status: ok` and `database: connected`. Production build and type checks PASS. A read-only browser map check exercised the point-screen API and correctly showed unknown when no verified source layer was available. The complete browser-to-database property/document/report workflow has NOT RUN.

## Run conditions and safety

Run against an isolated staging database initialized from `database/mysql-schema.sql` and explicitly synthetic fixtures from `infra/db/seed.sql`. Do not use a client dataset. Record repository commit, build IDs, environment (without secrets), test tenant/user role, generated test IDs, request IDs, UTC timestamps, request/response artifacts with sensitive values redacted. Reset only the disposable test environment. Do not run seed SQL against a database with existing data.

## Workflow matrix

| Step | UI/API/DB path | Expected result | Evidence to capture | Current status |
|---|---|---|---|---|
| 1. Authentication | UI login -> auth API -> `user_accounts`, `org_memberships`, `authentication_sessions` | Valid test identity signs in; expired/revoked/missing token denied; production does not accept demo identity | Session row/hash, role, denial status, audit row, timestamp | API role/auth tests PASS; browser login, session lifecycle and production config NOT RUN |
| 2. Property create/read | React property form -> `POST /api/properties` -> `properties` -> `GET /api/properties/:id` | Tenant property persists and reload returns same values; omitted values remain absent | Request/response IDs, row values, reload result | PARTIAL — suite passes; dedicated browser create/reload and API restart persistence NOT RUN |
| 3. District hierarchy | UI district -> taluk -> hobli -> village APIs -> Karnataka location tables | Child values filtered to parent; bad/inactive IDs rejected; no fabricated fallback | API payloads and DB rows | DB hierarchy API test PASS; UI cascade and source-data provenance NOT RUN |
| 4. Document intake | Upload UI -> `POST /api/properties/:id/documents` -> file store + `documents` | Allowed MIME/size accepted; checksum matches bytes; unknown extraction remains manual review; invalid/oversize rejected | file hash, row ID, status, denial payload | API validation/security tests PARTIAL PASS; browser upload, persisted hash/file comparison NOT RUN; storage is local |
| 5. Secure file retrieval | `GET /api/properties/:id/documents/:docId/file` | Same tenant/property allowed; other tenant, wrong property, traversal and missing file denied; response private | Status, headers, audit row, path test evidence | API traversal and tenant-negative tests PASS; browser download and full same-tenant file lifecycle NOT RUN |
| 6. Manual fact review | Review UI -> extraction/review endpoints -> `documents.extracted_fields`, `audit_events` | Edits preserve provenance; reviewer/status/time retained; verification denied until required fields and source review pass | Before/after JSON, reviewer ID, audit event, page evidence | API field-validation, rationale and audit tests PASS; browser review UI path NOT RUN |
| 7. Title/discrepancies/findings | UI -> title-chain, discrepancy, analyze APIs -> `title_events`, `risk_findings` | Persisted data only; empty chain stays empty; no unsupported no-gap/clear claims; findings link to source/rule | DB rows, payloads, source doc IDs, rule versions | Rule and adversarial spatial tests PASS; complete persisted browser workflow NOT RUN |
| 8. GIS screening | Map UI -> `/api/spatial/screen-point` -> verified `spatial_layers` | Missing coordinates/layers -> unknown/unavailable; demo/stale/unprovenanced rows do not create findings; licensed layer produces known-case expected output | source/license/version/CRS metadata, result, expected vs actual | API regression and read-only browser negative case PASS (no source -> unknown); positive licensed-source case BLOCKED (no authorized dataset) |
| 9. Report | `POST /api/properties/:id/due-diligence-snapshot`, HTML/JSON report | Snapshot matches persisted evidence and timestamp; report links resolve via authorized route; HTML safely escapes user text; PDF endpoint clearly says renderer unavailable until implemented | Snapshot ID, source IDs/hash/time, report artifact, HTML injection case | Snapshot/report unit and escaping tests PASS; live report-link/persistence NOT RUN; real PDF renderer BLOCKED |
| 10. Persistence | Re-read after browser reload/API restart | Property, doc metadata, review, title events, findings and snapshot remain; local files remain only in local storage | Before/after IDs/hash and restart timestamps | NOT RUN end-to-end |
| 11. Failure paths | Stop DB/API, remove GIS rows, use malformed input, unavailable storage/provider | Accurate 4xx/5xx or unknown state, no fake success/data, no leaked secrets | Error status/body, logs with request ID | Malformed input and unavailable-data API/unit cases PARTIAL PASS; deliberate outage and UI failure presentation NOT RUN |
| 12. Tenant/role regression | Repeat reads/writes for two tenants and all pilot roles | Cross-tenant and role restrictions enforced for properties, docs, findings, reports and admin APIs | Matrix, denied statuses, DB assertions and audit | API tenant and role regression tests PASS (included in 427); deployed production identity matrix NOT RUN |
| 13. Backup/restore | Staging DB and object restore | Restored objects/checksums and DB links match; achieved RPO/RTO measured against approved target | Backup ID, restore runbook, durations, hash checks | NOT IMPLEMENTED / BLOCKED — no approved RPO/RTO or recovery environment |

## Minimum sign-off

QA completes every applicable row and attaches reproducible output. Product/data/legal owners accept scope, source rights, review workflow and template. Security reviews access/tenant/file lifecycle. Platform records backup and restore evidence. No P0 is Done based only on source presence, a passing build, or a synthetic happy path.

