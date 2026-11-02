# OJIX Property Intelligence — MVP 0.1.0

A Karnataka-first, Bengaluru-first property due-diligence workspace built from the OJIX Property Intelligence FRD. This is an engineering starter/MVP, not a production-ready legal verification service.

## Included in this build

- Responsive React + TypeScript PWA-style workspace (overview, property register, property case file, documents, map context, findings).
- TypeScript/Express REST API with request validation, upload size/type limits, rate limiting, security headers, audit events and tenant-scoped property/document/findings queries.
- MariaDB schema for organizations, memberships, properties, documents, spatial layers, findings and audit events.
- SHA-256 checksum recorded for every uploaded file.
- Explainable baseline screening rules for missing survey number, documents and coordinates.
- Spatial-layer proximity checks against explicitly imported features. The seeded feature is synthetic and labelled demo; it is not an official boundary.
- JSON evidence report export.
- Platform Super Admin console for cross-organization oversight, membership controls, session revocation and audit history.
- Firebase ID-token verification support, activated when `FIREBASE_PROJECT_ID` is set.
- Unit tests for baseline findings and score behaviour.

## Not yet implemented / do not imply it is live

- No live Bhoomi, Kaveri 2.0, BBMP/e-Aasthi, BDA or Rajakaluve government integration. The RTC module stores validated lookup attempts and supports an authorised API adapter, but remains in manual-retrieval mode until official credentials are supplied.
- No Document AI OCR or Vertex AI extraction pipeline yet. Uploads are queued in metadata only; files remain in local `uploads/` for development.
- No verified survey parcel boundaries, official lake/SWD geometry, buffer-rule engine or official planning notices.
- No production Cloud Storage adapter, Cloud Tasks/Pub/Sub workers, PDF report renderer or billing.
- A sandbox Supabase private-storage adapter and short-lived signed URL endpoint are available when explicitly configured; malware scanning and production storage controls are still pending.
- No legal opinion or automated ownership certification.

## Requirements

- Node.js 20+
- Docker Desktop / Docker Engine with Compose
- npm 10+

## Run locally

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Start MariaDB:

   ```bash
   docker compose up -d db
   ```

   The first database initialization loads the schema, demo role memberships, and one synthetic property. If you change schema or seed files later, recreate the local volume only if you are comfortable deleting local development data:

   For an existing database created before the Organisation Admin module, preserve its data and apply migration 017 once:

   ```bash
   docker exec -i ojix-mariadb mariadb -uojix -pojix_local_only ojix_property_mysql < database/migrations/017_admin_governance.sql
   ```

   Migration 017 uses forward-only MariaDB DDL and is intentionally non-idempotent; confirm the new tables do not already exist before rerunning it.

   To add RTC lookup persistence to an existing database, apply migration 018 once:

   ```bash
   docker exec -i ojix-mariadb mariadb -uojix -pojix_local_only ojix_property_mysql < database/migrations/018_rtc_lookups.sql
   ```

   ```bash
   docker compose down -v
   docker compose up -d db
   ```

3. Install workspace dependencies:

   ```bash
   npm install
   ```

4. Load the Karnataka district, taluk, hobli and village hierarchy used by the property forms:

   ```bash
   npm run db:locations
   ```

5. Start API and web app in separate terminals (or use `npm run dev` from the root):

   ```bash
   npm run dev
   ```

   - Web: http://localhost:5173
   - API health: http://localhost:4000/health

6. Open the web app and sign in with a configured demo account or a verified registered account. Protected API routes require an authenticated session.

### Deploy the web frontend to Vercel

The repository includes a Vercel configuration for the Vite frontend (`apps/web`). Import the GitHub repository into Vercel and deploy with the repository root as the project root. Vercel will run `npm install`, build the `apps/web` workspace, and publish `apps/web/dist` with SPA route rewrites. Set `VITE_API_URL` to the HTTPS base URL of the separately hosted API before deploying; without it, the browser calls the Vercel origin and API requests will fail.

Vercel hosts the web frontend only. The Express API, MariaDB database, Firebase project, and SMTP OTP delivery need their own production hosting and configuration. Set `SUPER_ADMIN_EMAILS` in the API host to a comma-separated list of verified account emails, including the intended administrator's email. Ensure that account is active in `user_accounts` and has an active `org_memberships` row; then restart/redeploy the API. The Super Admin sign-in portal will recognize the allowlisted email, while login still requires the account password and a delivered one-time code. Never put API secrets, passwords, database URLs, or Firebase service credentials in `VITE_*` variables because those values are embedded in the public frontend bundle.

### Platform Super Admin

