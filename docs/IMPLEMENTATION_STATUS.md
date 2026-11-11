# Implementation status

## Implemented in starter build
- [x] Property register and search
- [x] Property workspace creation and update API
- [x] Property identity fields (village, hobli, taluk, survey number, subdivision, extent, address, coordinates, notes)
- [x] Tenant ID on core records and membership lookup in API middleware
- [x] Local development authentication bypass isolated from production mode
- [x] Document upload with type/size limits and SHA-256 checksum
- [x] PostGIS schema, spatial layer registry and proximity screening
- [x] Explainable baseline findings and risk score cap
- [x] JSON report export
- [x] Audit events for key mutations
- [x] Unit tests for deterministic risk engine
- [x] Responsive dashboard and property details UI

## Not yet implemented
- [ ] Frontend sign-in flow and Firebase SDK token injection
- [x] Server-enforced workspace RBAC baseline for ten roles, action-level API checks, audited restriction overrides, workspace membership selection and role-specific dashboards/navigation.
- [~] Sandbox Supabase private-storage adapter and signed URLs implemented; malware scanning and production controls pending
- [ ] Document AI OCR and extraction review UI
- [ ] Cloud Tasks / Pub/Sub worker and dead-letter handling
- [ ] Official government source connectors and provenance validation
- [ ] Verified GIS datasets, topology checks, parcel intersection and applicable legal buffer rules
- [ ] PDF report rendering and professional sign-off workflow
- [ ] CI workflow, Terraform modules, load/security tests, backup restore verification

## RBAC implementation (2026-11-09)
- [x] Server-side role/action policy for Super Admin, Owner, Admin, Lawyer, Analyst, Operations, Consultant, Support, Data Steward and Viewer.
- [x] Permission middleware with a separate Super Admin gate; platform Super Admin does not inherit workspace Owner permissions.
- [x] Workspace permission restrictions with audit trail; overrides cannot expand beyond the server policy baseline.
- [x] Workspace selection via `X-OJIX-Workspace-Id`; API exposes active memberships through `/api/auth/workspaces`.
- [x] Matter assignments scope dashboard/property/evidence lists; Viewer requires an explicit assignment and an approved/complete matter.
- [x] Admin permission matrix UI and dedicated Super Admin portal/navigation.
- [x] Migration 033 adds permission overrides; migration 034 adds Viewer assignment. Both applied to an isolated MariaDB test database for this acceptance run.
- [x] Pure RBAC tests cover all ten roles, actions, Viewer read-only behavior, Super Admin isolation and sensitive route mapping.
- [x] Workspace selection UI lists active memberships and sends the selected organization ID; API rejects a workspace without an active membership.
- [x] Super Admin bootstrap is isolated from workspace Owner, does not reactivate a revoked membership during restart, and first-time provisioning is audited. Super Admin lifecycle endpoint supports audited activation, suspension and revocation; Owner/Admin escalation is rejected.
- [x] Database-backed API suite passed 469/469 against the isolated MariaDB test database and live local API, including all ten roles, dashboard surfaces, organization isolation, matter assignment, disabled/unverified accounts, direct API token rejection and Super Admin lifecycle.
- [ ] A valid Firebase ID token could not be exercised because this local environment has no Firebase project configured. The API's Firebase Admin `verifyIdToken` path is present; verify with a real non-production Firebase project and test identities before deployment.
- [ ] Production authorization acceptance still requires deployment IAM/configuration review, Firebase positive/negative token tests, and runtime tests in the target hosting environment.

## Owner governance additions (2026-11-05)
- [x] Tenant-scoped source health view built from actual portal reachability probes and tenant retrieval history; live official record connectors remain unconfigured.
- [x] Immutable tenant configuration version records for GIS rules, discrepancy rules, document AI/model configuration, and report templates.
- [x] Export history records for successful approved consultant report JSON/Word exports.
- [x] Active GIS/discrepancy versions feed their respective screening engines; version IDs are included in generated snapshots where applicable.
- [x] Active report template versions feed the HTML report executive-summary title and identify the template version in output.
- [ ] Document AI integration still requires provider credentials and worker configuration; no API credentials are stored or returned by these endpoints.
- [x] Approved consultant report shares enforce their configured expiry; export history is recorded.
- [x] Two-step purge request/Owner approval checks retention and legal hold, and calls provider deletion only when supported. Local storage explicitly refuses physical purge.
- [ ] Export watermark rendering and bulk export flows remain unimplemented.
- [ ] No official government data connector is configured or authorized; source status remains disconnected regardless of portal reachability.
- [ ] Vertex AI has no provider adapter. Google Document AI activation requires configured worker credentials and runtime validation.
- [ ] Live Document AI credentials and a non-production Firebase project are not configured in this environment; verify those provider paths before deployment.

## Test strategy before pilot
- Unit: rules, validators, access control and risk aggregation.
- Integration: tenant A cannot read/update/export/upload against tenant B property IDs; invalid token rejected; DB rollback and audit writes.
- GIS: known synthetic geometries, CRS validation, point-in-polygon, distance and tolerance behaviour; no inference from proximity alone.
- Documents: type spoofing, oversized files, duplicate hash, corrupt files, retention/deletion, access control.
- Reliability: API load test, upload concurrency, queue retry/idempotency, DB connection pool and Cloud Run cold starts.
- Security: dependency scan, secret scan, OWASP API review, IAM review, penetration test before client data.
