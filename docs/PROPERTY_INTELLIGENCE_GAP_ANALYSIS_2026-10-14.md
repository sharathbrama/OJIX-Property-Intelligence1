# OJIX Property Intelligence
## FRD Gap Analysis and Go-Live Readiness

**FRD:** OJIX Property Intelligence Functional Requirements Document + Technical Architecture, v1.0, dated 29 September 2026  
**Assessment date:** 14 October 2026  
**Status:** **RED - no-go for an external client-data pilot or public production launch**

> **Baseline note:** this gap analysis records the pre-fix source state. The P0 implementation pass has since removed the named title/GIS/map/PDF fallback behaviors and added truthful missing-data handling. For current implementation, verification and blockers, use [`docs/audit/FINAL-VALIDATION-REPORT.md`](audit/FINAL-VALIDATION-REPORT.md), [`docs/audit/P0-GAP-REGISTER.md`](audit/P0-GAP-REGISTER.md) and [`docs/audit/PROGRESS-TRACKER.md`](audit/PROGRESS-TRACKER.md). The RED release status and cloud, data, security and end-to-end blockers remain current.

## 1. Executive assessment

The repository has a working prototype foundation: real property APIs and MariaDB persistence, authentication and tenant-scoping patterns, upload/checksum metadata, review screens, and substantive title, discrepancy and spatial analysis code. Frontend-to-backend wiring exists for ordinary property and workflow actions.

The FRD launch gate is not met. Several intelligence views can still present invented/demo results when APIs fail or data are absent. OCR is not connected to an OCR provider, authoritative GIS data are not available, the current PDF endpoint serves mock PDF bytes, and production data, security, reliability, and pilot acceptance evidence is missing.

| First release target | Readiness | Planning range after scope/access approval | Confidence |
|---|---|---:|---|
| Internal synthetic-data demo | Near; remove/visibly isolate misleading fallbacks | 1-3 engineering days | Medium |
| Controlled manual-evidence pilot | Not ready; FRD P0 storage, provenance, reporting, security and operations gates remain | 4-8 weeks | Low-medium |
| Automated OCR + authoritative GIS/source launch | Not ready; providers, source permissions, and domain validation remain | 8-16+ weeks | Low |

Ranges are planning assumptions, not commitments. They assume immediate project/cloud decisions, an experienced full-stack engineer and part-time GIS, security, DevOps and legal review. The FRD’s original sequential phase estimates total about 13-24 weeks from discovery through pilot hardening. Existing code may reduce some implementation effort, but no numeric completion percentage is defensible without acceptance evidence for each requirement.

## 2. FRD functional requirement comparison

“Partial” means meaningful code exists but acceptance is not demonstrated or a production dependency is missing. “Pending” means the required capability is not implemented or connected. FRD “Must” items are launch blockers under section 29.

| FRD requirement | Priority | Status | Comparison and remaining evidence |
|---|---|---|---|
| AUTH-01..05, MAT-01, PROP-01..06 | Must / Should | Partial | Property workspaces, roles/membership, OTP and audit patterns exist. Matter-centric completeness, MFA policy, production tenant onboarding, revocation assurance, and acceptance tests still need evidence. |
| DOC-01..07 | Must / Should | Partial / Pending | Upload limits, hashes, parser/classifier and review UI exist. Private GCS, malware scanning, immutable versions, duplicate similarity, Document AI OCR/layout, searchable page-linked extraction and golden-set threshold are not connected. |
| TITLE-01..05 | Must | Partial / blocked by fabricated fallback | DAG, gap logic, event persistence and review actions exist. Empty stored events trigger a fabricated title chain with invented parties/dates and verified statuses. Evidence-linked event creation and owner/source distinctions are not demonstrated end-to-end. |
| GIS-01..07 | Must / Should | Partial / Pending | MapLibre, parcel GeoJSON validation and spatial rules exist. GIS layers are demo/unverified; backend inserts demo features when empty; frontend draws point-centered circles and fallback geometry. Licensed source vintage, CRS, parcel intersections, versioned rules and provenanced snapshots are not launch-ready. |
| DISC-01..05 | Must / Should | Partial | Normalization, comparison, rule IDs/versions and review UI exist. Verify OCR-backed facts, raw source values, evidence anchors, confidence and reviewer state through to report output. |
| LAW-01..05 | Must / Should | Partial | Legal research module exists. FRD requires approved corpus search, citations and source links. Corpus coverage, citations, provenance and acceptance evidence are not verified. |
| RISK-01..05 | Must | Partial / Pending | Explainable rules/scores exist. Finding evidence/owner, configurable versioned rules, data-checked date, source freshness and final report traceability need completion. |
| Admin / source registry | Mixed | Partial | Admin controls/source status exist. Reachability probes do not verify official records; source permissions, snapshots, scheduled refresh and degraded-state behavior need evidence. |
| Async processing / architecture | MVP | Pending | No Cloud Tasks/Pub/Sub processing path with retries, idempotency, dead-letter handling and UI job status. Repo uses Express/Vite and MariaDB; FRD recommends Cloud Run, Cloud SQL PostgreSQL/PostGIS/pgvector and GCS. Production architecture and migration/runbooks must be decided and reconciled. |
| E17 / section 29 launch gate | P0 | Pending | No production-like E2E, independent security review, load result, queue recovery, restore drill, monitoring/alerts, qualified report-template approval or controlled real pilot was evidenced. |

