# Codebase Architecture & Requirements Gap Analysis: OJIX Property Intelligence

## 1. Observation

### 1.1 Project Structure & Workspace Setup
- Root configuration in `/Users/FOUDER/Downloads/ojix-property-intelligence/package.json` lines 1-14 defines an npm monorepo with two workspaces:
  ```json
  "workspaces": ["apps/web", "apps/api"],
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"npm run dev -w apps/api\" \"npm run dev -w apps/web\"",
    "build": "npm run build -w apps/api && npm run build -w apps/web",
    "test": "npm run test -w apps/api",
    "typecheck": "npm run typecheck -w apps/api && npm run typecheck -w apps/web"
  }
  ```
- No shared package directory exists (no `packages/` folder; types, constants, and utilities are duplicated or loosely defined).
- Docker configuration (`docker-compose.yml` lines 1-22) uses `postgis/postgis:16-3.4` database mounting schema and seed files from `./infra/db/schema.sql` and `./infra/db/seed.sql`.
- Current verification commands pass:
  - `npm run typecheck`: Exited 0.
  - `npm test`: Exited 0 (3 passing tests in `apps/api/test/risk-engine.test.ts`).
  - `npm run build`: Exited 0 (tsc builds `apps/api/dist/` and vite builds `apps/web/dist/`).

### 1.2 Backend Framework & Architecture (`apps/api`)
- Dependencies (`apps/api/package.json` lines 7-8):
  - Framework: `express` 4.21.2 with Node.js ESM (`"type": "module"`).
  - Database Client: Direct `pg` 8.13.1 (`Pool`). No ORM (no Prisma, Drizzle, TypeORM). All queries are raw parameterized SQL.
  - Validation: `zod` 3.24.1.
  - Security / Network: `cors` 2.8.5, `helmet` 8.0.0, `express-rate-limit` 7.5.0, `firebase-admin` 13.0.2.
  - File Uploads: `multer` 1.4.5-lts.1 storing files on local disk (`uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads')`, `server.ts` line 20).
- Application Entry & Routes (`apps/api/src/server.ts`):
  - `GET /health` (lines 84-88): DB connectivity and auth status.
  - `GET /api/overview` (lines 90-96): Workspace counts, documents count, and 5 recent properties.
  - `GET /api/properties` (lines 98-103): Search properties by query `q`.
  - `POST /api/properties` (lines 105-114): Create property workspace with Zod validation.
  - `GET /api/properties/:id` (lines 116-123): Fetch single property, documents, and risk findings.
  - `PATCH /api/properties/:id` (lines 125-139): Partial update of property fields.
  - `POST /api/properties/:id/analyze` (lines 141-160): Runs baseline completeness checks and `ST_Distance` proximity against active `spatial_layers` within 0.01-degree bounding box expansion.
  - `POST /api/properties/:id/documents` (lines 169-183): Uploads multipart files, computes SHA-256, inserts into `documents` table with `processing_status = 'queued'`. Note: No file retrieval/streaming route exists (e.g. `GET /api/properties/:id/documents/:docId/file` does not exist).
  - `GET /api/properties/:id/report` (lines 185-194): Generates and sends a downloadable JSON file (`ojix-property-report-${id}.json`).
  - `GET /api/map/layers` (lines 196-200): Queries `spatial_layers` and returns a GeoJSON `FeatureCollection`.
- Risk Engine (`apps/api/src/risk-engine.ts` lines 1-50):
  - Implements `calculateRisk(findings: RiskFinding[])`: severity weights `low: 5, medium: 15, high: 25, critical: 35, unverified: 0`. Caps score at 100 (`Math.min(100, scored)`).
  - Implements `buildBaselineFindings`: Exactly 3 hardcoded checks (`IDENTITY_SURVEY_MISSING`, `DOCUMENTS_NOT_UPLOADED`, `SPATIAL_LOCATION_MISSING`).

