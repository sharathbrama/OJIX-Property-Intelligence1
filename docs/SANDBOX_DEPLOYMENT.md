# Sandbox deployment note

The former zero-cost sandbox guide described a PostGIS/PostgreSQL and Cloudflare tunnel setup that does not match the current repository. The current API uses MariaDB/MySQL and the frontend/API are separate services. Do not use that former setup for customer or production data.

For supported local development, run `docker compose up -d --build`. For a hosted deployment, use the current [production deployment runbook](DEPLOYMENT.md). The runbook records current blockers and does not treat the developer's local Docker stack as a public API host.
