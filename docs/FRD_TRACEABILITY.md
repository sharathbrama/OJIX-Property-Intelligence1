# FRD traceability matrix — starter build

| FRD area | Starter implementation | Status / next work |
|---|---|---|
| Property workspace and identity | `properties` table, create/list/detail/update APIs, register and case-file UI | Implemented for MVP |
| Organisation and access | `organizations`, `org_memberships`, tenant-scoped property/doc/findings queries, write-role guard | Starter baseline; multi-workspace switching and granular RBAC remain |
| Evidence and documents | Upload UI/API, MIME allowlist, file size cap, SHA-256, document metadata | Local-only; add GCS, antivirus, signed access and OCR jobs |
| Spatial intelligence | PostGIS `spatial_layers`, GeoJSON endpoint, MapLibre map, imported-layer proximity findings | Framework only; seed data is synthetic, official GIS integration and geometry rules remain |
| Risk engine | Deterministic completeness checks, capped score, explanation, next action, disclaimer | Starter rules only; lawyer-reviewed configurable rule catalog needed |
| Reporting | JSON evidence report and browser print-to-PDF workflow | PDF layout is client-side print; server-rendered signed PDF remains |
| Audit trail | Audit events for create/update/upload/analyze | Add immutable retention/export and full access/download audit |
| Government sources | Source fields on spatial layers and explicit data status | Not connected; integrations require permissions and current official data |
| Document AI / Vertex AI | Architecture and status indicators in UI | Not connected; add async workers, extraction schema, confidence and human review |
| Async processing | DB status values and integration direction documented | Cloud Tasks/Pub/Sub, idempotency, retry and DLQ remain |
| Security and operations | Helmet, CORS allowlist, rate limit, upload limits, Firebase ID token verification hook, tenant membership checks | Finish frontend auth, Cloud Storage, monitoring, backup/restore, threat model and security test |
| CI/CD | GitHub Actions workflow | Runs after push; not executed from this environment because package installation was unavailable |
