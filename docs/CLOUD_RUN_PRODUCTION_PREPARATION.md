# OJIX Cloud Run production preparation

**Status:** preparation only. No Google Cloud resources, secrets, databases, or paid services were created or accessed.

## Proposed service layout

- Firebase Hosting serves `apps/web/dist`.
- Firebase Hosting rewrites `/api/**` to Cloud Run service `ojix-api` in `asia-south1` (Mumbai), after that region and project placement are approved.
- Cloud Run service `ojix-api` runs the existing Express application.
- Cloud Run worker pool `ojix-ocr-worker` runs the existing Python polling worker, Tesseract, and Poppler. Worker pools are continuously running compute and incur cost while provisioned.
- Cloud SQL for MySQL is the proposed managed MySQL endpoint. This does not authorize moving or connecting production data.
- A private Cloud Storage bucket is supported by the new `gcs` storage adapter. The adapter uses runtime Application Default Credentials, provider-qualified object keys, generation-match upload protection, short-lived V4 signed reads, private cache metadata, OCR retrieval through the authenticated API, and provider-routed deletion. Existing local and Supabase storage remain supported.

## Hosting rewrite and CORS

The current `firebase.json` has the `/api/**` rewrite before the SPA catch-all. Replace its Cloud Run placeholders with service `ojix-api` and region `asia-south1` only after the service exists. Firebase documents that Hosting can rewrite to Cloud Run and that `asia-south1` is a supported rewrite region: <https://firebase.google.com/docs/hosting/cloud-run>.

The expected default Hosting origin is `https://ojix-property-intelligence.web.app`; Firebase also provides `https://ojix-property-intelligence.firebaseapp.com`. Confirm the actual Hosting site and any attached custom domain before setting `CORS_ORIGIN`. Configure only the exact browser origin(s), comma-separated, with HTTPS. Do not include API origins or wildcards unless specifically required and reviewed.

Firebase Hosting to Cloud Run routing requires the service to accept Hosting invocations. The Cloud Run endpoint can consequently be reachable publicly. Keep app-level bearer authentication, tenant scoping, RBAC, rate limits, and worker-token checks enabled; public reachability must not grant unauthenticated data access. Verify login, denied requests, and cross-tenant access in staging.

The worker calls `/internal/ocr/...` and therefore needs the Cloud Run API URL, not the Firebase `/api` rewrite. Those endpoints are protected by `OCR_WORKER_TOKEN`; consider a later identity-token based service-to-service design if the worker/API networking and authentication model is changed.

## Cloud SQL and pool budget

