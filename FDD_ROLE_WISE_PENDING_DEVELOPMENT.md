# OJIX Property Intelligence — FDD Role-Wise Audit and Pending Development

**Audit date:** 29 October 2026
**Scope:** Repository source, UI, API, schemas/migrations, project requirement/status documents, QA reports, and the supplied FDD PDF.
**Method:** Static evidence review. No application tests were run during this audit; existing test results are quoted only from repository QA records. No application, database, or configuration files were changed.

## Status definitions

- **COMPLETED** — evidence shows the requirement is implemented; this label does not imply runtime certification.
- **PARTIALLY COMPLETED** — some code or workflow exists, but material requirements, integrations, or controls remain.
- **PENDING** — no implementation evidence found for the requirement.
- **DEFECTIVE** — a defect is confirmed by existing QA evidence or source inspection.
- **NEEDS VERIFICATION** — implementation or a test is claimed/present, but this audit did not establish that it works in the target runtime.

Implementation status and test execution status are separate. All proposed test cases below are **NOT RUN** by this audit unless explicitly labelled BLOCKED based on the existing QA record.

## 1. Executive Summary

### 1.1 Roles and scope

- **8 product roles** are explicitly defined in FDD §3: Organisation Admin, Lead Advocate / Reviewer, Associate / Analyst, Paralegal / Operations, Property Consultant, Client / Read-only Reviewer, OJIX Support, and OJIX Data Steward.
- Source code and seeded memberships add **owner, admin, and super-admin/platform owner** variants. Owner/Admin are not separately listed in the FDD’s product-role table, but their governance functions appear in the running implementation and must be included in the authorization audit.
- FDD §28 defines **9 delivery disciplines** (Product lead, Tech lead/CTO, Frontend engineer, Backend engineer, AI/data engineer, GIS engineer, QA engineer, Legal SME/reviewer, DevOps/cloud). These are team responsibilities, not application login roles; they are mapped to shared work below rather than treated as user accounts.

### 1.2 Requirement review counts

This audit reviewed **48 role-feature checkpoints**: six role-feature areas for each of the eight FDD product roles. The roll-up is an evidence review, not a test pass rate.

| Status | Count | Interpretation |
|---|---:|---|
| COMPLETED | 0 | No role-feature checkpoint was marked complete because this audit did not verify the full requirement and runtime acceptance. |
| PARTIALLY COMPLETED | 22 | Feature foundations exist, but implementation or acceptance is incomplete. |
| PENDING | 3 | No evidence of the specified capability was found (billing scope, consultant notifications, support runbook). |
| DEFECTIVE | 0 | Role-feature checkpoints do not incorporate shared project defects; confirmed defects are listed separately in Section 6. |
| NEEDS VERIFICATION | 23 | Runtime, integration, or security behavior cannot be established from static source review. |

**Counting rule:** Each of the eight FDD product roles has six audit rows covering authentication/session, intended module workflow, data access, write/review/export actions, audit/governance, and tests. A shared feature may therefore appear against multiple roles. Counts must not be interpreted as unique project features or as a percentage of all FDD requirements. Additional code-defined owner/super-admin findings are described separately and are not included in the 48 checkpoints.

### 1.3 Readiness and major blockers

The project has substantial MVP code: property register and CRUD, document upload, local OCR, title-chain and reviewer functions, spatial screening, reports, admin panels, OTP/session handling, and role-aware query/guard patterns. However, the documents in the repository are not fully aligned: `docs/IMPLEMENTATION_STATUS.md` still marks the frontend sign-in flow, expanded RBAC, OCR review UI, cloud workers, official connectors, PDF renderer/sign-off, CI, and production hardening as incomplete, while later code and QA artifacts describe additional work. Treat the checklist as a historical snapshot and verify against current code.

The current readiness evidence is **NOT READY FOR RELEASE** in `qa-reports/QA_EXECUTIVE_REPORT.md` (27-Oct-2026); an earlier `docs/QA-REPORT-2026-10-27.md` describes conditional synthetic internal use and no-go for real client data. Both reports agree that database/API-dependent and authenticated workflows were not fully certified. The executive QA record also cites one critical dependency advisory, CI’s PostgreSQL/PostGIS versus MariaDB mismatch, materially incomplete OpenAPI coverage, and unexecuted migration/production controls. The discrepancy in release wording is recorded as an open reporting decision; the stricter NOT READY status is used here.

## 2. Role Inventory

FDD responsibilities below are sourced from FDD §3, pages 4–5. “Observed role” names come from `apps/api/src/server.ts`, role guards, `infra/db/seed.sql`, and migration files.

| FDD role / observed role | Purpose and FDD responsibility | FDD permission baseline | Current code role mapping |
|---|---|---|---|
| Organisation Admin / `admin` | Manage users, plans, source settings, retention, billing. | Full tenant administration. | `adminGuard` permits `owner` and `admin`; tenant-scoped `/api/admin/*` governance. Plans/billing not evidenced as complete. |
| Lead Advocate / Reviewer / `lawyer` | Own final due-diligence review and sign-off. | Create/edit/review/export dossiers. | Lawyer assignment filtering; `legalReviewerGuard` allows owner/admin/lawyer; title event review; document verification owner/lawyer. |
| Associate / Analyst / `analyst` | Research, uploads, extraction review, evidence tagging. | Create/edit; no tenant admin. | `writeGuard` allows analyst; assignment filtering; no adminGuard. OCR/extraction review completeness remains partial. |
| Paralegal / Operations / `operations` | Intake, metadata cleanup, task execution. | Intake + workflow tasks. | `documentIntakeGuard` allows operations; assignment filters and workflow records exist. Admin governance is disallowed by `adminGuard`. |
| Property Consultant / `consultant` | Prepare client-ready dossier and issue list. | Matter access, exports. | Consultant role and findings access appear in server logic; report export exists. Approval and client-ready report acceptance remain incomplete. |
| Client / Read-only Reviewer / `viewer` | View approved findings and reports. | Read-only selected matters. | Released/complete matter guard and internal-data guard; viewer has restricted document/findings payloads. |
| OJIX Support / `support` | Troubleshoot with time-bound support access. | Scoped support, audited. | One-hour support session; diagnostics-only overview; business-data guard denies access. |
| OJIX Data Steward / `data_steward` | Source mappings, rule configuration, ingestion QA. | Platform data administration. | `sourceDataGuard` allows owner/admin/data_steward. Source registry exists; verified official data/provenance workflow remains incomplete. |
| Workspace Owner / `owner` (code-defined) | Tenant owner and high-level governance; operationally distinct from platform-wide Super Admin. | Not separately specified in FDD §3. | Broad write/admin/reviewer permissions; admin and super-admin routes have distinct guards. Verify separation and UI scope. |
| Platform Super Admin / `super-admin` (code-defined) | Cross-organisation platform governance. | Not an FDD §3 tenant user role; implementation addition. | Login identity may be `super-admin`; privileged APIs use `superAdminGuard`. Demo identity metadata also maps to owner membership; verify deployed claim-to-role behavior. |

### 2.1 Shared page/module map

Pages are implemented in the React app under `apps/web/src/components/` and routed/selected in `apps/web/src/App.tsx`. The API is the authority for sensitive operations; the presence of a page is not evidence of full authorization or persistence.

| Module | Principal API evidence | Expected access pattern / audit note |
|---|---|---|
| Login, registration, OTP, session | `/api/auth/*` (`apps/api/src/server.ts`) | Authenticated requests use `authGuard`; OTP and durable-session deployment behavior needs runtime verification. |
| Overview/property register | `GET /api/overview`, `GET/POST /api/properties` | Tenant scoping and role/assignment filters are visible in SQL; test all role combinations and direct API access. |
| Property details and edits | `GET/PATCH /api/properties/:id`, parcel routes | Writes use `writeGuard`; reads use tenant and assignment predicates; inspect every nested endpoint for consistent object scoping. |
| Documents/OCR/review | upload, file, signed URL, extract and fields routes | Intake uses `documentIntakeGuard`; edits use `writeGuard`; verification separately requires owner/lawyer. Storage and file security are not production-ready per QA records. |
| Title, discrepancies, legal research, spatial | `/api/properties/:id/title-*`, `/api/findings`, `/api/legal-research`, `/api/spatial/*` | Middleware has `legalDecisionDataGuard`; reviewer transitions have additional guards. Verify every read, mutation, and cross-tenant path. |
| Workflow/admin governance | `/api/properties/:id/workflow`, `/api/admin/*` | Admin routes use owner/admin; workflow update also uses `adminGuard`. Invitation delivery explicitly reports `not_configured`. |
| Source registry / RTC | `/api/source-registry/*`, `/api/rtc/*` | Source administration has dedicated guard; RTC retrieval limited to owner/admin; authorized live connector not configured by default. |
| Reports/exports | property JSON and due-diligence HTML/PDF routes | Reads are authenticated; review approval, approved-only viewer export, report versioning, and PDF renderer require verification/completion. |
| Platform Super Admin | `/api/super-admin/*` | `superAdminGuard`; confirm identity cannot be self-asserted or confused with tenant owner in production. |

