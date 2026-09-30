# Deployment runbook (staging/prod)

This is a controlled deployment plan, not an automatic production deploy. Do not deploy until a GCP project, billing, domain, IAM, data classification, retention and security review are approved.

## Suggested order
1. Create separate dev/staging/prod Google Cloud projects.
2. Enable Cloud Run, Cloud SQL Admin, Artifact Registry, Cloud Build, Secret Manager, Cloud Logging and Cloud Monitoring APIs.
3. Create a private Artifact Registry repository.
4. Provision Cloud SQL PostgreSQL and confirm PostGIS availability for the chosen version/region; run `infra/db/schema.sql` as a controlled migration.
5. Store DB credentials and application secrets in Secret Manager; never commit service-account keys.
6. Create a Cloud Storage bucket with uniform bucket-level access, public access prevention, lifecycle/retention policy and least-privilege service account access. Implement the GCS adapter before client uploads.
7. Configure Firebase Authentication and seed approved workspace memberships. Implement frontend sign-in/token injection before enabling the API publicly.
8. Deploy API to Cloud Run with minimum required IAM, `FIREBASE_PROJECT_ID`, `DATABASE_URL` via Secret Manager, `CORS_ORIGIN`, `NODE_ENV=production`, and a non-public storage configuration.
9. Deploy web build to Firebase Hosting or Cloud Run. Set `VITE_API_URL` to the HTTPS API URL at build time.
10. Configure custom domain, TLS, CORS allowlist, Cloud Armor or equivalent edge protections where appropriate, request limits, alerting, DB backups and point-in-time recovery.
11. Run migration checks, tenant-isolation tests, upload tests, restore drill, dependency/secret scans, performance tests and a security review.
12. Start with synthetic data, then a controlled pilot with explicit customer consent and a documented data processing/retention policy.

## Current limitations
- API Dockerfile writes uploaded files to local container storage. Cloud Run local disk is ephemeral; do not accept real documents until private Cloud Storage is implemented.
- The frontend does not include a Firebase sign-in screen yet. Production API auth is enforced if Firebase project ID is configured, but frontend token injection must be completed.
- No Cloud Tasks/Pub/Sub workers or Document AI/Vertex AI adapters are deployed.
- Do not create or use real official property data in the demo spatial layer.
