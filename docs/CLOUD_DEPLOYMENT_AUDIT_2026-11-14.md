# OJIX external cloud deployment audit

**Requested target:** Vercel frontend, Google Cloud Run API and OCR worker, Cloud SQL for MySQL, private Cloud Storage, SMTP OTP, and Secret Manager.  
**Audit date:** 14 November 2026.  
**Result:** deployment is not complete or safe for external client data. Repository preparation has been done where possible; no cloud service, secret, database, deployment, or customer data was accessed or created.

## Architecture found

| Area | Existing implementation | Deployment finding |
|---|---|---|
| Frontend | React/TypeScript/Vite workspace at `apps/web`; Vite emits `apps/web/dist`; API calls use `VITE_API_BASE_URL` or same-origin paths | `vercel.json` now selects the repository root, workspace build command, output path, and SPA fallback. Vercel production builds require an HTTPS `VITE_API_BASE_URL`. Vercel settings and a deployed API are still required. |
| API | Express/TypeScript entry `apps/api/src/server.ts`; Docker image starts `dist/src/server.js`; `/healthz` and DB-aware `/readyz`; API validates bodies, rate-limits and uses server-side membership/RBAC | Existing Cloud Run manifest is a placeholder template. `CORS_ORIGIN`, database, runtime identity, image and secrets are not configured. Sessions return bearer tokens that the SPA stores in `localStorage`, rather than secure HttpOnly cookies. |
| SQL | Canonical schema `database/mysql-schema.sql`; migrations `database/migrations/004` through `035`; MariaDB/MySQL spatial SQL | Migration rehearsal documented against an isolated MariaDB candidate baseline, not a cloud or actual deployed database. No trustworthy production schema ledger or Cloud SQL compatibility proof. The documented migration failures/role mismatch must be resolved and rehearsed before staging data. |
| Document storage | Local, Supabase, and GCS adapters; GCS objects are private when bucket access is correctly configured; signed reads are capped at 15 minutes; API checks tenant/document authorization | Default is local storage. No bucket, IAM, signing identity, malware scanning/quarantine, or restore procedure is configured. Changing providers does not migrate existing objects. |
| OCR | Python polling worker with Tesseract, Poppler, SQL job leases/retry/recovery, and API-mediated document access | Worker image and persistent Cloud Run Worker Pool manifest exist. The worker runs Tesseract OCR; repository inspection found no Google Document AI SDK/request implementation. Document AI settings UI/API do not constitute a working provider. |
| OTP | SMTP delivery, scrypt-hashed salted OTPs, resend limits and five failed attempts | OTP lifetime is **10 minutes**, not the requested 5. SMTP provider credentials/inbox were not available for a delivery test. Development/demo identities are not production identities. |
| Registration / tenant creation | Registration verifies email, then creates a Viewer membership in `DEFAULT_ORGANIZATION_ID` | This is **not per-client organization provisioning**. Public registration would put clients in the shared default demo organization; do not expose registration to external clients until an owner/workspace creation flow and isolated membership tests are implemented. |
| Reports | JSON and Word-editable exports for supported approved reports | PDF export returns 501. The requested PDF workflow is unavailable. |
| Cloud configuration | Cloud Run API and worker templates, GCS adapter, Secret Manager plan and project hint `ojix-property-intelligence` | No real project state, billing status, Vercel account, Cloud SQL instance, SMTP account, or secrets could be verified. `gcloud` could not open its credentials database in the sandbox; `vercel whoami` failed to reach its service. |

## Release blockers

1. **Tenant isolation / onboarding:** implement organization creation and first-owner assignment at registration, then invite/membership management inside each organization. Add backend tests proving two independently registered organizations cannot enumerate, read, update, export, or download each other's properties/documents/findings/reports. Current registration's shared default-tenant membership fails the requested tenant model.
2. **Authentication session storage:** replace long-lived bearer tokens in browser `localStorage` with reviewed secure session handling (for example, HttpOnly, Secure, SameSite cookies plus CSRF protection for mutations), or document and approve an equivalent threat model. Confirm every mutation and download remains authenticated and tenant scoped.
3. **OTP policy:** change the requested flow to five-minute expiry consistently in API messages and tests, preserve hashed OTP storage, rate limits and attempt caps, then verify a real inbox delivery. Keep OTP values out of API responses and production logs.
4. **Database:** establish an approved clean-install schema and migration history, fix reconciliation/role issues in the existing rehearsal, verify Cloud SQL engine/spatial compatibility, apply only forward migrations to a backed-up isolated staging instance, and perform a restore drill. Never run migrations against a production DB as a deployment shortcut.
5. **Private files:** provision an isolated private bucket with public access prevention, uniform access, least-privilege IAM and signed URL verification; implement/operate malware scanning and quarantine; test size/type errors, tenant denial, deletion, backups and checksum restoration. Keep existing storage keys and objects intact until a separate verified migration is approved.
6. **OCR / reports:** implement or explicitly scope out the Document AI adapter and test its service identity/processor; keep Tesseract as its own clearly labelled fallback if desired. Implement a real PDF renderer or remove PDF from promised workflows.
7. **Cloud operations:** choose region/VPC and approved budget, configure Secret Manager values, runtime identities, Cloud SQL backups/PITR, Cloud Run scaling, Artifact Registry, logs/alerts, SMTP, exact Vercel origin and rollback. No actual values or approvals were available to configure these.
8. **External verification:** run the requested full journey in a deployed staging environment and test API authorization directly. A local build cannot prove OTP delivery, backup status, Cloud SQL durability, worker recovery, public routing or cross-organization isolation.

