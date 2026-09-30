## 2026-09-30T17:05:45Z
You are worker_m3_1, an Implementation Worker for Milestone 3 (GIS & Spatial Rules Engine with Buffer Screening).
Your working directory is /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/worker_m3_1.
Your caller/parent is 3d42048c-91f5-4f22-8a89-e9bee87cdb59.

MANDATORY FIRST STEP:
Read /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md.

REFERENCE DOCUMENTS:
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/teamwork_preview_orchestrator/PROJECT.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/apps/api/test/gis-buffer.test.ts
- /Users/FOUDER/Downloads/ojix-property-intelligence/apps/api/test/contract-oracle.ts (reference lines 754-944 for exact signatures and calculations)

FILE OWNERSHIP:
You EXCLUSIVELY own:
- `apps/api/src/spatial-rules-engine.ts`
- `apps/api/src/server.ts`
- `apps/web/src/components/MapViewer.tsx`
- `apps/web/src/App.tsx`
- `apps/api/test/gis-buffer.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASKS TO EXECUTE:
1. Implement `apps/api/src/spatial-rules-engine.ts`:
   - Feature 11: Rajakaluve 3-Tier Buffer Screening:
     - Primary SWD: 50m buffer band (distance <= 50m -> buffer_zone, severity 'critical', 35 pts; distance == 0 -> encroached; distance <= 100m -> proximity, severity 'medium', 15 pts).
     - Secondary SWD: 25m buffer band (distance <= 25m -> buffer_zone, severity 'high', 25 pts; distance == 0 -> encroached; distance <= 75m -> proximity, severity 'medium', 15 pts).
     - Tertiary SWD: 15m buffer band (distance <= 15m -> buffer_zone, severity 'high', 25 pts; distance == 0 -> encroached).
   - Feature 12: Lake / Waterbody 30m Buffer Screening:
     - Waterbody: 30m statutory buffer (distance <= 30m -> buffer_zone, severity 'critical', 35 pts; distance == 0 -> encroached; distance <= 100m -> proximity, severity 'medium', 15 pts).
   - `calculateGeodesicDistance(lat1, lon1, lat2, lon2)`: WGS84 Haversine distance in meters (R = 6371e3 m).
   - `screenSpatialBuffers(propertyPoint, layers)`:
     - Evaluates distances, sets `drainClearanceStatus` and `lakeClearanceStatus`, creates finding objects with statutory codes (`SPATIAL_SWD_PRIMARY_BUFFER`, `SPATIAL_WATERBODY_ENCROACHMENT`, etc.).
     - Includes `cadastralParcelGeoJSON` polygon feature.
     - Includes `georeferencedSnapshot` with base64 PNG and metadata from `generateCartographicSnapshotMetadata`.
   - Feature 14: `generateCartographicSnapshotMetadata(center, zoom, sources)`:
     - Calculates `metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)`.
     - `scaleText = 1 cm = ${Math.round(metersPerPixel * 37.795)} m (Zoom ${zoom})`.
     - Returns `{ center, zoom, scaleText, hasNorthArrow: true, sources, timestamp, crs: 'EPSG:4326 (WGS 84)' }`.
   - Feature 13: `validateCadastralGeoJSON(geojson)`:
     - Validates closed ring polygon: coordinates array, length >= 4, first coordinate equals last coordinate.
   - Export all types and functions: `screenSpatialBuffers`, `calculateGeodesicDistance`, `generateCartographicSnapshotMetadata`, `validateCadastralGeoJSON`, `SpatialScreeningResult`, `SpatialScreeningFinding`.

2. Update `apps/api/src/server.ts`:
   - Add routes:
     - `GET /api/properties/:id/spatial-screening`: Loads property coordinates from DB, retrieves spatial layers from PostGIS (or fallback demo layers if empty), runs `screenSpatialBuffers`, returns result.
     - `POST /api/properties/:id/parcel-geometry`: Validates GeoJSON payload with `validateCadastralGeoJSON` (returns 400 Bad Request on invalid polygon), updates property location, logs audit event.

3. Implement `apps/web/src/components/MapViewer.tsx`:
   - Interactive GIS map view with MapLibre GL / canvas fallback.
   - Renders cadastral parcel polygon.
   - Overlays buffer rings: Primary SWD (50m red), Secondary SWD (25m orange), Tertiary SWD (15m amber), Lake buffer (30m blue).
   - Layer control toggles (SWD, Lake, Cadastral Parcel).
   - Cartographic snapshot preview card with True North arrow, metric scale bar (`1 cm = X m`), legend, and source attribution (`BDA Revised Master Plan SWD Layer v2.1 (2023)`, `Bhoomi Cadastral Survey (2024)`).

4. Integrate `MapViewer` in `apps/web/src/App.tsx` under the "GIS & Maps" tab.

5. Re-wire `apps/api/test/gis-buffer.test.ts`:
   - Replace `import { ... } from './contract-oracle.js';` with direct production imports from `../src/spatial-rules-engine.js`.
   - Ensure all tests in `gis-buffer.test.ts` run directly against production source code!

6. Verification:
   - Run `npm test` -> ensure 100% of tests pass.
   - Run `npm run typecheck` -> ensure 0 errors.
   - Run `npm run build` -> ensure 0 errors.
   - Write comprehensive `handoff.md` in your working directory and notify parent.