## 3. Individual Role Audits

### 3.1 Organisation Admin (`admin`)

**Purpose:** Tenant governance: members, role assignment, workflow, integrations, security, retention, audit and (per FDD) plans/billing/source settings.
**Expected modules:** Admin dashboard, members/invitations, roles, applications/workflow, documents overview, integrations, security/sessions, retention, audit, source settings.
**Restricted:** Platform-wide administration; legal approval/sign-off; should not automatically receive Lead Advocate powers solely because of admin status except where explicitly intended by policy.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Authentication and session | Secure OTP/login, logout, expiry/revocation. | OTP endpoints, auth guard, durable sessions, logout and session revoke routes present. | NEEDS VERIFICATION | Execute login, logout, expiry and revoked-token tests against isolated MariaDB/API; verify production Firebase/provider config. |
| Tenant admin modules | Manage members, roles, workflow, security, retention, audit. | `AdminModule.tsx`; `/api/admin/*`; `adminGuard` owner/admin; tenant filters used in queries. | PARTIALLY COMPLETED | Verify all routes and mutation fields; cover roles, application assignments and every admin page with integration tests. |
| Plans/billing | View/manage plans, billing and subscriptions per FDD. | No substantiated billing/payment implementation found in current project documentation/API review. | PENDING | Product must define plan/billing scope; implement only after decision and provider selection. |
| Invitation delivery | Invite, resend, revoke users. | Invitations persisted/audited, but API response states email delivery `not_configured`; resend renews expiry only. | PARTIALLY COMPLETED | Configure secure invitation delivery, token acceptance/expiry/replay flow, and audit; never show delivery success until sent. |
| Authorization and tenant boundaries | Admin can govern own tenant only; cannot cross-tenant or alter protected owner improperly. | `adminGuard`; API tests are present, but QA records say runtime DB/API suite blocked. | NEEDS VERIFICATION | Run tenant A/B and role-escalation negative cases; verify active-owner invariant and audit. |
| Existing tests | Admin route/auth, owner protection, audit and tenant tests exist. | `apps/api/test/admin-governance.test.ts`; existing QA results blocked/not certified where runtime services absent. | NEEDS VERIFICATION | Execute the file in isolated CI and attach output; do not mark passed from test presence. |

**Exact tasks:** RBAC-01 and ADM-01/02/03/04; shared release tasks SH-01 through SH-06 in Section 4.

### 3.2 Lead Advocate / Reviewer (`lawyer`)

**Purpose:** Qualified human owns final due-diligence review and sign-off.
**Expected modules:** Assigned matters, documents and evidence review, title chain, discrepancy/findings review, legal research, map/risk findings, report builder/export.
**Restricted:** Tenant administration and platform controls unless independently granted an admin role.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Assigned matter access | Read assigned matters; deny unrelated lawyer’s matters. | Property list/detail SQL filters lawyer by assigned UID. | PARTIALLY COMPLETED | Test list, direct detail, nested documents, reports and export under assigned/unassigned records. |
| Title/evidence review | Verify/dispute title events and document evidence with rationale/audit. | `legalReviewerGuard`; title-event review endpoint; document verify requires owner/lawyer; reviewer UI exists. | PARTIALLY COMPLETED | Verify reviewer rationale, state transitions, immutable audit, and that admin/owner cross-grant is intended. |
| Final sign-off | Final qualified reviewer approves dossier/report; versioned snapshot and disclaimer. | Snapshot and HTML/PDF endpoints exist; implementation status says professional sign-off/PDF rendering not yet implemented; QA says renderer returns 501 when unavailable. | PARTIALLY COMPLETED | Implement approval state, immutable report version, qualified reviewer identity, evidence appendix, template/disclaimer approval and real PDF renderer. |
| Edit/create scope | Create/edit dossier and resolve review items without tenant admin. | `writeGuard` includes lawyer; property/title mutation routes use it, with narrower reviewer guards for decisions. | NEEDS VERIFICATION | Route-by-route negative matrix for admin, legal, write and delete operations. |
| Legal research | Search cited sources and keep human notes separate from generated text. | Search/category/bookmark endpoints and research UI exist; source corpus and citation quality not certified. | PARTIALLY COMPLETED | Verify provenance/citations and separation of human notes; add tests for unsupported/empty results. |
| Existing tests | Title-chain and document review unit/API tests. | `apps/api/test/title-chain.test.ts`, `document-extraction.test.ts`, admin governance cases. | NEEDS VERIFICATION | Execute unit and HTTP/database tests; QA records do not establish full role workflow. |

**Exact tasks:** LAW-01/02/03; SH-01/02/03/05/06.

### 3.3 Associate / Analyst (`analyst`)

**Purpose:** Prepare evidence and preliminary analysis for reviewer decision.
**Expected modules:** Assigned matters, uploads, extraction review, evidence tagging, discrepancy analysis, research and preliminary findings.
**Restricted:** Tenant admin, final legal sign-off and owner-only governance.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Authentication and matter assignment | Authenticate and see only assigned work. | Analyst identity, assignment filtering and API tests are present. | NEEDS VERIFICATION | Run assigned/unassigned list/detail and token lifecycle tests in an isolated runtime. |
| Document intake and extraction | Upload supported files, persist metadata/checksum, extract with traceable evidence and confidence. | Upload route supports file limits/checksum; local OCR module exists. | PARTIALLY COMPLETED | Finish durable storage, malware scanning, extraction job/retry pipeline, field confidence/page anchors and Kannada/English benchmark. |
| Extraction review/evidence tags | Analyst can correct/tag evidence; corrections are auditable and not final legal verification. | Fields edit route uses `writeGuard`; reviewer verification narrower. Existing review component. | PARTIALLY COMPLETED | Define analyst-vs-reviewer field editing, add evidence tagging persistence and test no privilege escalation via payload. |
| Property/discrepancy analysis | Run deterministic checks and inspect provenance-backed results. | Analyze/discrepancy/spatial engines and UI components exist; official sources/data absent or limited. | PARTIALLY COMPLETED | Keep unknown distinct from safe; integrate approved data and test rule versions, source freshness and edge cases. |
| Tenant administration restriction | Analyst cannot administer members/settings. | `adminGuard` owner/admin; test case confirms expected 403 in source. | NEEDS VERIFICATION | Execute direct API 403 and ensure no alternate admin endpoint bypass. |
| Existing tests | Analyst assignment and authorization cases. | `admin-governance.test.ts`, extraction and engine tests. | NEEDS VERIFICATION | Execute with MariaDB/API; review output and map tests to requirement IDs. |

**Exact tasks:** ANL-01/02/03; SH-01/02/04/05/06.

### 3.4 Paralegal / Operations (`operations`)

