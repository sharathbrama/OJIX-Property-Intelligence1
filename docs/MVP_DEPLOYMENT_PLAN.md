# MVP deployment plan and architecture decision

**Date:** 11 November 2026  
**Decision status:** proposed; no cloud resources created and no deployment performed.

## Architecture decision

Firebase Hosting on Spark is suitable for the Vite static frontend only. It is not a runtime for this repository's Express API, long-running Python/Tesseract worker, or MySQL/MariaDB. The current UI uses relative `/api/...` calls and the current Hosting catch-all routes those requests to `index.html`, so the frontend is not ready to deploy as a functional application.

There is no complete production architecture for this stack that can be honestly promised under all current constraints (no billing, no VPS purchase, no managed backend/database). Select one of these paths:

| Path | What works | Constraints / decision |
|---|---|---|
| **A. Full MVP on already available infrastructure (recommended if available)** | Existing frontend, Express API, MariaDB, private file storage and Tesseract worker can remain intact. Hosting may remain Firebase or be served by the same approved origin. | Requires an already operated private server/platform and database, backups, TLS, monitoring and security ownership. No new paid resource is implied. If no such infrastructure exists, this path is unavailable. |
| **B. Firebase Spark static demonstration** | Publicly distributable frontend assets and SPA navigation; optionally Firebase Authentication-supported login for a separately redesigned demo. | No existing API, MariaDB, OCR worker or confidential-document workflows. Use synthetic data only. Disable/label backend-dependent screens; do not represent this as production or client-data-ready. Do not implement this partial mode until product chooses it. |
| **C. Migrate backend to Firebase products** | Could replace selected identity/data/storage components over time. | Not a drop-in hosting fix. Firestore requires full relational/tenant/query migration design; Firebase Functions/other compute and integrations may require Blaze billing. Cloud Storage, quotas, rules, export/rollback, OCR execution and data retention need separate evaluation. Not authorized or recommended as an automatic migration. |

No Vercel/Render/free-tier API host, free database, or public storage is assumed: limits, sleeping behavior, persistence and current terms must be verified before selection. Do not place confidential property documents in a public bucket or unauthenticated URL.

## Target request flow for Path A

```text
Browser
  ├── HTTPS static app: Firebase Hosting (apps/web/dist)
  └── HTTPS API base URL: approved Express host
        ├── MariaDB/MySQL (private network, backups, migrations)
        ├── private durable document storage (no public URLs)
        └── private Tesseract worker ← durable OCR job queue
```

The web bundle must use a configured `VITE_API_BASE_URL` (public URL only, never a credential). API CORS must allow only the exact Hosting origin. Alternatively a hosting rewrite may target a separately deployed supported compute service, but Spark Hosting alone cannot provide that target. Private storage credentials and database/SMTP/worker secrets belong only in the API/worker secret environment.

## Ordered release gates

1. Approve Path A infrastructure ownership or explicitly accept Path B demo limitations.
2. Resolve schema/migration defects and establish verified backup/restore before database rollout.
3. Configure a non-production API/database/storage/worker environment; migrate a sanitized snapshot and validate OTP, role isolation, upload, review and reports.
4. Set the API URL and CORS; prove login, authenticated read/write, upload/download and OCR end-to-end from the Firebase Hosting origin. Check `/api` errors are JSON and do not return SPA HTML.
5. Complete security gates: server-side RBAC and cross-tenant negatives, no demo identity, TLS, secure sessions, file validation/quarantine, private storage, retention, audit and restore drill.
6. Run and record all required checks in `PRODUCTION_TEST_REPORT.md`; resolve release-blocking failures.
7. Build `apps/web` and inspect generated assets for secrets. Confirm `firebase.json`, `.firebaserc`, API URL and SPA behavior. Deploy only when Path A supports the API calls and release owner authorizes deployment.
8. Monitor health/readiness, API errors, OTP delivery, queue age, failed OCR, storage, DB capacity and backup completion. Keep rollback instructions and the prior frontend artifact.

## Firebase Spark compatibility matrix

| Feature | Spark Hosting alone | Path A with external existing API |
|---|---|---|
| Static React/Vite SPA | Yes | Yes |
| Existing Express endpoints | No | Yes, via explicit API URL/proxy |
| Existing MySQL/MariaDB schema | No | Yes, keep as current system of record |
| Python Tesseract worker | No | Yes, on continuously available worker host |
| Secure document upload/download | No API/storage path | Yes, private storage + tenant-scoped API |
| Current OTP workflow | No API/SMTP runtime | Yes, with configured delivery provider |
| RBAC and audit | No secure backend to enforce it | Yes, subject to release tests |
| Firestore replacement | Not automatic | Optional separate migration project |

## Rollback and data safety

Do not run migrations against production without an owner-approved backup and tested restore. Keep the previous frontend build artifact; frontend rollback must not be paired with an incompatible schema rollback. Prefer forward-compatible expand/migrate/contract schema changes. Retain an immutable database backup and private document backup according to approved retention/legal-hold policy. Test restore into an isolated environment and verify checksums before declaring recovery readiness.

## Deployment checklist

- [ ] Runtime path and infrastructure owner accepted.
- [ ] API URL reachable over HTTPS from deployed frontend; CORS exact-origin configured.
- [ ] `/healthz` and `/readyz` verified; DB and OCR dependencies observable.
- [ ] Schema version inventory and migration 031 repaired/reviewed; upgrade and restore rehearsed.
- [ ] Database credentials, OTP provider, Firebase Admin credentials if used, storage and worker secrets set only server-side.
- [ ] Firebase web config contains only public Firebase app identifiers; no SMTP, DB, service-role or worker secrets in `VITE_*`.
- [ ] Authentication, recovery, revocation, roles and cross-tenant checks passed.
- [ ] Private uploads tested; invalid files, oversize files, access denial and malware flow verified.
- [ ] OCR queue and human field review verified; no unverified facts marked legally verified.
- [ ] PDF is either implemented and verified or remains clearly unavailable.
- [ ] Test report complete; production owner approves rollout.
- [ ] `npm run build -w apps/web`; inspect `apps/web/dist` and confirm API configuration.
- [ ] `firebase deploy --only hosting --project ojix-property-intelligence` performed only after all above gates and deployment authorization.
- [ ] Smoke test login, dashboard, matter, document, review and logout from production URL.
