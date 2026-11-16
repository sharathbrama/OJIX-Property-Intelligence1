# Vercel deployment preparation

This repository keeps the current React/Vite client and MariaDB schema. It does not run migrations at startup. Deploy the frontend and API as separate Vercel projects, with the API project Root Directory set to `apps/api` and the frontend project Root Directory set to the repository root.

## API project

`apps/api/api/[...path].ts` exports the existing Express app as the Vercel catch-all function. `apps/api/src/server.ts` exports that app by default and skips `app.listen()` when `VERCEL` is set. Local `npm run dev -w apps/api` still starts the listener and serves `apps/web/dist` when present. Vercel temporary multipart staging defaults to `/tmp/ojix-uploads`; this storage is ephemeral and must not be treated as durable document storage.

Configure the API project with Node.js 22 and server-only environment variables in the Vercel project’s secret environment:

- `DATABASE_URL`: MariaDB connection string, TLS enabled and least-privilege account.
- `DATABASE_SSL=true`; optional `DATABASE_SSL_CA` path only if the provider requires a CA file available in the function image.
- `CORS_ORIGIN`: exact frontend production origin (scheme and host, no wildcard).
- `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`: optional paired bootstrap credentials. Password must meet the API’s complexity requirements. Provisioning is idempotent and does not replace an existing password or reactivate a revoked membership. Remove/rotate bootstrap credentials after controlled provisioning.
- Select private storage with `DOCUMENT_STORAGE_PROVIDER=gcs` plus `GCS_BUCKET`, or `DOCUMENT_STORAGE_PROVIDER=supabase` plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Keep buckets private. Supabase service-role credentials belong only in API secrets.
- Set `MAX_UPLOAD_MB` for the small multipart route (the Vercel handler caps each multipart file at 4 MiB), and optionally `MAX_DIRECT_UPLOAD_MB` (default 25 MiB; maximum 100 MiB because completion verifies and hashes the object in the function).
- Set `DB_POOL_LIMIT` conservatively for serverless scale; the application validates it to 1–10 connections per warm function instance.
- Keep `LOCAL_TEST_LOGIN_BYPASS` unset/false. Do not configure demo flags or demo database credentials on the production API. Configure only integrations that are approved for production.

Vercel Functions enforce a **4.5 MB maximum request body**. Multipart framing and fields consume some of that budget, so the application limits each direct multipart file to 4 MiB. Files larger than that use `POST /api/properties/:id/documents/direct-upload`, upload directly to the configured private GCS or Supabase bucket, then call `POST /api/properties/:id/documents/direct-upload/:docId/complete`. The API authorizes the caller against the tenant and property before signing, generates an opaque tenant/property/document object key, binds the content type, checks object size and file signature, computes SHA-256 server-side, rejects duplicates, and only then inserts the document row. GCS uses a signed POST policy with an exact byte-size range and create-only generation. Supabase signed upload URLs have a provider-defined two-hour lifetime; set that private bucket’s maximum object size to `MAX_DIRECT_UPLOAD_MB` or lower to cap abandoned uploads. Signed upload URLs are bearer capabilities; keep them private. Configure bucket CORS for the exact frontend origin and the returned method/headers (GCS POST multipart; Supabase PUT with `Content-Type` and `x-upsert`). See [Vercel Function limits](https://vercel.com/docs/functions/limitations), [Supabase signed uploads](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), and [Google Cloud signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls).

Storage metadata/database registration is completed only after the direct upload. A failed completion can leave an unreferenced object; configure a lifecycle rule to remove unreferenced temporary objects after a conservative grace period, or add a scheduled reconciler before broad production use. Do not make the bucket public.

## Frontend project

The existing frontend `vercel.json` now routes `/api/*` to `https://api.example.com/api/*` before the SPA fallback. This is an explicit placeholder; replace `api.example.com` with the API project’s stable production domain before deploying the frontend. Set `VITE_SERVERLESS_UPLOADS=true` in the frontend Vercel project so batches over 3.5 MiB use the signed direct-cloud flow; without this flag, local and non-serverless deployments keep using the existing multipart route. Leave `VITE_API_BASE_URL` unset to use the same-origin rewrite. If set, it should be the API HTTPS origin; it is public configuration, never a credential. The React application and SPA fallback remain intact.

## Deployment checks

1. Connect the API Vercel project to this Git repository, Root Directory `apps/api`, and the selected production branch. Confirm the build command in `apps/api/vercel.json` and `/api/health`, `/api/healthz`, and `/api/readyz` reach the Express handler.
2. Connect the frontend project with repository root as Root Directory. Set the external API rewrite target and SPA fallback, then deploy the selected branch.
3. Set API `CORS_ORIGIN` to the frontend’s final custom production origin. Verify OPTIONS/preflight and authenticated API calls from the deployed frontend.
4. Check `/api/health`, `/api/healthz`, and `/api/readyz`; confirm MariaDB reports ready and the API is connected to the intended non-demo database.
5. Verify OTP login, role permissions, tenant isolation, private document preview/signed downloads, small multipart upload, direct cloud upload over 4 MiB, duplicate rejection, and storage cleanup. Never test with customer documents.
6. Check Vercel function logs for bootstrap/database errors, function duration, 413 responses, and storage failures. Do not interpret `/tmp` as persistent storage.

Do not run destructive migrations or schema initialization against an existing database as part of a Vercel deploy. Back up and rehearse schema changes separately.