**Purpose:** Intake, metadata cleanup and task/workflow execution.
**Expected modules:** Assigned/available intake matters, document upload, metadata cleanup, task assignment and status/due dates.
**Restricted:** Legal review/sign-off, source/rule administration, tenant admin and final approval.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Intake access | Upload to authorized/assigned matters and follow intake workflow. | `documentIntakeGuard` includes operations; property query permits assigned, unassigned or own-assigned operations records. | PARTIALLY COMPLETED | Product must confirm unassigned visibility; enforce least-privilege assignment policy and test direct document/file routes. |
| Metadata cleanup and task execution | Record missing/invalid metadata, resolve checklist tasks, update workflow. | Workflow fields/status/priority/due date and assignment APIs exist; full intake checklist is not demonstrated. | PARTIALLY COMPLETED | Define persisted intake checklist and task states; implement validation/transition history and reminders if required. |
| Legal decision restriction | Cannot verify title or make legal decisions. | `legalDecisionDataGuard` blocks operations on decision data. | NEEDS VERIFICATION | Execute 403 tests on all title/discrepancy/legal-research/finding decision APIs and UI deep links. |
| Admin/source restriction | Cannot change tenant settings or source rules. | `adminGuard` and `sourceDataGuard` do not include operations. | NEEDS VERIFICATION | Execute direct API tests across admin, source registry, RTC and spatial mutation routes. |
| Assignment and data scope | See only authorized work and files. | Assignment filters and API tests exist; full nested object/file/export coverage not established. | NEEDS VERIFICATION | Cross-role/object-level tests for property, document, signed URL, report and search routes. |
| Existing tests | Operations assignment/intake guards. | `admin-governance.test.ts`; QA says API suite not certified when DB/API unavailable. | NEEDS VERIFICATION | Execute test file and record unrun/blocked cases. |

**Exact tasks:** OPS-01/02; SH-01/02/05/06.

### 3.5 Property Consultant (`consultant`)

**Purpose:** Prepare client-facing dossier and issue list using approved evidence.
**Expected modules:** Matter/property view, findings and issues, report builder/export.
**Restricted:** Admin governance and final legal verification unless the user separately has a lawyer/admin membership.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Matter/finding access | See permitted matters and issue list. | Consultant role exists; property detail includes findings for consultant; tenant queries exist. | PARTIALLY COMPLETED | Verify assignment/share semantics; test direct access outside permitted matters. |
| Client-ready report/export | Export approved, traceable dossier with evidence, freshness and disclaimer. | JSON/HTML/PDF endpoints and report UI exist; PDF renderer and reviewer sign-off incomplete per status/QA docs. | PARTIALLY COMPLETED | Implement report approval gate, version snapshot, evidence anchors, source freshness and genuine PDF rendering. |
| Edit/review privileges | Consultant prepares issue list but cannot certify legal conclusions. | `legalReviewerGuard` excludes consultant; `writeGuard` includes it. | NEEDS VERIFICATION | Inspect each write endpoint for fields that could alter risk/review/legal state; separate safe narrative edits from legal decisions. |
| Export confidentiality | Tenant/property authorized, approved-only, audited export. | Authenticated report endpoints; route-by-route export ACL/audit not fully established. | NEEDS VERIFICATION | Test every export and file link for tenant/assignment/release checks and audit event. |
| Existing tests | Consultant access and guard tests. | Consultant case exists in `apps/api/test/admin-governance.test.ts`; QA runtime status not certified. | NEEDS VERIFICATION | Execute and extend to approved report and forbidden reviewer actions. |
| Notifications | Relevant review/clarification changes reach responsible consultant. | No verified end-to-end notification requirement implementation found. | PENDING | Product to confirm notification channels/events; implement after workflow ownership decision. |

**Exact tasks:** CON-01/02; SH-01/02/03/05/06.

### 3.6 Client / Read-only Reviewer (`viewer`)

**Purpose:** View only approved findings and reports for selected matters.
**Expected modules:** Released/complete matter and approved report view.
**Restricted:** Internal evidence, drafts, upload/edit/delete, approval, administration, legal research and unreleased matters.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Released matter visibility | Only explicitly selected and approved/released matters are visible. | `releasedMatterGuard` checks viewer and status `complete`; list/detail SQL filters viewer to complete. | PARTIALLY COMPLETED | Confirm `complete` exactly means approved/released; implement explicit share/access grant if required by FDD “selected matters.” |
| Read-only restriction | No create/update/delete or internal work data. | `viewerInternalDataGuard` excludes viewer from documents/source/spatial; write guard excludes viewer; detail response filters documents/findings. | PARTIALLY COMPLETED | Route-by-route direct mutation/read tests; ensure signed URLs, report HTML/PDF, exports and property nested routes enforce same scope. |
| Approved report access | Read approved findings and reports, with clear evidence and disclaimers. | Report routes authenticated; no runtime proof of viewer approval gate or report authorization. | NEEDS VERIFICATION | Add tests proving unapproved/draft reports are denied and released report is accessible. |
| Cross-tenant isolation | Cannot enumerate or read another tenant’s records. | Tenant filters used broadly; source-review docs explicitly say live cross-tenant negative run is outstanding. | NEEDS VERIFICATION | Run tenant A/B attempts on properties, docs, URLs, findings, reports, search and exports. |
| Authentication/session | Login, logout, expiry and revoked session behavior. | OTP/session code present; QA records say real identity and DB flows not fully exercised. | NEEDS VERIFICATION | Execute role-specific OTP, session expiry/revocation and invalid token cases. |
| Existing tests | Viewer internal data and approved status filters. | `admin-governance.test.ts` includes viewer cases; runtime suite status blocked/unverified. | NEEDS VERIFICATION | Run and extend to report and nested-file endpoints. |

**Exact tasks:** VIEW-01/02; SH-01/02/03/05/06.

### 3.7 OJIX Support (`support`)

**Purpose:** Troubleshoot with scoped, time-bound, audited access.
**Expected modules:** Diagnostics only by default; any support elevation must have a reason, scope, expiry and audit trail.
**Restricted:** Customer business data, legal evidence, documents, findings, exports and tenant administration by default.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Time-bound session | Support access expires and logout revokes it. | `SUPPORT_SESSION_MS` set to one hour; session and logout logic present. | PARTIALLY COMPLETED | Verify persistence/restart behavior, extension policy, expiry boundary and revoke in deployed environment. |
| Diagnostic-only access | Health/system status without customer business data. | `businessDataGuard` denies support; overview returns diagnostics-only counters/status. | PARTIALLY COMPLETED | Audit all routes not covered by global guards, including exports, map, locations, reports, source and admin. |
| Support audit | Sensitive access/change and reason recorded. | Audit events exist for login; support-specific access/session reason/elevation workflow not established by reviewed evidence. | PARTIALLY COMPLETED | Add support access request/approval record, ticket/reason, scope, actor, expiry, and auditable elevated action if product requires it. |
| Forbidden data access | Every direct business-data request denied consistently. | Guard code denies support on protected route families; no route-by-route runtime proof. | NEEDS VERIFICATION | Execute 403/404 matrix for property, document stream/signed URL, findings, legal, report, source, admin and map. |
| Existing tests | Support diagnostics scope and expiry. | Governance tests include support access; QA reports indicate full suite blocked/not certified. | NEEDS VERIFICATION | Execute test and test expiry, logout, restart, and all relevant route classes. |
| Support workflow/runbook | Safe troubleshooting and escalation procedure. | No production-ready runbook or verified deployed controls evidenced. | PENDING | Create support runbook, escalation approval and incident audit procedure. |

**Exact tasks:** SUP-01/02; SH-01/02/05/06.

### 3.8 OJIX Data Steward (`data_steward`)

**Purpose:** Govern source mappings, rule configuration and ingestion quality.
**Expected modules:** Source registry, ingestion QA, source freshness/provenance, rule configuration/versioning.
**Restricted:** Tenant user administration and legal sign-off unless separately assigned.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Source administration | Configure and maintain source mappings and status. | Source registry UI; `sourceDataGuard` allows owner/admin/data_steward; source status/verification routes present. | PARTIALLY COMPLETED | Verify CRUD permissions and source-level audit; confirm tenant/platform scope and avoid unintended platform-wide access. |
| Provenance and licensed data | Track publisher, URL, licence, retrieval date, vintage, CRS, checksum, reviewer state. | Some verification requirements exist in code; implementation status says official connectors/provenance validation and verified datasets remain incomplete. | PARTIALLY COMPLETED | Establish required provenance schema, licensing review, data QA and freshness/degraded states before enabling analysis. |
| Rule configuration/versioning | Change thresholds/rules with version and historical results preserved. | Spatial rules engine and source configuration surfaces exist; full admin/rule lifecycle not established. | PARTIALLY COMPLETED | Implement versioned rule change approval, effective dates, audit and reproducible historical results. |
| Ingestion QA | Detect invalid, stale, incomplete or mismatched source data; record outcome. | Import/source checks and registry present, but production connectors/QA evidence absent. | PARTIALLY COMPLETED | Build ingestion validation and review queue with provenance completeness and quarantine on failure. |
| Official GIS/source operation | Use only permitted, verified datasets and distinguish unknown from safe. | Project docs warn no verified production GIS dataset/live portal integration; synthetic rows are labelled demo. | NEEDS VERIFICATION | Require data owner/legal approval and known positive/negative properties; do not claim clearance until complete. |
| Existing tests | Steward cannot access tenant admin unless also owner/admin; source controls work and audit. | Guard and source-related tests exist in project; no complete runtime test result. | NEEDS VERIFICATION | Execute role matrix for each source route and audit/version transition. |

