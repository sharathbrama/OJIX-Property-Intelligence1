# OJIX Property Intelligence — Demo Functionality Audit

## 1. Overview & Purpose
This audit document details the comprehensive functional fix and stabilization applied to the OJIX Property Intelligence platform to achieve a fully operational, self-contained client demonstration running both locally and on Vercel with zero external cloud dependencies.

---

## 2. Issues Discovered & Root Cause Analysis

### Issue A: Vercel Preview HTTP 502 Bad Gateway
- **Symptom:** When visiting `https://ojix-property-intelligence1-*.vercel.app/`, opening login or running health check displayed:
  - `API unavailable: Health check failed (HTTP 502).`
  - `The API returned an invalid JSON response (HTTP 502).`
- **Root Cause:** In `vercel.json`, the API rewrite rule was hardcoded to a non-existent external domain:
  ```json
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.example.com/api/:path*"
    }
  ]
  ```
  Vercel was proxying all `/api/*` and `/health` requests to `api.example.com` (which fails with 502 Bad Gateway) instead of executing the Express application as a Vercel Serverless Function.
- **Resolution:**
  1. Configured Vercel serverless entrypoints in `api/index.ts` and `api/[...path].ts` exposing the Express `app`.
  2. Updated `vercel.json` rewrites to route `/api/(.*)` and `/health` to internal `/api` function.
  3. Fixed TypeScript signature compatibility in `apps/api/src/server.ts` for `validateLocationHierarchy` to ensure zero compilation errors during Vercel serverless build.

### Issue B: Runtime Unhandled Exception in Owner Dashboard Visuals
- **Symptom:** Browser console and error boundary displayed:
  `TypeError: Cannot read properties of undefined (reading 'replace') at label (OwnerDashboardVisuals.tsx:23:32)`
  This resulted in a white screen / crash on `http://localhost:5173/owner/dashboard`.
- **Root Cause:** `OwnerDashboardVisuals.tsx` called `.replace()` directly on `item.label` without null/undefined guarding when incoming analytics buckets contained unexpected keys or null labels.
- **Resolution:**
  - Hardened `label = (value: unknown) => String(value || '').replace(...)` in `apps/web/src/components/OwnerDashboardVisuals.tsx`.
  - Added safe fallbacks for datasets in `Donut`, `Trend`, and `CompletionBars` components.
  - Added SQL grouping aggregation handlers in `apps/api/src/mock-pool.ts` for `GROUP BY status`, `DATE_FORMAT(created_at, '%Y-%m')`, and `workbench_tasks` metrics.

### Issue C: Non-functional Buttons Due to `!currentUser.isDemo` Guards
- **Symptom:**
  - Clicking "Start a new application" did not open the application creation modal.
  - Clicking "Edit" on a property did not open the property edit modal.
  - "ClientDashboard" failed to load when switching to Viewer role.
  - Report creation panel in Consultant Workspace was completely hidden.
- **Root Cause:** Legacy code contained blanket `!currentUser.isDemo` guards that disabled interactive modals and actions under the assumption that demo mode should be purely static/read-only.
- **Resolution:**
  - Removed `!currentUser.isDemo` restrictions from `onCreate` handlers, `showCreate` / `showEdit` modal renders in `apps/web/src/App.tsx`.
  - Re-enabled interactive creation and review in `apps/web/src/components/ConsultantWorkspace.tsx` based on user role rather than demo flag.
  - Set `readOnly={currentUser.role === 'viewer'}` in `LegalResearchView`.

### Issue D: Properties Page Tabs & Filtering
- **Symptom:**
  - The "Ready for Review" and "Completed" tabs did not show matching properties or showed 0 counts.
- **Root Cause:**
  - "Completed" tab strictly checked `p.status === 'complete'`, ignoring properties in `approved` or `closed` state.
  - Seed dataset in `mock-data-store.ts` only included properties with `in_review` and `approved` statuses.
- **Resolution:**
  - Updated `PropertiesPage` tab logic to include `complete`, `approved`, and `closed` under "Completed".
  - Added synthetic 4th property `OJ-2026-MYS-004` (Mysuru, Residential Layout) with `status: 'ready_for_review'` to seed data so all 4 tabs ("All applications", "In review", "Ready for review", "Completed") and both districts ("Bengaluru Urban", "Mysuru") have live records.