The local Super Admin demo account is separately identified and mapped to the existing owner membership for workspace access. For production, set `SUPER_ADMIN_EMAILS` in the API environment to a comma-separated allowlist of verified account emails, then restart the API. The server checks this permission for every platform endpoint. Role and membership changes require a reason, are written to the audit log, and cannot leave an organization without an active owner.

### Run the complete stack with Docker

To run MariaDB, the API, and the production web build together:

```bash
docker compose up --build
```

- Web: http://localhost:8080
- API health: http://localhost:4000/health

Compose publishes MariaDB on host port 3307 by default so it can run alongside a local MySQL or MariaDB service already using port 3306. The API connects to MariaDB over the Compose network at `db:3306`; this host port setting does not change that connection. To use another free host port, set `DB_PORT` (for example, `DB_PORT=3308 docker compose up --build`).

Startup and login flow:

1. Run `docker compose up --build` and wait for the `db`, `api`, and `web` services to become healthy.
2. Open http://localhost:8080. Check http://localhost:4001/health if the page cannot reach the API. The API uses port 4000 inside Compose; set `API_PORT` to another free host port if needed.
3. Configure SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_SECURE` and `SMTP_FROM`) in `.env`. For Gmail, use an app password. Set `DEMO_OTP_EMAIL` to the inbox receiving codes for the shared-email demo accounts. Restart the API after changing `.env`.
4. Set all ten `DEMO_*_PASSWORD` values in the ignored `.env` file, then seed password hashes into the local database:

   ```bash
   npm run seed:demo-passwords -w apps/api
   ```

   The seed command is disabled in production and refuses missing or repeated passwords. It stores hashes only. Keep `.env` private; `.env.example` contains placeholders.

5. For an existing database, apply the OTP account-binding migration once:

   ```bash
   docker exec -i ojix-mariadb mariadb -uojix -p ojix_property_mysql < database/migrations/026_demo_login_account_binding.sql
   ```

   Then, if the account profile columns are not present yet, apply migration 027 once:

   ```bash
   docker compose exec -T db mariadb -uojix -pojix_local_only ojix_property_mysql < database/migrations/027_registration_profile_fields.sql
   ```

   New databases receive the columns from the base schema and the Super Admin membership from `infra/db/seed.sql`. OTPs are never shown in the UI or returned by the API; requests return a configuration or delivery error if email cannot be sent.

## Commands

```bash
npm run dev        # start API and web app
npm run build      # build API and web app
npm run typecheck  # TypeScript checks
npm test           # API rule-engine tests
npm run db:locations # reload Karnataka location dropdown data
```

## Core API

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health and DB connectivity |
| GET | `/api/overview` | Workspace counts and recent properties |
| GET | `/api/properties?q=` | Search property workspaces |
| POST | `/api/properties` | Create a property workspace |
| GET | `/api/properties/:id` | Property, documents and findings |
| PATCH | `/api/properties/:id` | Update property fields |
| POST | `/api/properties/:id/documents` | Upload PDF/JPEG/PNG/TIFF files (multipart field `files`) |
| POST | `/api/properties/:id/analyze` | Run deterministic completeness + imported spatial-layer screening |
| GET | `/api/properties/:id/report` | Download a JSON evidence report |
| GET | `/api/map/layers` | GeoJSON for active imported spatial layers |
| POST | `/api/rtc/search` | Validate and initiate an authorised RTC lookup |
| GET | `/api/rtc/:id` | Read a tenant-scoped stored RTC lookup |
| GET | `/api/rtc/:id/status` | Read lookup and manual-intervention status |
| PATCH | `/api/rtc/:id/confirmation` | Record the Owner/Admin source-match decision |

## Karnataka RTC retrieval

The New Property Review form enables **Fetch RTC Details** only after District, Taluk, Hobli, Village and Survey Number are valid. Every attempt is stored separately from the property, so retrieved source data never silently overwrites user-entered facts. With `RTC_PROVIDER_MODE=disabled` (the default), the API returns `manual_required` and the UI links to the official Bhoomi portal. An authorised provider can be enabled with `RTC_PROVIDER_MODE=api`, `RTC_API_BASE_URL` and `RTC_API_TOKEN`. CAPTCHA, authorization failures, timeouts, empty results and malformed provider responses are recorded with explicit statuses. The adapter never attempts to bypass CAPTCHA or authentication controls. Fixture mode is restricted to automated tests.

Live portal review on 13 October 2026 found that `https://landrecords.karnataka.gov.in/service53/` presents Google reCAPTCHA before RTC-information access. `https://landrecords.karnataka.gov.in/Service2/` provides the citizen View RTC and MR form using stateful ASP.NET dropdown postbacks, but the page does not publish an automation licence or a supported machine-to-machine API contract. OJIX therefore does not scrape that form by default. Written authorization and a stable integration contract are required before enabling automated portal navigation in production.

