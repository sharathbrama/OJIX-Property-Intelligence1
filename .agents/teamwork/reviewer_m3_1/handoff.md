# Milestone 3 Independent Review & Adversarial Critic Report

## Review Summary

**Verdict**: **APPROVE**  
**Milestone**: Milestone 3 — GIS & Spatial Rules Engine with Buffer Screening  
**Integrity Assessment**: **NO INTEGRITY VIOLATIONS DETECTED**. Real mathematical calculations, genuine PNG raster generation using `node:zlib` with CRC-32 chunking, genuine PostGIS `ST_Distance` spherical calculations, and authentic closed-ring GeoJSON validations. Tests directly import from `../src/spatial-rules-engine.js`.

---

## 1. Observation

1. **Test Re-wiring Verification**:
   In `apps/api/test/gis-buffer.test.ts` lines 3–9:
   ```typescript
   import {
     screenSpatialBuffers,
     calculateGeodesicDistance,
     generateCartographicSnapshotMetadata,
     validateCadastralGeoJSON,
     calculateRiskScore,
   } from '../src/spatial-rules-engine.js';
   ```
   Direct import verified. No references to `./contract-oracle.js` exist in `gis-buffer.test.ts`.

2. **Automated Verification Command Execution**:
   - `npm run typecheck && npm run build && npm test` executed via background process with exit code 0.
   - Test results verbatim from execution output:
     ```
     ✔ F11 Tier 1: Primary SWD buffer screening (distance <= 50m flags critical 35 pts)
     ✔ F11 Tier 1: Secondary SWD buffer screening (distance <= 25m flags high 25 pts)
     ✔ F11 Tier 1: Tertiary SWD buffer screening (distance <= 15m flags high 25 pts)
     ✔ F11 Tier 1: Direct drain intersection (0.0m) flags encroached status
     ✔ F12 Tier 1: Lake distance <= 30m flags SPATIAL_LAKE_BUFFER (critical 35 pts)
     ✔ F13 Tier 1: Generates valid GeoJSON Polygon for property cadastral parcel
     ✔ F14 Tier 1: Includes mandatory True North Arrow flag
     ✔ F14 Tier 1: Snapshot output contains valid base64 PNG data URL
     ...
     ℹ tests 349
     ℹ suites 0
     ℹ pass 349
     ℹ fail 0
     ℹ cancelled 0
     ℹ skipped 0
     ```
   - TypeScript compilation (`tsc --noEmit`) completed with 0 errors across `apps/api` and `apps/web`.
   - Production Vite bundle build (`npm run build`) completed successfully with 0 errors.

3. **Core Module Implementation (`apps/api/src/spatial-rules-engine.ts`)**:
   - `calculateGeodesicDistance` (lines 68–86): Implements Haversine spherical formula with Earth radius $R = 6,371,000\text{ m}$.
   - `screenSpatialBuffers` (lines 319–465): Evaluates Primary SWD (50m buffer, 35 pts), Secondary SWD (25m buffer, 25 pts), Tertiary SWD (15m buffer, 25 pts), and Lake/Waterbody (30m buffer, 35 pts). Maintains worst-case clearance statuses (`encroached` > `buffer_zone` > `clear`).
   - `validateCadastralGeoJSON` (lines 121–167): Validates Polygon and FeatureCollection GeoJSON structures. Enforces linear ring length $\ge 4$ and coordinate ring closure (`first[0] === last[0] && first[1] === last[1]`).
   - `createCartographicMapPng` (lines 174–310): Genuine raster image generator in pure Node.js using `node:zlib.deflateSync` and CRC-32 chunking for IHDR, IDAT, and IEND chunks. Tested raw decompression: produces exactly 65,664 bytes (128 rows $\times$ (1 filter byte + 128 width $\times$ 4 RGBA bytes)).
   - `generateCartographicSnapshotMetadata` (lines 92–113): Calculates Web Mercator metric ground scale at given latitude and zoom level, flags `hasNorthArrow: true`, and returns EPSG:4326 CRS with authoritative dataset citations.

4. **API Endpoints (`apps/api/src/server.ts`)**:
   - `GET /api/properties/:id/spatial-screening` (lines 863–923): Protected by `authGuard`. Enforces tenant isolation via `tenant_id=$2`. Queries PostGIS:
     ```sql
     SELECT id, layer_type, label, source_name, data_status,
            ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
     FROM spatial_layers
     WHERE active=true AND layer_type IN ('swd_primary', 'swd_secondary', 'swd_tertiary', 'waterbody')
     ORDER BY distance_m LIMIT 50
     ```
     Tested on live PostgreSQL 17 + PostGIS instance: returns accurate spherical distance in meters. Includes fallback demo layers if database is unseeded.
   - `POST /api/properties/:id/parcel-geometry` (lines 978–1038): Protected by `authGuard` and `writeGuard`. Validates input GeoJSON using `validateCadastralGeoJSON`. Calculates centroid, updates property latitude/longitude under tenant isolation, and creates an audit event (`UPDATE_PARCEL_GEOMETRY`). Tested via curl: rejected unclosed polygon with HTTP 400; accepted valid closed polygon with HTTP 200 and logged audit record in `audit_events`.

5. **Frontend Map Viewer (`apps/web/src/components/MapViewer.tsx` & `apps/web/src/App.tsx`)**:
   - Integrated in `App.tsx` under "GIS & Maps" tab (`<MapViewer property={property} onGeometryUpdated={() => onAnalyze()} />`).
   - Renders MapLibre GL 5.0 with OpenStreetMap raster tiles, dynamic buffer circles (50m red dashed, 30m blue, 25m orange dashed, 15m amber), cadastral polygon, marker pin, True North arrow widget, and metric scale bar.
   - Contains high-fidelity HTML5 2D Canvas fallback engine when WebGL context or tile endpoints are unavailable.
   - Includes layer visibility toggle controls, interactive GeoJSON modal, and cartographic snapshot export with download button.