**Exact tasks:** DATA-01/02/03; SH-01/02/05/06.

### 3.9 Code-defined Owner and Platform Super Admin additions

These are included because the prompt requires actual roles in code/schema as well as FDD roles. They are **not additional FDD §3 product roles**.

| Feature / requirement | Expected behavior | Current implementation | Status | Pending development |
|---|---|---|---|---|
| Owner tenant governance | Tenant owner may perform explicitly allowed tenant admin and reviewer actions; cannot silently bypass audit. | Owner included in write/admin/reviewer/source guards; admin owner-protection tests exist. | NEEDS VERIFICATION | Execute role tests and define whether owner may legally verify/sign reports. |
| Super Admin identity boundary | Platform-only privileged identity; must not be client-assertable or confused with tenant owner. | Separate super-admin guard and endpoints; login flow derives role and super-admin flag from identity metadata. Demo mappings use owner membership. | NEEDS VERIFICATION | Verify production claim/allowlist binding and prove changing request payload/headers cannot grant platform privilege. |
| Cross-org operations and audit | Operate across organisations with reasoned, logged actions. | Super-admin endpoints for orgs, memberships, sessions and audit; mutation schema requires reason. | PARTIALLY COMPLETED | Execute cross-tenant negative/positive tests, owner safety invariants, session revoke and durable audit checks. |

**Exact tasks:** RBAC-01/02/03; SH-01/02/03/06.

## 4. Role-Wise Development Backlog

Effort is a planning estimate: **Small** = roughly 1–2 engineer-days; **Medium** = 3–5; **Large** = 6+ or cross-team/infrastructure work. Estimates exclude external approvals and environment provisioning. Priorities reflect launch/security dependencies, not a committed schedule.

