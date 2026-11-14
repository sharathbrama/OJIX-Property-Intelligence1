# OJIX Demo and Deployment Guide

This guide is for a product walkthrough with synthetic data. It covers the current demo stack and its implemented feature areas; it does not turn the MVP into a production legal verification service.

## 1. Start a local demo

Requirements: Docker with Compose, Node.js 20+, and npm 10+.

From the repository root:

```bash
cp .env.example .env
docker compose up --build -d db
npm install
npm run db:locations
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The local API should answer at [http://localhost:4002/health](http://localhost:4002/health). The Compose API port is 4001 instead. If the database volume was created from a much older schema, use the migration instructions in [README.md](../README.md) before starting the API.

The seed creates the **OJIX Local Demo Workspace**, one synthetic sample application (`OJIX-DEMO-0001`) and a clearly labelled demo map shape. Its location, documents, map geometry and findings are not verified real-world records.

## 2. Set demo passwords

Demo identities share a demonstration email address and are separated by role and password. Set ten distinct values in the root `.env` file; never commit it:

```dotenv
DEMO_SUPER_ADMIN_PASSWORD=replace-with-a-unique-local-password
DEMO_OWNER_PASSWORD=replace-with-a-unique-local-password
DEMO_ADMIN_PASSWORD=replace-with-a-unique-local-password
DEMO_LAWYER_PASSWORD=replace-with-a-unique-local-password
DEMO_ANALYST_PASSWORD=replace-with-a-unique-local-password
DEMO_OPERATIONS_PASSWORD=replace-with-a-unique-local-password
DEMO_CONSULTANT_PASSWORD=replace-with-a-unique-local-password
DEMO_SUPPORT_PASSWORD=replace-with-a-unique-local-password
DEMO_DATA_STEWARD_PASSWORD=replace-with-a-unique-local-password
DEMO_VIEWER_PASSWORD=replace-with-a-unique-local-password
DEMO_OTP_EMAIL=your-demo-inbox@example.com
```

Set every password to a different value, then seed hashes into the local database:

```bash
npm run seed:demo-passwords -w apps/api
```

Configure SMTP credentials in `.env` for email verification codes. Demo identities do not bypass OTP verification. The local UI lists the available roles at sign-in; choose a role, use its configured password, and enter the code delivered to `DEMO_OTP_EMAIL`. Without a working SMTP inbox, the seeded demo identities cannot complete login; configure email before the walkthrough.

## 3. Walk through the application

After sign-in, open **Workflow Guide** from the sidebar and start with **Try the demo**. The main walkthrough is:

1. Open the seeded sample case or create another property application.
2. Inspect property identity, location and supplied case information.
3. Upload synthetic or redacted PDF/JPEG/PNG/TIFF files to try document intake, classification and field review.
4. Compare recorded facts and evidence, review title-chain/discrepancy findings, and run the preliminary screening where available.
5. Open map intelligence to see the illustrative demo geometry and inspect the source registry's provenance/readiness information.
6. Review the case report and try its export controls. Sign out and repeat with Owner, Admin, Operations, Analyst, Lawyer, Consultant, Viewer, Data Steward, Support and Super Admin roles to see role-based access.

The guide changes by role and links to relevant sections. Admin can try member and workflow controls; Super Admin can inspect platform-level controls. Use only synthetic records and safe sample files for a shared demonstration.

## 4. Docker Compose demo

For a self-contained laptop demo, configure the root `.env` as above and run:

```bash
docker compose up --build
```

Then open [http://localhost:8080](http://localhost:8080). The API is published on port 4001 by default. The Compose web/API/database/worker stack is suitable for local evaluation. Use `docker compose down` to stop it. `docker compose down -v` also deletes the local database volume and demo records.

## 5. Deploying for an external audience

The checked-in Cloud Run YAML is a preparation template with `REPLACE_*` values, not a turnkey deployment. Before deploying, choose and configure the cloud project, region, billing, managed MySQL-compatible database, private file bucket, service accounts/IAM, secret names, Firebase project, exact HTTPS frontend origin, SMTP provider, and domain. Store credentials in a secret manager; do not put passwords or service keys in frontend `VITE_*` variables.

The app's Cloud Run direction and readiness gates are documented in [CLOUD_RUN_PRODUCTION_PREPARATION.md](CLOUD_RUN_PRODUCTION_PREPARATION.md), [PRODUCTION_ENVIRONMENT.md](PRODUCTION_ENVIRONMENT.md), and [MVP_DEPLOYMENT_PLAN.md](MVP_DEPLOYMENT_PLAN.md). Validate MariaDB spatial and migration compatibility against the selected managed database before committing to it. Deploy the API and web as separate services (or web via Firebase Hosting), run reviewed database migrations, configure Firebase authentication and private storage, then test role access, uploads, backups/restores, logs, and health checks using synthetic data.

Do not publish the local demo password hashes or account setup, expose a development API, or accept client documents until authentication, tenant access, private storage, malware scanning, retention, backups and security review are complete. Current external government registry integrations and legal verification are not live by default.

### Vercel frontend preparation

The repository root is the Vercel project root because the web app is an npm workspace. `vercel.json` sets the install/build commands and `apps/web/dist` output, and routes client-side paths to the SPA. The public homepage and read-only seeded sample preview do not need an API. Until the backend is deployed, Client Login and Register can display their existing forms but cannot complete requests. When the API is ready, set `VITE_API_BASE_URL` in Vercel's Production environment to its HTTPS origin (for example, `https://ojix-api-<approved-suffix>-<region>.a.run.app`, without credentials); the Vite config rejects a non-HTTPS Vercel production value. The variable is public frontend configuration, never a secret.

Once Vercel access and the API are ready:

```bash
vercel link
vercel env add VITE_API_BASE_URL production
vercel --prod
```

At the prompts, select the existing OJIX Vercel project, set the API HTTPS origin, and confirm that its `CORS_ORIGIN` allows the exact deployed Vercel browser origin. Do not deploy until the API and isolated database/storage/worker are ready; Vercel only serves the frontend and does not make the backend persistent.

### Requested Google Cloud architecture

The target frontend/API/database/storage/worker layout and Cloud Run preparation manifests are described in [CLOUD_RUN_PRODUCTION_PREPARATION.md](CLOUD_RUN_PRODUCTION_PREPARATION.md). The manifests still contain placeholders and require project-specific network, service-account, image, secret, database, and Vercel-origin values. Creating Cloud SQL, Cloud Run, Artifact Registry, networking, Secret Manager entries, or a continuously running OCR worker may incur charges. No cloud resources or secrets were created as part of this preparation.

## What's available to demonstrate

- Role-specific workspace access and administrative controls.
- Property case management, document intake and review, title-chain and discrepancy tooling.
- Preliminary explainable findings, map context, source registry, legal research workspace and report workflow.
- Audit/workflow surfaces and JSON evidence/report exports where enabled for the signed-in role.

Feature behavior is constrained by available case evidence and the configured environment. OCR is a local/manual-review aid; do not present it as production Document AI or automated legal advice.
