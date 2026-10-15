# Storage, Cloud, and Backup Plan

**Repository assessment date:** 14 October 2026  
**Current state:** local development storage and Docker Compose exist. No cloud account, production bucket, production DB, automated backup, or restore run was verified. This file is a plan, not a claim that services are provisioned.

## Observed configuration

| Component | Evidence | Verified state |
|---|---|---|
| Database | `DATABASE_URL` config in `apps/api/src/server.ts:111-160`; schema `database/mysql-schema.sql`; Compose MariaDB 10.11 in `docker-compose.yml` | MariaDB implementation in repository; no DB reachable in this run. FRD names Cloud SQL PostgreSQL/PostGIS, so target decision remains open. |
| Documents | API `UPLOAD_DIR` defaults `./uploads`; Multer diskStorage and randomized filename in `apps/api/src/server.ts:62-64,1480-1485`; Docker named volume `ojix_uploads` mounted at `/app/uploads` in `docker-compose.yml:32-38,75-76` | Local persistent volume for Compose only; not a remote/private object-storage adapter. Cloud Run local disk would not provide durable document storage. |
| Document metadata | `documents` stores storage key, MIME, byte count, SHA-256, extraction fields and upload time (`database/mysql-schema.sql:257-289`) | Metadata supports basic provenance; no immutable version/artifact table or provider version observed. |
| Upload access | `GET /api/properties/:id/documents/:docId/file` scopes tenant and property and checks resolved path (`apps/api/src/server.ts:1637-1659`) | Code path exists; not runtime verified. No short-lived signed URL is used. |
| Cloud config | `docs/DEPLOYMENT.md`, `docs/SANDBOX_DEPLOYMENT.md`, Docker files | Deployment guides are proposals; no cloud project/IAM/bucket/secrets evidence. `GCS_BUCKET` is not an implemented storage adapter. |
| Secrets | env-based API config; Compose includes local-only DB passwords | No production secret manager evidence. Do not reuse Compose values externally. |
| Database backups | schema and Compose named DB volume | No automated backup/PITR configuration or backup logs found/evidenced. |
| Document backups | `ojix_uploads` Compose volume | No off-host backup/versioning/lifecycle evidence. Local volume is not a disaster-recovery plan. |

## Required decisions before provisioning

- Confirm MariaDB vs PostgreSQL/PostGIS production target and migration/rollback approach.
- Approve cloud provider/project, billing owner, regions, data residency, IAM/workload identity and deployment access.
- Approve evidence/document sensitivity, encryption requirements, retention, legal hold and deletion policy.
- Decide manual-first pilot or OCR-enabled, expected document count/size/growth and access patterns.
- Product/Tech must agree RPO and RTO. FRD references RPO <=15 minutes and RTO <=1 hour; do not claim those targets until tested.
- Select private object-store adapter and malware scanning/quarantine provider.

## Proposed implementation sequence (not yet done)

1. Provision isolated dev/staging/production environments only after approval; private DB networking; managed secrets; least-privilege workload identity; TLS.
2. Implement private object storage with server-side encryption, public-access prevention, tenant-scoped object keys, random IDs, immutable versions/checksums, audit events, malware quarantine, safe retrieval, retention and deletion.
3. Measure current uploads and define capacity with headroom: document count x observed average and high-percentile file size, plus versions, reports, quarantine and backup copies. No capacity number is defensible before that inventory.
4. Configure database automated backup/PITR and private-object versioning/backup/lifecycle; define retention and key recovery. Back up DB and object metadata/content consistently enough to restore links and checksums.
5. Write restore procedure with ownership, access path, integrity checks, escalation and rollback. Run a timed isolated restore; record backup age (achieved RPO), elapsed recovery (achieved RTO), row counts, object checksums and missing references.
6. Add alerts for backup failures, capacity, queue/storage failures, restore testing schedule and access anomalies. Keep secrets out of CI logs and audit details.

## Acceptance evidence before client data

- Cloud project/environment IDs and approved architecture decision (no credential values).
- IAM policy and public-access prevention review.
- Encryption, lifecycle, retention and deletion configuration evidence.
- Upload/quarantine/access/tenant-isolation tests and audited download evidence.
- Successful database + object restore with checksums, timestamp, achieved RPO/RTO and named role responsible.
- Agreed RPO/RTO and retention/legal-hold approval.

Until those artifacts exist, client-document intake and production claims remain blocked.

