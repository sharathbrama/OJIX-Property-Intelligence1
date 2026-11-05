# OJIX Property Intelligence — Project Progress & Handover Documentation

> **Last Updated:** 2026-11-05 09:56 IST  
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

## 3. Current Project State & Working Services

* **API Server:** Port `4000` (`http://localhost:4000`)
* **Web Frontend:** Port `5173` or served via local stack (`http://localhost:4000` / `http://localhost:5173`)
* **Database:** MariaDB on `127.0.0.1:3308` (`ojix_property_mysql`)
* **Build Status:** TypeScript build (`tsc -b apps/api apps/web`) exits with 0 errors. Vite production build completes cleanly.

---

## 4. Pending Tasks & Roadmap

### Priority 1: Matter Workspace & Multi-Property Lifecycle (FRD §5 / §7)
* **Status:** Pending / Next Logical Task
* **Scope:**
  * Connect top-level Matters (`matters` table) to individual properties (`properties` table) per FRD §5.
  * Currently properties are scoped directly to tenant without explicit matter folder grouping.
* **Dependencies:** Database migration for `matters` schema and navigation tabs in `App.tsx`.

### Priority 2: Real-time RTC (Bhoomi) Government Connector Hardening (FRD §8.3 / §14)
* **Status:** Pending
* **Scope:**
  * Hardening automated Bhoomi/Kaveri scraper and API connector when government service is degraded or returns CAPTCHA.
  * Connect Source Health monitor dashboard (`/admin/sources`) to reflect live connector latency.
* **Dependencies:** Authorization and mock fixture mode for CI.

### Priority 3: Cross-Role Workflow Handover Verification (FDD §3 / XROLE-01)
* **Status:** In Progress
* **Scope:**
  * End-to-end integration test verifying complete handoff:
    1. Admin invites / assigns matter.
    2. Operations uploads intake documents.
    3. Analyst reviews OCR extractions and tags evidence anchors.
    4. Lawyer verifies title chain and disputes/approves events.
    5. Consultant prepares client issue list.
    6. Owner signs off report release.
* **Dependencies:** Synthetic test fixture in `apps/api/test/cross-role-workflow.test.ts`.

---

## 5. Important Conventions & Ground Rules

1. **Strict FRD Adherence:** Always check `FULL_DECODED_FRD.txt` before implementing or changing permissions, roles, or workflow rules.
2. **Sole Owner Invariant:** Never allow a migration or route to permit a tenant with 0 owners.
3. **Database Port:** MariaDB local port is `3308` (User: `ojix`, Password: `ojix_local_only`).
4. **Execution Protocol:** Always update this `PROJECT_PROGRESS.md` file immediately upon completing any task.