### 1.3 Database & PostGIS Models (`infra/db/schema.sql` & `seed.sql`)
- Tables:
  - `organizations` (`id`, `name`, `slug`, `created_at`)
  - `org_memberships` (`id`, `organization_id`, `user_uid`, `email`, `role`, `created_at`)
  - `properties` (`id`, `tenant_id`, `name`, `village`, `hobli`, `taluk`, `district`, `survey_number`, `subdivision`, `extent`, `address`, `latitude`, `longitude`, `location geometry(Point,4326)`, `notes`, `status`, `created_by_uid`, `updated_by_uid`, `created_at`, `updated_at`). Includes trigger `set_property_location()` that updates `location` from latitude/longitude.
  - `documents` (`id`, `tenant_id`, `property_id`, `original_filename`, `storage_key`, `mime_type`, `size_bytes`, `sha256`, `processing_status`, `extracted_text`, `extracted_fields jsonb`, `uploaded_by_uid`, `created_at`).
  - `risk_findings` (`id`, `tenant_id`, `property_id`, `code`, `title`, `severity`, `points`, `explanation`, `evidence_status`, `next_action`, `created_by_uid`, `created_at`).
  - `spatial_layers` (`id`, `layer_type`, `label`, `source_name`, `source_url`, `source_date`, `data_status`, `geom geometry(Geometry,4326)`, `active`, `metadata jsonb`, `created_at`).
  - `audit_events` (`id`, `actor_uid`, `tenant_id`, `action`, `entity_type`, `entity_id`, `details jsonb`, `created_at`).
- Existing Seed Data (`infra/db/seed.sql` lines 1-15):
  - One demo organization (`11111111-1111-4111-8111-111111111111`), user `local-developer`.
  - One sample property (`DEMO-34`, lat: 12.8870, lng: 77.5960).
  - One spatial layer: `demo_reference` (synthetic polygon).

### 1.4 Frontend Architecture (`apps/web`)
- Dependencies (`apps/web/package.json` lines 7-8):
  - React 18.3.1, React-DOM 18.3.1
  - MapLibre GL 5.0.1 (`maplibre-gl`)
  - Lucide React 0.468.0 (`lucide-react`)
  - Firebase 11.1.0
  - Vite 6.0.7
- Single Monolithic File (`apps/web/src/App.tsx`, 235 lines):
  - Views: `overview`, `properties`, `property` (with tabs: `summary`, `documents`, `map`, `findings`).
  - `PropertyMap` component (lines 203-226): Initializes `maplibregl.Map` with OSM raster tiles, plots property point marker, loads `/api/map/layers` GeoJSON.
  - `printReport` function (lines 101-119): Opens a new browser window, constructs inline HTML table/findings, and triggers `window.print()`.

---

## 2. Logic Chain: Requirement-by-Requirement Gap Assessment

### 2.1 R1. Document Intelligence & Evidence Extraction Pipeline
- **Observation**:
  - `documents` table stores raw metadata (`original_filename`, `storage_key`, `mime_type`, `size_bytes`, `sha256`, `processing_status`, `extracted_text`, `extracted_fields jsonb`).
  - Upload endpoint `POST /api/properties/:id/documents` writes to local disk and sets `processing_status = 'queued'`.
  - There is NO API endpoint to stream or retrieve document files (e.g. `GET /api/properties/:id/documents/:docId/file`).
  - `apps/web/src/App.tsx` has a simple list of documents with a file dropzone.
- **Inference**:
  - Document Classification: Missing. There is no classifier for Karnataka property documents (Sale Deed, Gift Deed, RTC/Pahani, Encumbrance Certificate, e-Khata, Mutation Extract). There is no `doc_type` column on `documents`.
  - Field Extraction: Missing. No extraction pipeline exists for parties, survey numbers, execution dates, extent, consideration, or boundaries.
  - Evidence Anchoring: Missing. No schema or data structure for page-level bounding boxes (`page_number`, `bbox`, `confidence`, `snippet`).
  - Side-by-Side Review UI: Missing. The frontend has no PDF/image canvas viewer with bounding box overlay and no interactive side-by-side human verification inputs.
- **Status**: Partially implemented (15% — upload & metadata storage only).