Preferred network design: place Cloud SQL MySQL on private IP and attach both the API service and OCR worker pool to the same approved VPC/subnet using Direct VPC egress. Set `DATABASE_URL` in Secret Manager to the MySQL TCP URL using a hostname that matches the configured Cloud SQL certificate SAN. Set `DATABASE_SSL=true` and mount the trusted server CA as `DATABASE_SSL_CA`. Cloud SQL hostname identity verification depends on the selected CA mode and network option; validate this before staging. Google documents automatic encryption and server/client identity verification when using the Cloud SQL Auth Proxy or language connectors, while direct TLS SAN behavior differs by CA mode ([Cloud SQL TLS guidance](https://cloud.google.com/sql/docs/mysql/authorize-ssl), [Cloud SQL certificate configuration](https://cloud.google.com/sql/docs/mysql/configure-ssl-instance)). Do not authorize `0.0.0.0/0` or broad public database access.

The API pool limit is configurable using `DB_POOL_LIMIT` (valid range 1–10, default 10). The prepared Cloud Run manifest sets 8 with a three-instance cap, or 24 nominal API connections, plus one sequential OCR worker’s short-lived connections, operational/admin sessions, and possible brief scale-limit overshoot. Confirm Cloud SQL’s connection ceiling and reserve headroom before staging. Revisit pool size, container concurrency, and max instances together from measured concurrency.

The Python worker opens and closes a MySQL connection around job operations. `DATABASE_SSL=true` now enables certificate and hostname validation, with optional `DATABASE_SSL_CA` pointing to a mounted CA bundle. The prepared worker manifest mounts a Secret Manager reference placeholder for that CA. The API’s TLS setting is independent from Python’s.

## Private document storage design

The API keeps `local` and `supabase` providers and adds `gcs`; do not repoint existing Supabase keys or silently change old document records.

Implemented adapter behavior:

1. The authenticated API stages the upload and writes it to GCS before recording the provider-qualified key. Temporary container disk is request staging only; durable storage must be configured before production.
2. Object keys reuse tenant/property/document IDs and retain `gcs:<tenant>/<property>/<document>` names. Existing `supabase:` records dispatch to Supabase when its server credentials remain configured.
3. Enforce Public Access Prevention and uniform bucket-level access on the bucket. Grant the API runtime identity only object read/create/delete permissions needed by the adapter. Never grant the worker bucket access while reads pass through the authenticated API endpoint.
4. Browser file access and signed-link requests run the existing tenant-scoped document and role/release checks before redirecting to a short-lived (maximum 15-minute) GCS signed read URL. Object metadata sets `private, no-store`; signed-link issuance is audited.
5. OCR retrieval requires the worker bearer token, an existing job joined to its tenant document, and `processing` status; remote bytes are read by the API adapter and returned with private no-store headers.
6. Tests cover fake-client upload/read/delete, signed URL expiry limits, legacy Supabase routing, document-file access policy, and worker retrieval using a mocked API call. A full database-backed cross-tenant/API integration test, upload rollback/orphan cleanup, and audit-path integration test still require an isolated staging test database and remain blockers before production.

GCS signed URL creation with Cloud Run Application Default Credentials may require the runtime identity to sign blobs through IAM. Validate signing in staging and, if required by the selected SDK/identity configuration, grant `roles/iam.serviceAccountTokenCreator` only to the runtime service account on itself. Confirm whether workload identity signing is available before relying on signed URLs.

Do not switch a live installation to `DOCUMENT_STORAGE_PROVIDER=gcs` until existing local and Supabase files are inventoried, copied to an isolated staging bucket, verified by checksum and access-policy tests, and the document references are updated under a separately approved, backed-up data migration plan. This implementation does not move existing objects or update database records. If existing `supabase:` keys remain, keep their server-side credentials available.

## Secret Manager reference names

These are proposed names only; no secrets were created. Use separate staging and production secrets and grant `roles/secretmanager.secretAccessor` to only the corresponding runtime identity.

| Proposed secret | Consumer | Contains |
|---|---|---|
| `REPLACE_WITH_STAGING_DATABASE_URL_SECRET_NAME` | API and worker | MySQL connection string with private host and credentials |
| `REPLACE_WITH_STAGING_CLOUD_SQL_CA_SECRET_NAME` | API and worker | Cloud SQL server CA bundle for certificate verification |
| `ojix-staging-smtp-user` | API | SMTP username |
| `ojix-staging-smtp-password` | API | SMTP password/app password |
| `ojix-staging-ocr-worker-token` | API and worker | Shared internal worker token |
| `ojix-staging-supabase-service-role-key` | API only, only if retaining Supabase storage | Supabase service-role key |

Use runtime service identity / Application Default Credentials for Google APIs; do not upload service-account JSON. SMTP host/port/security mode and exact CORS origin are configuration values, not credentials, but must be set deliberately. Firebase project ID and GCS bucket name are identifiers, not secrets.

## Service identities and least privilege

- **API runtime identity** (`REPLACE_WITH_API_RUNTIME_SERVICE_ACCOUNT`): Secret Accessor on only API secrets; bucket-scoped Storage Object Creator, Viewer, and (only for approved purge) User/Custom object-delete permissions. Avoid project-wide Storage Admin. Cloud SQL connect permissions only when required by the selected network/connector. No Owner/Editor or DB-admin role.
- **OCR worker identity** (`REPLACE_WITH_OCR_WORKER_RUNTIME_SERVICE_ACCOUNT`): Secret Accessor only for database URL and worker token; Cloud SQL connect/client permission if using a connector; Artifact Registry Reader for the worker image. No document bucket access required if all reads remain through the authenticated API. Document AI processor access only if worker integration is implemented there.
- **Build/deployer identity:** separate from runtime identities; narrowly scoped Artifact Registry writer, Cloud Build permissions if used, Cloud Run deploy, and Service Account User on the named runtime identities. Do not reuse a human owner account as a runtime identity.
- **Firebase Hosting deploy identity:** separate deployment permission for the selected Firebase project. Do not grant API runtime permissions to the Hosting client.

Exact IAM roles depend on whether Cloud SQL uses private TCP or a connector, whether signed URLs use IAM signing, and the final GCS access flow. Review the permission matrix against the actual implementation before provisioning.

## Staging-only checklist

- [ ] Approve staging project, billing owner, region/data residency, and spending ceiling. Do not use production MySQL or real property documents.
- [ ] Create a sanitized isolated staging database from an approved fixture/backup copy; do not run migrations as part of this deployment task.
- [ ] Confirm Cloud SQL engine/version/schema compatibility and backup/restore procedure in staging.
- [ ] Create an isolated staging GCS bucket with Public Access Prevention, uniform access, retention/lifecycle policy review, and bucket-scoped IAM; validate signed URL signing and API-only object access.
- [ ] Keep Supabase service credentials configured while any existing `supabase:` document records still depend on them; plan a separately approved object-copy and verification exercise before any retirement.
- [ ] Create separate staging runtime service identities and staging secrets with least privilege.
- [ ] Build API and worker images; inspect image contents and logs for environment files, credentials, and user document data.
- [ ] Validate API `/healthz` and `/readyz`, Cloud Run port/probes, max instances, DB connection budget, request concurrency, upload limits, and graceful shutdown.
- [ ] Verify Hosting `/api/**` rewrite, exact `CORS_ORIGIN`, OTP delivery, authenticated/unauthenticated behavior, RBAC, tenant isolation, audit events, signed/private downloads, worker lease/retries, and queue recovery.
- [ ] Test worker deployment and scale manually; worker pools do not automatically autoscale. Record queue age/throughput and OCR failure alerts.
- [ ] Test restore of database and documents in isolation; record checksums, achieved RPO/RTO, and recovery owner.
- [ ] Complete security, privacy, retention, legal-hold, monitoring, budget-alert, rollback, and support reviews.
- [ ] Obtain separate approval before any production provisioning, secret creation, DNS/custom-domain change, production DB use, migration, or deployment.

## Application-level production readiness results

- **API container:** `apps/api/Dockerfile` now defaults to port 8080, listens through the existing `PORT` handling, exposes 8080, and probes `/healthz` on the runtime port. Cloud Run startup/liveness probes use the same port/path. `/healthz` is process-only; use `/readyz` for DB readiness checks in staging, not as liveness.
- **Pool:** `DB_POOL_LIMIT` supports 1–10, default 10. The prepared service uses 8 and caps at 3 API instances (nominal 24 API DB connections). The worker processes one job at a time and opens short-lived connections; verify the aggregate Cloud SQL budget before staging.
- **Authentication/security:** API CORS remains an exact comma-separated origin allowlist and rejects other browser origins. Set `CORS_ORIGIN` to the exact HTTPS Firebase Hosting origin(s), e.g. the selected `https://<hosting-site>.web.app` and only any approved custom origin. Firebase Hosting `/api/**` rewrite is already ordered before SPA fallback and targets Cloud Run placeholders; replace service and region placeholders only when approved. Requests routed through Hosting are same-origin in the browser; the API still applies bearer/Firebase/session auth, tenant filters, RBAC, rate limiting and audit logging. No cookie session is used for app auth, so `SameSite`/`Secure` cookie flags do not apply; session tokens are sent in the Authorization header and persist in the existing database session table.
- **Storage:** `DOCUMENT_STORAGE_PROVIDER=gcs`, `GCS_BUCKET`, and Cloud Run ADC are needed. GCS keys are private; policy checks precede signed URL issuance. Keep Supabase credentials available for old `supabase:` records until a separately approved migration/copy and verification process. GCS upload failure cleans the staged upload; database insert failure attempts to delete the just-written remote object. Purge remains gated by the existing approval, legal-hold and retention checks and uses the key’s provider adapter.
- **OCR queue:** queue rows remain in MySQL; leases, heartbeats, retry delay/backoff and stale-job reclaim are already implemented. The worker fetches source bytes through the authenticated API endpoint, so API function termination does not own job execution. Worker is sequential and requires persistent worker compute, Cloud SQL connectivity/TLS CA, API URL, worker token, Tesseract, Poppler and Kannada/English language packs.
- **Google Document AI:** the API stores processor configuration and the worker can be given Google ADC, but inspection found no Document AI client call in `apps/api/worker/worker.py`; its implemented OCR path is Tesseract. Do not describe Document AI processing as production-ready until a separately approved processor adapter is implemented and tested. If implemented, enable the Document AI API in the chosen staging project, grant the worker identity only `roles/documentai.apiUser` (or narrower tested permissions) on the configured processor project, and use Cloud Run workload identity rather than service-account JSON.
- **Secret variables (names only):** API requires `DATABASE_URL`, `DATABASE_SSL=true`, `DATABASE_SSL_CA`, `DB_POOL_LIMIT`, `CORS_ORIGIN`, `FIREBASE_PROJECT_ID`, `DOCUMENT_STORAGE_PROVIDER=gcs`, `GCS_BUCKET`, SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`), and `OCR_WORKER_TOKEN`. Worker requires `DATABASE_URL`, `DATABASE_SSL=true`, `DATABASE_SSL_CA`, `OCR_WORKER_TOKEN`, `OCR_API_INTERNAL_URL`, plus `OCR_WORKER_POLL_SECONDS`, retry/lease/heartbeat values, `OCR_LANGUAGES`, `OCR_MAX_PAGES`, and `OCR_TIMEOUT_MS`. Document AI additionally needs processor configuration in the existing database and workload identity only after adapter implementation. Store credentials in Secret Manager; never use frontend `VITE_*` variables for server secrets.
- **Backups:** before any staging copy or eventual production cutover, take a database backup and prove restore into a separate isolated database; preserve an encrypted offsite copy and record retention, RPO/RTO and restore owner. Preserve GCS objects with an approved backup/retention/versioning policy and run object/database consistency checks. No backup or migration was performed here.

## Staging command sequence (approval and actual staging identifiers required)

These are command shapes only. Do not paste production credentials into a shell. Replace placeholders after staging resources and approval exist. The commands below intentionally stop before deployment commands unless a deployment approval is granted.

1. Build and test locally: `npm run build -w apps/api`; `npm run build -w apps/web`; `node --import tsx --test apps/api/test/document-storage.test.ts apps/api/test/document-access.test.ts apps/api/test/cors-policy.test.ts apps/api/test/rbac.test.ts`. For the worker, create an isolated Python venv, install `apps/api/worker/requirements.txt`, then run `python -m unittest -v test_worker.py` from `apps/api/worker`.
2. Authenticate/select the approved staging project: `gcloud auth login`; `gcloud config set project <STAGING_GCP_PROJECT_ID>`; `firebase login`; `firebase use ojix-property-intelligence` only when deploying Hosting to that Firebase project is approved (for staging, use the separately approved staging Firebase project).
3. Configure secrets via Secret Manager using secured interactive/CI procedures, then validate secret access from the correct runtime identities; do not provide secret literals as command arguments.
4. Build/push API and worker images only after approval to create/use Artifact Registry and Cloud Build resources. Validate image contents and digests before any Cloud Run revision deployment.
5. Create/validate staging Cloud SQL, private bucket, VPC access, identities/IAM, and OCR worker compute only after explicit staging provisioning approval. Restore an approved sanitized backup into isolated staging; no migrations unless separately approved.
6. Deploy to staging only after explicit staging deployment approval. Confirm HTTPS `/healthz`, `/readyz`, Firebase `/api/**`, exact CORS, OTP, RBAC/tenant isolation, signed URL expiry, object privacy, worker retry/reclaim, audit events, backup restore, and spending limits.
7. Production release remains a separate decision: approve production resources/secrets, reviewed immutable image digests, database backup/restore plan, deployment and rollback window, exact domain/CORS origins, monitoring and budget alerts. No production step is authorized by this preparation.
