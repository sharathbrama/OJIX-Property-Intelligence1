# OJIX Property Intelligence — MVP 0.1.0

A Karnataka-first, Bengaluru-first property due-diligence workspace built from the OJIX Property Intelligence FRD. This is an engineering starter/MVP, not a production-ready legal verification service.

## Included in this build

- Responsive React + TypeScript PWA-style workspace (overview, property register, property case file, documents, map context, findings).
- TypeScript/Express REST API with request validation, upload size/type limits, rate limiting, security headers, audit events and tenant-scoped property/document/findings queries.
- PostgreSQL + PostGIS schema for organizations, memberships, properties, documents, spatial layers, findings and audit events.
- SHA-256 checksum recorded for every uploaded file.
- Explainable baseline screening rules for missing survey number, documents and coordinates.
- Spatial-layer proximity checks against explicitly imported features. The seeded feature is synthetic and labelled demo; it is not an official boundary.
- JSON evidence report export.
- Firebase ID-token verification support, activated when `FIREBASE_PROJECT_ID` is set.
- Unit tests for baseline findings and score behaviour.

## Not yet implemented / do not imply it is live

- No live Bhoomi, Kaveri 2.0, BBMP/e-Aasthi, BDA or Rajakaluve government integration.
- No Document AI OCR or Vertex AI extraction pipeline yet. Uploads are queued in metadata only; files remain in local `uploads/` for development.
- No verified survey parcel boundaries, official lake/SWD geometry, buffer-rule engine or official planning notices.
- No production Cloud Storage adapter, Cloud Tasks/Pub/Sub workers, PDF report renderer, billing or organisation-management UI.
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

2. Start PostGIS:

   ```bash
   docker compose up -d db
   ```

   The first database initialisation loads the schema and one synthetic demo workspace. If you already ran the database and change schema/seed files, recreate the local volume only if you are comfortable deleting local data:

   ```bash
   docker compose down -v
   docker compose up -d db
   ```

3. Install workspace dependencies:

   ```bash
   npm install
   ```

4. Start API and web app in separate terminals (or use `npm run dev` from the root):

   ```bash
   npm run dev
   ```

   - Web: http://localhost:5173
   - API health: http://localhost:4000/health

5. Open the web app. In local mode, the API uses the seeded `local-developer` identity and demo workspace. This bypass is intentionally limited to development; `NODE_ENV=production` refuses unauthenticated operation.

## Commands

```bash
npm run dev        # start API and web app
npm run build      # build API and web app
npm run typecheck  # TypeScript checks
npm test           # API rule-engine tests
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
- Database: Cloud SQL for PostgreSQL with PostGIS enabled where supported by the chosen instance configuration; verify extension availability before provisioning.
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
infra/db/         PostGIS schema and synthetic seed
.env.example      local configuration template
docker-compose.yml local PostGIS
```

## Production readiness gate

This MVP is suitable for internal product validation with synthetic/test data. It is not ready for external client data until authentication is active, tenant authorization has been reviewed, cloud storage and OCR workers are configured, official sources are integrated with provenance, backup/restore and load tests pass, and an independent security review is completed.
