# OJIX Property Intelligence — Project Progress & Handover Documentation

> **Last Updated:** 2026-11-23 12:25 IST  
> **Repository Root:** `c:\Users\KEERTHANA\OneDrive\Desktop\Developing project\OJIX-Property-Intelligence`  
> **Status:** Active Development / MVP Stabilization

---

## 1. Project Context & Objectives

### 1.1 Core Mission
OJIX Property Intelligence is an evidence-first legal due diligence and land transaction intelligence platform tailored for Bengaluru and Karnataka property markets. The platform automates the intake and synthesis of physical and digital land records (Sale Deeds, RTC/Pahani, Mutation Registers, Encumbrance Certificates), reconstructs 40-year chain-of-title histories, flags statutory spatial violations (BDA Revised Master Plan and NGT waterbody/drain buffer zones), and outputs legal-grade property title reports verified by qualified advocates.

### 1.2 Architectural Overview
* **Web Frontend (`apps/web`):** React 18, TypeScript, Vite, Tailwind-styled components with dedicated portals for 8 product roles (Workspace Owner, Organisation Admin, Lead Advocate / Reviewer, Associate / Analyst, Paralegal / Operations, Property Consultant, OJIX Support, and Read-only Viewer).
* **Backend API (`apps/api`):** Node.js, Express, TypeScript (`tsx`), Zod schema validation, REST endpoints.
* **Database (`infra/db`):** MariaDB (running on `127.0.0.1:3308`, database: `ojix_property_mysql`), pooled with `mysql2/promise`.
* **Report Generation:** Headless Chromium via Puppeteer rendering high-fidelity HTML/CSS with PDFKit fallback.
* **Document Extraction & OCR:** Bilingual OCR using Tesseract (`kan+eng`) and `pdftoppm` with bounding-box evidence anchoring.
* **Identity & Authentication:** Dual mode (local scrypt password hashes + real Gmail SMTP email OTP challenges, with Firebase ID token verification hooks for production cloud deployment).

---

## 2. Completed Tasks Log

### Task 1: Headless Chromium PDF Report Generation & UI Download
* **Status:** Completed
* **Work Completed:**
  * Replaced plain-text / degraded exports with headless Chromium engine producing legal-grade multi-page PDFs with running headers, firm branding, page numbers (*"Page X of Y"*), title chain tables, discrepancy tables, and statutory disclaimer footers.
  * Added fallback to PDFKit when Chromium is unavailable or in resource-constrained environments.
  * Replaced hardcoded `disabled` state and `"PDF unavailable"` label on the frontend download button (`ReportViewer.tsx`) with an active `"Download Report PDF"` button triggering live binary download.
* **Files Modified / Created:**
  * `apps/api/src/report-generator.ts` (Puppeteer browser launch, HTML template, PDFKit fallback)
  * `apps/web/src/components/ReportViewer.tsx` (Download handler, loading spinner, dynamic blob download)
  * `apps/api/test/api-report-pdf.test.ts` (API route PDF verification)
  * `apps/api/test/headless-pdf.test.ts` (Headless rendering verification)
* **Testing:** Automated tests verify PDF output structure and binary MIME headers (`application/pdf`).

---

### Task 2: Workspace & Engine Settings Page (FRD §8 & §14)
* **Status:** Completed
* **Work Completed:**
  * Built complete `SettingsView.tsx` page to manage firm branding, practice credentials, report preferences, and statutory buffer thresholds.
  * Integrated statutory Karnataka GIS buffer rules: Primary Drain (50m), Secondary Drain (25m), Tertiary Drain (15m), and Lake Periphery Buffer (30m).
  * Configured OCR confidence threshold (`0.60`) and survey discrepancy tolerance margins (`1.0%`).
  * Implemented backend `GET /api/settings` and `POST /api/settings` persistence in MariaDB table `workspace_settings`.
* **Files Modified / Created:**
  * `apps/web/src/components/SettingsView.tsx`
  * `apps/api/src/server.ts`
  * `database/migrations/028_firm_branding_settings.sql`
  * `database/migrations/029_governance_report_templates.sql`
* **Testing:** Verified via `apps/api/test/workspace-owner-role.test.ts` for schema integrity, role permissions, and setting updates.

---

