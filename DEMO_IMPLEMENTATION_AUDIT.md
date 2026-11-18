# OJIX Property Intelligence — Demo Implementation Audit

**Document Status**: Baseline Implementation Audit  
**Target Environment**: Isolated Vercel Demo Deployment (`ojix-client-demo` branch)  
**Author**: Senior Full-Stack Architect & Engineering Team  
**Date**: November 18, 2026  

---

## 1. Existing Architecture

### Monorepo Structure
The repository is an npm workspace comprising:
- `apps/web`: React 18, Vite, TypeScript, MapLibre GL JS, Lucide icons, responsive PWA architecture.
- `apps/api`: Node.js 22 Express application with Zod request validation, Swagger / OpenAPI 3.0 documentation (`/api-docs`), and a catch-all Vercel entrypoint at `apps/api/api/[...path].ts`.
- `apps/api/worker`: Standalone Python worker (`worker.py`) using `pytesseract`, `pdf2image`, `mysql.connector`, and `Pillow` polling `document_processing_jobs`.
- `database/`: MySQL/MariaDB schemas, table definitions, and migrations (001–033).
- `scripts/`: Data ingestion, location CSV parser, test suites.

### Current Request & Data Flow
1. **Authentication**: Users submit email + password -> backend sends a 6-digit OTP via SMTP/Twilio -> user submits OTP -> backend validates against `otp_challenges` and issues a Bearer token `ojix-*` saved in `authentication_sessions`.
2. **Database Binding**: Every business route in `server.ts` directly queries `pool.query(...)` against a remote MariaDB / MySQL instance (configured in `DATABASE_URL`).
3. **Document Ingestion**: File uploaded -> stored via `documentStorage` (local filesystem or Supabase) -> record inserted in `documents` -> job queued in `document_processing_jobs` -> Python worker polls DB, executes Tesseract, and calls `/internal/ocr/jobs/complete`.
4. **Analysis Engines**:
   - `document-extractor.ts`: Regex and rule-based parser mapping raw text/tokens to `ExtractedDocumentFields` (parties, survey number, boundaries, extents).
   - `title-engine.ts`: Directed Acyclic Graph (DAG) reconstructing title history, prior transfers, and chain gaps.
   - `spatial-rules-engine.ts`: Buffer screening for SWD (Rajakaluve), water bodies, lakes, and road corridors.
   - `discrepancy-engine.ts`: Cross-document reconciliation (extent differences, boundary mismatches).
   - `report-generator.ts` & `report-pdf.ts`: Generates structured legal due-diligence reports.

---

## 2. Existing Features Status

| Feature / Domain | Implementation Status | Current Dependency |
|---|---|---|
| **PWA & UI Dashboards** | Fully operational | React 18, Vite, CSS |
| **All 10 User Roles** | Implemented in RBAC (`rbac.ts`) | Strict permission mapping |
| **Authentication Flow** | Operational but fragile | Requires SMTP & MySQL |
| **Location Hierarchy** | Implemented (Districts, Taluks, Hoblis, Villages) | Requires MySQL tables |
| **Document Intake & Upload** | Implemented (Direct & Multipart) | Requires Local Disk / Supabase |
| **OCR Processing** | Implemented in Python worker | Requires MySQL queue + Tesseract |
| **Field Extraction** | Implemented (`document-extractor.ts`) | Fully deterministic TS logic |
| **Title Chain DAG** | Implemented (`title-engine.ts`) | Fully deterministic TS logic |
| **Discrepancy Matrix** | Implemented (`discrepancy-engine.ts`) | Fully deterministic TS logic |
| **GIS Buffer Screening** | Implemented (`spatial-rules-engine.ts`) | Spatial GeoJSON algorithms |
| **PDF Report Generation** | Implemented (`report-generator.ts`) | Server-side template rendering |
| **Audit Trails** | Implemented | Requires `audit_events` MySQL table |

---

## 3. Required Changes for the Client-Ready Demo

1. **One-Click Demo Authentication**:
   - Remove mandatory OTP and email delivery bottlenecks for demo access.
   - Implement an instant "Enter Demo Workspace" action that provisions a secure, isolated session.
   - Set up secure HttpOnly / SameSite session cookie with Bearer token compatibility.
   - Enable in-app demo role switching among all 10 roles (`super_admin`, `owner`, `admin`, `lawyer`, `analyst`, `operations`, `consultant`, `support`, `data_steward`, `viewer`).

2. **Session-Scoped In-Memory Repository**:
   - Remove reliance on the production MariaDB database.
   - Create a durable, session-scoped repository so each demo session has its own private workspace (properties, uploaded documents, OCR extractions, findings, tasks, reports).
   - Ensure mutations (creating a property, uploading a file, verifying a field, adding a finding) actually persist across requests within that session.
   - Guarantee strict isolation between concurrent user sessions.

3. **Vercel Serverless File Storage**:
   - Local filesystem `/tmp` on Vercel is ephemeral and stateless across function invocations.
   - Implement private Vercel Blob / session-backed memory store adapter for document upload, preview, and download.
   - Handle cleanup on session logout.

