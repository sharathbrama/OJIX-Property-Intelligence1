# OJIX Team Staging and Test Handoff

**Purpose:** give the engineering team a repeatable way to run OJIX locally, prepare a staging deployment, and record test evidence. This is a staging handoff, not approval to deploy production or handle real client documents.

## Current handoff state

- Last shared merge commit: `5314cd3` on `main`, `sharath`, and `keerthana`.
- API typecheck/build and full API suite passed on that commit; the suite reported **522 passed, 0 failed** against an isolated local MariaDB test database.
- Firebase Hosting is configured to rewrite `/api/**` to Cloud Run service `ojix-api` in `asia-south1`. `.firebaserc` currently defaults to `ojix-property-intelligence`; do not deploy against that default as a staging target.
- No staging URL, staging cloud resources, staging database, SMTP inbox, private bucket, runtime secrets, or OCR worker deployment have been verified. The team must supply these before external staging can work.
- Before distributing a later build, confirm its exact Git commit and that the working tree is clean; send the commit SHA with the staging URL so the team tests a known version.

## Option A: team runs the complete synthetic local stack

Requirements: Git, Node.js 20+, npm, and Docker Desktop/Engine with Compose.

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