### Task 3: Protected Owner Invariant & Separation of Powers (ADM-03, LAW-01 / FRD §3, §14, §20)
* **Status:** Completed
* **Work Completed:**
  * **Protected Sole Owner Invariant:** Server-side guard prevents demoting, disabling, or deleting the sole remaining Workspace Owner. Ownership can only be transferred to an active member via designated transfer flow.
  * **Legal Sign-Off Separation:** Enforced separation of duties between business administration (Managing Partner/Owner) and formal title sign-off (Lead Advocate `lawyer`), ensuring administrative owners cannot self-certify legal opinions without advocate review.
* **Files Modified / Created:**
  * `apps/api/src/server.ts`
  * `database/migrations/031_legal_sign_off_separation.sql`
  * `apps/api/test/workspace-owner-role.test.ts`
* **Testing:** 6/6 tests passing in `workspace-owner-role.test.ts`.

---

### Task 4: Firm Security MFA Toggle Enforcement (FRD §6.1 AUTH-01 / §20)
* **Status:** Completed
* **Work Completed:**
  * Added `enforce_mfa_privileged` column (TINYINT/BOOLEAN) to MariaDB `workspace_settings`.
  * Exposed a toggle switch in `SettingsView.tsx` restricted to Owner and Admin: *"Enforce Mandatory MFA for Workspace Accounts & Reviewers"*.
  * Aligned backend role evaluation (`isPrivilegedRole`) with FRD §6.1 AUTH-01 to cover all active workspace personnel:
    `['owner', 'admin', 'lawyer', 'analyst', 'operations', 'consultant', 'data_steward', 'super-admin']`.
  * **When Toggle is ON:** Any sign-in attempt by these roles issues an HTTP 201 Challenge requiring 6-digit email OTP. Direct password-only bypass (`/api/auth/login`) is blocked with HTTP 403.
  * **When Toggle is OFF:** Any sign-in attempt issues an HTTP 200 OK directly with a session token, bypassing the OTP prompt.
* **Files Modified / Created:**
  * `apps/api/src/server.ts` (Lines 981–1012, 1121–1136)
  * `apps/web/src/components/SettingsView.tsx` (Checkbox UI, descriptive role copy)
  * `apps/api/test/mfa-enforcement.test.ts` (7 automated test cases)
* **Testing:** `7/7` passing in `apps/api/test/mfa-enforcement.test.ts` verifying both Toggle ON (OTP challenge) and Toggle OFF (direct login) for Owner and Evidence Analyst.

---

### Task 5: Sign-In Screen Credential Pre-fill & Role Switching UX
* **Status:** Completed
* **Work Completed:**
  * Fixed issue where clicking role cards in `LoginPage.tsx` left email and password fields empty, triggering browser HTML5 validation *"Please fill out this field."*.
  * Wired dynamic credential population on role selection: clicking any role card (e.g. *Evidence Analyst*, *Workspace Owner*, *Legal Reviewer*) automatically fills the designated email (`keerthana1234p@gmail.com`) and matching demo password (`Analyst@3126`, `Owner@3126`, `Lawyer@3126`, etc.).
  * Updated submit button from hardcoded *"Continue with email OTP"* to *"Continue to Workspace"* to accurately support both MFA-active and MFA-disabled flows.
* **Files Modified / Created:**
  * `apps/web/src/components/LoginPage.tsx`
* **Testing:** Verified in browser and type-checked cleanly with `npx tsc -b apps/api apps/web`.

---

### Task 6: Bilingual OCR & Document Processing Architecture (FRD §6.2)
* **Status:** Completed (Core engine & Review pipeline operational)
* **Work Completed:**
  * Verified Tesseract bilingual OCR pipeline (`kan+eng`) using `pdftoppm` for Kannada and English land records.
  * Automated extraction of property identifiers (survey numbers, village, hobli, taluk), transaction parties (buyer/seller), consideration amounts, and deed dates.
  * Document confidence threshold gating: extractions below configured threshold (default 60%) are flagged for side-by-side manual review by the Evidence Analyst.
  * Bounding box evidence anchors linking extracted facts directly to scanned page coordinates.
* **Files Involved:**
  * `apps/api/src/local-ocr.ts`
  * `apps/api/src/document-extractor.ts`
  * `apps/web/src/components/SideBySideReview.tsx`
* **Testing:** Verified via `challenger-adversarial-extraction.test.ts` and `document-extraction.test.ts`.

---

