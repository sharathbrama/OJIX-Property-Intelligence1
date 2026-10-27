# OJIX Property Intelligence - Test Cases and Results

**Execution date:** 27 October 2026  
**Revision:** `bc0508b`

## Execution summary

| Status | Count |
|---|---:|
| PASS | 7 |
| FAIL | 2 |
| BLOCKED | 4 |
| NOT TESTED | 5 |
| Total | 18 |

## Detailed cases

### TC-QA-001 - Repository release integrity

- **Scenario:** Verify the local release matches the shared branch.
- **Preconditions:** Git repository and remote available.
- **Steps:** Check current branch, status, local revision and `origin/main`.
- **Test data:** Repository metadata only.
- **Expected:** Local `main` synchronized with `origin/main`; no uncommitted application changes before report generation.
- **Actual:** Revision synchronized before QA artifacts were created.
- **Status:** PASS
- **Bug:** None

### TC-QA-002 - API TypeScript validation

- **Scenario:** Compile-check backend source without emitting files.
- **Preconditions:** Dependencies installed.
- **Steps:** Run `npm run typecheck -w apps/api` through the root type-check command.
- **Expected:** Exit code 0.
- **Actual:** Exit code 0.
- **Status:** PASS

### TC-QA-003 - Web TypeScript validation

- **Scenario:** Compile-check frontend source without emitting files.
- **Preconditions:** Dependencies installed.
- **Steps:** Run `npm run typecheck -w apps/web` through the root type-check command.
- **Expected:** Exit code 0.
- **Actual:** Exit code 0.
- **Status:** PASS

### TC-QA-004 - Frontend property-form validation

- **Scenario:** Execute available automated frontend validation cases.
- **Preconditions:** Dependencies installed; temporary test IPC permitted.
- **Steps:** Run `npm run test -w apps/web`.
- **Test data:** Whitespace-only values, valid agricultural data, incomplete non-agricultural identifiers.
- **Expected:** Invalid cases rejected; valid case accepted.
- **Actual:** 3 passed, 0 failed.
- **Status:** PASS

### TC-QA-005 - API production compilation

- **Scenario:** Build backend production JavaScript.
- **Steps:** Run `npm run build -w apps/api` through the root build.
- **Expected:** Exit code 0.
- **Actual:** Exit code 0.
- **Status:** PASS

### TC-QA-006 - Web production build

- **Scenario:** Build optimized frontend assets.
- **Steps:** Run `npm run build -w apps/web` through the root build.
- **Expected:** Exit code 0 with deployable assets.
- **Actual:** PASS; 1,603 modules transformed. Main JS 1,680.35 KB before gzip and 442.38 KB gzip. Vite emitted a chunk-size warning.
- **Status:** PASS

### TC-QA-007 - Production dependency security audit

- **Scenario:** Audit installed production dependencies against current npm advisories.
- **Steps:** Run `npm audit --omit=dev --json` with registry access.
- **Expected:** No critical or high vulnerabilities.
- **Actual:** 16 vulnerabilities: 1 critical, 7 high, 8 moderate.
- **Status:** FAIL
- **Bug:** BUG-001

### TC-QA-008 - CI/database implementation alignment

- **Scenario:** Verify CI provisions the database used by the application.
- **Steps:** Compare `.github/workflows/ci.yml`, `docker-compose.yml`, API dependencies and canonical schema.
- **Expected:** CI and runtime use the same supported database engine and migration path.
- **Actual:** CI provisions PostGIS/PostgreSQL and calls `psql`; runtime uses MariaDB 10.11, `mysql2`, and MySQL SQL.
- **Status:** FAIL
- **Bug:** BUG-002

### TC-QA-009 - API health endpoint

- **Scenario:** Verify the API and database health response.
- **Preconditions:** API and MariaDB running.
- **Steps:** Request `/health` on ports 4000 and 4001.
- **Expected:** HTTP 200 with connected database status.
- **Actual:** No listener on either port.
- **Status:** BLOCKED

### TC-QA-010 - Database connectivity

- **Scenario:** Verify MariaDB accepts application connections.
- **Preconditions:** Isolated MariaDB running.
- **Steps:** Check listeners and application health.
- **Expected:** Database available on configured endpoint.
- **Actual:** No listeners on ports 3306 or 3307.
- **Status:** BLOCKED

### TC-QA-011 - Full API regression suite

- **Scenario:** Execute all API tests.
- **Preconditions:** MariaDB and API available with isolated test data.
- **Steps:** Run `npm test`.
- **Expected:** All tests pass.
- **Actual:** Suite launched in an earlier current-release run, but database/API-dependent cases returned `ECONNREFUSED`.
- **Status:** BLOCKED

### TC-QA-012 - Docker Compose deployment

- **Scenario:** Build and start DB, API and web services.
- **Preconditions:** Docker daemon running.
- **Steps:** Query `docker compose ps`; if available, start and verify health checks.
- **Expected:** Three healthy services.
- **Actual:** Docker daemon unavailable.
- **Status:** BLOCKED

### TC-QA-013 - Authentication and OTP E2E

- **Scenario:** Registration, verification, login, logout, password change, OTP expiry/reuse/rate limit.
- **Preconditions:** DB/API/web plus safe Resend/Twilio/Firebase test configuration.
- **Expected:** Secure positive and negative behavior with audit evidence.
- **Actual:** Not executed; external and runtime prerequisites unavailable.
- **Status:** NOT TESTED

### TC-QA-014 - Role and tenant authorization E2E

- **Scenario:** Verify Owner, Admin, Lawyer, Analyst, Operations, Consultant, Support, Data Steward and Viewer boundaries.
- **Preconditions:** Seeded isolated environment.
- **Expected:** Least privilege and tenant isolation.
- **Actual:** Not executed at runtime.
- **Status:** NOT TESTED

### TC-QA-015 - Property/document/report workflow E2E

- **Scenario:** Property CRUD, search, upload, OCR review, title chain, spatial state and report generation.
- **Preconditions:** Full isolated stack and fixture files.
- **Expected:** Persistent, authorized, correctly validated workflow.
- **Actual:** Not executed.
- **Status:** NOT TESTED

### TC-QA-016 - Responsive browser and accessibility

- **Scenario:** Desktop, tablet, mobile, keyboard and screen-reader basics.
- **Preconditions:** Running web application and supported browsers.
- **Expected:** No blocking layout or accessibility failures.
- **Actual:** Not executed.
- **Status:** NOT TESTED

### TC-QA-017 - Database migration and persistence

- **Scenario:** Apply migrations `004-025` to clean and prior-release databases; verify constraints and persistence.
- **Preconditions:** Isolated databases and recoverable snapshots.
- **Expected:** Successful forward upgrade without data loss.
- **Actual:** Not executed.
- **Status:** NOT TESTED

### TC-QA-018 - API documentation coverage

- **Scenario:** Compare implemented routes with documented OpenAPI paths.
- **Steps:** Count Express route registrations and OpenAPI path keys.
- **Expected:** All supported public routes documented.
- **Actual:** 99 registered routes and 8 documented paths.
- **Status:** PASS as an inspection; coverage gap recorded as BUG-003.

## Proposed automated regression additions

- Add a root `test:web` command and include it in CI.
- Add browser E2E for authentication, property creation, upload, review and report export.
- Add schema migration tests for clean install and sequential upgrade.
- Add OpenAPI-versus-route coverage validation.
- Add dependency audit or an equivalent policy-controlled security scanner to CI.
- Add bundle-size budgets and accessibility smoke tests.
