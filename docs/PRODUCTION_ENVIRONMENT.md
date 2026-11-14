# Production environment inventory

This is a configuration inventory, not a credential store. Never commit real values here or in `.env`, source code, browser bundles, build artifacts, logs, or support tickets. Supply secrets through the selected API/worker host's secret manager or protected environment.

## Database initialization and migration handling

- API startup creates a connection pool only; it deliberately runs no schema DDL. See `apps/api/src/server.ts`.
- Fresh local Docker initialization loads `database/mysql-schema.sql`, then `infra/db/seed.sql`. Do not replay historical migrations on top of this current canonical schema.
- The 31 historical files in `database/migrations` are numbered 004–034 and represent forward deltas from an earlier baseline. The repository has no automated migration runner or migration ledger, and README examples apply selected files manually rather than defining a complete deployment history.
- Do not run migration 031 blindly: it is one-shot/non-idempotent and may already have partially or fully applied on a target. Inspect schema and migration records, verify a restorable backup, and rehearse on a disposable copy first.
- Phase 3 rehearsal server: MariaDB 10.11.19 container `ojix-mariadb-migration-test`, bound only to `127.0.0.1:3317`, using dedicated volume `ojix_migration_test_data`. The disposable DB `ojix_migration_rehearsal` was created there; credentials remain in Git-ignored `.env.migration-test` (mode 0600) and must never be used by application or production services.
- All 31 historical files passed on a reconstructed baseline candidate. Production readiness is still blocked by unverified baseline provenance, migration 026's Super Admin-to-Owner role change and 3 failing API tests, migration 034/canonical index drift, lack of a ledger, and no backup/restore rehearsal. Details are in `docs/DATABASE_MIGRATION_REHEARSAL.md`.
- A migration ledger/runner has been proposed but is not implemented. Implementation requires explicit design approval; this rehearsal did not alter migrations, startup behavior, or deployment scripts.

## Architecture-dependent settings

The current code has no production hosting/API URL selected. `apps/web/src/apiConfig.ts` currently hardcodes a same-origin empty base. Add a production public `VITE_API_BASE_URL` configuration or an explicitly supported proxy before deploying the frontend. It must contain an HTTPS URL and no secret.

## API service

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT` | Runtime mode and listener port; use production mode and platform-provided port. |
| `DATABASE_URL`, `DATABASE_SSL` | MySQL/MariaDB connection; credentials server-only and TLS enabled when supported. |
| `CORS_ORIGIN`, `TRUST_PROXY_HOPS` | Exact frontend origin allowlist and trusted proxy configuration. |
| `FIREBASE_PROJECT_ID` | Optional Firebase ID token verification. This alone does not wire frontend Firebase login. |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Optional one-time Super Admin bootstrap; inject securely, rotate/remove bootstrap secret after provisioning according to operating procedure. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | OTP email delivery. SMTP password server-only. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` | Optional SMS delivery; credentials server-only. |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Local storage path and upload cap. Local disk is unsuitable on ephemeral hosts without persistent encrypted storage. |
| `DOCUMENT_STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `SIGNED_URL_TTL_SECONDS` | Existing local/private Supabase storage adapter configuration. Keep bucket private and service role key API-only. |
| `OCR_WORKER_TOKEN`, `OCR_RETRY_DELAY_SECONDS`, `OCR_LANGUAGES`, `OCR_MAX_PAGES`, `OCR_TIMEOUT_MS` | Worker authentication and bounded OCR settings. Token shared only with private worker. |
| `RTC_PROVIDER_MODE`, `RTC_API_BASE_URL`, `RTC_API_TOKEN`, `RTC_REQUEST_TIMEOUT_MS` | Disabled by default; enable only with authorized supported integration. |

## OCR worker

Provide `DATABASE_URL`, `OCR_API_INTERNAL_URL`, `OCR_WORKER_TOKEN`, `OCR_LANGUAGES`, `OCR_MAX_PAGES`, `OCR_TIMEOUT_MS`, `OCR_WORKER_POLL_SECONDS` and required private storage settings. The worker requires Python dependencies, Poppler and Tesseract Kannada/English language data. It must be able to access files without public URLs and reach only the API/database/storage resources it needs.

## Frontend Firebase public configuration

If Firebase web SDK features are enabled, the frontend may need `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. These identify the public web app and are not backend secrets; provider configuration and strict authorization still matter. The current UI authentication flow is API OTP, so do not assume adding these variables completes Firebase Authentication. Never prefix SMTP, DB, service account, Supabase service-role, Twilio auth, bootstrap password, or worker secrets with `VITE_`.

## Rotation and handling

Use unique production credentials; rotate any credential that has appeared in a shared or committed environment. Do not paste secret values into audit or handover documents. Restrict access by operator role, log secret access where supported, and document the responsible owner and rotation cadence in the organization's secret manager.
