# OJIX Staging Release Checklist

Updated 14 November 2026. This checklist reflects repository inspection and the local checks run during the current work. A checked box means the stated item was verified; code presence alone is not a staging verification.

## Database

- [x] Loaded canonical schema and synthetic seed into a separate local MariaDB 10.4 database `ojix_property_test`; did not use XAMPP/OJIX.
- [ ] Upgrade an identified existing baseline using the reviewed migration history.
- [x] Migration runner refuses implicit baselining, checksum drift, ordering gaps, and unsafe automatic replay of historical migrations 026/034.
- [x] Forward correction 035 is present to repair only the reserved Super Admin membership and reconcile the Viewer assignment column/index.
- [x] Migration 036 adds registration onboarding state idempotently for existing schemas; canonical schema includes the same column.
- [x] Migrations 037–038 add workspace branding and explicit legal sign-off metadata; both were applied to the isolated test database after canonical baseline `canonical-v1`.
- [ ] Verify final tables, columns, indexes, constraints, and roles against the selected staging database; a full catalog comparison is still pending.
- [ ] Run a backup restore rehearsal against an isolated target.
- [ ] Reconcile the actual target schema/history before applying migrations; no staging DB was available in this work.

## Authentication and organization onboarding

- [x] Registration collects an organization name.
- [x] After email verification, one transaction creates a new organization, its first active Owner membership, account activation, and audit events.
- [x] New registrations no longer receive a membership in the shared default demo organization.
- [x] Focused unit tests cover owner provisioning, isolated organization IDs/slugs, audit creation, and invalid names.
- [ ] Verify registration and OTP delivery/expiry/invalid-code handling against staging SMTP and database.
- [ ] Verify login, logout, session expiry/revocation, and all role restrictions against staging.
- [ ] Verify separate real test organizations cannot access one another's properties, documents, reports, or findings through every API route and the frontend.

## Tenant security and authorization

- [x] Existing server-side role policy and tenant-scoped query patterns are present; focused RBAC tests passed.
- [x] Run the full database-backed API test suite against isolated MariaDB-backed API: role coverage, tenant-scoped admin listings, unauthorized token handling and assigned-matter scopes passed.
- [ ] Complete explicit two-organization property, document download, report mutation, and audit IDOR matrix, including storage object access.
- [ ] Verify frontend behavior in a browser against the same staging API.
- [ ] Review production session storage, cookies/CSRF posture, and runtime identity configuration.

## Documents and OCR

- [x] Existing storage adapters include private GCS operations, opaque tenant-scoped keys, checksums, short-lived signed reads, and scoped API reads.
- [x] Focused document storage tests passed, including GCS adapter behavior using a test client.
- [ ] Configure and verify a private bucket, public access prevention, IAM, retention, and deletion policy.
- [ ] Add/verify malware quarantine and scanner behavior; no active scanner is evidenced.
- [ ] Verify storage backup/restore and checksum recovery.
- [ ] Run a real OCR sample through upload, job pickup, extraction persistence, retry, and recovery in an isolated environment. No document was run through OCR in this pass.
- [ ] Validate OCR quality on an approved representative corpus. Google Document AI activation remains unverified; Tesseract is the implemented worker path.

## Analysis and source evidence

- [x] Focused deterministic RBAC, migration, storage, risk, GIS, and extraction checks are present in the repository.
- [ ] Verify title chain, discrepancy, evidence, risk, and reviewer decision persistence end to end in a database-backed environment.
- [ ] Add/verify licensed and authorized GIS datasets with vintage, CRS, source and known cases. Until then GIS must remain unavailable/unknown where no verified layer exists.
- [ ] Configure authorized government connectors, if access is granted; portal reachability is not proof of a data connector.
- [ ] Verify legal research citations and source traceability with approved source material.

## Reports and review

- [x] JSON and Word-editable report exports are implemented in code.
- [x] Implement a real Chromium PDF renderer and verify actual PDF text/content with `pdftotext` in a local test.
- [ ] Verify approved-report PDF route, download, reviewer/sign-off metadata, and audit in staging.
- [ ] Verify immutable report snapshots, evidence links, reviewer identity, timestamp, sign-off history, and export audit in staging.

## Deployment and operations

- [x] Firebase Hosting API rewrite now targets `ojix-api` in `asia-south1`, matching the checked-in Cloud Run service/worker naming and region hints.
- [ ] Verify the Cloud Run service exists and that Firebase Hosting routes `/api/**` to it.
- [ ] Resolve Cloud Run template inputs: image tags, VPC/subnet, runtime service accounts, database/SMTP/OCR secrets, bucket, and CA secret.
- [ ] Configure environment variables, secret access, CORS, ingress, TLS, scaling and rollback.
- [ ] Deploy API, frontend and OCR worker to staging; verify health/readiness and end-to-end frontend/API connectivity.
- [ ] Verify logging, alerting, backup schedule, recovery objectives and operational runbooks.

## Test results recorded during this work

- `npm run typecheck`: passed.
- `npm run build`: passed. Vite emitted a non-blocking large JavaScript chunk warning (about 1.87 MB before gzip).
- Focused tests: 31/31 passed across migration, RBAC, storage and organization onboarding test files.
- Managed full API suite: **522 passed, 0 failed** via `npm test -w apps/api` with explicit `TEST_DATABASE_URL` pointing to the isolated loopback MariaDB test database. The managed runner starts the API, checks readiness, runs all test files serially, and tears it down; it cannot fall back to a developer database.
- Canonical schema and synthetic fixtures loaded successfully. Migration runner reported canonical baseline `canonical-v1`, then migrations 037–038 were applied to the isolated database. This did not replay all historical migration SQL. Prior-version upgrade rehearsal, full catalog comparison, and restore rehearsal remain unchecked.
- Local Chromium renderer produced readable PDF text. No staging deployment, external SMTP OTP, OCR worker sample, or full browser workflow was verified.
- Python worker unit tests could not start in the local Python environment because the declared `mysql-connector-python` dependency is not installed (`ModuleNotFoundError: mysql`). No OCR sample was run.
- Earlier Docker/MySQL initialization attempts failed, but an isolated MariaDB 10.4 instance was subsequently initialized in `/tmp`; no existing XAMPP/OJIX database was used.

## Release gate

**Current decision: NOT READY FOR CLIENT TESTING.** Do not invite clients until the unchecked critical upgrade/restore, explicit tenant IDOR, staging authentication, private storage/IAM, OCR, end-to-end workflow, malware scan, and deployment checks are completed in staging.
