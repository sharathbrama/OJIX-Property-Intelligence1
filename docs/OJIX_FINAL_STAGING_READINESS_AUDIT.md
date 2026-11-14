# OJIX Property Intelligence — Final Staging Readiness Audit

**Audit date:** 13 November 2026  
**Scope:** Repository and deployment-configuration inspection. This is an audit of staging readiness, not a production validation.  
**Recommendation: NO-GO for staging deployment** until the critical blockers below are closed.

## Scope and evidence limits

The audit reviewed the repository's API, web client, storage adapters, worker, canonical schema and migration files, deployment templates, Firebase Hosting configuration, and existing readiness/migration reports. No cloud console, deployed service, secret manager, external database, or production system was accessed. No deployment, resource creation, paid-service enablement, migration, test suite, or build was run. Repository tests and previous reports are not treated as proof of current staging behavior. Files already modified or untracked before this audit were left untouched; this report is the only file created for the audit.

**Status meanings:** **PASSED** means the stated static check is evidenced in the repository. It does not imply a live staging check. **FAILED** means a known configuration or implementation defect prevents readiness. **UNVERIFIED** means evidence requires execution, external configuration, or a deeper review that was outside this audit.

## Check results

| Area / check | Status | Finding and evidence |
|---|---|---|
| GCS adapter implementation | **PASSED** | `apps/api/src/document-storage.ts` includes GCS upload, provider-qualified keys, generation-match create-only writes, private/no-store object metadata, V4 signed reads capped at 900 seconds, API-side object reads, deletion, and provider routing. This establishes code presence only. |
| GCS staging bucket and IAM | **UNVERIFIED** | No bucket, uniform bucket-level access, public-access prevention, encryption/retention policy, runtime identity, least-privilege IAM, or signed-URL behavior was inspected in a live project. `GCS_BUCKET` and service identity remain deployment inputs. |
| Legacy/local storage safety | **FAILED** | Local storage is the default in `.env.example`; the app's local adapter is not durable on ephemeral Cloud Run instances. Staging must explicitly select and verify durable private storage before accepting documents. |
| Supabase compatibility | **PASSED** | A server-side Supabase Storage adapter remains implemented with HTTPS URL validation, service-role authorization, private signed URL flow, reads, and deletes; GCS routing can coexist with prior provider keys. |
| Supabase configuration and policy | **UNVERIFIED** | No Supabase project, private bucket policy, service-role secret injection, retention, or live upload/read/delete was verified. Compatibility does not establish staging configuration. |
| Cloud SQL / MySQL connection configuration | **PASSED** | API and worker contain MySQL-compatible database connection code and optional TLS configuration. The Cloud Run API template sets `DATABASE_SSL=true`; both templates reference a CA file. |
| Database TLS effectiveness | **UNVERIFIED** | No Cloud SQL instance, CA, DNS/host identity, network path, or TLS handshake was verified. API enables certificate verification; actual trust and hostname behavior depend on target and driver settings. Worker explicitly enables certificate and identity validation when TLS is on. |
| Database target, schema, and migration readiness | **FAILED** | No staging DB target/history was verified; there is no migration runner/ledger. Existing `docs/DATABASE_MIGRATION_REHEARSAL.md` reports a reconstructed-baseline rehearsal, three API role failures after migration 026, migration 034/canonical index drift, and no backup/restore rehearsal. Production/staging schema provenance is unresolved; do not apply migrations blindly. |
| Python OCR implementation | **PASSED** | `apps/api/worker/worker.py` implements job claiming, leases/heartbeats, bounded retries, API-mediated document retrieval, Tesseract OCR and result callbacks. Dockerfile installs Poppler and Kannada/English Tesseract assets. |
| OCR worker deployment/readiness | **UNVERIFIED** | Worker-pool YAML is a placeholder template with unresolved image/network/service-account/API URL fields. No worker was deployed or run; queue connectivity, scaling, monitoring, failure recovery, OCR quality and private access are not verified. |
| Cloud Run API configuration | **FAILED** | `apps/api/cloudrun.service.yaml` is explicitly a template with `REPLACE_*` image, network, identity, secret, bucket and origin values. It is not deployable as committed. Cloud Run service existence, ingress/IAM, health probes, capacity and secrets were not verified. |
| Cloud Run worker configuration | **FAILED** | `apps/api/worker/cloudrun.worker-pool.yaml` contains unresolved placeholders and hard-coded staging secret names whose existence is unverified. It does not establish a runnable staging worker. |
| Firebase Hosting static configuration | **PASSED** | `firebase.json` defines `apps/web/dist`, security headers, asset caching, and orders `/api/**` before the SPA fallback. |
| Firebase API routing | **FAILED — critical** | The `/api/**` rewrite still targets `REPLACE_WITH_CLOUD_RUN_SERVICE_NAME` and `REPLACE_WITH_CLOUD_RUN_REGION`. `apps/web/src/apiConfig.ts` defaults to an empty same-origin base, so client API calls depend on this broken/unresolved rewrite. Current checked-in configuration cannot route API traffic to a real service. |
| Hosting build artifact and project | **UNVERIFIED** | No web build was run and no Firebase deployment/site was inspected. `.firebaserc` only names a project alias; it does not prove project access, enabled services, hosting site, billing, or readiness. |
| Authentication mechanism | **PASSED** | Server-side OTP/session auth and optional Firebase Admin token verification are present; the development identity header is rejected in production. Frontend login calls API OTP endpoints. |
| Authentication staging integration | **UNVERIFIED** | No identity provider, SMTP/SMS delivery, Firebase project, token/session lifecycle, bootstrap account, or recovery flow was configured or exercised. `FIREBASE_PROJECT_ID` alone does not wire Firebase web sign-in; the existing UI uses API OTP sessions. |
| RBAC and tenant isolation controls | **PASSED** | Static implementation shows active-membership validation, workspace selection checks, role permission evaluation, tenant-filtered queries, tenant-bearing schema/FKs, and separate Super Admin handling. This is code evidence, not complete route-level security proof. |
| RBAC / cross-tenant staging validation | **UNVERIFIED** | No full route-role matrix or live cross-tenant negative test was run. The prior migration rehearsal specifically reports RBAC/Super Admin regression evidence after migration 026. |
| Security headers, CORS, and rate limiting | **PASSED** | API code configures Helmet, exact-origin CORS allowlist logic, and production API rate limiting. Production proxy trust is configurable. |
| Security deployment posture | **UNVERIFIED** | Actual origin allowlist, proxy hops, ingress, IAM, secret-manager bindings, network restrictions, log redaction, dependency/image scanning, vulnerability response and audit retention were not verified. CSP is disabled in API Helmet configuration; frontend policy posture needs a dedicated review. |
| Secrets and deployment configuration | **UNVERIFIED** | `.env.example` contains placeholders and directs production secrets to a secret manager; deployment templates use secret references. No real secret values were read, and no staging secret versions, access policies, rotation, or secret leakage scan was verified. |
| File upload and document safety | **UNVERIFIED** | Code includes limits, checksums, tenant checks and signed access paths, but content-signature validation, malware scanning/quarantine, operational retention/deletion, backup/restore, and end-to-end file access were not validated. |

