# OJIX Property Intelligence — revised delivery plan

**Prepared:** 14 October 2026  
**Planning baseline:** OJIX Property Intelligence FRD v1.0 (29 September 2026), repository review and current uncommitted work  
**Current release status:** **RED — not ready for external client data or public production**  
**Commitment status:** **No baseless ship date. A bounded reforecast is required.** Start with a 5-business-day decision and technical-baseline checkpoint. At that checkpoint, named owners must provide confirmed capacity, access, blockers and revised effort; publish a calendar forecast for the next 2-week execution window. Reforecast every 2 weeks until the pilot gate. Dates depend on decisions and access, not optimism. Person-day ranges below are provisional engineering estimates, not delivery commitments.

## 1. Executive delivery position

The assigned scope is the full Property Intelligence product. The current uncommitted changes improve the landing/login experience but do not close the major FRD P0 product or launch gaps. Pause further visual polish beyond accessibility, usability or defect fixes needed by a core workflow. Reprioritize engineering around real APIs and persisted evidence, secure document processing, trustworthy GIS, real reports and release readiness.

An internal synthetic-data demonstration can be made safer sooner, but it is not a client pilot. A controlled manual-evidence pilot is the first plausible release target; automated OCR and broad government/GIS integrations should remain separate until source rights and provider access are confirmed.

## 2. Immediate execution plan and measurable exits

Effort uses person-days (PD) for one qualified contributor. Ranges are provisional and exclude external approval, procurement and waiting time. Work may overlap only after prerequisites are met. The first 1–2 week discovery/decision block is a proposed planning window, not an approved calendar commitment.

| Order / FRD | Work package and accountable role | Effort range | Dependency / blocker | Definition of done |
|---|---|---:|---|---|
| 0 — E01/E02/E17 | Scope, architecture and access decisions — Product owner + Tech lead | 3–6 PD | Product/release scope, named owners, cloud project and source access are not confirmed | Signed decision record for pilot cohort, manual vs automated OCR, supported source data, database/cloud architecture, target NFR/load profile, retention, report approver and roles. Risk/assumption log has an owner and due date for each blocker. |
| 1 — baseline | Remove misleading synthetic fallback behavior — API + web engineers | 3–6 PD | None beyond safe fixture boundary agreement | Empty, missing, stale or failed source/API responses display explicit no-evidence/unavailable/manual-review states. No invented title events, coordinates, parcel shapes, distances, layers, raster evidence or PDF bytes can enter production responses. Fixtures are test-only or visibly isolated synthetic demo data. Failure paths are recorded and demonstrated. |
| 2 — E02/E03/E11 | Real authenticated workflow and tenant authorization — API + web engineers, security reviewer | 8–15 PD | Identity provider/project, tenant onboarding model, role matrix and pilot user list | A pilot user signs in, sees only authorized tenant/matters, performs role-allowed actions, and session revocation/access denial are verified. API authorization applies to every relevant record, document, export and review action. Audit records cover privileged and material changes. |
| 3 — E04/E05/E06 | Secure documents and evidence review — API/storage + document engineer, security reviewer | 12–22 PD manual-first; OCR extension separately 10–20 PD | Cloud/storage choice, IAM/secrets, retention and deletion policy; OCR provider/account and golden corpus for automated path | Private durable versioned storage with checksum, authorized short-lived access, upload validation, malware quarantine/scanning, retention/deletion and audited download/export. Manual-first pilot allows reviewers to attach normalized facts to document/page evidence and record confidence/source/reviewer state. Automated scope additionally has async OCR/extraction jobs, retries/idempotency, error states, page/bounding-box anchors and golden-set evaluation. |
| 4 — E07/E10/E11 | Evidence-backed title, discrepancy and findings workflows — API + domain/web engineers, legal SME | 10–18 PD | Evidence schema/review states and representative approved cases | Title events and discrepancy values link to source document/page anchors, preserve raw and normalized values, expose gaps/uncertainty and reviewer decisions, and maintain audit history. No empty-data fabricated history. Material findings include severity, reason, inputs, owner/state, rule ID/version and next action. |
| 5 — E08/E09 | Trusted map and spatial screening — GIS engineer + API/web engineer, data steward/legal reviewer | 12–24 PD after data receipt | Authorized dataset/licence and vintage, CRS/quality metadata, sample known cases, selected database/PostGIS plan | Ingested layer registry records publisher, source/license, vintage, CRS/SRID, coverage, checksum and quality/freshness. Geometry validation and deterministic distance/intersection rules with version are visible. Known cases and edge tolerances pass. Map and report use actual geometry; unavailable/stale inputs are explicit. No proximity is represented as legal determination. |
| 6 — E12 | Genuine report generation — API/report engineer + legal reviewer | 8–14 PD | Evidence/finding model, map snapshot, approved template/disclaimer/sign-off policy | Deterministic HTML and valid PDF generated from one immutable versioned dossier snapshot. Report has source/evidence appendix, map snapshot when available, data-checked/freshness dates, limitations, reviewer identity/approval state and audit event. Verify artifact opens and matches snapshot; remove “signed” label unless signature workflow is actually implemented. |
| 7 — E17/E01 | Production platform, reliability and security — DevOps + Tech lead + security reviewer | 12–24 PD | Cloud/database choice, budget/account access, environment/secrets, agreed NFRs | CI checks/release path, least-privilege secrets/IAM, TLS, logs/metrics/alerts/runbooks, automated backup/PITR, demonstrated restore against FRD RPO <=15 min/RTO <=1 hour targets, queue recovery where queues are in scope, load results for agreed workload and no unresolved critical/high security findings. |
| 8 — section 26/29 | Acceptance and controlled pilot — QA + product owner + legal reviewer + pilot operator | 8–15 PD plus pilot cycle | All P0 work complete; representative controlled data and reviewers available | Contract, integration, role/tenant, negative/edge, golden corpus, GIS known-case, E2E intake-to-report, performance, restore and security evidence reviewed. Qualified reviewer approves templates/disclaimers; one controlled end-to-end real workflow completes with documented acceptance and rollback/support plan. |

