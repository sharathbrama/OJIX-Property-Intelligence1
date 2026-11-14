# OJIX Property Intelligence - QA Executive Report

**Assessment date:** 27 October 2026 (Asia/Kolkata)  
**Branch:** `main`  
**Assessed revision:** `bc0508b`  
**Application version:** `0.1.0`  
**Final recommendation:** **NOT READY FOR RELEASE**

## Executive summary

The current source compiles and builds successfully. API and web TypeScript checks passed, the production build completed, and all three available frontend property-form unit tests passed. The repository contains extensive API tests: 19 API test files with 402 top-level test declarations.

The release cannot be certified because MariaDB, the API, and Docker were unavailable during this assessment. The database-backed and HTTP API suite therefore remains blocked. A new Playwright smoke suite passed all 12 executions across desktop Chrome and a Pixel 7 mobile profile, covering the public login and registration experience, outage messaging, password visibility, required controls, and horizontal overflow. Authenticated end-to-end workflows could not be exercised. Production dependency auditing found 16 vulnerabilities: 1 critical, 7 high, and 8 moderate. The critical finding affects the directly installed `maplibre-gl` package. CI is also inconsistent with the current implementation: the workflow provisions PostGIS/PostgreSQL while the API uses `mysql2`, MariaDB SQL, and a MySQL connection string.

This build is suitable only for developer review or controlled internal demonstrations using synthetic data. It must not process real client documents or be presented as production-ready legal verification software.

## Project and architecture summary

| Layer | Implementation |
|---|---|
| Frontend | React 18, TypeScript, Vite, MapLibre GL, Firebase client SDK |
| Backend | Node.js, Express, TypeScript, Zod, Multer, Helmet, rate limiting |
| Authentication | Local development sessions and optional Firebase Admin verification; email/SMS OTP adapters |
| Database | MariaDB 10.11 through `mysql2`; 26 canonical schema tables and 22 incremental migration files |
| Documents | Local development upload volume, SHA-256 checksums, local OCR adapter |
| Deployment | Docker Compose with MariaDB, API, Nginx-hosted web application |
| Automated tests | Node test runner through `tsx`; Playwright with desktop and mobile Chrome projects; 19 API test files, 1 web unit-test file, and 1 browser E2E file |

The server contains 99 registered HTTP routes. The checked-in OpenAPI document describes only 8 paths and is materially incomplete.

## Current execution metrics

The denominator is the 24 logical QA cases documented in `TEST_CASES.md`. The six Playwright cases execute against two browser profiles, producing 12 browser test executions.

| Metric | Result | Denominator / interpretation |
|---|---:|---|
| Total documented cases | 24 | All logical cases in this assessment |
| Passed | 13 | Successfully executed checks |
| Failed | 2 | Confirmed static/security failures |
| Blocked | 4 | Required runtime service unavailable |
| Not tested | 5 | No supported environment or automation executed |
| Pass rate among determinate executed cases | 86.7% | 13 / (13 passed + 2 failed) |
| Overall pass coverage | 54.2% | 13 / 24 total documented cases |
| Requirement coverage with a PASS result | 28.6% | 4 / 14 inferred requirements |
| Automated functional coverage | Not reliably measurable | Tests are numerous, but route-to-test coverage instrumentation is absent |

Blocked and not-tested cases are not counted as passes.

## Defect summary

| Severity | Count | Confirmed defects |
|---|---:|---|
| Critical | 1 | Production dependency audit includes a critical MapLibre XSS advisory |
| High | 2 | CI database mismatch; seven additional high dependency findings are grouped under the dependency defect |
| Medium | 2 | OpenAPI documents 8 of 99 route registrations; root/CI test command omits web tests |
| Low | 0 | None confirmed |

## Verified as working

- API TypeScript type checking.
- Web TypeScript type checking.
- API production compilation.
- Web production build: 1,603 modules transformed.
- Three frontend property-form validation tests.
- Twelve Playwright public-auth browser executions: six scenarios on desktop Chrome and six on a Pixel 7 mobile profile.
- Git branch synchronization and clean tracked working state before QA report generation.

## Failed or defective

- Production dependency security gate: 16 vulnerabilities, including 1 critical.
- CI database service and migration commands do not match the MariaDB implementation.
- API documentation is incomplete: 8 documented paths versus 99 route registrations.
- Root `npm test` runs only API tests, so the frontend unit suite is excluded from the default CI test command.

## Blocked or not tested

- API health, authentication, authorization, roles, CRUD, file upload, title-chain, spatial, report and admin runtime flows.
- Database connectivity, migrations, constraints, persistence and tenant isolation.
- Full API regression suite.
- Docker Compose deployment.
- Real email/SMS OTP delivery and production Firebase authentication.
- Authenticated browser E2E, full accessibility, load, backup/restore and penetration testing. Public authentication smoke and responsive overflow checks were completed.

## Priority actions

1. **P0:** Upgrade or replace vulnerable production dependencies. Verify the MapLibre remediation and rerun `npm audit --omit=dev`.
2. **P0:** Replace the PostGIS CI service with MariaDB 10.11, use the canonical MariaDB schema/seed, start the API, and make the complete test suite pass in CI.
3. **P1:** Start the isolated QA stack and execute all 402 API test declarations plus the web suite. Preserve complete logs.
4. **P1:** Add the frontend test command to the root/CI quality gate.
5. **P1:** Regenerate or expand OpenAPI coverage for all supported public endpoints.
6. **P1:** Test migrations `004-025` on both a clean database and a pre-upgrade snapshot.
7. **P1:** Extend the new Playwright public-auth smoke suite to authenticated property CRUD, uploads, OCR review, title chain, spatial states, reports and administration.
8. **P2:** Reduce the 1.68 MB JavaScript bundle through measured route/module splitting.

## Retest entry criteria

- Docker or equivalent MariaDB/API services are available in an isolated environment.
- No real client or production data is used.
- Critical and high dependency findings have approved fixes or documented risk acceptance.
- CI uses the same database engine and schema as the application.
- Required external test credentials are provided through a secure secret store.

## Release decision

**NOT READY FOR RELEASE.** Reassess after P0 items are fixed and the full API, database, browser, migration, security, and recovery gates execute successfully.
