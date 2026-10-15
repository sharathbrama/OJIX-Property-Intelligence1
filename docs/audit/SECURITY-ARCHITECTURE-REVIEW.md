# Security and Architecture Review — Repository Baseline

**Review date:** 14 October 2026  
**Method:** source and configuration inspection; no penetration test, deployed cloud account, customer data, secret values or production access inspected. This is not a security certification.

## Current architecture

React + TypeScript web application calls Express + TypeScript API. API uses MariaDB/MySQL via `mysql2`; SQL schema is in `database/mysql-schema.sql`. File uploads use Multer disk storage under `UPLOAD_DIR` (defaults to `./uploads`). Docker Compose maps API files to a named local volume. Firebase Admin ID-token verification is conditional on `FIREBASE_PROJECT_ID`; server also implements persistent opaque OTP sessions in MariaDB and development/demo identity paths. Application starts without DDL, which avoids startup migration/destruction.

The FRD recommends Cloud Run, Cloud SQL PostgreSQL/PostGIS and private GCS. Repository implementation and deployment documents also mention different database/provider targets. No production architecture should be assumed until Product/Tech confirms the target.

## Findings and required actions

| ID | Area | Observed | Action / status |
|---|---|---|---|
| SEC-01 | Authentication | Firebase verification exists when configured; OTP login creates random opaque tokens, stores token hashes and supports revocation/expiry. Development identity fallback, dummy accounts and `x-user-uid` are present in source. `/api/auth/dummy-accounts` is now hidden in production; `user-token-*`, `local-developer` and dummy OTP identities are restricted to non-production. | PARTIAL. Verify production has Firebase project or approved auth provider and rejects all dev identity paths. Exercise revoked/expired/session restoration and deployment config. |
| SEC-02 | Authorization / tenant | `authGuard`, role guards and many SQL statements scope by `tenant_id`; property document route scopes document by document ID + property ID + tenant. | PARTIAL. No route-by-route assessment or live cross-tenant negative run. Audit all export/report/admin/source endpoints and fix gaps. |
| SEC-03 | CORS / headers | CORS now uses comma-separated `CORS_ORIGIN` allowlist; Helmet enabled, CSP disabled. Requests with no Origin are allowed (non-browser API clients). | PARTIAL. Confirm production origin list, TLS/proxy behavior, CSP compatibility and edge rules. |
| SEC-04 | Input / SQL | Zod validates several write payloads; MySQL calls generally use parameter placeholders. Request JSON body max 1 MB; API rate limit configured but local/test exemptions exist. | PARTIAL. Inventory unvalidated routes; validate IDs/limits, check dynamic SQL construction, run SQL injection and malformed-input tests. |
| SEC-05 | File handling | MIME allowlist PDF/JPEG/PNG/TIFF; max file size from `MAX_UPLOAD_MB` default 25; max 10 files; randomized path; traversal-safe resolution; authorized streaming route uses `Cache-Control: private, no-store`. MIME is client-provided and no malware/file signature scan is wired. | PARTIAL. Add magic-byte/content validation, antivirus/quarantine, private durable storage, safe disposition/headers, storage version, deletion/retention and read/export audit. |
| SEC-06 | HTML report | Dynamic DB/report values now pass through `escapeHtml`; PDF mock was removed and endpoint returns explicit 501 if renderer unavailable. | Code fix implemented; add malicious text regression cases; deploy only after real HTML/PDF template review. |
| SEC-07 | GIS trust | Demo seed exists; analysis queries now require `data_status='verified'`, source name, URL and date; unknown layer is not clearance. | PARTIAL. `verified` field alone is not proof. Require imported-by, license, CRS, checksum, vintage, geometry QA, review and known-case evidence; source owner/legal acceptance. |
| SEC-08 | Secrets / cloud | App reads environment variables; Docker Compose contains local-only database passwords. Deployment docs are plans, not proof. No verified production Secret Manager/IAM/service account/network evidence. | BLOCKED. Cloud owner supplies approved project/IAM/budget and secret manager; rotate any local value before external hosting. Keep credentials out of docs/logs. |
| SEC-09 | Data protection / tenancy | `documents`, `properties`, title, risk, sessions and audit records persist in MariaDB. No encryption-at-rest, network boundary or production DB evidence reviewed. | BLOCKED. Confirm provider encryption, network controls, least privilege, private connectivity, tenant export/delete and legal retention. |
| SEC-10 | Audit / retention | Audit table and events exist; retention policy table/API exists but reports no active scheduler and automatic cleanup remains disabled. | BLOCKED. Product/legal decide retention/legal hold; implement and test lifecycle/deletion and read/export audit. |
| SEC-11 | Availability / operations | Docker health endpoints/restarts exist; no verified production alerts, incident owner, restore evidence or independent security review. | BLOCKED. Establish dashboards/alerts/runbooks, dependency scans, restore drill, load tests and review evidence. |

## Production release blockers

1. Production identity and tenant onboarding configured, demo logins disabled in deployed artifacts, invalid/revoked identities denied.
2. Route authorization matrix and cross-tenant tests pass for properties, files, findings, exports/reports, source APIs and admin surfaces.
3. Private document storage, malware handling, encryption/IAM, retention/deletion, download audits and restore coverage implemented.
4. Cloud/database target and migrations approved; secrets held by managed secret system; production network/access verified.
5. Security review closes all critical/high issues; operational recovery and monitoring demonstrated.