| Task ID | Role | FDD section / module | Current implementation | Missing work and exact development task | Relevant code / API / data | Dependency | Priority | Effort | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|---|
| SH-01 | All roles | FDD §20 security; §29 launch gate | Guards and tenant filters exist; runtime path coverage incomplete. | Build an authorization matrix for all roles × all routes. Add integration tests for anonymous, wrong role, wrong tenant, wrong assignment, and allowed case; verify 401/403/404 semantics and audit events. | `apps/api/src/server.ts` guards `authGuard`, `writeGuard`, `documentIntakeGuard`, `sourceDataGuard`, `legalDecisionDataGuard`, `releasedMatterGuard`, `legalReviewerGuard`, `adminGuard`, `superAdminGuard`; all route registrations. | Isolated MariaDB/API CI environment (SH-02). | Critical | Large | Matrix is checked in; every sensitive route has positive and negative tests; no cross-tenant read/write/export succeeds; unauthorized requests return expected status; CI artifacts retained. |
| SH-02 | All roles / QA | FDD §§26, 29; QA | QA docs record API tests blocked by unavailable MariaDB/API; CI DB mismatch. | Align CI service/migrations/seed with actual MariaDB 10.11 + `mysql2`; start app and execute full API suite, web tests and migrations on clean and upgrade DB snapshots. | `.github/workflows/*` (locate current workflow); `package.json`; `apps/api/test/*`; `database/mysql-schema.sql`; `database/migrations/`. | CI service and isolated secrets. | Critical | Large | CI uses same engine/schema as app; all suites/migrations complete; blocked tests are not counted as pass; logs and DB state archived. |
| SH-03 | All roles / Security | FDD §§20, 29 | OTP/session and some tenant controls coded; production setup and runtime checks incomplete. | Verify production auth provider, OTP delivery, account binding, session expiry/revocation, logout, CORS and disabled dev identities. Add a production-like integration suite; remediate confirmed vulnerabilities. | `apps/api/src/server.ts` `/api/auth/*`; `apps/api/src/auth-security.ts`; `.env.example`; `docs/audit/SECURITY-ARCHITECTURE-REVIEW.md`; `qa-reports/QA_EXECUTIVE_REPORT.md`. | Firebase/SMTP test accounts via secure environment; SH-02. | Critical | Large | Invalid/expired/revoked tokens denied; logout invalidates session; role derives only from trusted membership/claim; no dev identity accepted in production; dependency audit has no unresolved critical/high finding or approved risk acceptance. |
| SH-04 | All document roles | FDD §9; E04 backlog; §20 | Local upload/checksum and signed URL paths exist; QA docs say storage/malware/backup controls incomplete. | Add file signature validation, malware quarantine, private durable storage, immutable versions, authorized download audit, retention/deletion and restore drill. | `apps/api/src/document-storage.ts`; `apps/api/src/document-extractor.ts`; `apps/api/src/server.ts` upload/file/signed URL routes; `documents` schema; Docker volume. | Storage provider, IAM, retention/legal-hold decisions. | Critical | Large | Malicious/oversized/spoofed files are rejected/quarantined; only authorized tenant/role can download; versions/checksums persist; deletion/retention and restore verified; no client data until accepted. |
| SH-05 | All product roles | FDD §§26, 29; traceability | Tests exist across unit/API/e2e; coverage and runtime evidence gaps remain. | Convert requirements to traceable cases; implement role-complete browser and API workflows from login through logout; add edge cases for validation, pagination/search, export, notification, session expiry and responsive layouts where specified. | `qa-reports/TEST_CASES.md`; `qa-reports/REQUIREMENT_TRACEABILITY.md`; `tests/e2e/*`; `apps/api/test/*`; `apps/web/src/*.test.ts`. | SH-02; stable test identities and synthetic fixtures. | High | Large | Each FDD Must/P0 criterion maps to a test; result is PASSED only with execution output; all roles have positive and negative scenarios; no unresolved Critical/High. |
| SH-06 | All teams | FDD §§21, 28, 29 | OpenAPI source exists; QA reports 8 documented paths vs 99 server routes. | Reconcile supported routes with OpenAPI, document auth/scopes, request/response/status/error contracts; add schema validation in CI and release versioning. | `docs/openapi.yaml`; `apps/api/src/swagger/openapi.ts`; `apps/api/src/server.ts`; `qa-reports/QA_EXECUTIVE_REPORT.md`. | API route inventory; SH-02. | High | Medium | Every supported public route is documented or explicitly internal/deprecated; generated/contract checks pass; docs match behavior. |
| ADM-01 | Organisation Admin | FDD §3; E15 Admin | Admin pages and API exist; FDD plans/billing not evidenced. | Product to decide MVP plans/billing scope; then implement plan/usage/invoice/payment controls or record approved deferral with acceptance criteria. | `apps/web/src/components/AdminModule.tsx`; `/api/admin/*`; no verified billing routes found. | Product/payment provider decision. | Medium | Large | Approved product decision exists; if in scope, tenant cannot view/change another tenant plan and all billing mutations are audited. |
| ADM-02 | Organisation Admin | FDD §14; E15; §20 | Invitation records and audit exist; delivery returns `not_configured`. | Implement signed single-use invitation acceptance, secure email delivery, expiry/resend/revoke semantics, membership activation and audit. | `apps/api/src/server.ts` `/api/admin/members/invite`, resend, revoke; `workspace_invitations`, migrations 017/024/026. | SMTP/identity policy; SH-03. | High | Medium | Valid invite activates intended tenant/role once; expired/revoked/replayed token denied; delivery status is truthful; all changes audited. |
| ADM-03 | Organisation Admin | FDD §14; role permissions | `adminGuard` owner/admin; UI lists roles; complete enforcement not runtime verified. | Publish server-side capability matrix and test that Admin cannot elevate to Owner/Super Admin or perform Lead Advocate sign-off unless explicitly authorized. | `ADMIN_ROLES`, `adminGuard`, `/api/admin/members/*`, role matrix UI in `AdminModule.tsx`. | SH-01. | Critical | Medium | Admin role cannot grant itself owner/super-admin; owner invariant maintained; each allowed/denied action has 2xx/403 test and audit evidence. |
| ADM-04 | Organisation Admin | FDD §14; retention | Retention API records policy but automatic cleanup disabled; no scheduler evidenced. | Implement legal-approved retention lifecycle, legal hold, archive/delete job, dry-run, audit and restore strategy; do not enable deletion before approval. | `/api/admin/retention`; `workspace_retention_policies`; `docs/audit/STORAGE-CLOUD-BACKUP-PLAN.md`. | Legal retention/legal hold decision; SH-04. | High | Large | Retention and legal hold are deterministic, tested with synthetic data, auditable, reversible where required; no automatic cleanup before signed policy. |
| LAW-01 | Lead Advocate | FDD §§5–6, 13; E07/E12 | Review guards, title chain, snapshots and reports partly exist. | Implement explicit reviewer sign-off state machine: draft → review → approved/rejected, mandatory rationale, identity/time, immutable version and report disclaimer/template. | `/api/properties/:id/title-events/:eventId/review`; `/api/properties/:id/due-diligence-snapshot`; `apps/api/src/report-generator.ts`; `ReportViewer.tsx`. | Product/legal approval state definition; SH-01. | Critical | Large | Only lawyer/approved owner can sign; rejection requires rationale; approved report is immutable/versioned and links evidence; every transition audited. |
| LAW-02 | Lead Advocate | FDD §§9, 13 | Reviewer can verify fields; extraction anchors/quality are incomplete. | Bind every material report finding to source document, page/box or stable evidence anchor, extraction confidence, rule version and source freshness; expose reviewer state. | `apps/api/src/document-extractor.ts`; `SideBySideReview.tsx`; report generator and document schema. | SH-04; evidence schema decision. | High | Large | Reviewer can navigate every material claim to its source anchor; missing anchor blocks/flags approval; edits preserve original extraction and audit history. |
| LAW-03 | Lead Advocate | FDD §29 Legal workflow | Report templates exist in some form; qualified template approval not evidenced. | Obtain Legal SME approval for report language, limitations and disclaimers; record template version and approval metadata. | Report HTML/PDF routes; `apps/api/src/report-generator.ts`; FDD §29. | Legal SME decision. | High | Medium | Every released report carries an approved template version and disclaimer; old snapshots retain the template version used. |
| ANL-01 | Associate / Analyst | FDD §9; E05 | Local OCR source and extraction functions exist; cloud worker/review UI marked incomplete. | Complete asynchronous extraction lifecycle, retries/idempotency, failure state, confidence/evidence anchors and human review queue; benchmark Kannada and English documents. | `apps/api/src/local-ocr.ts`; `document-extractor.ts`; document APIs; `apps/web/src/components/SideBySideReview.tsx`; job schema. | OCR/manual-first decision; storage SH-04. | High | Large | Approved corpus meets product threshold; unsupported/low-confidence data is UNKNOWN/review-required; retry does not duplicate records; reviewers can correct with audit. |
| ANL-02 | Associate / Analyst | FDD §§6–7 | Property fields, discrepancies and evidence functions exist. | Define analyst-editable versus protected reviewer fields; validate normalization, evidence tagging and discrepancy state transitions; add server-side field allowlist. | `PATCH /api/properties/:id/documents/:docId/fields`; discrepancy engine/API; property schema. | SH-01; legal policy. | High | Medium | Analyst may correct permitted extraction fields with rationale/audit, cannot self-verify legal evidence or alter protected/system fields; negative payload tests pass. |
| ANL-03 | Associate / Analyst | FDD §§10, 18 | Research/search and extraction code exists; source grounding/quality not certified. | Ensure research results cite source identifiers/metadata and human notes remain distinguishable; test empty/unsupported retrieval and AI guardrail outcomes. | `/api/legal-research/*`; `legal-research-engine.ts`; `rtc-retrieval-service.ts`. | Approved legal corpus/connector. | Medium | Medium | Each reportable research item has retrievable citation metadata; unsupported claims are marked unavailable; human notes remain separately attributed. |
| OPS-01 | Paralegal / Operations | FDD §5; E04/E11 | Upload and workflow assignments exist; intake checklist not evidenced. | Implement persisted document intake checklist with required metadata, missing-item status, validation errors and task completion; clarify unassigned matter visibility. | `/api/properties/:id/documents`; workflow/assignment routes; `properties`, `documents` schema; `AdminModule.tsx`. | Product confirms assignment policy; SH-01/04. | High | Medium | Operations can complete intake for authorized matter; missing metadata remains visible; cannot approve legal findings; changes are audited. |
| OPS-02 | Paralegal / Operations | FDD §5 workflow | Status/priority/due dates exist. | Add allowed transition table and role-specific transitions, overdue task query/notifications if accepted, and audit trail for transitions. | `/api/properties/:id/workflow`; task/workflow fields; admin application UI. | Product defines states and notification channels. | Medium | Medium | Invalid transitions return 400/409; operations can only perform permitted transitions; history contains actor, before/after and time. |
| CON-01 | Property Consultant | FDD §§13, 29 | JSON/HTML/PDF report endpoints exist; PDF/sign-off incomplete per current docs. | Implement client-ready export from approved immutable snapshot with scope, evidence appendix, unresolved issues and clear limitations. | `/api/properties/:id/report`; due-diligence snapshot/HTML/PDF routes; `report-generator.ts`. | LAW-01/02/03; SH-04. | High | Large | Consultant cannot export draft/unapproved report; output references evidence and data vintage; real PDF bytes validated; export audited and tenant-scoped. |
| CON-02 | Property Consultant | FDD §5 | Findings/issues exist; approved audience selection is unclear. | Define consultant access/share model; implement permitted matter query and issue-list workflow; prevent consultant edits to legal decision fields. | Property detail/list; findings APIs; assignment columns; `consultant` role guards. | Product access model; SH-01. | High | Medium | Consultant sees only authorized matters; can prepare permitted client issue list; cannot verify title or access admin; direct API tests pass. |
| VIEW-01 | Client / Viewer | FDD §3 | Complete status filters and internal-data denial exist; explicit share grant is not established. | Add explicit matter/report release/share record if “selected matters” requires per-client selection; replace ambiguous `status='complete'` with approved/released predicate if needed. | `releasedMatterGuard`; property query; schema/migrations; viewer UI. | Product defines release/share semantics; LAW-01. | Critical | Medium | Viewer sees only an explicitly shared, approved version; status-only transition cannot expose internal data; revocation immediately denies access. |
| VIEW-02 | Client / Viewer | FDD §13 | Authenticated report routes; viewer report access not proven. | Gate HTML/PDF/JSON/report attachments and signed URLs on the same release grant and approved snapshot; add export audit. | `/api/properties/:id/report`; `/due-diligence-report/*`; file/signed URL routes. | VIEW-01; CON-01; SH-01. | Critical | Medium | Viewer can retrieve released report only; draft, revoked, wrong-tenant and wrong-matter requests denied; approved export event audited. |
| SUP-01 | OJIX Support | FDD §3 Security | Diagnostics-only and one-hour session logic exist. | Audit every route for support data leakage; add tests for reports, file streams, signed URLs, map/source, legal research and admin. | `businessDataGuard`; `authGuard`; all `/api/*` routes. | SH-01/02. | Critical | Medium | Support can read only approved diagnostics; business data returns 403/404 without content; expiry and logout revoke access; audit has support actor. |
| SUP-02 | OJIX Support | FDD §3 | Support session restriction exists; reasoned scoped elevation/runbook not evidenced. | Decide if break-glass elevation is needed; if so implement request/approval, ticket, least scope, short expiry, reason and immutable audit; otherwise document no-elevation policy. | Support login/session; audit schema; `docs/` runbooks. | Security/Product decision. | Medium | Medium | Documented policy exists; if enabled, every elevation has approver, expiry, scope and audit; expired access denied. |
| DATA-01 | Data Steward | FDD §§8, 14, 19 | Source registry/verification functions; official connectors/data incomplete. | Enforce source metadata schema: publisher, licence, URL, retrieval/vintage, CRS, checksum, importer, review status and freshness; reject incomplete sources from production rules. | `/api/source-registry/*`; source registry UI; layer schema; `seed.sql`. | Legal/data license and schema decision. | Critical | Large | Unverified/synthetic/stale/unlicensed source cannot produce a positive clearance; QA proves known cases and unknown fallback. |
| DATA-02 | Data Steward | FDD §§8, 12, 14 | Spatial rules and configuration surfaces exist; version lifecycle incomplete. | Add rule version, effective period, inputs/thresholds, reviewer approval and immutable finding linkage; support reproducible rerun. | `spatial-rules-engine.ts`; `risk-engine.ts`; spatial schema/APIs. | Data/legal policy; DATA-01. | High | Large | Every result stores exact rule version and source vintage; historical report remains reproducible after rule changes; transitions audited. |
| DATA-03 | Data Steward | FDD §23; E14 | No live official connectors or scheduled monitor evidenced; RTC defaults manual. | Implement authorized connector/import workflow, validation/quarantine, freshness monitoring, degraded state and alert; do not automate restricted portals without permission. | `source-registry-engine.ts`; `rtc-retrieval-service.ts`; `/api/rtc/*`; job system. | Written access/licence, source credentials, SH-03. | High | Large | Connector is authorized, monitored, rate-limited and has manual fallback; invalid/stale source marked unavailable; source actions audited. |
| RBAC-01 | Owner/Admin/Support/Data Steward | FDD §20 | Code-defined roles exceed FDD role list; role assignment pathways exist. | Define canonical role capability matrix including owner vs admin vs platform super-admin; reconcile UI role options, DB migrations, test fixtures and OpenAPI. | `server.ts` role guards/`ADMIN_ROLES`; migrations 009–012/017/025/026; `seed.sql`. | Product/security signoff; SH-01. | Critical | Medium | One authoritative role enum and permission table; no role can assign a higher privilege than permitted; schema/seed/UI/API agree. |
| RBAC-02 | Platform Super Admin | FDD §20 (implementation addition) | Guarded endpoints and reason validation exist. | Verify trusted super-admin source in production and separate platform claim from tenant `owner`; test spoofed headers/body, membership changes and audit. | `superAdminGuard`; `/api/super-admin/*`; auth verification/session creation. | Approved platform identity/allowlist. | Critical | Medium | Only allowlisted/trusted identity receives platform role; tenant role cannot imply super-admin; every mutation reasoned and audited. |
| RBAC-03 | All role accounts | FDD §§3, 20 | Role-specific demo identities; password/OTP code exists. | Exercise role portal selection and ensure expectedRole is checked against resolved identity/membership; verify registration always assigns least privilege and no client role parameter elevation. | `/api/auth/register/*`, `/api/auth/login/*`, `auth-security.ts`; migration 026; auth tests. | SH-02/03. | Critical | Medium | Registered accounts receive viewer only; forged role/UID rejected; demo accounts disabled in production; OTP/session events audited. |
| QA-01 | All roles | FDD §§26, 29 | Many unit/API/browser tests exist, some documented passes; full environment unavailable in QA. | Build role-wise test data and run all role journeys in clean seeded DB; distinguish PASSED/FAILED/BLOCKED/NOT RUN per case and attach logs. | `apps/api/test/admin-governance.test.ts`; `auth-security.test.ts`; `tests/e2e/*`; QA reports. | SH-02. | High | Large | Every matrix row mapped to executed result; no pass inferred from test file existence; clean reset/repeatability demonstrated. |