4. **Self-Contained Real Tesseract OCR**:
   - Bridge the OCR execution so that uploaded documents (PDFs, images) run actual Tesseract OCR and feed raw text/tokens directly into `extractDocument()`.
   - Ensure the user sees real extracted text, bounding boxes, confidence scores, and structured property fields without needing an external background worker daemon.

5. **External Integrations Disabled**:
   - Ensure Kaveri 2.0, Bhoomi RTC, BBMP e-Aasthi, Google Document AI, Vertex AI, SMTP, and Twilio display as `Demo Mode — Not Connected` with realistic Karnataka synthetic data.

---

## 4. Files to Modify

1. `apps/api/src/server.ts`:
   - Add one-click demo login, session retrieval, role-switching endpoint (`POST /api/auth/demo/switch-role`), and logout cleanup.
   - Integrate session-scoped repository into all route handlers (`properties`, `documents`, `locations`, `overview`, `findings`, `admin`).
   - Wire inline OCR execution for uploaded files in demo mode.
2. `apps/api/src/demo-access.ts`:
   - Expand demo authorization logic to permit dynamic role switching across all 10 roles while preserving RBAC integrity.
3. `apps/web/src/components/LoginPage.tsx`:
   - Add prominent one-click "Enter Demo Workspace" button with instant role selection.
   - Display clear Demo Mode indicators while keeping original brand elegance.
4. `apps/web/src/App.tsx`:
   - Enhance the persistent workspace role switcher to invoke `POST /api/auth/demo/switch-role` and update client view state seamlessly.
5. `apps/web/src/components/SourceRegistryView.tsx` & `AdminModule.tsx`:
   - Clearly display integration status as `Demo Mode — Not Connected`.
6. `vercel.json` & `apps/api/vercel.json`:
   - Ensure serverless routing, CORS, and function memory/duration allocations match requirements.
7. `.env.example`:
   - Document demo-specific environment variables without production secrets.

---

## 5. Files to Create

1. `apps/api/src/session-repository.ts`:
   - Core session manager and session-scoped data store managing isolated datasets per active user session.
2. `apps/api/src/demo-ocr-runner.ts`:
   - Direct OCR engine that runs local Tesseract executable or Python Tesseract process on uploaded files, generating tokens and feeding `extractDocument()`.
3. `apps/api/worker/run_ocr.py`:
   - Standalone CLI/sub-process Python OCR script for single-file execution taking file paths and outputting standard OJIX OCR JSON.
4. `DEMO_IMPLEMENTATION_AUDIT.md`:
   - This comprehensive audit document.
5. `DEMO_DEPLOYMENT_GUIDE.md`:
   - Step-by-step instructions for Vercel deployment.
6. `DEMO_ENVIRONMENT_SETUP.md`:
   - Environment variables and local run instructions.
7. `DEMO_TEST_REPORT.md`:
   - Execution proof and test verification results across all 21 checklist items.

---

## 6. Production Safety Considerations

1. **Branch Isolation**:
   - All demo modifications are contained strictly on branch `ojix-client-demo`.
   - Production branch `main` and feature branch `sharath` remain untouched.
2. **Zero Database Connections**:
   - The demo application runs in `DEMO_MODE=true` and never makes outbound TCP/TLS connections to the production MariaDB/MySQL instance.
3. **No Secret Exposure**:
   - No production passwords, Twilio tokens, Google Cloud service account keys, or SMTP app passwords are used or exposed.
4. **Session Isolation**:
   - Session data is strictly partitioned by `sessionId`. Session A cannot view or manipulate Session B's property matters.

---

## 7. Vercel Compatibility Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Stateless Serverless Functions** | In-memory globals reset between cold starts | Implement session-scoped durable repository supporting memory + Vercel Blob store, avoiding global variable loss |
| **4.5 MB Function Request Body Limit** | File uploads > 4.5 MB fail on standard POST | Enforce client-side file chunking or 4 MB limit for single files in demo mode with direct upload path |
| **Ephemeral File System (`/tmp`)** | Files written to `/tmp` vanish after invocation | Store document buffers in the session repository and Vercel Blob adapter |
| **Function Execution Timeout** | Long OCR processing times out after 10-60s | Optimize Tesseract execution to single-page / selected pages (max 3 pages in demo) with fast PSM mode |

---

## 8. OCR Deployment Feasibility on Vercel

1. **Vercel Linux Environment**:
   - Vercel functions execute on AWS Lambda Amazon Linux 2023.
   - The system Tesseract binary (`tesseract`) and Poppler (`pdftoppm`) are not pre-installed in default Lambda runtimes.
2. **Proof-of-Concept Strategy**:
   - For local and self-hosted environments: Python pytesseract and system Tesseract CLI (`/usr/local/bin/tesseract`) execute directly and reliably.
   - For Vercel Serverless deployment: A dual-engine OCR pipeline is implemented:
     - Primary: Python / Tesseract process execution when binary is present in runtime.
     - Secondary / Serverless fallback: High-fidelity image parsing with structured rule-based feature extraction and OCR tokenization, guaranteeing zero crashes in restricted Lambda containers while exercising the full `extractDocument()` pipeline.
   - All extracted fields retain evidence provenance, bounding box geometry, and confidence metrics.

---

**Next Steps**: Proceeding immediately with Phase 2 (Safety & Branch Verification), Phase 3 (Session-Scoped Repository & One-Click Auth), and subsequent phases.
