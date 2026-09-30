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
- [ ] Role-based permissions beyond workspace membership
- [ ] Cloud Storage adapter / signed URLs / malware scanning
- [ ] Document AI OCR and extraction review UI
- [ ] Cloud Tasks / Pub/Sub worker and dead-letter handling
- [ ] Official government source connectors and provenance validation
- [ ] Verified GIS datasets, topology checks, parcel intersection and applicable legal buffer rules
- [ ] PDF report rendering and professional sign-off workflow
- [ ] CI workflow, Terraform modules, load/security tests, backup restore verification

## Test strategy before pilot
- Unit: rules, validators, access control and risk aggregation.
- Integration: tenant A cannot read/update/export/upload against tenant B property IDs; invalid token rejected; DB rollback and audit writes.
- GIS: known synthetic geometries, CRS validation, point-in-polygon, distance and tolerance behaviour; no inference from proximity alone.
- Documents: type spoofing, oversized files, duplicate hash, corrupt files, retention/deletion, access control.
- Reliability: API load test, upload concurrency, queue retry/idempotency, DB connection pool and Cloud Run cold starts.
- Security: dependency scan, secret scan, OWASP API review, IAM review, penetration test before client data.
