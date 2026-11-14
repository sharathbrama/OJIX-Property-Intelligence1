# OJIX Final Project Status

Updated 14 November 2026. This is a repository and local validation status, not a staging deployment report.

## Development

OJIX is an existing, substantially implemented property intelligence application. The repository contains property and matter workflows, document upload and storage adapters, OCR worker code, title and discrepancy processing, GIS screening logic, risk analysis, legal research surfaces, report exports, role-based authorization, migration tooling, and deployment templates.

## Critical Fixes

- Registration now asks for an organization name.
- Email verification now provisions a distinct organization and first active Owner membership in one database transaction and records onboarding audit events.
- Registration no longer assigns new users to the shared demo organization.
- Added migration 036 for the pending organization name; it is safe against the canonical schema already containing that column.
- Merged firm branding/report fields as migration 037 and explicit legal sign-off metadata as migration 038, avoiding duplicate historical migration IDs.
- Workspace settings validate and persist organization/report branding. Property workflow sign-off is restricted to the assigned Lawyer and records reviewer identity/time; report status alone no longer claims legal sign-off.
- Password-only sign-in remains disabled. The Keerthana branch's MFA-off/password-only path and embedded demo-password fallbacks were not merged because they would weaken the existing authentication policy.
- Firebase Hosting's `/api/**` rewrite now uses the repository's configured API service name and region.
- Existing safeguards remain: migration 035 repairs only the reserved Super Admin membership and Viewer assignment schema; the migration runner blocks ambiguous historical replay.

These code changes have not been applied to an external or staging database.

## Testing

- `npm run typecheck`: **passed** after final harness edits.
- `npm run build`: **passed** after final harness edits. The frontend build reports a non-blocking large-chunk warning (about 1.87 MB before gzip).
- Managed full API suite: **522 passed, 0 failed**, using `npm test -w apps/api` with `TEST_DATABASE_URL` pointed to a dedicated loopback MariaDB 10.4 database `ojix_property_test`, never the XAMPP/OJIX database. This exercised database-backed route tests, role/tenant scoping, onboarding provisioning coverage, migration runner checks, storage adapter tests, source reachability, and Chromium/PDFKit report generation.
- Test runner now requires an explicit loopback-only disposable DB URL with a test-like database name, starts a managed API instance, checks readiness, and cleans up. It does not fall back to `DATABASE_URL`.
- The isolated schema was loaded from `database/mysql-schema.sql` plus synthetic `infra/db/seed.sql` fixtures. The migration runner reported baseline `canonical-v1`, then applied migrations 037–038 to that isolated schema. It did not replay every historical migration from an empty schema. Prior-version upgrade rehearsal, backup restore, and full catalog comparison remain unverified.

## Security

Server-side RBAC and route integration checks passed, including role-specific access and tenant-scoped list routes. Storage adapter tests passed with local/mock GCS clients. The suite does not establish the full requested two-organization property/document/report/audit IDOR matrix with private-object download through deployed IAM; that remains a staging security gate. Staging login/OTP, deployed IAM, malware scanning, and full security review remain unverified.

The branch's configurable password-only sign-in behavior was excluded. The application continues to return HTTP 410 for password-only login and uses the existing OTP flow. The UI does not expose an MFA-off toggle that cannot be enforced safely end to end.

## Database

The repository includes canonical schema, guarded migration tooling, migrations 035–038, and schema-aligned firm/report/sign-off fields. A separate local MariaDB 10.4 instance and `ojix_property_test` schema were used without touching XAMPP/OJIX. Canonical schema and synthetic seed loaded successfully; migrations 037–038 were actually applied to the isolated database after baseline `canonical-v1`. Historical migrations were not replayed because the runner explicitly baselines a canonical fresh install. A prior-version upgrade rehearsal, final catalog comparison, and backup restore remain **not verified**. Existing migration history still needs reconciliation before applying to a real target.

## Deployment

No staging deployment was performed. Firebase Hosting now routes to `ojix-api` in `asia-south1`, based on repository deployment configuration. Cloud Run templates still require actual image, network, runtime identity, secrets, storage and CA configuration. No cloud resources, database, SMTP account, or storage bucket were configured or accessed.

## Reports and OCR

- PDF endpoint no longer returns 501: approved-report export uses the bounded Chromium renderer; the merged report generator also has a PDFKit fallback. Chromium and PDFKit tests passed, including a multi-page render. Local PDF readability was verified; approved-report export and reviewer audit still need staging verification.
- OCR remains an implemented Tesseract worker path, but no representative PDF/image was processed through the worker and persisted via queue in this pass. OCR quality, upload-to-job integration, and retry remain unverified.
- Worker unit tests were not runnable in the local Python environment because `mysql-connector-python` is not installed (`ModuleNotFoundError: mysql`); the container installs the declared requirements. No OCR output was fabricated.
- No active malware scanner/quarantine service is configured or verified.

## Post-Deployment Verification

Not run: there is no verified staging URL or deployed API/worker/database. The local suite tested portions of tenant routing, onboarding provisioning logic, storage adapters, and PDF rendering, but not the full staging workflow. No claim is made for deployed registration, OTP, storage IAM, OCR, GIS, reviewer sign-off, or cross-tenant behavior in staging.

## Remaining External Dependencies

- Cloud project/service access, billing approval, Cloud SQL target and migration history, Cloud Run runtime identities, secrets and network configuration.
- Private GCS bucket, IAM policy, retention/backup and restore configuration.
- SMTP provider credentials and a controlled inbox for OTP tests.
- Approved GIS datasets, source licenses/permissions, vintages and known validation properties.
- Representative approved OCR corpus; Google Document AI credentials if that provider is selected.

## Known Limitations

- PDF export has Chromium and PDFKit rendering paths; report approval, route download, and reviewer audit remain unverified in staging.
- No active malware scanner/quarantine path is verified.
- Tesseract OCR worker code exists; deployed processing and quality are unverified.
- Government portal reachability is not a government record connector. No authorized live connector is established.
- GIS framework is present, but there is no approved live GIS dataset verified here.
- Staging runtime, monitoring, backups and recovery have not been verified.

## Client UAT

**NOT READY FOR CLIENT TESTING.** Critical upgrade/restore database, staging registration and OTP, full tenant IDOR matrix, private object IAM, actual OCR processing, malware quarantine, end-to-end workflow, and deployment checks remain unverified. Use `STAGING_RELEASE_CHECKLIST.md` as the gate. A client-facing UAT guide should be issued after the staging workflow has passed.

## Final Decision

### NOT READY FOR CLIENT TESTING

This decision reflects actual validation evidence, not the amount of code in the repository.