### 2.2 R2. Title Chain & Ownership Graph Engine
- **Observation**:
  - The database has zero tables for title instruments, events, chain links, party entities, or reviews.
  - No title-related API endpoints exist in `server.ts`.
  - No graph, timeline, or alias normalization code exists in `apps/api/src/`.
  - No title visualization component exists in `apps/web/src/App.tsx`.
- **Inference**:
  - Entire ownership timeline and title-chain analysis module is absent.
  - Title gap detection algorithms (identifying missing preceding deeds, date inconsistencies, extent changes across transfers) are completely missing.
  - Legal reviewer verify/dispute workflow with recorded rationales is completely missing.
- **Status**: Completely missing (0%).

### 2.3 R3. GIS & Spatial Rules Engine with Buffer Screening
- **Observation**:
  - PostGIS is enabled in schema; `spatial_layers` table exists with a GIST index on `geom`.
  - `properties` has `location geometry(Point,4326)` populated via trigger from lat/lng.
  - `POST /api/properties/:id/analyze` computes a raw `ST_Distance` query against any active layer within a 0.01 degree box, generating an `unverified` finding with 0 risk points.
  - Only one synthetic demo polygon exists in `seed.sql`.
  - In `App.tsx`, `PropertyMap` renders an OSM raster map with a marker and basic GeoJSON layers.
- **Inference**:
  - Rajakaluve / Storm-Water Drain buffer bands: Missing. Neither the layers (Primary, Secondary, Tertiary drains) nor the regulatory buffer bands (50m, 25m, 15m) are modeled or evaluated.
  - Lake / Waterbody buffer: Missing. 30m lake buffer rules are not implemented.
  - Exact Buffer Intersection / Screening Engine: Missing. The existing code only does point distance; it does not evaluate parcel polygon intersections or categorize into buffer penalty bands.
  - Cadastral Survey Parcel Overlay: Missing. `properties` has only a point `location`, no parcel boundary polygon geometry (`parcel_geometry` or `boundary_geom`). Frontend does not render cadastral parcel polygon overlays.
  - Map Snapshot Export: Missing. There is no functionality to export georeferenced snapshots with scale bar, north arrow, legend, and source metadata.
- **Status**: Partially implemented (20% — baseline PostGIS table & basic point map only).

### 2.4 R4. Cross-Document Discrepancy & Explainable Risk Scoring Engine
- **Observation**:
  - `apps/api/src/risk-engine.ts` only provides 3 hardcoded checks (`hasSurveyNumber`, `documentCount === 0`, `coordinatesPresent`).
  - Score is capped at 100 with 3 bands (`high_attention`, `review_required`, `preliminary`).
- **Inference**:
  - Cross-Document Discrepancy Engine: Completely missing. No normalization or comparison exists between instruments (e.g. Sale Deed vs RTC vs e-Khata).
  - Identifier Normalization: Missing. No normalization for Karnataka survey numbers (e.g. "Sy. No. 34/1" vs "34/1").
  - Person Name Normalization: Missing. No alias/name variation matching.
  - Karnataka Land Unit Normalization: Missing. No conversion or normalization engine for Acres, Guntas, Cents, Anis, Sq. Ft., Sq. Meters (e.g., 1 Acre = 40 Guntas = 43,560 sq ft; 1 Gunta = 1,089 sq ft).
  - Boundary Conflict Detection: Missing. No comparison of North, South, East, West boundaries across instruments.
  - Rule Versioning & Evidence Citations: Missing. Existing findings lack `ruleVersion` and statutory citations (e.g., Karnataka Land Revenue Act, Transfer of Property Act).
  - Discrepancy Review UI: Missing. No matrix UI compares attributes across documents.
- **Status**: Stubbed / Partially implemented (15% — scoring formula exists, but zero discrepancy or normalization engines exist).

### 2.5 R5. Reviewable Report & Evidence Appendix Generator
- **Observation**:
  - `GET /api/properties/:id/report` in `server.ts` outputs raw JSON with property metadata, documents list, and findings list.
  - In `App.tsx`, `printReport()` uses `window.open` with basic inline HTML and calls `window.print()`.