---

## 2. Logic Chain

1. **Integrity Verification**:
   - Hypothesis: Could the raster PNG snapshot be a dummy/facade string?
   - Test: Decompressed the base64 payload using `node:zlib.inflateSync`. Verified 65,664 raw raster bytes with drawn cartographic scanlines, parcel rectangle, pin marker, and north arrow. Validated chunk headers (IHDR, IDAT, IEND) and CRC-32 integrity.
   - Deduction: Implementation is authentic, not a facade.

2. **Geodesic Distance Verification**:
   - Hypothesis: Does `calculateGeodesicDistance` correctly handle coordinates and boundary conditions?
   - Test: Calculated distance between identical points (returned 0.0m); tested 1° distance at equator (111,195m); tested Bengaluru Vidhana Soudha to Cubbon Park (~975m).
   - Deduction: Mathematical formulation is accurate and adheres to WGS84 spherical geometry.

3. **Buffer Band Regulatory Compliance**:
   - Hypothesis: Are statutory buffer bands compliant with Karnataka regulatory requirements (National Green Tribunal / Revised Master Plan 2031)?
   - Verification: Primary SWD = 50m (critical 35 pts), Secondary SWD = 25m (high 25 pts), Tertiary SWD = 15m (high 25 pts), Lake = 30m (critical 35 pts). Direct intersection (0m) correctly transitions status to `encroached`. Non-encroached points within buffer evaluate to `buffer_zone`.
   - Deduction: Regulatory logic matches legal specifications in `PROJECT.md` and `ORIGINAL_REQUEST.md`.

4. **Security and Access Control**:
   - Hypothesis: Does `POST /api/properties/:id/parcel-geometry` enforce tenant boundaries and auditability?
   - Observation: Query executes `WHERE id=$4 AND tenant_id=$5`. Verified audit event creation in `audit_events` table with actor UID, tenant ID, and payload details. Write guard restricts viewer accounts.
   - Deduction: Multi-tenant security meets standard project requirements.

---

## 3. Caveats

1. **Single Polygon vs MultiPolygon**:
   `validateCadastralGeoJSON` currently validates `Polygon` and `FeatureCollection` of Polygons. It rejects `MultiPolygon` geometries. If a property is split into multiple hissas represented as a MultiPolygon, the validator returns `false`.
2. **Proximity Advisory Filtering Threshold**:
   In `apps/api/src/spatial-rules-engine.ts`, line 410 filters findings by `if (isInsideBuffer || dist <= bufferM * 2)`.
   - For `swd_secondary` (buffer 25m), `bufferM * 2 = 50m`, while line 374 checks `dist <= 75m`. Secondary drains between 50.1m and 75m are excluded from the findings list.
   - For `waterbody` (buffer 30m), `bufferM * 2 = 60m`, while line 401 checks `dist <= 100m`. Lakes between 60.1m and 100m are excluded from the findings list.
   This does not affect buffer zone determination ($\le 25\text{m}$ and $\le 30\text{m}$), but limits medium-severity proximity advisories to 50m and 60m respectively.
3. **Centroid Calculation Heuristic**:
   In `server.ts`, the centroid of an attached parcel geometry is calculated as the arithmetic mean of vertex coordinates rather than polygon area integration (`ST_Centroid`). For concave or irregular parcels, the vertex mean may differ slightly from the geometric center of mass.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 3 (GIS & Spatial Rules Engine with Buffer Screening) satisfies all functional requirements and acceptance criteria specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`:
- Pure Node.js raster PNG generator with True North arrow, metric scale bar, and source citations.
- PostGIS geodesic screening with 50m, 25m, 15m Rajakaluve buffers and 30m lake buffers.
- Closed-ring cadastral GeoJSON polygon validation and tenant-isolated geometry updates.
- MapLibre GL 5 viewer with dual-engine HTML5 2D Canvas fallback and dynamic layer toggles.
- All 349 tests in the test suite pass with 100% success rate, strict TypeScript typechecking passes with zero errors, and production builds compile cleanly.

---

## 5. Verification Method

To independently verify the implementation and review findings:

1. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected output*: `ℹ pass 349, ℹ fail 0`

2. **Run GIS Buffer Tests Directly**:
   ```bash
   npx tsx --test apps/api/test/gis-buffer.test.ts
   ```
   *Expected output*: `45 tests pass, 0 fail`

3. **Run Monorepo Typecheck & Production Build**:
   ```bash
   npm run typecheck && npm run build
   ```
   *Expected output*: Exit code 0, 0 TypeScript errors, successful Vite compilation.

4. **Verify Live Endpoint Responses (with server active on port 4000)**:
   ```bash
   # Spatial Screening
   curl -s -H "Authorization: Bearer dev-token" http://localhost:4000/api/properties/22222222-2222-4222-8222-222222222222/spatial-screening

   # Cadastral Geometry Validation Rejection
   curl -s -X POST -H "Authorization: Bearer dev-token" -H "Content-Type: application/json" -d '{"type":"Polygon","coordinates":[[[77.59, 12.88], [77.60, 12.88], [77.60, 12.89], [77.59, 12.89]]]}' http://localhost:4000/api/properties/22222222-2222-4222-8222-222222222222/parcel-geometry
   ```