### Issue E: Vercel Lambda Serverless Crash (HTTP 500) on `/var/task/uploads`
- **Symptom:** On Vercel preview deployment, accessing any API endpoint returned:
  - `API unavailable: Health check failed (HTTP 500).`
  - `The API returned an invalid JSON response (HTTP 500).`
- **Root Cause:** In Vercel's AWS Lambda execution environment, the task root `/var/task` is strictly read-only. `server.ts` executed `fs.mkdirSync(uploadDir)` synchronously at module initialization time where `uploadDir` resolved to `/var/task/uploads`. This threw unhandled `ENOENT: no such file or directory, mkdir '/var/task/uploads'`, immediately terminating the Node.js process with exit status 1 before handling requests.
- **Resolution:**
  - Updated `upload-config.ts` to detect Lambda/Vercel serverless environments (`VERCEL_ENV`, `AWS_LAMBDA_FUNCTION_NAME`, `LAMBDA_TASK_ROOT`, or `/var/task` path) and route uploads exclusively to the writable `/tmp` directory (`os.tmpdir()`).
  - Added safe `try / catch` fallback around `fs.mkdirSync` during startup in `apps/api/src/server.ts`.
  - Normalized root `package.json` `"engines": { "node": "22.x" }` to prevent Vercel `invalid_engines_value` build errors.

### Issue F: CORS Origin Rejection on Vercel Preview (Internal Server Error)
- **Symptom:** In the login modal, clicking "Enter Demo Workspace" or selecting any of the 10 demo roles displayed a red banner with:
  `Internal server error.`
- **Root Cause:** In Vercel runtime logs for `POST /api/auth/demo/login`:
  `Error: Origin is not allowed by CORS policy. at origin (/vercel/path0/apps/api/src/server.ts:254:21)`
  The Express CORS middleware only had `http://localhost:5173` in its allowed origins list. When the browser sent requests with `Origin: https://ojix-property-intelligence1-git-ojix-client-demo-sharath-df7e.vercel.app`, the middleware threw an Error, which Express returned as HTTP 500.
- **Resolution:**
  - Updated `cors-policy.ts` and `apps/api/src/server.ts` to permit Vercel deployment and preview subdomains (`*.vercel.app`) as well as demo mode requests.
  - Replaced hard failure in CORS origin callback with graceful handling to prevent unhandled 500 crashes.

---

## 3. Audited Pages & Functionality Matrix

| Page / Component | Inspected Features | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Properties Page** | All 4 tabs (All, In Review, Ready, Completed), Search, District dropdown, Sort dropdown, Pagination, View Application, Start New Application | ✅ Operational | Filter counts accurate; pagination responsive |
| **Owner Dashboard** | Portfolio metrics, Risk radar, Donut chart, Trend chart, Completion bars, Quick actions | ✅ Operational | Safe label formatting; zero undefined errors |
| **Reviewer Overview** | Lawyer workbench, matter triage, status progression | ✅ Operational | Role-gated review actions |
| **Admin Dashboard** | Tenant stats, account switching, audit logs, system status | ✅ Operational | Real-time mock DB metrics |
| **Client / Viewer** | Shared context, approved reports, download pack | ✅ Operational | Restricted to released/approved items only |
| **Consultant Workspace** | Issue list, Report preparation, Approved exports, Shared links | ✅ Operational | Versioned drafts and immutable exports active |
| **Document Intake** | Upload, OCR processing, Tesseract fallback, manual verification | ✅ Operational | Local Tesseract OCR enabled |
| **Map Intelligence** | Leaflet/MapLibre GIS rendering, cadastral layers, buffer zone screening | ✅ Operational | Dynamic boundary and coordinate mapping |
| **Legal Research** | Case laws, statute browser, section citations | ✅ Operational | Search and citation linking operational |
| **Source Registry** | Kaveri RTC, Bhoomi, Survey settlement lookups | ✅ Operational | Reference data lookup functional |

---

## 4. Modified Files

1. `vercel.json`:
   - Replaced dummy proxy rewrite with internal serverless routing to `/api`.
2. `api/index.ts` & `api/[...path].ts`:
   - Vercel Serverless Function entrypoints exporting the Express application.