- **Inference**:
  - Immutable Property Snapshots: Missing. There is no snapshot storage or versioning in the database; reports are built on-the-fly from mutable DB rows.
  - Client-Ready PDF Report Generation: Missing. Browser `window.print()` of raw HTML is not a structured, client-ready legal due-diligence report.
  - Required Report Sections: Incomplete/Missing. The current output lacks:
    - Executive Summary
    - Title Timeline (R2)
    - Discrepancy Matrix (R4)
    - Georeferenced GIS screening snapshots (R3)
    - Itemized Evidence Appendix with document page anchors and checksum verifications (R1).
- **Status**: Stubbed / Partially implemented (20% — JSON export and browser print popup only).

---

## 3. Caveats
- No live connection to external government portals (Bhoomi, Kaveri 2.0, BBMP e-Aasthi, K-GIS) is present or expected in this offline codebase environment. Seed/mock data and deterministic rules must be used to drive all features and tests.
- Docker command was not found in the test shell PATH (`zsh: command not found: docker`), so local database operations in testing must be runnable with fallback in-memory/mock or verified with unit/integration test harnesses that do not require external daemon dependencies.
- No third-party UI component libraries (Tailwind, Radix, shadcn) are currently installed; all UI styling in `apps/web` is currently handled in a single custom CSS file (`apps/web/src/styles.css`).

---

## 4. Conclusion & Architecture Blueprint

### 4.1 Summary Assessment Table

| Requirement | Implementation State | Key Gaps |
|---|---|---|
| **R1: Document Intelligence & Evidence Extraction** | 15% (Upload & metadata only) | Classification service, field extraction (parties, survey numbers, extent, dates, consideration, boundaries), page bounding boxes & confidence scores, file streaming API, side-by-side verification UI |
| **R2: Title Chain & Ownership Graph** | 0% (Completely missing) | `title_events` and `title_reviews` schemas, chronological graph builder, alias normalization, gap detection algorithms (broken chain, date sequence, extent deviation), reviewer verify/dispute UI |
| **R3: GIS & Spatial Buffer Screening** | 20% (Point location & demo layer only) | Rajakaluve drain layers (Primary 50m, Secondary 25m, Tertiary 15m), lake boundary layers (30m), cadastral parcel polygon geometry, exact buffer distance/intersection screening, map snapshot export with scale/north arrow |
| **R4: Cross-Document Discrepancy & Risk Scoring** | 15% (3 baseline rules only) | Karnataka land unit normalizer (Acres/Guntas/SqFt), identifier & person name normalizer, boundary conflict detector, rule catalog with version & statutory citations, frontend discrepancy matrix |
| **R5: Reviewable Report & Evidence Appendix** | 20% (JSON export & window.print only) | Immutable snapshot model, client/server legal PDF generation, executive summary, title timeline, discrepancy matrix, GIS snapshots, itemized evidence appendix |

### 4.2 Required Technical Architecture Upgrades

1. **Database Schema Enhancements (`infra/db/schema.sql`)**:
   - Add `doc_type` (`sale_deed`, `gift_deed`, `rtc_pahani`, `encumbrance_certificate`, `e_khata`, `mutation_extract`) to `documents`.
   - Add `evidence_anchors jsonb` (`{ pageNumber, bbox: [x,y,w,h], confidence, snippet }`) to `documents`.
   - Add `parcel_boundary geometry(Polygon, 4326)` to `properties`.
   - Add `title_events` table (`id`, `property_id`, `document_id`, `sequence_order`, `event_date`, `deed_type`, `from_party`, `to_party`, `extent_sqft`, `extent_raw`, `consideration_amount`, `status`).
   - Add `title_reviews` table (`id`, `event_id`, `reviewer_uid`, `status` ['verified','disputed'], `rationale`, `reviewed_at`).
   - Add `property_snapshots` table (`id`, `property_id`, `version`, `snapshot_data jsonb`, `created_at`).
   - Seed realistic spatial layers in `seed.sql`: Primary Rajakaluve (50m buffer), Secondary Rajakaluve (25m buffer), Tertiary Rajakaluve (15m buffer), and Lake boundaries (30m buffer).

