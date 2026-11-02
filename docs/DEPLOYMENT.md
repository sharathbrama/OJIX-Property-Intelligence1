# OJIX production deployment and Super Admin setup

This guide matches the checked-in application: a React/Vite frontend, Express API, MariaDB/MySQL database and private Supabase Storage adapter. The API is a long-running Docker service; Vercel hosts the static frontend only.

## Current deployment status

- Frontend: [https://ojix-property-intelligence-ten.vercel.app](https://ojix-property-intelligence-ten.vercel.app) (Vercel team deployment protection is enabled).
- API: **not deployed**. The local API is available at `http://localhost:4001` only while the developer Docker stack is running.
- The Vercel project currently has no production environment variables. Until `VITE_API_URL` points to a hosted API, the login screen reports the missing production API configuration and authenticated features cannot be verified.
- Live diagnosis on 2026-11-02: requesting `/health` on the Vercel domain returns the Vercel SPA `index.html` (the catch-all rewrite), not an API response. The deployed JavaScript bundle still includes the obsolete development message `Start the local stack`; redeploy the current frontend after a real HTTPS API URL is available.
- A production login, remote MySQL persistence and production uploads have not been verified. Do not describe the full product as production-ready until those checks pass.

## Frontend on Vercel

Import `https://github.com/sharath790/OJIX-Property-Intelligence` into the `SHARAth` Vercel team and use these settings:

| Setting | Value |
|---|---|
| Root Directory | `.` (repository root; required for the npm workspace lockfile) |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build -w apps/web` |
| Output Directory | `apps/web/dist` |

These settings are also in [`vercel.json`](../vercel.json). The SPA rewrite supports refreshing application routes such as `/properties` and `/super-admin/dashboard`. The API URL is validated at runtime: production requires an HTTPS URL and rejects localhost.

In Vercel **Settings → Environment Variables**, set:

| Name | Value | Environments |
|---|---|---|
| `VITE_API_URL` | `https://<hosted-api-domain>` (origin only, no trailing slash) | Production; Preview only when pointing to a separate test API |

Redeploy after changing this build-time variable. Never place database URLs, SMTP credentials, Supabase service-role keys, Firebase service credentials or passwords in any `VITE_*` variable; Vite embeds those values into public JavaScript.

Vercel production URL: `https://ojix-property-intelligence-ten.vercel.app`. Add that exact origin to the API's `CORS_ORIGIN`. Preview domains should only be allowlisted for a non-production API.

## API hosting

Deploy the Express API as an always-on Docker web service using [`apps/api/Dockerfile`](../apps/api/Dockerfile). It listens on `PORT` (default `4000`), exposes liveness at `/healthz`, and checks MySQL plus spatial functions at `/readyz`. The API must be reachable from browsers at a stable HTTPS origin.

The API is not a Vercel static asset. Host it on a container service with persistent networking to a managed MySQL/MariaDB database. Use the API Dockerfile as the build context (`apps/api`) or build from the repository using that Dockerfile. Configure all required values below through the host's secret manager, then roll out the service. Do not expose the database port publicly.

Production startup intentionally fails when required settings are missing or unsafe. It requires a remote TLS MySQL endpoint, exact HTTPS CORS origins, SMTP OTP delivery, private Supabase document storage, and the Super Admin bootstrap pair. This prevents an ephemeral local upload directory or a localhost database from being mistaken for production infrastructure.

## MySQL/MariaDB setup

1. Provision a managed MySQL-compatible database with TLS, private networking, automated backups and a least-privilege application user. The local stack uses MariaDB 10.11; use a version compatible with `database/mysql-schema.sql` and the spatial functions in `/readyz`.
2. Create the database named `ojix_property_mysql` (the schema snapshot selects that name) and grant the application user only the required schema/data privileges.
3. Apply the consolidated schema once, before starting the API:

   ```sh
   mysql --host=<private-db-host> --ssl-mode=REQUIRED --user=<migration-user> --password < database/mysql-schema.sql
   ```

   `database/mysql-schema.sql` is the current MariaDB schema snapshot. Do not run `infra/db/seed.sql` in production: it contains synthetic demo identities, property and map data. Existing installations that were not created from the current snapshot should apply the reviewed SQL migrations in `database/migrations/` in order instead of replaying the full schema.

4. Store the connection string in the API host as `DATABASE_URL`, for example `mysql://<user>:<encoded-password>@<private-db-host>:3306/ojix_property_mysql`. URL-encode reserved characters in the password. Set `DATABASE_SSL=true`; set `DATABASE_SSL_CA` to a mounted CA file path only when the provider uses a private CA.
5. Start the API and confirm `GET /readyz` returns HTTP 200 with `status: "ready"` before configuring Vercel.

The application never sends database credentials to the frontend. The Compose database password is a local-development value and must not be used for production.

## Required API environment variables

Set these on the API service only:

| Variable | Required production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Host-provided port, normally `4000` |
| `DATABASE_URL` | Remote `mysql://` URL for the managed database |
| `DATABASE_SSL` | `true` |
| `DATABASE_SSL_CA` | Optional path to a mounted trusted CA certificate |
| `CORS_ORIGIN` | Exact HTTPS frontend origin(s), comma-separated; no wildcard or localhost |
| `SUPER_ADMIN_EMAIL` | Email for the initial platform administrator |
| `SUPER_ADMIN_PASSWORD` | 12–128 characters with uppercase, lowercase, number and symbol |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Working SMTP service for sign-in, registration and recovery OTPs |
| `SMTP_SECURE`, `SMTP_FROM` | SMTP TLS mode and verified sender as required by the provider |
| `DOCUMENT_STORAGE_PROVIDER` | `supabase` |
| `SUPABASE_URL` | Supabase project HTTPS URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Private API secret; never expose to the frontend or logs |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name (default `private-documents`) |
| `UPLOAD_DIR` | Writable temporary upload directory; uploaded objects are moved to private storage |
| `MAX_UPLOAD_MB` | Optional upload cap; defaults to 25 MB |

Optional integrations: `FIREBASE_PROJECT_ID` for Firebase ID-token verification, Twilio variables for SMS OTP fallback, and `RTC_PROVIDER_MODE`/RTC credentials only when an authorized official connector exists. The current frontend login uses the API's password-plus-email-OTP session flow; setting a Firebase project alone does not configure email delivery.

## Super Admin bootstrap and access

Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` as API secrets before the first production API start.

- The API creates the account only if that normalized email does not already exist. It hashes the initial password with scrypt and stores no plaintext password.
- It creates the platform organization if needed and assigns the protected database role `super_admin`. The same identity receives Owner workspace permissions so it can use all workspace modules, plus a separate server-computed `isSuperAdmin` claim for platform-wide routes.
- On redeploy, an existing password is preserved. The bootstrap does not create a duplicate account. Existing disabled or unverified accounts are not silently reactivated; resolve those through an authorized account process.
- The bootstrap password is not used to authenticate every request. Sign-in still requires the email OTP delivered by SMTP, and the API stores only a hash of each session token.
- Normal role changes and account creation accept workspace roles only. They cannot assign `super_admin`; only the deployment bootstrap can do that. All platform endpoints enforce `authGuard` and `superAdminGuard` on the server.
- Super Admin can create organizations and user accounts, change workspace roles/status, archive/restore properties, revoke sessions and search the cross-organization audit log. User creation requires a temporary password; share it only out of band. The user's email must be reachable for OTP sign-in.

`SUPER_ADMIN_EMAILS` remains as a compatibility allowlist for existing installations. Migrate to the singular bootstrap variables and remove the legacy list after confirming access.

## Deploy and verify

After the API, database, SMTP and private storage are ready:

1. Set the production API environment variables and start the API service.
2. Confirm `https://<api-domain>/healthz` returns `OK` and `/readyz` returns ready.
3. Confirm the configured Super Admin can receive an OTP, sign in at `/login/super-admin`, load the dashboard, and use a protected platform endpoint. Verify a normal account gets `403` from `/api/super-admin/overview` and cannot assign itself `super_admin`.
4. Set `VITE_API_URL` in Vercel to the API HTTPS origin and set the API's `CORS_ORIGIN` to `https://ojix-property-intelligence-ten.vercel.app`.
5. Deploy the frontend to Production. Refresh `/super-admin/dashboard` and `/properties` directly; the SPA rewrite should return the app shell while API requests go to the configured HTTPS API.
6. Test login/logout, workspace roles, property create/update/archive, document upload/download using the private bucket, API readiness, MariaDB persistence across API restart, cross-tenant rejection, unauthorized routes and mobile layouts.

## Verification completed in this repository

| Check | Result |
|---|---|
| `npm run build` (API TypeScript + Vite production build) | Pass |
| Web unit tests | 8 passed |
| API password/OTP, production-config and Super Admin bootstrap unit tests | 14 passed |
| Existing local Docker API, MariaDB readiness and protected Super Admin endpoints | Previously verified locally; current full API suite could not connect using the test process's configured DB credentials |
| Production API, database, OTP delivery and login | Not verified; no hosted API/database/SMTP/storage credentials are configured |
| Full production role/property/document/security/mobile test matrix | Not run; requires the hosted services and an authorized test account |
| API dependency audit | 9 production advisories remain; the outstanding high Zod and moderate UUID fixes require major dependency upgrades |

The Super Admin bootstrap, API production guardrails, and new platform management endpoints have unit/build coverage but have not yet been exercised against a fresh production database. Run the production verification checklist before treating this as complete.

## Local development

```sh
cp .env.example .env
docker compose up -d --build
```

- Web: `http://localhost:8080`
- API: `http://localhost:4001`
- MariaDB host port: `3308`

Local-only credentials and demo seeds live in Compose. Do not use this local stack as the production backend or publish a developer-machine tunnel as the production API.
