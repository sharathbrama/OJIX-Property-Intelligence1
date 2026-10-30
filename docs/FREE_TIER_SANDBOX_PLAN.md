# Free-tier sandbox plan

This plan is for synthetic and non-sensitive test data. It is not approval to store real client documents.

## Recommended sandbox stack

- **Vercel:** React/Vite web application preview deployments.
- **Supabase:** private document bucket and short-lived signed URLs.
- **Existing MariaDB:** keep the current database locally during the first sandbox phase. Moving this MySQL/MariaDB schema to Neon or Supabase PostgreSQL is a separate migration because the SQL and spatial behavior differ.
- **Firebase Authentication:** optional next step because the API already verifies Firebase ID tokens.

This avoids combining two database migrations with the document-storage work. Supabase is initially used only as private object storage.

## Configure private Supabase document storage

1. Create a Supabase project for sandbox use.
2. Create a bucket named `private-documents` and keep **Public bucket** disabled.
3. Add these server-only values to the API environment:

   ```env
   DOCUMENT_STORAGE_PROVIDER=supabase
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
   SUPABASE_STORAGE_BUCKET=private-documents
   SIGNED_URL_TTL_SECONDS=300
   ```

4. Never add `SUPABASE_SERVICE_ROLE_KEY` to a `VITE_` variable, browser bundle, committed file, or Vercel frontend environment.
5. Restart the API. New uploads use tenant/property/document object keys. Existing locally stored documents continue to use their authenticated API route.

The endpoint below returns a link valid for 30–900 seconds for Supabase objects:

```http
POST /api/properties/:propertyId/documents/:documentId/signed-url
Content-Type: application/json

{"expiresInSeconds":300}
```

Every cloud signed-link request is tenant-scoped and recorded in the audit log. Local sandbox files return the existing authenticated API URL instead of pretending to be cryptographically time-limited.

## Vercel boundary

Deploy `apps/web` to Vercel and configure `VITE_API_BASE_URL` with the HTTPS URL of the API. The current stateful Express/MariaDB API and local OCR executable should not be forced into a Vercel function. Host that API separately when the sandbox needs remote access, or keep it local during UI work.

## Next implementation slices

1. Add a quarantine status and malware-scanner adapter (ClamAV locally; webhook/provider adapter in cloud).
2. Add a durable jobs table and worker for OCR/report jobs, with idempotency, attempts and dead-letter state.
3. Add Playwright/PDF rendering behind that worker.
4. Finish Firebase sign-in in the web app and enforce roles for document/report actions.
5. Add document versions, lawyer approval and signed report snapshots.
6. Import only licensed GIS datasets with source, date, CRS and verification metadata.

## Deferred production work

MFA policy, key management, legal retention, immutable backups, restore drills, official government-data licences, production monitoring, load testing and authorized penetration testing remain production gates.