## Vercel preparation completed

- Added root `vercel.json`: install `npm install`, build `npm run build -w apps/web`, output `apps/web/dist`, Vite framework and SPA fallback.
- Added a Vercel Vite guard: when an API origin is configured, production builds reject a non-HTTPS value. The frontend-only homepage and read-only sample preview can build before an API exists; client Login/Register require that backend later. API URL is browser-visible configuration, not a secret.
- To configure after the existing Vercel project/API are available:

  ```bash
  vercel link
  vercel env add VITE_API_BASE_URL production
  vercel --prod
  ```

  Link the existing OJIX Vercel project, enter only the API HTTPS origin, and configure `CORS_ORIGIN` on the API to allow the exact final browser origin. Vercel project selection, environment configuration and production deployment have not been performed.

## Google Cloud staging sequence (not executed)

The repository targets project identifier `ojix-property-intelligence` and proposes `asia-south1`, but neither project access nor cost approval has been verified. After the cloud owner authorizes a budget and provides the required account access, provision *staging only* in this order:

1. Confirm account/project, billing owner, budget ceiling, region/data residency and VPC design; enable only required services.
2. Create least-privilege API, worker and deployer service identities; create staging Secret Manager secrets through the approved secret channel.
3. Create Artifact Registry; build and inspect API/worker images without embedding `.env`, credentials or client files.
4. Create private Cloud SQL MySQL with backups/PITR and private connectivity; rehearse the reviewed schema/migrations against sanitized synthetic fixtures and restore a backup.
5. Create a private GCS staging bucket with Public Access Prevention and uniform access; test uploads, scoped reads, signed URL expiry, deletion and checksums.
6. Deploy API from `apps/api/cloudrun.service.yaml` after replacing all placeholders and assigning exact runtime settings; verify `/healthz`, `/readyz`, CORS and JSON API errors.
7. Deploy the worker from `apps/api/worker/cloudrun.worker-pool.yaml` only after review of its persistent-compute cost. Verify queued job recovery after worker restart.
8. Configure SMTP and test registration/login OTP to a controlled inbox. Verify no OTP or secret in frontend bundle, responses or production logs.
9. Configure Vercel preview with the staging API, implement and validate the organization onboarding/session gates, and complete the tenant-boundary/API test matrix before production.
10. Only after backup restore, security review and owner go-live approval: deploy production, verify every deliverable and record the actual URLs/statuses. Do not reuse staging secrets or database.

Cloud resources are not provisioned by this audit because the request explicitly requires approval before creating billable resources and no budget/account approval was supplied. A deployment cannot responsibly use the supplied demo/default tenant as a shortcut.

## Exact local preparation commands

Run at repository root after installing Node 20+ dependencies:

```bash
npm install
npm run build -w apps/web
```

For a Vercel production-build check, use a valid HTTPS staging API origin supplied by the operator:

```bash
VERCEL=1 VITE_API_BASE_URL=https://YOUR-STAGING-API-ORIGIN npm run build -w apps/web
```

The actual cloud deployment commands/manifests depend on project, network, database, secret and image identifiers. They must be generated from approved real values; the existing `REPLACE_*` Cloud Run templates must not be blindly applied.

## Deliverable status

| Deliverable | Status |
|---|---|
| Public Vercel URL | Not deployed / unavailable |
| Cloud Run API URL | Not deployed / unavailable |
| Cloud SQL status and backups | Not provisioned / unverified |
| Private GCS status | Adapter exists; bucket/IAM unprovisioned |
| SMTP OTP inbox result | Not tested; no provider access supplied |
| OCR worker status | Code/template exists; cloud worker unprovisioned; Document AI adapter missing |
| Tenant-isolation result | Existing role mechanisms; requested separate-organization onboarding/test is a blocker |
| Production build | To be run with the actual Vercel API environment; no external deployment log exists |