2. **Backend Engine Modules (`apps/api/src/`)**:
   - `document-extractor.ts`: Classification, regex/heuristic Karnataka property document parser, bounding box and confidence score generator.
   - `title-engine.ts`: Chronological sequence builder, party alias normalizer, gap detector (missing prior deed, date inconsistency, extent discrepancy).
   - `spatial-rules-engine.ts`: Exact distance and intersection calculation for 50m/25m/15m Rajakaluve buffers and 30m lake buffers against property point and parcel polygon.
   - `discrepancy-engine.ts`: Karnataka land unit normalizer (Acres, Guntas, Sq. Ft., Sq. Meters), person name & survey identifier normalizer, boundary conflict detector.
   - `risk-catalog.ts`: Versioned rules catalog with statutory citations (Karnataka Land Revenue Act 1964, Transfer of Property Act 1882, NGT guidelines).
   - `pdf-report-generator.ts`: Formal legal due-diligence report renderer (or HTML-to-PDF export) with executive summary, property profile, title timeline, discrepancy matrix, GIS screening snapshots, and itemized evidence appendix.
   - New API routes in `server.ts`:
     - File retrieval: `GET /api/properties/:id/documents/:docId/file`
     - Extraction & update: `POST /api/properties/:id/documents/:docId/extract`, `PATCH /api/properties/:id/documents/:docId/fields`
     - Title chain: `GET /api/properties/:id/title-chain`, `POST /api/properties/:id/title-events`, `POST /api/properties/:id/title-events/:eventId/review`
     - GIS screening: `GET /api/properties/:id/spatial-screening`, `POST /api/properties/:id/parcel-geometry`
     - Discrepancies: `GET /api/properties/:id/discrepancies`
     - Snapshots & PDF: `POST /api/properties/:id/snapshots`, `GET /api/properties/:id/report/pdf`

3. **Frontend UI Components (`apps/web/src/`)**:
   - Split monolithic `App.tsx` into modular components:
     - `components/SideBySideReview.tsx`: Document preview (PDF/image) with bounding box highlights side-by-side with structured editable fields.
     - `components/TitleChainTimeline.tsx`: Chronological title timeline showing transfer nodes, high-severity gap alerts, and reviewer verify/dispute modal.
     - `components/MapViewer.tsx`: Enhanced MapLibre GIS viewer showing cadastral survey parcel polygons, buffer overlays (50m/25m/15m and 30m lake), layer toggles, and snapshot export (with scale, north arrow, legend, metadata).
     - `components/DiscrepancyMatrix.tsx`: Side-by-side comparison table between Sale Deed, RTC, and Khata for extent, survey numbers, owners, and boundaries.
     - `components/ReportGenerator.tsx`: Client-ready PDF preview and download component with all five required sections.

---

## 5. Verification Method

### 5.1 Verification Commands
To independently verify the current codebase state:
1. **Type Check**:
   ```bash
   npm run typecheck
   ```
   Both `apps/api` and `apps/web` compile without TypeScript errors.
2. **Unit Tests**:
   ```bash
   npm test
   ```
   Runs `tsx --test test/*.test.ts` in `apps/api`. Currently 3 tests pass in `test/risk-engine.test.ts`.
3. **Build Check**:
   ```bash
   npm run build
   ```
   Builds API with `tsc` and web app with `vite build`.

### 5.2 Files to Inspect
- `apps/api/src/server.ts`: Check endpoints exposed (notice lack of document file streaming, title chain, discrepancy, and snapshot endpoints).
- `apps/api/src/risk-engine.ts`: Check risk calculation (notice lack of unit conversion, discrepancy comparison, and title gap detection).
- `infra/db/schema.sql`: Check tables (notice lack of `title_events`, `title_reviews`, `property_snapshots`, and parcel polygon column).
- `apps/web/src/App.tsx`: Check UI tabs (notice lack of side-by-side document review, title timeline, discrepancy matrix, and PDF generation).

### 5.3 Invalidation Conditions
- If any unit test fails in `npm test`, the baseline is compromised.
- If `npm run typecheck` or `npm run build` fails, build integrity is broken.
- If new tables or endpoints are introduced without tenant scoping (`tenant_id`), multi-tenant isolation is violated.
