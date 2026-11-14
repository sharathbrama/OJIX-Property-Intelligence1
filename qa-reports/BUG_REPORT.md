# OJIX Property Intelligence - Bug Report

**Assessment date:** 27 October 2026  
**Revision:** `bc0508b`

## Confirmed defects

### BUG-001 - Critical and high production dependency vulnerabilities

- **Module:** Dependency security / frontend and backend supply chain
- **Title:** Production dependency audit reports 1 critical, 7 high and 8 moderate vulnerabilities
- **Preconditions:** Installed lockfile dependencies and npm advisory access.
- **Steps to reproduce:**
  1. From the repository root, run `npm audit --omit=dev --json`.
  2. Inspect `metadata.vulnerabilities` and package entries.
- **Expected:** No critical or high vulnerabilities in production dependencies.
- **Actual:** 16 findings: 1 critical, 7 high and 8 moderate. The critical advisory affects directly installed `maplibre-gl` and concerns an XSS sanitizer bypass. High findings include Firebase/grpc, body-parser and Zod dependency paths.
- **Severity:** Critical
- **Priority:** P0
- **Evidence:** Audit exit code 1; metadata totals above; advisory `GHSA-jrc7-96c5-q579` for MapLibre.
- **Recommended fix:** Review application use of affected packages, upgrade to supported patched releases in a controlled branch, run type/build/unit/E2E regression, and rerun the audit. Do not use `npm audit fix --force` without compatibility review.
- **Status:** Open

### BUG-002 - CI provisions the wrong database engine

- **Module:** CI/CD and database integration
- **Title:** GitHub Actions uses PostGIS/PostgreSQL while the current application uses MariaDB/MySQL
- **Preconditions:** Current repository revision.
- **Steps to reproduce:**
  1. Open `.github/workflows/ci.yml`.
  2. Observe the PostGIS 16 service, PostgreSQL connection string and `psql` schema commands.
  3. Compare with `docker-compose.yml`, `apps/api/package.json`, `database/mysql-schema.sql` and the `mysql2` dependency.
- **Expected:** CI runs the same database engine, schema and seed path used by the application.
- **Actual:** CI and runtime database contracts differ materially.
- **Severity:** High
- **Priority:** P0
- **Evidence:** Static configuration comparison.
- **Recommended fix:** Replace the PostGIS service with MariaDB 10.11, initialize `database/mysql-schema.sql` and `infra/db/seed.sql`, use a MySQL connection string, start the API before HTTP tests, and verify all tests in CI.
- **Status:** Open

### BUG-003 - OpenAPI specification omits most implemented routes

- **Module:** API documentation
- **Title:** OpenAPI documents 8 paths while the Express server registers 99 routes
- **Preconditions:** Current repository revision.
- **Steps to reproduce:**
  1. Count `app.get/post/patch/delete` registrations in `apps/api/src/server.ts`.
  2. Count path keys in `docs/openapi.yaml`.
- **Expected:** Every supported public endpoint has an accurate method, security, request and response contract.
- **Actual:** 99 route registrations versus 8 OpenAPI paths.
- **Severity:** Medium
- **Priority:** P1
- **Evidence:** Static counts from `rg`.
- **Recommended fix:** Generate or maintain a complete OpenAPI contract and add CI validation for drift.
- **Status:** Open

### BUG-004 - Default test command excludes frontend tests

- **Module:** Test automation / CI
- **Title:** Root `npm test` runs only the API workspace
- **Preconditions:** Current package scripts.
- **Steps to reproduce:**
  1. Inspect root `package.json`.
  2. Observe `test: npm run test -w apps/api`.
  3. Observe `apps/web/package.json` has its own test command.
- **Expected:** The default CI test gate executes all maintained application test suites.
- **Actual:** Web tests are excluded unless run separately.
- **Severity:** Medium
- **Priority:** P1
- **Evidence:** Package script comparison and CI use of root `npm test`.
- **Recommended fix:** Add a root command that runs API and web suites and use it in CI.
- **Status:** Open

## Suspected issues and risks requiring runtime confirmation

These are not confirmed product bugs:

- Database migrations `019-025` may fail or alter existing account data unexpectedly; no upgrade test was executed.
- Email/SMS OTP failure, expiry, reuse and rate-limit behavior is unverified with real adapters.
- Authorization and tenant isolation may regress in current code; relevant runtime tests were blocked.
- The 1.68 MB JavaScript bundle may cause poor performance on lower-end devices or slow networks; no performance threshold was supplied.
- Local OCR accuracy for Kannada and English property documents is unmeasured.
- PDF generation intentionally returns a not-configured response where a renderer is unavailable; production expectations require product confirmation.

## Environment blockers, not bugs

- Docker daemon unavailable.
- No database listener on ports 3306 or 3307.
- No API listener on ports 4000 or 4001.
- Real Firebase, Resend, Twilio, government portal and licensed GIS credentials were not supplied.