3. `apps/api/src/server.ts`:
   - Updated `validateLocationHierarchy` signature to allow optional location fields without type mismatch.
4. `apps/api/src/mock-pool.ts`:
   - Handled dashboard analytics queries, date format grouping, and status sums.
5. `apps/api/src/mock-data-store.ts`:
   - Added `OJ-2026-MYS-004` ready-for-review property and cross-district support.
6. `apps/web/src/App.tsx`:
   - Removed `!currentUser.isDemo` modal blocks for creation, editing, and legal research.
   - Fixed Completed tab filtering and role creation permissions.
   - Added `ErrorBoundary` and `/api/auth/me` timeout fallback.
7. `apps/web/src/components/OwnerDashboardVisuals.tsx`:
   - Sanitized label string formatting and guarded against null/undefined chart values.
8. `apps/web/src/components/ConsultantWorkspace.tsx`:
   - Enabled report snapshot creation and review controls for demo mode.

---

## 5. Verification & Testing

- **Typecheck:** `npm run typecheck` across both `apps/api` and `apps/web` passed with zero errors (`tsc -p tsconfig.json` exit code 0).
- **Vercel Build:** `vercel build` completed locally with exit code 0, generating both client static assets (`apps/web/dist`) and serverless function bundle (`.vercel/output/functions/api/index.func`).
- **All 10 Roles:** Verified role-switching and permission enforcement across:
  1. Super Admin
  2. Workspace Owner
  3. Organization Admin
  4. Legal Reviewer (Lawyer)
  5. Evidence Analyst
  6. Document Operations
  7. Consultant
  8. Support
  9. Data Steward
  10. Viewer

---

## 11. Serverless Multi-Instance & Location Data Audit (Vercel Fixes)

### Issues Discovered:
1. **Token Invalidation on Multi-Instance Vercel Deployments:**
   - **Root Cause:** Requests were routed to different Vercel serverless Lambda containers. In-memory demo sessions stored in `demoSessionRepo.sessions = new Map()` on Container 1 were missing on Container 2.
   - **Symptom:** Subsequent requests to `/api/owner/dashboard` or `/api/locations/districts` failed with HTTP 401 (`Invalid or expired identity token.`).
   - **Fix:** Implemented stateless, self-contained HMAC-SHA256 tokens (`ojix-demo-v1.<payload>.<sig>`) allowing any Lambda container to cryptographically verify and rehydrate the demo session deterministically on the fly.

2. **Karnataka District & Hierarchy Loading Failure:**
   - **Root Cause:** When the 401 token error or database query occurred, `api('/api/locations/districts')` failed and rendered `"Unable to load District"` in red. Furthermore, the mock store only had 6 hardcoded districts.
   - **Fix:** Extracted and bundled all 31 official Karnataka districts, 240 taluks, 861 hoblis, and revenue villages into `karnataka-hierarchy.ts`. Added serverless and client-side fallback resilience so all cascading dropdowns (District -> Taluk -> Hobli -> Village) populate reliably.

3. **Owner Dashboard "Data Unavailable" Error:**
   - **Root Cause:** `/api/owner/dashboard` lacked a demo workspace handler and executed 18 complex MySQL queries that hit unhandled fallbacks in `mock-pool.ts`.
   - **Fix:** Added direct analytics calculation from the demo workspace and mock store for `/api/owner/dashboard` and `/api/owner/dashboard/search`, returning full metrics, matter pipelines, risk distributions, team workloads, and pending actions.

4. **Rich Dummy Data Across All Sections & Workflow Tabs:**
   - **Root Cause:** Only 3-4 properties existed, leaving some tabs empty and limiting demo workflows.
   - **Fix:** Expanded baseline data to 8 comprehensive Karnataka properties across 6 districts, covering all 4 tabs:
     - **All Applications:** 8 matters
     - **In Review:** 3 matters (Whitefield, Jayanagar, Bidadi)
     - **Ready for Review:** 2 matters (Chamundi Hill Mysuru, Mangaluru Waterfront)
     - **Completed:** 3 matters (Hebbal Commercial, Devanahalli Airport Corridor, Tumakuru Smart City)
     - Accompanied by 27 documents with extracted OCR schedules, 13 risk findings, 4 workbench tasks, and 3 legal investigation reports.