## 5. Cross-Role Workflow Gaps

| Workflow | Role sequence | Current evidence | Gap / dependency | Required validation |
|---|---|---|---|---|
| Matter setup to review | Admin/Owner assigns → Analyst researches/uploads → Operations completes intake → Lawyer reviews/signs → Consultant exports → Viewer reads release | Assignment/workflow, uploads, review and report routes exist. | Sign-off and explicit release/share gate are incomplete or ambiguous; assigned visibility and notifications need definition. | Exercise full matter through released report, including wrong-role and wrong-tenant denial at each step. |
| Document evidence lifecycle | Operations/Analyst uploads → OCR/extraction → Analyst corrects → Lawyer verifies → report cites source | Upload/OCR/review foundations present. | Cloud worker/retries, OCR benchmark, page-level anchors, storage security and immutable version behavior remain open. | Use approved synthetic corpus; verify every extracted field, override, reviewer state and report anchor persists/audits. |
| Source and spatial result lifecycle | Data Steward configures source/rule → Analyst screens property → Lawyer reviews → Consultant/Viewer sees qualified result | Source registry and rules engine exist; source query and unknown state behavior code present. | Official licensed datasets, provenance, rule version lifecycle and known positive reference cases absent/unverified. | Do not test against or claim official data until lawful dataset and known reference cases are supplied. |
| Workspace governance | Owner/Admin invites and assigns roles → users authenticate → Admin audits or revokes | Admin endpoints, invitation records and session management exist. | Email delivery is explicitly not configured; role capability matrix and production identity remain unverified. | Test single-use invite activation, role change, session revoke, audit and tenant boundary in staging. |
| Support investigation | Support authenticates → reads diagnostics → access expires/logs out | Diagnostics-only overview and one-hour support session exist. | Route-wide business-data denial and formal support runbook/elevation policy not verified. | Attempt direct API access to all protected route families before/after expiry and confirm no record leakage. |
| Property completion to client release | Lawyer final approval → Admin/Owner or Lawyer releases snapshot → Consultant exports → Viewer reads | `complete` state and report routes exist. | FDD says approved findings/reports and selected matters; current viewer predicate may rely on generic `status='complete'`. Release grant semantics need product decision. | Verify no draft or revoked report can be retrieved by guessed property/report/file ID. |

## 6. RBAC and Security Findings

This section separates source-observed controls from confirmed defects. Static guard code is not a security test.

| Finding | Evidence | Assessment | Required action |
|---|---|---|---|
| Role-specific middleware exists | `authGuard`, `writeGuard`, `documentIntakeGuard`, `sourceDataGuard`, `rtcLookupGuard`, `businessDataGuard`, `legalDecisionDataGuard`, `viewerInternalDataGuard`, `releasedMatterGuard`, `legalReviewerGuard`, `adminGuard`, `superAdminGuard` in `apps/api/src/server.ts`. | PARTIALLY COMPLETED — route-level bypasses and deployed behavior not tested here. | SH-01 route inventory and role matrix integration tests. |
| Tenant/assignment filtering exists in property queries | `GET /api/properties`, `GET /api/properties/:id` SQL includes tenant and role/assignment predicates. | NEEDS VERIFICATION — nested routes/exports need independent object-level checks. | SH-01; VIEW-02; SUP-01. |
| Production identity needs deployed verification | Security review says Firebase is conditional and dev/demo paths exist in source; hardened behavior is documented but runtime config not inspected. | NEEDS VERIFICATION, not confirmed bypass. | SH-03/ RBAC-03 in production-like environment. |
| Owner/Admin/Super Admin boundaries are unclear across FDD and code | FDD §3 names Organisation Admin; code adds owner/admin/super-admin and allows owner/admin/legal functions through some guards. | NEEDS VERIFICATION / policy gap. | RBAC-01/02 and product/security approval. |
| Viewer release rule uses `status='complete'` | `releasedMatterGuard` and property queries; FDD requires approved findings/reports for selected matters. | NEEDS VERIFICATION — `complete` may not be equivalent to an explicit approved/released grant. | VIEW-01/02. |
| Support protection is implemented in some route middleware | `businessDataGuard` and diagnostics-only overview. | NEEDS VERIFICATION — direct access to every route family and file/export paths not executed. | SUP-01. |
| Document files and production safeguards | Security review documents local filesystem, no malware scan and no demonstrated cloud storage/restore. | PARTIALLY COMPLETED; production safeguards are known gaps, not a newly discovered exploit. | SH-04. |
| Confirmed QA defect: CI database mismatch | `qa-reports/REQUIREMENT_TRACEABILITY.md` and `QA_EXECUTIVE_REPORT.md`: CI provisions PostgreSQL/PostGIS while runtime uses MariaDB/MySQL. | DEFECTIVE (confirmed by repository QA evidence). | SH-02. |
| Confirmed QA defect: incomplete API contract | QA executive report states OpenAPI covers 8 paths while server has 99 route registrations. | DEFECTIVE (confirmed documentation/contract coverage issue). | SH-06. |
| Confirmed QA security concern: dependency findings | QA executive report records 16 dependency vulnerabilities including one critical MapLibre advisory. | DEFECTIVE per recorded assessment; current live dependency scan was not run by this audit. | SH-03; refresh scan and remediate or formally accept risk. |
| No confirmed privilege-escalation exploit established by this audit | Source review shows guards, but no test or exploit execution performed. | Do not report as confirmed defect; requires verification. | SH-01, RBAC-02/03. |

