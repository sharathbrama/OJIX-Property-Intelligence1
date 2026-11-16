# OJIX Team Staging and Test Handoff

**Purpose:** give the engineering team a repeatable way to run OJIX locally, prepare a staging deployment, and record test evidence. This is a staging handoff, not approval to deploy production or handle real client documents.

## Current handoff state

- Last shared merge commit: `5314cd3` on `main`, `sharath`, and `keerthana`.
- API typecheck/build and full API suite passed on that commit; the suite reported **522 passed, 0 failed** against an isolated local MariaDB test database.
- Firebase Hosting is configured to rewrite `/api/**` to Cloud Run service `ojix-api` in `asia-south1`. `.firebaserc` currently defaults to `ojix-property-intelligence`; do not deploy against that default as a staging target.
- No staging URL, staging cloud resources, staging database, SMTP inbox, private bucket, runtime secrets, or OCR worker deployment have been verified. The team must supply these before external staging can work.
- Before distributing a later build, confirm its exact Git commit and that the working tree is clean; send the commit SHA with the staging URL so the team tests a known version.

## Option A: team runs the complete synthetic local stack

Requirements: Git, Node.js 22.12+, npm, and Docker Desktop/Engine with Compose.

```bash
git clone <approved-repository-url>
cd OJIX-NonLetigation-Law-inteligence
npm ci
docker compose up --build -d
```

Open `http://localhost:8080`. The Compose stack starts the web app, API, MariaDB, and OCR worker. API health endpoints are:

```bash
curl -fsS http://localhost:4001/healthz
curl -fsS http://localhost:4001/readyz
```

Use only synthetic or redacted test files. The seed data and map features are illustrative. Login/registration OTP requires the team’s approved SMTP test inbox and server-side configuration; never share plaintext passwords or put credentials in Git. Stop the stack with `docker compose down`. `docker compose down -v` deletes the local database and uploaded-file volumes.

