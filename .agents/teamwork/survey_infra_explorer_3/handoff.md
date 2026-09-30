# Infrastructure, Build, Test & Runtime Investigation Report

**Agent**: `survey_infra_explorer_3`  
**Date**: 2026-09-30  
**Target Workspace**: `/Users/FOUDER/Downloads/ojix-property-intelligence`  
**Parent Agent**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  

---

## 1. Observation

### 1.1 Project & Workspace Configuration
- **Monorepo Layout**: The repository uses npm workspaces defined in root `package.json` (lines 5-11):
  ```json
  "workspaces": ["apps/web", "apps/api"],
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"npm run dev -w apps/api\" \"npm run dev -w apps/web\"",
    "build": "npm run build -w apps/api && npm run build -w apps/web",
    "test": "npm run test -w apps/api",
    "typecheck": "npm run typecheck -w apps/api && npm run typecheck -w apps/web"
  }
  ```
- **API Workspace (`apps/api/package.json`)**:
  - `type`: `"module"`
  - Scripts:
    ```json
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "tsx --test test/*.test.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json"
    ```
  - Test runner: Uses Node.js native test runner via `tsx --test test/*.test.ts`.
  - Dependencies: `cors` (^2.8.5), `dotenv` (^16.4.7), `express` (^4.21.2), `express-rate-limit` (^7.5.0), `firebase-admin` (^13.0.2), `helmet` (^8.0.0), `multer` (^1.4.5-lts.1), `pg` (^8.13.1), `zod` (^3.24.1).
  - Dev dependencies: `tsx` (^4.19.2), `typescript` (^5.7.3), and corresponding `@types/*`.
- **Web Workspace (`apps/web/package.json`)**:
  - Scripts:
    ```json
    "dev": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "typecheck": "tsc --noEmit"
    ```
  - Note: There is **no test script** in `apps/web/package.json`.
  - Dependencies: `react` (^18.3.1), `react-dom` (^18.3.1), `maplibre-gl` (^5.0.1), `lucide-react` (^0.468.0), `firebase` (^11.1.0), `@vitejs/plugin-react` (^4.3.4).
- **TypeScript Configurations**:
  - `apps/api/tsconfig.json`: Targets `ES2022`, module `NodeNext`, moduleResolution `NodeNext`, `outDir: dist`, `strict: true`. Includes `["src/**/*.ts", "test/**/*.ts"]`.
  - `apps/web/tsconfig.json`: Targets `ES2020`, module `ESNext`, moduleResolution `Bundler`, `strict: true`, `noEmit: true`, `jsx: react-jsx`. Includes `["src"]`.

### 1.2 Baseline Execution Results
- **`npm test`**: Executed from workspace root.
  ```text
  > ojix-property-intelligence@0.1.0 test
  > npm run test -w apps/api

  > @ojix/property-api@0.1.0 test
  > tsx --test test/*.test.ts

  ✔ baseline flags missing survey, documents and location (0.863333ms)
  ✔ risk score is capped and transparent (0.189ms)
  ✔ a clean workspace remains preliminary, not certified safe (0.071ms)
  ℹ tests 3
  ℹ suites 0
  ℹ pass 3
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 102.091792
  ```
  Result: **Passed** with 0 errors. Total duration: ~102ms.

- **`npm run typecheck`**: Executed from workspace root.
  ```text
  > ojix-property-intelligence@0.1.0 typecheck
  > npm run typecheck -w apps/api && npm run typecheck -w apps/web

  > @ojix/property-api@0.1.0 typecheck
  > tsc --noEmit -p tsconfig.json

  > @ojix/property-web@0.1.0 typecheck
  > tsc --noEmit
  ```
  Result: **Passed** with exit code 0. No type errors in either workspace.

- **`npm run build`**: Executed from workspace root.
  ```text
  > ojix-property-intelligence@0.1.0 build
  > npm run build -w apps/api && npm run build -w apps/web

  > @ojix/property-api@0.1.0 build
  > tsc -p tsconfig.json

  > @ojix/property-web@0.1.0 build
  > tsc --noEmit && vite build

  vite v6.4.3 building for production...
  ✓ 1581 modules transformed.
  dist/index.html                     0.56 kB │ gzip:   0.35 kB
  dist/assets/index-CBwMnnlz.css    102.23 kB │ gzip:  17.56 kB
  dist/assets/index-BCvMuDbL.js   1,259.21 kB │ gzip: 347.13 kB
  ✓ built in 2.52s
  ```
  Result: **Passed** with exit code 0.

### 1.3 Database & Environment Dependencies
- **Docker Compose (`docker-compose.yml`)**:
  - Image: `postgis/postgis:16-3.4`
  - Container Port Mapping: `5432:5432`
  - Target DB: `ojix_property`, user: `ojix`, pass: `ojix_local_only`
  - Init scripts: `./infra/db/schema.sql` and `./infra/db/seed.sql`