### Security review checklist

- [ ] Every API route is mapped to authentication + authorization policy.
- [ ] Direct API request tests cover each disallowed role (not only hidden UI buttons).
- [ ] Request bodies cannot assign `tenant_id`, reviewer state, role or approval fields without server authorization.
- [ ] Role changes cannot self-elevate and preserve at least one active owner.
- [ ] Property, document, signed URL, report and export lookups enforce tenant + assignment/share policy.
- [ ] Viewer receives only released/approved information.
- [ ] Support access is time-limited, audited and contains no business data.
- [ ] Invalid, expired, logged-out and revoked sessions return 401; role denial returns 403 or non-disclosing 404 as policy defines.
- [ ] OTP replay, rate limit, account binding and delivery failure behavior are tested.
- [ ] Every approval, role change, export and sensitive mutation is auditable.

## 7. Role-Wise Test Plan

**Execution status for this audit:** all cases below are **NOT RUN**. The QA report documents prior blocked DB/API execution; that does not make every individual case blocked today. Cases needing DB/API runtime are marked **BLOCKED by existing QA environment record** until rerun in a working isolated environment.

| Test ID | Role | Preconditions | Steps | Expected result | Existing coverage | Execution status |
|---|---|---|---|---|---|---|
| AUTH-01 | Each FDD role | Test identity/membership for role; isolated DB/API | Login with valid email OTP; call `/api/auth/me`; logout; retry old token. | Correct trusted role and tenant; logout invalidates session; protected request is 401. | Auth/security unit and governance tests exist; runtime auth not certified. | BLOCKED by existing QA environment record |
| AUTH-02 | Each FDD role | Invalid, expired and replay OTP fixtures | Request/verify invalid, expired, reused OTP; exceed limits. | Denied with safe error; no OTP/token leak; counters/audit policy respected. | OTP implementation/test files present; real SMTP not executed per QA. | BLOCKED |
| ADM-01 | Organisation Admin | Active admin + owner, two tenants | Get admin pages; invite member; attempt owner/super-admin assignment; query other tenant. | Own-tenant permitted operations succeed; forbidden role assignment denied; no cross-tenant records. | `admin-governance.test.ts` has auth/owner/tenant cases. | BLOCKED |
| ADM-02 | Organisation Admin | Pending invite | Resend/revoke/accept valid, expired, revoked and replayed invitation. | Only single valid activation; delivery state truthful; audit recorded. | API code says delivery not configured; no completed mail workflow evidence. | NOT RUN |
| LAW-01 | Lawyer | Assigned and unassigned matters; uploaded evidence | Open title chain; verify/dispute with/without rationale; try same as analyst/consultant. | Lawyer allowed only for assigned matter; rationale enforced; other roles denied; audit and state persisted. | Title-chain and governance tests exist. | BLOCKED |
| LAW-02 | Lawyer | Draft report with evidence and missing anchors | Sign off; alter source after snapshot; regenerate report. | Approval checks prerequisites; immutable snapshot identifies evidence/template/rules; changes create new version. | Report/snapshot tests partial; PDF unconfigured per QA report. | NOT RUN |
| ANL-01 | Analyst | Assigned/unassigned synthetic matter and documents | Upload, extract, edit allowed field, submit; attempt verify/sign-off/admin route. | Upload/edit allowed on authorized work; legal approval/admin denied; data persists with audit. | Extraction, upload and assignment tests exist. | BLOCKED |
| ANL-02 | Analyst | Representative synthetic Kannada/English corpus | Run OCR; inspect low-confidence and corrupt documents; retry job. | Unknown/review states visible; no fabricated confidence; retry idempotent; anchor saved. | OCR tests exist but no benchmark/quality acceptance. | NOT RUN |
| OPS-01 | Operations | Assigned, unassigned and another user’s matter | Upload intake documents; update checklist/workflow; attempt legal review, source and admin routes. | Only allowed intake scope; state transitions valid; sensitive routes denied. | Operations assignment and admin-governance cases exist. | BLOCKED |
| CON-01 | Consultant | Approved and draft matters; another tenant | Prepare issue list and export JSON/HTML/PDF; attempt reviewer and admin mutation. | Only authorized approved scope exported; draft/wrong tenant denied; export logged; reviewer mutation denied. | Consultant governance test exists; full release workflow unverified. | BLOCKED |
| VIEW-01 | Viewer | Released, draft, revoked and cross-tenant matters | Open UI; directly request property, documents, signed URL, findings, HTML/PDF/JSON report. | Read only released approved data; all draft/revoked/wrong-tenant paths denied; no internal evidence. | Viewer tests cover some internal restrictions; end-to-end report tests absent/unverified. | BLOCKED |
| SUP-01 | Support | Support session; protected synthetic business records | Access overview; request property/document/map/source/report/admin endpoints; wait until expiry; retry. | Diagnostics only; no business data; expiry/logout denies access; audit identifies support. | Support governance test exists; route-wide behavior not certified. | BLOCKED |
| DATA-01 | Data Steward | Verified, incomplete, stale, synthetic and unlicensed source fixtures | Add/update source metadata; attempt rule analysis with each source state. | Only approved provenance-complete current source is usable; unknown/unverified never presented as clearance; changes audited. | Source and GIS tests exist; real official data not available in QA. | NOT RUN |
| RBAC-01 | Owner / Admin / Super Admin | Separate trusted identities and two tenants | Attempt role changes, privileged routes, spoofed body/header claims, remove/demote final owner. | Privileges derive from trusted identity; escalation blocked; owner invariant and audit preserved. | Governance tests cover some owner protections; production trust boundary not verified. | BLOCKED |
| XROLE-01 | Admin → Analyst → Operations → Lawyer → Consultant → Viewer | Synthetic matter and roles; test DB | Create/assign; upload/intake; analyst review; lawyer approve; release; export/view; revoke release. | Correct transition sequence and visibility; only authorized role can act at each transition; events audited. | Components/API endpoints exist; no complete authenticated E2E certified. | BLOCKED |
| XROLE-02 | Data Steward → Analyst → Lawyer → Viewer | Licensed synthetic fixture and known outcomes | Register source/rule; screen property; review finding; publish approved snapshot. | Result cites source vintage/rule; unknown path works; Viewer only sees approved conclusion. | Spatial and source unit tests exist; authoritative source and known cases unavailable. | NOT RUN |
| UI-01 | Each role | Browser E2E environment | Navigate allowed/restricted pages; test forms, validation, search/filter, exports and responsive layouts. | UI behavior matches server permissions; errors are useful; no horizontal overflow or hidden-route bypass. | Public-auth smoke is documented; authenticated E2E not certified. | NOT RUN |

## 8. Implementation Roadmap

### Phase 1 — Critical security issues and blockers

1. SH-02: repair CI database mismatch; stand up isolated MariaDB/API test job.
2. SH-03: resolve critical/high dependency findings; verify production identity/session configuration.
3. SH-01 + RBAC-01/02/03: publish canonical role matrix; test every sensitive API and tenant/assignment boundary.
4. SH-04: finish private durable document storage, malware controls, download audit, retention and restore before any real client data.

### Phase 2 — Missing authentication and permission controls

1. ADM-03, VIEW-01/02 and SUP-01: harden admin, viewer release, support route scopes.
2. ADM-02 and SUP-02: invitation activation and support access/runbook policy.
3. Confirm owner versus admin versus super-admin privileges with Product/Security.