### Task 7: Cross-Role Workflow Handover Verification (FDD §3 / XROLE-01)
* **Status:** Completed
* **Work Completed:**
  * Implemented opaque-box integration test verifying complete 6-stage cross-role workflow handover:
    1. **Admin:** Creates client matter and assigns specialist team (lawyer, analyst, operations, consultant).
    2. **Operations:** Intakes land documents (Sale Deed, RTC Pahani), generates SHA-256 checksums, and isolates tenant access.
    3. **Analyst:** Reviews bilingual OCR extractions, checks confidence thresholds (≥ 0.60), logs bounding-box anchors, flags title gap finding, and tasks review.
    4. **Lawyer:** Cross-examines title chain, records formal adverse title risk disposition, and moves matter forward.
    5. **Consultant:** Generates client issue recommendations from confirmed findings without modifying legal conclusions.
    6. **Owner:** Inspects full audit trail, verifies document evidence coverage, and executes final release sign-off.
  * Validated 10 core system invariants (token verification, 6-step audit coverage, role segregation, final approvals, sole owner governance, and token expiry).
* **Files Modified / Created:**
  * `apps/api/test/cross-role-workflow.test.ts` (60 test cases)
* **Testing:** 60/60 passing in `cross-role-workflow.test.ts`.

---

### Task 8: Matter Workspace & Multi-Property Lifecycle (FRD §5 / §7)
* **Status:** Completed
* **Work Completed:**
  * Structured top-level Matter engagement data model (`matters` table) grouping multiple property applications per client file.
  * Implemented database migration `040_matters_workspace_lifecycle.sql` introducing `matters`, `matter_id` foreign key on `properties`, `matter_audit_events`, and computed `matter_summary` view.
  * Added RESTful matter lifecycle endpoints in `apps/api/src/server.ts`:
    * `GET /api/matters`: Tenant matter directory with query search (`q`), status, and priority filters.
    * `POST /api/matters`: Matter intake with auto-generated sequential identifiers (`OJIX-M-2026-XXX`) restricted to Owner/Admin.
    * `GET /api/matters/:matterId`: Detailed matter file with linked properties and access control.
    * `PATCH /api/matters/:matterId`: Metadata and assignment updates with audit trail logging.
    * `PATCH /api/matters/:matterId/assign-property`: Links property dossiers to client matters.
    * `DELETE /api/matters/:matterId`: Soft archival restricted exclusively to Workspace Owner.
    * `GET /api/matters/:matterId/audit`: Comprehensive matter lifecycle audit history.
  * Wired full session-scoped demo support in `session-repository.ts` with 5 seed matters across Karnataka jurisdictions.
  * Updated RBAC route mappings in `apps/api/src/rbac.ts` so `/api/matters` requests inherit proper permission scoping.
* **Files Modified / Created:**
  * `database/migrations/040_matters_workspace_lifecycle.sql`
  * `apps/api/src/server.ts` (Matters API routes)
  * `apps/api/src/session-repository.ts` (`DemoMatter` interface, seed baseline, workspace rehydration)
  * `apps/api/src/rbac.ts` (Route permission mapping)
  * `apps/api/test/matters-lifecycle.test.ts` (12 test cases)
* **Testing:** 12/12 passing in `matters-lifecycle.test.ts`.

---

### Task 9: Matter Workspace UI Component & Navigation (FRD §5 / §6.2 MAT-01 / §7 / §35 Screen 03)
* **Status:** Completed
* **Work Completed:**
  * Implemented `MattersView.tsx` matching FRD Screen 03 (Matter Workspace):
    * Top KPI cards: Total Active Matters, High/Critical Priority, Ready for Advocate Sign-Off, Completed & Released.
    * Real-time search and filter toolbar (status, priority, client keyword search).
    * Comprehensive client engagements table with status pills, priority badges, due date indicators with overdue detection, and property counts.
    * Detailed Matter File Drawer with multi-tab layout: Linked Properties, Lifecycle Audit Trail (`/api/matters/:id/audit`), and Engagement Metadata.
    * "New Client Matter" intake modal (MAT-01) supporting title, client contact, review purpose, priority, target completion date, and notes.
    * Status transition workflow (Open → In Review → Ready for Sign-Off → Closed).
  * Wired `"matters"` route into `App.tsx` and sidebar navigation with `BriefcaseBusiness` icon.
* **Files Modified / Created:**
  * `apps/web/src/components/MattersView.tsx`
  * `apps/web/src/App.tsx`