- **Host System Runtime**:
  - `docker` CLI is **NOT installed** on the host (`zsh:1: command not found: docker`).
  - However, native **PostgreSQL 17** (`/opt/homebrew/Cellar/postgresql@17/17.11/bin/postgres`) is running locally on port **`5433`**.
  - Native **PostgreSQL 14** (`/opt/homebrew/opt/postgresql@14/bin/postgres`) is running locally on port **`5432`**.
  - `.env` contains:
    ```bash
    PORT=4000
    DATABASE_URL=postgres://ojix:ojix_local_only@localhost:5433/ojix_property
    CORS_ORIGIN=http://localhost:5173
    UPLOAD_DIR=./uploads
    MAX_UPLOAD_MB=25
    FIREBASE_PROJECT_ID=
    GOOGLE_CLOUD_PROJECT=
    GCS_BUCKET=
    ```
  - Direct connection to `postgres://ojix:ojix_local_only@localhost:5433/ojix_property` verified:
    - Extensions installed: `postgis` (3.6.4), `pgcrypto` (1.3), `plpgsql` (1.0).
    - Tables verified: `organizations`, `org_memberships`, `properties`, `documents`, `risk_findings`, `spatial_layers`, `audit_events`, `spatial_ref_sys`.
    - Demo seeds present: organization `'ojix-local-demo'`, user `'local-developer'` (role `'owner'`), sample property `'Sample Arakere Due Diligence'`, and demo spatial polygon.
    - Node.js `pg.Pool` connection probe verified: `{ connected: 1 }`.
- **Test Suite Live DB Requirement**:
  - The current test suite (`apps/api/test/risk-engine.test.ts`) tests pure in-memory pure functions: `buildBaselineFindings` and `calculateRisk`.
  - It does **not** connect to PostgreSQL or require a database to be running.
  - However, the server endpoints (`apps/api/src/server.ts`) require a live database; without `DATABASE_URL` or when `pool` is null, `/api/*` endpoints respond with `503 Service Unavailable`.

### 1.4 Test Suites Present & Requirement (R1-R5) Coverage
- Only **one** test file exists across the entire project: `apps/api/test/risk-engine.test.ts`.
- It contains exactly **3** unit tests:
  1. `baseline flags missing survey, documents and location`
  2. `risk score is capped and transparent`
  3. `a clean workspace remains preliminary, not certified safe`
- Requirements Mapping:
  - **R1 (Document Intelligence & Evidence Extraction Pipeline)**:
    - Current test: 1 assertion checking that `documentCount: 0` triggers `DOCUMENTS_NOT_UPLOADED`.
    - Gaps: Zero tests for document classification (Sale Deed, Gift Deed, RTC/Pahani, EC, e-Khata, Mutation Extract), zero tests for metadata extraction (parties, survey numbers, execution dates, extent, consideration, boundaries), zero tests for bounding boxes / confidence scores.
  - **R2 (Title Chain & Ownership Graph Engine)**:
    - Current test: **None (0%)**.
    - Gaps: Zero tests for chronological instrument ordering, title gap detection (missing parent deed, date inconsistencies, extent changes between transfers), party alias normalization, or reviewer dispute/verification recording.
  - **R3 (GIS & Spatial Rules Engine with Buffer Screening)**:
    - Current test: **None (0%)**.
    - Gaps: Zero tests for PostGIS distance calculation, buffer bands (50m primary drain, 25m secondary drain, 15m tertiary drain, 30m lake buffer), intersection detection, cadastral survey parcel overlay, or map snapshot export metadata.
  - **R4 (Cross-Document Discrepancy & Explainable Risk Scoring Engine)**:
    - Current test: Only tests score capping at 100 and basic risk bands based on static points in `risk-engine.ts`.
    - Gaps: Zero tests for Karnataka land measurement unit conversions (Acres, Guntas, Sq. Ft., Sq. Meters, Cents, Ankanas), zero tests for property identifier normalization, zero tests for cross-document extent and boundary discrepancies, zero tests for rule version citations and evidence anchors.
  - **R5 (Reviewable Report & Evidence Appendix Generator)**:
    - Current test: **None (0%)**.
    - Gaps: Zero tests for immutable snapshot creation, PDF generation, or inclusion of required report sections (executive summary, property profile, title timeline, discrepancy matrix, GIS screening snapshots, evidence appendix).

---

## 2. Logic Chain