### Phase 3 — Core functionality by role

1. OPS-01/02: intake checklist and transition model.
2. ANL-01/02/03: extraction lifecycle, review, normalization, research provenance.
3. LAW-01/02/03: qualified sign-off, evidence anchors and approved report templates.
4. CON-01/02: approved client-ready dossier and access model.
5. DATA-01/02/03: licensed source provenance, rule versioning and authorized ingestion.
6. ADM-01/04: decide billing and implement only if in scope; implement approved retention lifecycle.

### Phase 4 — Cross-role integrations and workflows

1. Connect admin assignment → operations intake → analyst preparation → lawyer review → consultant export → viewer release.
2. Connect Data Steward-approved source/rule → Analyst screening → Lawyer review → approved report/viewer result.
3. Define notification events, delivery channels, failure retries and audit; implement only after Product confirms scope.

### Phase 5 — Testing, defect repair and regression

1. SH-05: role-complete integration and browser tests; execute all blocked cases.
2. SH-06: reconcile OpenAPI with actual supported routes.
3. Execute migrations on clean and upgraded snapshots; verify backup/restore, load, accessibility and security gates.

### Phase 6 — Final FDD compliance validation

1. Map every FDD Must/P0 requirement to implementation, test evidence, source/version, and acceptance owner.
2. Review launch gates in FDD §29: functional, data provenance, geo, AI, security, reliability, performance, operational, legal workflow and pilot.
3. Obtain Product, Engineering, QA, Security and Legal/Data Steward acceptance; do not infer production readiness from a successful build.

## 9. Final Completion Checklist

### Organisation Admin
- [ ] Tenant-scoped pages and APIs verified; no cross-tenant access.
- [ ] Role assignment cannot grant owner/super-admin improperly.
- [ ] Invitations deliver and accept securely; resend/revoke/expiry tested.
- [ ] Retention/legal hold lifecycle approved and verified.
- [ ] Billing scope decided and either delivered or formally deferred.

### Lead Advocate / Reviewer
- [ ] Assigned matters and evidence reviewed with complete provenance.
- [ ] Title and document verification rationale/state transitions tested.
- [ ] Qualified sign-off, immutable report snapshot and approved disclaimer implemented.
- [ ] Reports link material findings to stable evidence anchors and rule/source versions.

### Associate / Analyst
- [ ] Assignment scoping and write permissions tested.
- [ ] OCR/extraction pipeline benchmarked on approved corpus.
- [ ] Corrections/tags audited; analyst cannot self-verify or sign off.
- [ ] Uncertain/unavailable sources remain explicitly unknown.

### Paralegal / Operations
- [ ] Intake checklist, metadata rules, task states and due dates implemented.
- [ ] Unassigned matter visibility policy decided and enforced.
- [ ] Legal approval, source admin and tenant admin actions denied.

### Property Consultant
- [ ] Only authorized matters/issues visible.
- [ ] Draft/unapproved report export blocked.
- [ ] Approved client report renders correctly and export is audited.
- [ ] Consultant cannot alter legal verification state.

### Client / Viewer
- [ ] Explicit share/release grant controls access.
- [ ] Read-only behavior applies to all direct APIs and exports.
- [ ] Draft, revoked, wrong-tenant and internal evidence requests denied.
- [ ] Session expiry/logout and responsive view tested.

### OJIX Support
- [ ] Time limit, logout, expiry and revocation verified.
- [ ] Diagnostics-only route matrix passes; no business data exposure.
- [ ] Support actions/reasons and escalation are audited and documented.

### OJIX Data Steward
- [ ] Source licence, publisher, URL, vintage, CRS, checksum and review fields required.
- [ ] Incomplete, stale, synthetic or unlicensed data cannot produce clearance.
- [ ] Rule version changes are approved, audited and historically reproducible.
- [ ] Ingestion quarantine, freshness and degraded-state handling tested.

### Owner / Platform Super Admin (code-defined)
- [ ] Tenant Owner and platform Super Admin identity are distinct and trusted.
- [ ] No header/body/client-selected privilege escalation.
- [ ] Cross-org mutation requires reason, preserves owner invariant and writes audit.

### Shared release gates
- [ ] CI runs MariaDB-compatible schema/migrations and all test suites.
- [ ] Critical/high dependencies resolved or formally accepted by Security.
- [ ] API contract reflects supported routes.
- [ ] Storage, malware, retention, encryption/IAM and restore verified.
- [ ] FDD §29 launch criteria signed by accountable owners.

## 10. Open Questions

1. Is the attached PDF the authoritative current FDD? Its cover labels it a functional requirements/technical architecture baseline; repo documents include later changes and inconsistent status snapshots.
2. Are `owner`, `admin`, and `super-admin` formal product roles? What exact capabilities distinguish them from FDD Organisation Admin and Lead Advocate?
3. Does `status='complete'` mean legal approval and client release, or is a separate approval/share grant required? Who can release and revoke a report?
4. Should Consultant have write access to any property fields? Which issue-list fields are editorial versus legal findings?
5. Are unassigned matters visible to Operations by policy? Are consultants/lawyers assigned per matter, per team, or per tenant?
6. Are plans, billing, invoices and payment gateway in MVP scope despite FDD table listing Organisation Admin responsibilities and backlog E16 as P1?
7. What are approved OCR accuracy thresholds, language/document corpus, manual-review rules and acceptable UNKNOWN behavior?
8. Which official/property datasets are licensed for use? Who approves source provenance, rule thresholds, CRS, vintage and known test cases?
9. Which identity provider is authoritative in production: Firebase, OTP account system, or both? Which roles may self-register, and how are memberships provisioned?
10. What are email invitation, notification, support break-glass and operational escalation requirements? SMTP is documented as not configured for invitations in the current API response.
11. What are legal retention, legal hold, deletion, export logging, RPO/RTO and backup requirements?
12. Which database/cloud target is approved? The FDD recommends PostgreSQL/PostGIS/Cloud SQL, while the current API/CI evidence uses MariaDB/MySQL and the QA report identifies a CI mismatch.
13. Are the test identities and source fixtures synthetic and safe for CI? Which secure external credentials are available in an isolated staging environment?
14. Which release status is authoritative? `docs/QA-REPORT-2026-10-27.md` says conditional go for synthetic internal testing; `qa-reports/QA_EXECUTIVE_REPORT.md` says not ready for release. The stricter status is used until reconciled.

## Evidence Index

- **FDD:** `/Users/apple/Desktop/OJIX_RFD_Property_Intelligence_v1.0.pdf`, especially §3 (product roles), §5–6 (journeys/functional requirements), §9 (document intelligence), §13–14 (reports/admin), §20 (security), §26 (testing), §28–29 (team and acceptance), §34 (engineering backlog).
- **Authorization and routes:** `apps/api/src/server.ts` — auth and role guards around lines 352–525; auth/session routes around 685–910; property/document/title/spatial/report/legal/source/admin routes thereafter.
- **UI:** `apps/web/src/App.tsx`; `apps/web/src/components/AdminModule.tsx`; `SuperAdminPage.tsx`; `SideBySideReview.tsx`; `SourceRegistryView.tsx`; `ReportViewer.tsx`.
- **Schema/roles:** `database/mysql-schema.sql`; `database/migrations/009_operations_role.sql`, `010_property_consultant_role.sql`, `011_ojix_support_role.sql`, `012_data_steward_role.sql`, `016_property_workflow_assignments.sql`, `017_admin_governance.sql`, `026_demo_login_account_binding.sql`; `infra/db/seed.sql`.
- **Project status:** `README.md`; `docs/IMPLEMENTATION_STATUS.md`; `docs/FRD_TRACEABILITY.md`; `docs/audit/P0-GAP-REGISTER.md`; `docs/audit/SECURITY-ARCHITECTURE-REVIEW.md`.
- **Test/QA evidence:** `apps/api/test/admin-governance.test.ts`; `apps/api/test/auth-security.test.ts`; `apps/api/test/title-chain.test.ts`; `apps/api/test/document-extraction.test.ts`; `tests/e2e/*`; `qa-reports/TEST_CASES.md`; `qa-reports/QA_EXECUTIVE_REPORT.md`; `docs/QA-REPORT-2026-10-27.md`.