## Firebase Authentication

To enable token verification locally or in cloud:

1. Create a Firebase project and configure Authentication providers.
2. Add `FIREBASE_PROJECT_ID` to the API environment.
3. Ensure each user has a row in `org_memberships` for the workspace they can access. The API rejects users without membership.
4. Configure the web Firebase app with `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and implement sign-in before exposing the app publicly. The current frontend is designed for local developer mode and does not include the sign-in screen yet.
5. In production, do not set `NODE_ENV` to development, do not expose the local bypass, and configure TLS, secrets, least-privilege IAM and rate limits.

## Authentication OTP delivery

Registration and sign-in use cryptographically generated six-digit one-time codes stored as salted scrypt hashes in `otp_challenges`. Login challenges are bound to the selected account UID. Codes expire after 10 minutes, allow at most five incorrect attempts, and are consumed after successful verification or when a replacement code is requested. Registration and login OTP requests have a 30-second resend cooldown and a five-request per-email/account, per-15-minute limit. Migration `026_demo_login_account_binding.sql` adds the account binding and OTP salt columns for existing databases; `027_registration_profile_fields.sql` adds registration profile fields.

Email OTP delivery uses SMTP via `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM`. Gmail can use `smtp.gmail.com`; use a Google app password rather than the account password. Demo-account sign-in needs `DEMO_OTP_EMAIL`. In development, local demo accounts share the configured inbox but use distinct hashed passwords and account UIDs; role selection is checked against the account resolved from its password. The API does not return generated codes. Set provider credentials in the server environment only.

## Free-tier sandbox storage

The API defaults to local document storage. For sandbox testing, it can upload new documents to a private Supabase Storage bucket and issue audited links valid for at most 15 minutes. See [docs/FREE_TIER_SANDBOX_PLAN.md](docs/FREE_TIER_SANDBOX_PLAN.md). Keep the service-role key on the API server only and use synthetic documents until malware scanning and the remaining security controls are implemented.

## Google Cloud production direction

Recommended target architecture from the FRD:

- Web/API: Cloud Run; serve the web app via Firebase Hosting or Cloud Run.
- Database: a managed MySQL-compatible service selected only after its required MariaDB and spatial behavior has been verified against this schema.
- Private files: Google Cloud Storage with uniform bucket-level access, least-privilege service accounts and retention controls.
- OCR: Document AI processor behind a document-processing job interface.
- AI extraction: Vertex AI through a provider abstraction; require schema validation, source/page provenance, confidence and human review.
- Jobs: Cloud Tasks for retryable work dispatch, Pub/Sub for event fan-out and dead-letter handling.
- Operations: Cloud Logging, Monitoring, Error Reporting, backups, point-in-time recovery, alerting and CI/CD.
- Infrastructure: Terraform and GitHub Actions after the cloud project, billing, IAM and secrets are approved.

Do not deploy real client documents to this local setup. Before a pilot with client data, finish Firebase sign-in, tenant/role management, private cloud storage, malware scanning, encryption/retention policies, backup restore tests, dependency scanning, integration tests, rate limits and a security review.

## Importing spatial data

Use the `spatial_layers` table only for data that you are legally permitted to store and use. Every dataset should include source name, source URL, publication/update date, CRS, coverage, licensing, verification state, geometry quality and import timestamp. Reproject to EPSG:4326 before insertion. Keep demo, unverified and verified data visibly distinct. Do not call a dataset “official” based only on a file name.

Example outline (after reviewing licensing and schema):

```sql
INSERT INTO spatial_layers (layer_type, label, source_name, source_url, source_date, data_status, geom, metadata)
VALUES ('stormwater_drain', 'Example imported line', 'Verified source name', 'https://source.example', CURRENT_DATE,
        'unverified', ST_SetSRID(ST_GeomFromText('LINESTRING(77.59 12.88,77.60 12.89)'),4326),
        '{"crs":"EPSG:4326","imported_by":"admin"}');
```

This example geometry is illustrative only; do not use it as a real Rajakaluve record.

## Project structure

```text
apps/
  api/            Express API, risk rules, tests
  web/            React + Vite user interface
database/         canonical MariaDB schema and migrations
infra/db/         Docker database entry point and synthetic seed
.env.example      local configuration template
docker-compose.yml local MariaDB, API and web stack
```

## Production readiness gate

This MVP is suitable for internal product validation with synthetic/test data. It is not ready for external client data until authentication is active, tenant authorization has been reviewed, cloud storage and OCR workers are configured, official sources are integrated with provenance, backup/restore and load tests pass, and an independent security review is completed.