**Provisional total:** approximately **76–144 PD** for the manual-first controlled pilot path, including shared foundation and acceptance work; add approximately **10–20 PD** for automated OCR/extraction if not included in the estimates above. The P0 issue register, security gap register and test contract below decompose and add acceptance detail to those work packages; they are not extra effort to sum again. This is a rough sum with potential overlap and uncertainty, not a committed schedule. GIS/source access, cloud procurement, legal review and security remediation can add elapsed time that person-day estimates do not capture. Re-estimate after Work Package 0 with named contributors and actual access confirmed.

## 2A. P0 issue register and execution order

The first sprint objective is to make missing data truthful and produce a testable end-to-end path. Track each item in the project issue tracker with a named individual, due date, status, acceptance evidence and dependency. Until named individuals are assigned, the role owners below are accountable roles, not claimed assignments.

| P0 | Action | Accountable role | Acceptance evidence | Dependency / escalation |
|---|---|---|---|---|
| P0-1 | Remove dummy/fabricated title, GIS, parcel, distance, snapshot and report responses from API and UI paths. Keep synthetic data only in explicitly labelled demo fixtures/test mode. | API lead + Web lead | Source review and failure-case walkthrough show no fabricated values; empty API responses render “not available/no evidence” with reason. | If demo behavior is still needed, isolate behind explicit demo tenant and environment guard. |
| P0-2 | Verify required fields and source availability before analysis; persist a missing-data reason and checked-at timestamp. | API lead + Product | Screens show missing inputs/source freshness; API response distinguishes absent, stale, unavailable and failed. | Product defines acceptable freshness by source. |
| P0-3 | Implement authenticated E2E: sign in -> create matter/property -> upload document -> review source evidence -> run analysis -> review title/discrepancies/map -> generate report -> retrieve it with authorized role -> audit event. | QA lead + API/Web leads | E2E run record with build/commit, environment, test identities/roles, IDs, timestamps, expected/actual results and defects. Include denied cross-tenant request and provider/API outage. | Requires decision on auth provider, test environment, representative controlled documents and roles. |
| P0-4 | Secure document lifecycle: private durable storage, malware quarantine/scan, checksum/version, short-lived authorized access, retention/deletion and audited downloads/exports. | Storage/Platform lead + Security | Storage configuration evidence, access tests, quarantine test, deletion/retention procedure, audit samples and restore result. | Cloud project, IAM, budget, retention and legal-hold decision. |
| P0-5 | Make all material report facts traceable to source evidence and time. | API/report lead + Legal reviewer | Each fact/finding includes document ID and immutable version/hash, page and anchor when available, source name/URL, publication/retrieval/check timestamp with timezone, extraction/rule version, reviewer and review timestamp/state. Report links open only with authorization. | Evidence schema, real PDF renderer, template and qualified approver. |
| P0-6 | Make map results source-backed or explicitly unavailable. | GIS/Data steward + API lead | Dataset license, publisher, vintage, CRS, checksum/import time, known-case results, rule version and screening timestamp appear in UI/report; stale/missing layer has no synthetic replacement. | Licensed dataset and known-property cases. |
| P0-7 | Document and close production authentication, storage, cloud, secrets, backup and restore gaps below. | Tech lead + Security + Platform | Reviewed architecture/security checklist; implementation links and restore drill evidence; no unresolved critical/high findings before pilot. | Cloud/database, identity and environment decisions. |

