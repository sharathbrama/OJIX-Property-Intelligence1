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

6. Open the web app. In local mode, the API uses the seeded `local-developer` identity and demo workspace. This bypass is intentionally limited to development; `NODE_ENV=production` refuses unauthenticated operation.

### Platform Super Admin

In development, the seeded owner account can open **Super Admin** from the sidebar. For production, set `SUPER_ADMIN_EMAILS` in the API environment to a comma-separated allowlist of verified account emails, then restart the API. The server checks this permission for every platform endpoint. Role and membership changes require a reason, are written to the audit log, and cannot leave an organization without an active owner.

In local development, seeded demo accounts sign in with the development password (`ojix123`) without an OTP. Registered accounts and production still use OTP verification.

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
3. Register with a new email and a password containing at least eight characters, uppercase and lowercase letters, and a number.
4. Configure `RESEND_API_KEY` and `OTP_FROM_EMAIL` in `.env` for real email OTP delivery. For local demo-account sign-in, set `DEMO_OTP_EMAIL` to the inbox that should receive its code. Restart the API after changing `.env`. OTPs are never shown in the UI; requests return a configuration or delivery error if email cannot be sent.
5. If login reports `Invalid email or password`, confirm the account was verified in this Compose database. Compose persists its database in `ojix_db_data`; deleting that volume removes local accounts and data.

Existing databases need migration 019 for verified phone numbers:

```bash
docker exec -i ojix-mariadb mariadb -uojix -pojix_local_only ojix_property_mysql < database/migrations/019_phone_otp.sql
```

To enable SMS OTP, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` in `.env`. For demo accounts, set `DEMO_OTP_PHONE` in E.164 format. New registrations can add a phone number and must verify it by SMS before the account is activated. Existing accounts can continue using email OTP; SMS is available after their phone number has been verified.

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
