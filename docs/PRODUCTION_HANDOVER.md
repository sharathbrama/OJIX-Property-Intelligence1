# Production handover (pre-deployment)

**State:** implementation handover is not complete; no production deployment has been verified. This document records the current architecture and the decisions required before operator handoff.

## Architecture and service locations

- **Frontend target:** Firebase Hosting project alias currently points to `ojix-property-intelligence`; configured public directory is `apps/web/dist` with SPA fallback. Hosting URL is not verified and must be obtained from the Firebase project after an authorized deployment.
- **Backend URL:** not selected. Current browser API base is same-origin relative and will fail under the present Hosting rewrite. Select an approved HTTPS Express host and configure frontend URL/CORS.
- **Database:** MySQL/MariaDB schema is in the repository; production database location is not configured or verified. Preserve it as the system of record pending a separate reviewed migration decision.
- **Document store:** local disk by default; optional private Supabase adapter. No production bucket is configured or verified.
- **OCR:** Python Tesseract worker in repository; requires a continuously available host and private API/database/file access. Firebase Hosting does not run it.

## Required operating configuration

See [PRODUCTION_ENVIRONMENT.md](PRODUCTION_ENVIRONMENT.md). Production requires API/database TLS and secrets, exact CORS, OTP provider credentials, Super Admin bootstrap process, private storage, worker token/languages/limits, and API URL. Do not store credentials in this handover.

## Admin setup

Provision the initial platform Super Admin only through the reviewed bootstrap flow and protected API environment. Verify membership and role via authenticated API and audit event. Remove/rotate bootstrap values after provisioning per secret-manager policy. Do not rely on demo accounts or UI-only role hiding.

## Backup and recovery

No production backup location or restore test is configured. Before launch, the data owner must select encrypted database and private document backup targets, retention/legal-hold rules, recovery point/time objectives and access owners. Perform a restore rehearsal into an isolated environment and verify document checksums and database relationships. Do not run production migrations until a fresh backup is verified and the restore procedure is known.

## Deployment and known limits

Follow [MVP_DEPLOYMENT_PLAN.md](MVP_DEPLOYMENT_PLAN.md). Deployment is blocked until an API runtime and database/storage/worker architecture are selected. Current Firebase Spark-only constraints prevent the existing backend workflows. Firebase project selection does not establish permissions, billing state or production configuration. PDF export returns 501; official RTC/source integrations are disabled/unavailable without authorization; GIS data is only as trustworthy as its source and review; no automated legal verification is provided.

## Remaining work

Resolve migration/schema consistency, select a supported runtime, configure API URL and production identity, complete private storage and OCR controls, close route/RBAC security review, implement or disable PDF, run the required test matrix, verify backups and approve a staged deployment. No code was pushed and no deployment or production DB mutation was performed for this audit.