## 2B. Security and architecture gap register

This is a repository-based gap inventory, not a penetration test or cloud configuration audit.

| Area | Current evidence / gap | Required action before client-data pilot | Owner |
|---|---|---|---|
| Authentication | `FIREBASE_PROJECT_ID` enables Firebase token verification, but README says frontend Firebase sign-in/token injection is not implemented. Local developer bypass and seeded demo identities exist. | Implement production sign-in, token refresh/expiry, logout, session revocation and tenant onboarding; remove demo identities/bypass from production build; prove invalid/expired token and unauthorized role are denied. | Identity/API + Web leads |
| Authorization / tenant isolation | Membership and role guards exist, with tenant-scoped queries in many routes; full route-by-route coverage has not been independently evidenced. | Map every endpoint, document, report/export and admin action to role/tenant policy; integration-test cross-tenant IDs and least privilege; log privileged actions. | API lead + Security reviewer |
| CORS / security headers | API currently configures `cors({ origin: true, credentials: true })`; Helmet CSP is disabled. | Replace with explicit production origin allowlist; review CSP and browser security policy; document justified exceptions; run security review. | API lead + Security reviewer |
| File storage | `UPLOAD_DIR` defaults to local `./uploads`; Docker uses a local named volume. `GCS_BUCKET` is only a configuration/status hook in reviewed paths. | Implement private object storage, encryption, least-privilege service identity, signed/short-lived access, malware scanning/quarantine, versioning, lifecycle retention, deletion and access audit. | Platform/Storage + Security |
| Secrets / cloud | Env template has cloud/provider placeholders; no verified production project/IAM/secrets/deployment evidence was supplied. | Decide cloud/database target, provision isolated dev/stage/prod, use secret manager and workload identity, restrict network/DB access, document deploy/rollback and ownership. | Tech lead + Cloud owner |
| Database architecture | Application currently uses MariaDB; FRD recommends Cloud SQL PostgreSQL/PostGIS. Production target and migration strategy are undecided. | Decide and record target based on spatial, backup, operations and migration validation; rehearse schema/data migration and rollback before production. | Tech lead + DBA/Platform |
| Backups / disaster recovery | No demonstrated production backup, point-in-time recovery or restore drill evidence in repository. FRD targets RPO <=15 minutes and RTO <=1 hour. | Configure automated backups/PITR and document retention; run timed database and object recovery drill; record achieved RPO/RTO, data integrity and runbook owner. | Platform/DBA |
| Audit / retention | Audit and retention admin endpoints exist, but retention scheduler reports inactive and automatic cleanup is unavailable. | Define retention/legal hold with counsel; implement enforced lifecycle/deletion jobs or keep pilot data retention disabled by explicit policy; test audit of reads/exports and deletion. | Product + Security + Platform |
| Operations | Health checks exist; production metrics, alert routing, incident runbooks, load evidence and restore proof are not established by reviewed artifacts. | Define service objectives, dashboards/alerts, on-call owner, incident/rollback runbooks and test against agreed load. | Platform + QA |

## 2C. End-to-end integration test contract

Run one repeatable staging workflow with synthetic or specifically authorized controlled documents. Capture a test report with UTC timestamps and build identifier.

1. Sign in as each pilot role; verify an expired/revoked session fails.
2. Create a matter/property with required identifiers and intentionally omit optional coordinates/map source; confirm the product reports missing data and does not invent it.
3. Upload a document; verify checksum, version, private access, malware/quarantine outcome, and audit event.
4. Attach extracted/manual facts to exact document/page anchors; verify reviewer edits preserve original values and create an audit history.
5. Run title/discrepancy/risk analysis; verify every result has source evidence, rule/version and status, or an explicit unknown/unavailable reason.
6. Run map screening with a licensed test layer and known case; repeat with missing/stale/unreachable GIS and confirm explicit degraded state with no fallback geometry or distance.
7. Generate HTML/PDF report; verify it opens, uses an immutable snapshot, links source evidence, shows source/retrieval/check timestamps and timezone, limitations and reviewer approval state.
8. Retrieve report as an authorized user; deny another tenant and unauthorized role; confirm download audit.
9. Simulate API/storage/provider failure and retry; confirm no false success, duplicate event or evidence loss.
10. Archive/restore or recover test data from backup; record measured recovery point/time against the agreed FRD targets.

**Acceptance rule:** QA records pass/fail per step, request/correlation IDs, relevant timestamps, screenshots/log references, defects and retest. No P0 is accepted solely from a code change or happy-path screenshot.