## 3. Real frontend/backend wiring and mock audit

The following behaviors are confirmed in source and are release blockers:

1. **Frontend spatial fallback** - `apps/web/src/components/MapViewer.tsx` injects fixed 18m, 20m, 12.5m and 45m findings, named source layers, synthetic parcel geometry and a one-pixel PNG after an API error.
2. **Backend title fallback** - `GET /api/properties/:id/title-chain` in `apps/api/src/server.ts` invents three historical transactions, people, dates, consideration values and verified statuses when there are no persisted events.
3. **Backend GIS fallback** - spatial routes in `apps/api/src/server.ts` insert named demo drain/waterbody inputs when layer data are empty; point screening also supplies default coordinates when none are provided.
4. **Schematic map shapes** - `MapViewer.tsx` draws circles centered on the property point and a square parcel fallback. These are not actual measured buffers from drain/waterbody source geometry or surveyed parcel boundaries.
5. **OCR path** - document upload stores files/metadata/checksums, but the extract route returns `OCR_NOT_CONFIGURED` unless usable OCR text is supplied. A parser is not PDF/image OCR.
6. **Mock PDF** - `apps/api/src/report-generator.ts` returns `pdfBytesMock`; the API sends it as `application/pdf`, while the UI labels the action “Signed PDF.”
7. **Genuine wiring exists** - property CRUD, upload, review, workflow, title-event and discrepancy calls reach APIs and persisted data. The problem is incomplete evidence/provider integrations and false-success fallback paths, not a wholly static UI.

**Release rule:** if a service, database, provider or evidence layer is unavailable, show `unavailable`, `no evidence` or `manual review required` and record the reason. Keep fixtures test-only or unmistakably isolated to demo tenants. Never represent fabricated results as property findings, title events, GIS screening or client reports.

## 4. Pending work before pilot

### P0 release blockers

- Remove mock/demo fallback results from all production UI/API routes: fabricated distances, layers, title events, parcels, coordinates, raster snapshots and PDF bytes. Add explicit empty/error states and failure-path evidence.
- Carry artifact checksum, extraction engine/provider version, page/bounding-box/text anchor, source URL/publication/retrieval time, confidence, rule ID/version and reviewer decision into every material report finding. Show UNKNOWN/STALE/DEGRADED states.
- Implement private durable document storage, malware/quarantine controls, secure authorized access, encryption/IAM, retention/deletion and access/export auditing. For automated OCR, connect Document AI and async workers with retries, idempotency, DLQ and golden-set evaluation. A manual-first pilot still needs real human-review/provenance workflow.
- Import permitted GIS datasets with source, licence, date, CRS and quality checks. Implement parcel-to-drain/waterbody distance/intersection and versioned rules with known-case tests, freshness status and a real source-backed map snapshot.
- Create title events only from linked evidence and reviewed facts. Replace mock PDF output with a valid deterministic report from the same immutable snapshot, including evidence appendix, date checked, freshness, limitations and recorded qualified-review approval.
- Complete production authentication, tenant onboarding/isolation, roles, session revocation, short-lived file access, retention and security review.
- Choose and validate a production database/cloud target; reconcile the MariaDB implementation with the FRD’s Cloud SQL PostgreSQL/PostGIS recommendation and inconsistent deployment runbooks. Provision CI/CD, secrets, monitoring, backups, restore and queue recovery.
- Pass all Must/P0 requirements and core journeys; provide contract, integration, E2E, geo, golden-corpus, security, load and recovery evidence. Resolve critical/high security issues and obtain legal template approval before a controlled pilot.