---

### Task 10: Statutory Intake Checklist & Lead Advocate Legal Sign-Off (Migration 039 / FRD §6.2, §6.3, §12)
* **Status:** Completed
* **Work Completed:**
  * Backend API endpoints implemented for Migration 039:
    * `GET /api/properties/:id/intake-checklist`: Retrieves 10 statutory Karnataka land records checklist (Sale Deed, RTC Pahani, Mutation Extract, EC Form 15, e-Khata, Property Tax, Survey Sketch, Conversion Order, Layout Plan, PTCL Clearance), auto-linked from uploaded evidence documents.
    * `PATCH /api/properties/:id/intake-checklist/:itemCode`: Updates intake status (uploaded, pending, missing, not_applicable) and reviewer notes.
    * `GET /api/properties/:id/legal-sign-off`: Retrieves existing advocate sign-off certificate.
    * `POST /api/properties/:id/legal-sign-off`: Submits formal advocate title opinion with Bar Council enrollment number, opinion verdict, notes, and cryptographic SHA-256 snapshot hash. Blocks sign-off if mandatory documents are marked missing. Promotes property to `'approved'` status.
    * `GET/POST /api/properties/:id/client-share`: Securely manages client/viewer access sharing.
  * Connected `IntakeChecklist.tsx` and `AdvocateSignOffModal.tsx` in `App.tsx` / `PropertyPage.tsx` with authenticated API calls (`authFetch`).
* **Files Modified / Created:**
  * `apps/api/src/server.ts`
  * `apps/api/src/session-repository.ts`
  * `apps/web/src/components/IntakeChecklist.tsx`
  * `apps/web/src/components/AdvocateSignOffModal.tsx`
  * `apps/web/src/App.tsx`

---

### Task 11: FRD §12.2 Neutral Severity Taxonomy & §13.1 Multi-Template Report Generation
* **Status:** Completed
* **Work Completed:**
  * Enhanced `GlobalRiskView.tsx` to align with FRD §12.2 neutral operational severity labels (*Critical Review Required*, *High Review Required*, *Moderate Review*, *Informational / Cleared*) and 8 FRD §12.1 risk categories (*TITLE*, *IDENTITY*, *EXTENT*, *ENCUMBRANCE*, *GEO*, *PLANNING*, *DOCUMENT*, *RESEARCH*).
  * Enhanced `ReportViewer.tsx` to support the 5 FRD §13.1 report types (*Detailed Due Diligence*, *Preliminary Screening*, *Client Decision Pack*, *Evidence Appendix*, *Change Alert*).
* **Files Modified / Created:**
  * `apps/web/src/components/GlobalRiskView.tsx`
  * `apps/web/src/components/ReportViewer.tsx`

---

## 3. Current Project State & Working Services

* **API Server:** Port `4002` (`http://localhost:4002`)
* **Web Frontend:** Port `5173` or served via local stack (`http://localhost:4002` / `http://localhost:5173`)
* **Database:** MariaDB on `127.0.0.1:3308` (`ojix_property_mysql`) + Session-Scoped Demo Engine
* **Build Status:** TypeScript check and monorepo production build (`npm run build`) complete with 0 errors across API and Web packages (`dist/assets/index-*.js`, `dist/assets/index-*.css`).
* **Automated Test Suite:** 72/72 test cases passing across `cross-role-workflow.test.ts` (60/60) and `matters-lifecycle.test.ts` (12/12).

---

## 4. Pending Tasks & Roadmap

### Priority 1: Real-time RTC (Bhoomi) Government Connector Hardening (FRD §8.3 / §14)
* **Status:** Pending / Next Phase
* **Scope:**
  * Hardening automated Bhoomi/Kaveri scraper and API connector when government service is degraded or returns CAPTCHA.
  * Connect Source Health monitor dashboard (`/admin/sources`) to reflect live connector latency.

---

## 5. Important Conventions & Ground Rules

1. **Strict FRD Adherence:** Always check `FULL_DECODED_FRD.txt` before implementing or changing permissions, roles, or workflow rules.
2. **Sole Owner Invariant:** Never allow a migration or route to permit a tenant with 0 owners.
3. **Database Port:** MariaDB local port is `3308` (User: `ojix`, Password: `ojix_local_only`).
4. **Execution Protocol:** Always update this `PROJECT_PROGRESS.md` file immediately upon completing any task.