## 3. Release gates

### Gate A — safe internal demo

Synthetic/test data only; misleading fallback removal complete; clear demo labeling; primary property APIs work; no client documents. This gate is not permission for external data.

### Gate B — controlled manual-evidence pilot

All P0 controls needed for the chosen cohort are implemented and evidenced: tenant-safe authentication, secure document handling, reviewer-entered evidence with provenance, trusted licensed GIS data or explicit GIS unavailable state, genuine snapshot report, audit, operational monitoring, restore/security/load evidence and qualified reviewer approval. Complete at least one controlled real workflow. Do not claim automated extraction or government verification unless connected and acceptance-tested.

### Gate C — automated intelligence expansion

OCR/extraction golden-set target is agreed and met; UNKNOWN/review path works; async processing reliability is demonstrated; each GIS/government source has permission, provenance, freshness and degradation handling; expanded corpus/source coverage has documented acceptance. This is separate from Gate B unless expressly included in pilot scope.

## 4. Decisions and dependencies requiring attention

| Decision / dependency | Needed by | Decision owner | If unresolved |
|---|---|---|---|
| Choose manual-first evidence pilot vs OCR-enabled pilot | Before estimates become dates | Product owner | Keep OCR out of pilot commitment; do not imply extraction is live. |
| Approve production cloud and database target (FRD recommends Cloud SQL PostgreSQL/PostGIS; repo currently MariaDB) and migration approach | Before provisioning/integration | Product/Tech lead | No production architecture date; avoid building cloud-specific persistence twice. |
| Provide cloud project, billing, IAM, secret, domain and deployment access | Before platform/storage work | Cloud/account owner | Storage, authentication and production operations remain blocked. |
| Confirm licensed GIS dataset(s), publisher terms, vintage, CRS, coverage and representative cases | Before GIS acceptance | Data steward/legal reviewer | GIS result must remain unavailable/manual; no map-risk promise. |
| Select OCR provider/project, data-processing terms and golden corpus / target threshold | Before automated document scope | Product owner + security/legal | Keep manual review path; no OCR delivery date. |
| Approve tenant roles, pilot users, support-access and retention/deletion policy | Before auth/storage acceptance | Product/security owner | Cannot safely onboard real client data. |
| Name qualified report approver; approve disclaimer, template, signature meaning and report release criteria | Before reports/pilot gate | Legal/product owner | Report remains draft/internal and cannot be represented as approved/signed. |
| Assign contributors across API, web, GIS, security, DevOps, QA and legal review; confirm capacity and parallelism | Before calendar baseline | Engineering manager/product owner | Only person-day ranges can be reported, no reliable calendar date. |
| Agree pilot workload and NFR/load profile, recovery objective and environment | Before performance/reliability acceptance | Product/Tech lead | FRD targets cannot be objectively declared met. |

Government portal scraping, CAPTCHA bypass or unsupported integrations are out of scope. Where no authorized stable API exists, use user-assisted retrieval and uploaded official evidence, consistent with the FRD.

## 5. Status of the current UI work

Current uncommitted changes are a landing/login redesign, images and supporting components, plus the gap-analysis report. Preserve the work for review, but do not spend further planned capacity on visual refinement until the product P0 path is staffed. Continue only changes needed to make core workflows understandable, accessible and truthful. No changes in this plan are implemented by this document.

## 6. Reporting cadence and evidence

For each work package, report: named owner, baseline and remaining effort, blocker/decision owner, next action and due date, acceptance artifact/link, and status (not started / in progress / blocked / accepted). A status is “accepted” only when its Definition of Done evidence is reviewed; code completion alone is not release acceptance.

**Bounded timeline control:** within 5 business days of plan approval, hold a dependency review and publish a named-owner, capacity-backed forecast for the next 2 weeks. Thereafter hold a weekly 30-minute checkpoint; update the 2-week forecast every 2 weeks. Escalate a blocked dependency to its decision owner after 2 business days without movement. If cloud/source/role decisions are still open at the 5-day checkpoint, publish a dated blocked forecast with options and impact rather than extending the date silently. These are planning controls, not a promised pilot date.

## 7. Planning limitations

This plan is based on repository and FRD inspection, not a runtime deployment, cloud account inspection, source-rights confirmation, security assessment or stakeholder workshop. Person-day ranges are engineering judgment with high uncertainty and are not commitments. The previous 4–8 week pilot and 8–16+ week automated-launch ranges are withdrawn as unvalidated calendar estimates. No revised calendar release date is asserted until the decisions and dependencies in section 4 are resolved and work is estimated by named contributors.