## Critical blockers

1. **API traffic cannot reach the API from the checked-in Hosting setup.** Replace Firebase rewrite placeholders with the approved service/region and verify `/api` requests return API responses rather than SPA HTML.
2. **Cloud Run API and OCR worker templates are not deployable.** Resolve placeholders, verify service identities, network, image references, secrets, CA material, and worker-to-API authorization in an approved staging project.
3. **No staging database target or migration history is established.** Resolve the documented migration 026 RBAC regression and 034/canonical drift; identify the target schema baseline and establish a reviewed migration/restore procedure before changing any database.
4. **Staging storage and IAM are not established.** Configure a private durable bucket/provider and least-privilege runtime access; verify upload, signed read, OCR retrieval and deletion without public access.
5. **Staging authentication and authorization have not been exercised.** Configure OTP delivery and the selected identity mode; validate login, expiry/revocation, all roles, workspace membership and cross-tenant denials against the staging API.
6. **No operational evidence exists for backups, recovery, monitoring, OCR quality, or end-to-end deployment smoke checks.** Establish and verify these before any staging acceptance involving real or sensitive documents.

## Recommendation

**NO-GO for staging deployment in the current repository state.** The blockers include known broken/incomplete API routing and non-deployable Cloud Run templates, plus unresolved database migration/RBAC concerns. Staging readiness can be reconsidered after those defects are concretely resolved and the external configuration, builds, deployment smoke checks, authentication/RBAC matrix, private document flows, TLS, backups, and worker operation are verified. Until then, treat all cloud-facing and runtime checks marked **UNVERIFIED** as open; none should be represented as passed.

## Revalidation addendum — 14 November 2026

Repository changes since this audit:

- Firebase Hosting's `/api/**` rewrite now points to `ojix-api` in `asia-south1`, matching repository deployment configuration. This is a static configuration correction; no live route was tested.
- Registration now collects an organization name and, after email OTP verification, transactionally creates a new organization and first active Owner membership with audit events. The shared default-organization assignment was removed from this registration flow.
- Canonical schema and migration 036 include the pending organization name needed to retain it until verification.
- `npm run typecheck`, `npm run build`, and focused migration/RBAC/storage/onboarding tests passed. The full API test suite remains failed/unverified because the required database-backed API test service on localhost:4000 was unavailable.

The addendum does **not** change the NO-GO decision. No database migration was applied, no staging service was deployed, and no live OTP, tenant-isolation, storage, OCR, or post-deployment workflow was verified. See `STAGING_RELEASE_CHECKLIST.md` and `FINAL_PROJECT_STATUS.md` for the current gate.