### P1 or scope-controlled work

Notification monitoring, broader authority coverage, billing and enterprise APIs are Phase 2 or Should unless promised in pilot scope. FRD section 19 supports user-assisted retrieval and uploaded official records where no authorized stable government API exists. Do not imply live verification from portal-reachability checks.

## 5. Go-live readiness against FRD section 29

| Gate | FRD acceptance | Assessment | Evidence gap |
|---|---|---|---|
| Functional | All P0 and core journeys pass | Not met / not evidenced | No verified production-like intake-to-report journey. |
| Data | Provenance for material facts | Not met | OCR/page evidence and complete report anchors are not connected. |
| Geo | Source metadata, CRS, rules and known cases | Not met | Demo/unverified layers only; no authorized dataset or known-case results. |
| AI | Golden-set threshold and UNKNOWN path | Not met | Document AI and extraction evaluation are absent. |
| Security | No unresolved critical/high issues | Not evidenced | No independent security review supplied. |
| Reliability | Restore and queue recovery demonstrated | Not met | No async queue or restore drill evidenced. |
| Performance | Agreed NFRs achieved | Not evidenced | No measured P95/load results supplied. |
| Operational | Dashboards, alerts, runbooks ready | Not evidenced | Health endpoints/docs exist; production monitoring and incident response are not shown. |
| Legal workflow | Qualified reviewer approves templates/disclaimers | Not evidenced | Review concepts exist; template approval and real PDF sign-off are absent. |
| Pilot | One controlled real workflow completed | Not met | No production-like controlled-data case evidenced. |

## 6. Proposed delivery sequence

1. **Truthful baseline (week 1):** choose release scope, remove/disable mock fallbacks, label fixtures, inventory UI/API/data wiring, decide cloud/database target.
2. **Real evidence path (weeks 1-3):** private storage, auth/tenant controls, immutable artifacts, human evidence review; add OCR only if automated extraction is in first-release scope.
3. **Source-backed intelligence (weeks 2-5):** permitted GIS with provenance/CRS and known cases, evidence-linked title events, discrepancy/rule outputs with review.
4. **Reports and operations (weeks 3-6):** valid immutable-snapshot PDF, professional approval, freshness/limitations, monitoring, backups/restore and CI release path.
5. **Gate validation/pilot (weeks 5-8):** complete FRD acceptance suite and controlled real case, resolve P0/security/NFR gaps, approve cohort/support policy.
6. **Automated breadth (8-16+ weeks, uncertain):** OCR throughput/golden set, broad GIS/source integrations and expanded authority coverage, subject to permissions, licensing and provider availability.

The 4-8 week manual-pilot and 8-16+ week automated ranges are conditional, low-confidence planning estimates. Replace them with an owner-assigned backlog and test evidence after scope, staffing, cloud decisions and source access are known.

## 7. Non-negotiable frontend/backend release rule

A feature is complete only when the production UI calls a real authenticated API contract, the API reads/writes intended persisted data or a real provider, failure is visible without synthetic substitution, and a traceable integration run demonstrates the workflow. Screenshots, hard-coded fallback findings, test fixtures returned by production routes and mock report bytes do not meet acceptance.

## 8. Evidence and limitations

Compared with `OJIX_RFD_Property_Intelligence_v1.0.pdf` (v1.0, 29 September 2026), especially sections 4, 6-9, 15-20, 24-27, 29 and 34. Repository evidence reviewed includes `docs/IMPLEMENTATION_STATUS.md`, `docs/FRD_TRACEABILITY.md`, `README.md`, deployment docs, `docker-compose.yml`, `.env.example`, `apps/web/src/App.tsx`, `apps/web/src/components/MapViewer.tsx`, and API server/document/title/spatial/discrepancy/report modules.

This is a repository-based engineering assessment as of 14 October 2026. No runtime deployment, external cloud configuration, customer data, source contracts, legal review, security testing or end-to-end acceptance run was performed. “Not evidenced” means evidence was not available in reviewed materials, not proof that work never happened elsewhere. FRD architecture is treated as the comparison baseline; product owner must confirm final target and first-release scope.