## Local code verification

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run build
npm test -w apps/api
```

The API test runner requires an explicitly configured, disposable loopback MariaDB database with a test-like database name. Follow the runner error and team test-database setup; do not point `TEST_DATABASE_URL` at staging or a developer’s regular database. The Python worker test needs the dependencies in `apps/api/worker/requirements.txt` installed in an isolated virtual environment before running `python -m unittest -v test_worker.py` from `apps/api/worker`.

## Option B: deploy an external staging environment

An infrastructure owner must first provide an **isolated staging** cloud project and Firebase site, Cloud Run API service, MySQL-compatible database, private document bucket, worker runtime, SMTP test inbox, runtime identities, and secret-manager entries. These are not currently supplied by this repository. Provisioning Cloud Run, Cloud SQL, Artifact Registry, networking, a private bucket, or a continuously running worker may incur charges.

Before the first deployment:

1. Select one release branch and commit. Confirm all intended UI changes are committed and pushed; record the commit SHA for the test report.
2. Obtain a staging Firebase project/site distinct from production. Do not use the checked-in default Firebase project without explicit owner approval.
3. Set up API and OCR worker identities with least privilege, private database connectivity, private bucket access, Secret Manager access, HTTPS, logging, alerting, and budget limits.
4. Configure server-only secrets outside Git: `DATABASE_URL`, TLS CA configuration, SMTP credentials, `OCR_WORKER_TOKEN`, and GCS bucket settings. Set exact `CORS_ORIGIN` to the staging browser origin. Never put these secrets in `VITE_*` variables.
5. Back up the staging database, inspect its actual schema/migration history, restore-test the backup, and rehearse any needed migration against a disposable copy. Do not run all historical migrations blindly or apply migrations to production.
6. Build immutable API and worker images, record their digests, deploy to staging, and confirm API `/healthz` and `/readyz` before routing frontend traffic.
7. Build the web app for staging with the approved HTTPS API configuration or verified same-origin Hosting rewrite. Confirm the `/api/**` rewrite reaches the API and returns JSON, not the SPA HTML fallback.
8. Deploy Hosting to the **staging Firebase project only** after checking the active project and reviewing the target. Keep production deploys separate.

The manifests under `apps/api/cloudrun.service.yaml` and `apps/api/worker/cloudrun.worker-pool.yaml` are templates with `REPLACE_*` values. Fill and review them for the staging environment before applying. They are not turnkey deployment files. See `docs/CLOUD_RUN_PRODUCTION_PREPARATION.md` and `docs/PRODUCTION_ENVIRONMENT.md` for the configuration inventory and cloud-specific details.

### Temporary read-only public demo

The login page’s **Launch Instant Demo Access (Admin)** button obtains an eight-hour (configurable, maximum eight-hour) read-only demo session from the API. The session uses the seeded Viewer identity in a separate synthetic-only database and receives a narrowly scoped read permission set. Writes, uploads, user management, workspace administration and external report sharing remain blocked. The demo API is intentionally separate from the production API and database.

1. Create a dedicated database named `ojix_property_demo`, a database credential granted access only to that database (prefer a separate demo database instance), and a private document bucket used only by the demo service. Do not reuse production database credentials, storage buckets, SMTP, or OCR worker credentials.
2. Initialize only that database with `database/mysql-schema.sql`, `infra/db/seed.sql`, and `database/seeds/public-demo.sql`, in that order. The seed includes illustrative property/map data and removes the seeded Super Admin membership from the demo tenant.
3. Deploy the API from `apps/api/cloudrun.demo.service.yaml` as a separate Cloud Run service. Fill in its `REPLACE_*` values with demo-only infrastructure. The `DATABASE_URL` secret must target database `ojix_property_demo`; the server checks that it matches `PUBLIC_DEMO_DATABASE_NAME` and refuses to expose demo login on a production-named database. The demo bucket must be private and owned by the demo service account.
4. Keep the demo service’s SMTP, Twilio, OCR worker and external report-sharing integrations unset. OTP, registration, password recovery and credential-changing API routes are disabled in the public demo service. Uploaded documents are stored in the dedicated demo bucket and streamed only through authenticated API routes; demo report sharing is blocked.
5. Set `VITE_API_BASE_URL` on Vercel to the demo API’s HTTPS origin, and set the API’s `CORS_ORIGIN` to the exact Vercel site origin. Configure API routing so `/api/**` reaches the demo API. Do not point the production frontend/API configuration at this demo database.
6. Optionally set `PUBLIC_DEMO_SESSION_TTL_HOURS` to a whole number from 1 to 8; the default is 8. Confirm `GET /api/auth/demo/status` returns `enabled: true` and `defaultRole: "viewer"`, then use the login button and verify the persistent DEMO MODE countdown and Exit Demo control.
7. Confirm the demo Viewer can read dashboard, properties, documents, findings, legal review and report data; cannot create, edit, delete, upload, manage users or access admin endpoints; cannot request an OTP, register an account, reset a password or share a report; and cannot use the demo token with a different tenant ID. Verify expiry and logout revoke the session.

The existing login, registration, OTP and password reset paths remain enabled on the normal production API. `LOCAL_TEST_LOGIN_BYPASS` remains development-only and is not used by this feature.

## Staging smoke test and team test plan

Record pass/fail, tester, timestamp, environment, and a screenshot or redacted log for each item:

1. Check frontend loads over HTTPS; `/healthz` and `/readyz` succeed; frontend API calls reach the staging API.
2. Register a test organization and account; confirm OTP email arrives, invalid/expired codes fail, and successful verification creates a distinct Owner workspace.
3. Sign in/out; check expired/revoked sessions and the role dashboard. Verify that a user cannot open a page or perform an action outside assigned permissions.
4. Create a synthetic property, upload a harmless redacted document, verify checksum and processing status, and confirm an unrelated organization cannot read or download it.
5. Exercise review/findings, explicit assigned-Lawyer sign-off, report export, audit history, and PDF readability. Confirm status alone does not imply legal approval.
6. Process one approved synthetic OCR sample end-to-end; inspect extracted text manually, retry behavior, worker health, and failure logs. Never present OCR output as a verified legal fact.
7. Check private object access, signed-link expiry, upload limits, denied cross-tenant requests, database backup and isolated restore, logs, and budget alerts.
8. Capture bugs with URL/page, assigned role, steps, expected/actual behavior, browser/console errors, and request correlation ID. Redact tokens, OTPs, credentials, and personal documents.

Track outstanding release items in `docs/STAGING_RELEASE_CHECKLIST.md`. Current repository evidence does **not** establish a production-ready or client-document-ready deployment. Do not invite clients or upload real property documents until the security, storage, migration, backup/restore, malware-scanning, OCR, and end-to-end staging gates have been reviewed and signed off by the responsible owners.

## Test handback

The team should return:

- exact commit SHA and staging URLs (frontend/API), with no credentials;
- completed smoke-test matrix and checklist, including failures and evidence links;
- browser/device and role used for each bug;
- database migration and restore evidence;
- service health, OTP, storage/IAM, OCR queue and report-export observations;
- named release owner’s decision: ready for limited client UAT, blocked with issues, or rejected.