1. **Test Infrastructure**:
   - `apps/api/package.json` configures `"test": "tsx --test test/*.test.ts"`.
   - Node.js's native test runner (`node:test`) is executed with TypeScript support via `tsx`.
   - The test glob is `test/*.test.ts`. Additional test files placed under `apps/api/test/` (e.g. `test/document-extraction.test.ts`, `test/title-chain.test.ts`, `test/gis-buffer.test.ts`, `test/discrepancies.test.ts`, `test/reports.test.ts`) will be automatically discovered and executed by `npm test`.
   - `apps/web` has no test runner configured; if frontend tests or component tests are needed, either Vitest or Playwright would need to be added, but backend logic testing via `apps/api/test/*.test.ts` satisfies the root `npm test` script.

2. **Build and Typecheck Infrastructure**:
   - Strict TypeScript is enabled (`"strict": true` in both tsconfig files).
   - Both `npm run typecheck` and `npm run build` pass cleanly right now.
   - Any new code or modules implementing R1-R5 must adhere strictly to these compiler options to maintain 100% green typecheck and build status.

3. **Database Environment**:
   - Although `docker` is absent on the host, a local PostgreSQL 17 server with PostGIS 3.6.4 is already listening on `localhost:5433`.
   - The `.env` file is already wired to this instance: `DATABASE_URL=postgres://ojix:ojix_local_only@localhost:5433/ojix_property`.
   - The tables and extensions are already initialized.
   - For unit tests, business logic (unit conversion, document classification/extraction schema, title chain graph analysis, gap detection, discrepancy checks, risk calculation, PDF data structures) can and should execute in-memory with zero DB overhead to remain fast (<1 second total run time) and portable.
   - Spatial buffer screening queries can either run integration tests against the live PostGIS instance or use unit-tested spatial math / GeoJSON calculation helpers.

4. **Test Gap Prioritization**:
   - To achieve the Acceptance Criteria defined in `ORIGINAL_REQUEST.md`:
     - Unit & integration test suite covering document field extraction, title gap detection, unit conversions, and spatial buffer rules must pass with 100% success (`npm test`).
     - TypeScript verification (`npm run typecheck`) and production build (`npm run build`) must pass without errors.
   - The existing test suite covers only 3 trivial assertions for baseline completeness. Comprehensive test coverage for R1, R2, R3, R4, and R5 must be built alongside or ahead of feature implementation.

---

## 3. Caveats

1. **Docker CLI Absent**: Docker is not installed on this Mac. Attempting to run `docker compose up` or `docker compose down` will fail with command not found. However, local PostgreSQL 17 with PostGIS is already running on port 5433 and is completely functional.
2. **Web Tests**: `apps/web` has no `"test"` script in `package.json`, and root `npm test` only delegates to `apps/api`. No web-specific tests currently run on `npm test`.
3. **External Cloud Services**: No live GCP Document AI, Vertex AI, or Cloud Storage is connected (all upload storage is local `./uploads` and auth uses local developer bypass).

---

## 4. Conclusion

- **Baseline Status**:
  - `npm test`: **PASS** (3 tests, 0 failures, ~102ms).
  - `npm run typecheck`: **PASS** (0 errors).
  - `npm run build`: **PASS** (both api and web compile cleanly).
- **Database Status**:
  - Live PostgreSQL 17 + PostGIS 3.6.4 is active on `localhost:5433` matching `.env`.
  - All schema tables and initial seed data are populated.
- **Coverage Assessment**:
  - The starter codebase is an architectural skeleton: only 2 backend source files (`server.ts`, `risk-engine.ts`) and 1 frontend app file (`App.tsx`).
  - Requirements R1 (Document Intelligence), R2 (Title Chain Engine), R3 (Spatial Buffer Screening), R4 (Discrepancy Engine & Unit Conversion), and R5 (PDF Due-Diligence Report) are unimplemented or merely scaffolded, with practically 0% test coverage outside of capped scoring.

---

## 5. Verification Method

To independently verify all observations in this report:

1. **Run Baseline Test Suite**:
   ```bash
   cd /Users/FOUDER/Downloads/ojix-property-intelligence
   npm test
   ```
   *Expected output*: 3 passing tests in `apps/api/test/risk-engine.test.ts`.

2. **Run TypeScript Check**:
   ```bash
   npm run typecheck
   ```
   *Expected output*: Clean exit with code 0 across both `apps/api` and `apps/web`.

3. **Run Production Build**:
   ```bash
   npm run build
   ```
   *Expected output*: Clean exit with code 0, emitting `apps/api/dist/` and `apps/web/dist/`.

4. **Verify Database Connectivity**:
   ```bash
   psql "postgres://ojix:ojix_local_only@localhost:5433/ojix_property" -c "SELECT postgis_full_version();" -c "SELECT count(*) FROM properties;"
   ```
   *Expected output*: PostGIS version 3.6.4 and property count >= 1.
