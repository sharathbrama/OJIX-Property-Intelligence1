# OJIX Property Intelligence - API Test Report

**Revision:** `bc0508b`  
**Execution date:** 27 October 2026

## Inventory

- Express route registrations found: **99**
- OpenAPI documented paths: **8**
- API automated test files: **19**
- Top-level API test declarations: **402**
- Primary middleware: authentication guards, role guards, Zod validation, Multer upload control, Helmet, CORS and rate limiting.

Major route groups include health/readiness, authentication and OTP, locations, RTC lookup, overview, properties, parcels, workflow, documents, OCR/extraction, title chain, spatial screening, reports, legal research, source registry, global document/finding views, Super Admin and organization Admin.

## Executed API checks

| Test | Expected | Actual | Status |
|---|---|---|---|
| API TypeScript validation | Exit 0 | Exit 0 | PASS |
| API production build | Exit 0 | Exit 0 | PASS |
| `GET /health` on port 4000 | HTTP 200/503 structured health | Connection unavailable | BLOCKED |
| `GET /health` on Compose port 4001 | HTTP 200/503 structured health | Connection unavailable | BLOCKED |
| Full API test suite | All assertions pass | DB/API cases returned connection refused in current-release attempt | BLOCKED |

## Static findings

1. **Incomplete API contract:** 8 OpenAPI paths for 99 route registrations. Authentication, OTP, admin, Super Admin, RTC, title, legal research, registry and multiple report routes are absent or incomplete.
2. **Runtime unavailable:** No API listener existed on port 4000 or 4001.
3. **Test prerequisite coupling:** Many automated tests require both MariaDB and an API process; the root test command does not orchestrate these prerequisites.
4. **PDF route limitation:** The implementation may return a renderer-not-configured response. This must be explicitly reflected in the production contract.

## Required API retest matrix

- Successful request and response-schema validation for all supported routes.
- Missing, malformed and boundary request bodies.
- Missing/invalid/revoked authentication.
- Role denial and cross-tenant resource identifiers.
- Pagination, filtering and search boundaries.
- Upload file type, count, size, traversal and checksum behavior.
- OTP expiry, reuse, brute-force/rate-limit and delivery failure.
- Duplicate, not-found and conflicting mutations.
- Database outage and external-provider timeout behavior.
- Audit creation for every sensitive mutation.

## Assessment

The API source compiles, but runtime behavior is **not certified** for this revision. API release status is **BLOCKED** until the service and MariaDB are available and the complete route/test matrix passes.
