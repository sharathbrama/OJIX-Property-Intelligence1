# Milestone 3 Empirical Verification Report: GIS & Spatial Rules Engine

**Verdict**: `REQUEST_CHANGES`  
**Agent**: `challenger_m3_1` (EMPIRICAL CHALLENGER — critic, specialist)  
**Target Module**: GIS & Spatial Rules Engine (`apps/api/src/spatial-rules-engine.ts`, `apps/api/src/server.ts`, `apps/web/src/components/MapViewer.tsx`)  
**Harness Executed**: `apps/api/test/spatial-adversarial.stress.ts` (19 stress tests, 100% pass rate reproducing all defects)

---

## 1. Observation

### Observation 1: Premature Floating-Point Rounding at Statutory Buffer Thresholds
In `apps/api/src/spatial-rules-engine.ts` (lines 342–358, 397–401):
```typescript
342: dist = Math.round(dist * 10) / 10;
...
355: } else if (dist <= bufferM) {
356:   if (drainStatus !== 'encroached') drainStatus = 'buffer_zone';
357:   severity = 'critical';
358:   points = 35;
...
397: } else if (dist <= bufferM) {
398:   if (lakeStatus !== 'encroached') lakeStatus = 'buffer_zone';
399:   severity = 'critical';
400:   points = 35;
```
When querying coordinates situated legally outside the statutory buffer:
- Lake distance `30.01m`: `30.01 * 10 = 300.1` -> rounded to `300` -> `dist = 30.0m`. Because `30.0 <= 30` is `true`, `screenSpatialBuffers` assigns:
  ```json
  {
    "code": "SPATIAL_WATERBODY_BUFFER",
    "layerType": "waterbody",
    "distanceM": 30,
    "bufferM": 30,
    "severity": "critical",
    "isEncroached": false,
    "isInsideBuffer": true,
    "points": 35
  }
  ```
  and `lakeClearanceStatus: 'buffer_zone'`.
- Primary SWD distance `50.01m`: rounded to `50.0m` -> `isInsideBuffer: true`, `severity: 'critical'`, `points: 35`, `drainClearanceStatus: 'buffer_zone'`.
- Secondary SWD distance `25.01m`: rounded to `25.0m` -> `isInsideBuffer: true`, `severity: 'high'`, `points: 25`, `drainClearanceStatus: 'buffer_zone'`.
- Tertiary SWD distance `15.01m`: rounded to `15.0m` -> `isInsideBuffer: true`, `severity: 'high'`, `points: 25`, `drainClearanceStatus: 'buffer_zone'`.
Reproduced in `apps/api/test/spatial-adversarial.stress.ts` (Tests ADVERSARIAL-4.3 and ADVERSARIAL-4.4).

### Observation 2: Total Rejection of Standard GeoJSON MultiPolygon Cadastral Parcels
In `apps/api/src/spatial-rules-engine.ts` (lines 131–142):
```typescript
131: if (geojson.type === 'Feature') {
132:   if (!geojson.geometry || geojson.geometry.type !== 'Polygon') {
133:     return false;
134:   }
135:   return validatePolygonCoordinates(geojson.geometry.coordinates);
136: }
137: 
138: if (geojson.type === 'Polygon') {
139:   return validatePolygonCoordinates(geojson.coordinates);
140: }
141: 
142: return false;
```
And in `apps/api/src/server.ts` (lines 984–989):
```typescript
984: const isValid = validateCadastralGeoJSON(geojson);
985: if (!isValid) {
986:   return res.status(400).json({
987:     error: 'Invalid cadastral GeoJSON. Geometry must be a closed Polygon with at least 4 coordinates (first and last coordinate identical).',
988:   });
989: }
```
When submitting a standard GeoJSON `MultiPolygon` representing a fragmented or hissa-partitioned survey parcel (e.g., Sy No 102/1A & 102/1B):
- `validateCadastralGeoJSON` returns `false`.
- `POST /api/properties/:id/parcel-geometry` returns `400 Bad Request`.
Reproduced in `apps/api/test/spatial-adversarial.stress.ts` (Tests ADVERSARIAL-2.1 and ADVERSARIAL-5.4).

### Observation 3: Inadequate Coordinate Validation Permitting Non-Numeric Degenerates & Unhandled 500 Crash
In `apps/api/src/spatial-rules-engine.ts` (lines 145–167):
```typescript
145: function validatePolygonCoordinates(coordinates: any): boolean {
146:   if (!Array.isArray(coordinates) || coordinates.length === 0) {
147:     return false;
148:   }
149:   for (const ring of coordinates) {
150:     if (!Array.isArray(ring) || ring.length < 4) {
151:       return false;
152:     }
153:     const first = ring[0];
154:     const last = ring[ring.length - 1];
155:     if (
156:       !Array.isArray(first) ||
157:       !Array.isArray(last) ||
158:       first.length < 2 ||
159:       last.length < 2 ||
160:       first[0] !== last[0] ||
161:       first[1] !== last[1]
162:     ) {
163:       return false;
164:     }
165:   }
166:   return true;
167: }
```
Only `ring[0]` and `ring[ring.length - 1]` are validated. Intermediate vertices `ring[1..n-2]` are never typechecked or verified for numeric bounds.
When submitting `{ type: "Polygon", coordinates: [[[77.59, 12.97], ["corrupt_x", 12.97], [77.60, 12.98], [77.59, 12.97]]] }`:
- `validateCadastralGeoJSON` returns `true`.
- In `apps/api/src/server.ts` (lines 1007–1013), `sumLon` evaluates to `NaN`, leading to `lon = NaN`.
- Line 1015: `if (lat !== null && lon !== null)` evaluates to `true` (since `NaN !== null` in JS).
- Line 1016: `await pool.query('UPDATE properties SET latitude=$1, longitude=$2 ...', [lat, lon, ...])`.
- PostgreSQL throws `error: new row for relation "properties" violates check constraint "properties_longitude_check"` because `CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)` evaluates to `false` on `NaN`.
- API endpoint `POST /api/properties/:id/parcel-geometry` crashes with `HTTP 500 Internal Server Error` (`{"error":"Internal server error."}`).
Reproduced in `apps/api/test/spatial-adversarial.stress.ts` (Tests ADVERSARIAL-2.2 and ADVERSARIAL-5.5).

### Observation 4: Proximity Advisory Filtering Discrepancy (Silent Dropping of Findings)
In `apps/api/src/spatial-rules-engine.ts` (lines 374–410):
```typescript
374: } else if (dist <= 75) {
375:   severity = 'medium';
376:   points = 15;
377: }
...
389: } else if (dist <= 75) {
390:   severity = 'medium';
391:   points = 15;
...
401: } else if (dist <= 100) {
402:   severity = 'medium';
403:   points = 15;
...
410: if (isInsideBuffer || dist <= bufferM * 2) {
411:   findings.push({ ... });
412: }
```
For `swd_secondary`, `bufferM = 25`, so `bufferM * 2 = 50`.
For `swd_tertiary`, `bufferM = 15`, so `bufferM * 2 = 30`.
For `waterbody`, `bufferM = 30`, so `bufferM * 2 = 60`.
At line 410, `dist <= bufferM * 2` acts as a hard filter:
- Secondary drain at 60m: evaluates line 374, but line 410 check `60 <= 50` is `false`. Finding dropped!
- Tertiary drain at 45m: evaluates line 389, but line 410 check `45 <= 30` is `false`. Finding dropped!
- Waterbody at 80m: evaluates line 401, but line 410 check `80 <= 60` is `false`. Finding dropped!
Reproduced in `apps/api/test/spatial-adversarial.stress.ts` (Test ADVERSARIAL-3.3).

### Observation 5: Coordinate Falsy Fallback Bug in `POST /api/spatial/screen-point`
In `apps/api/src/server.ts` (lines 927–928):
```typescript
927: const lat = Number(latitude || 12.887);
928: const lon = Number(longitude || 77.596);
```
When calling `POST /api/spatial/screen-point` with `{"latitude": 0, "longitude": 0}`:
- Because `0` is falsy in JavaScript, `0 || 12.887` yields `12.887`, and `0 || 77.596` yields `77.596`.
- The API silently overrides the user's requested coordinate `(0, 0)` with Bengaluru center coordinates `(12.887, 77.596)`.
Reproduced in `apps/api/test/spatial-adversarial.stress.ts` (Test ADVERSARIAL-5.3).

### Observation 6: Discarding of Uploaded Parcel Geometries & Topological Degradation
In `apps/api/src/server.ts` lines 1015–1020:
- When a user uploads a genuine survey parcel polygon via `POST /api/properties/:id/parcel-geometry`, the server computes an arithmetic vertex mean and saves only `latitude` and `longitude` to table `properties`. The geometry itself is not saved to the property record.
- In `GET /api/properties/:id/spatial-screening` (lines 916–920), `screenSpatialBuffers` reconstructs a synthetic square `[lon - 0.0005, lat - 0.0005] ...` (`Arakere Sy No 34/2`).
- The actual uploaded boundary is completely lost. Furthermore, distance screening is calculated from the point centroid rather than the polygon boundary, meaning a 300m parcel whose corner touches a drain will be flagged `clear` if its centroid is >50m away.
Reproduced in `apps/api/test/spatial-adversarial.stress.ts` (Test ADVERSARIAL-5.2).

---

## 2. Logic Chain

1. **Defect 1 (Statutory Buffer Boundary Violation)**:
   - *Premise*: Under Karnataka statutory planning law (NGT OA 222/2014 & Karnataka High Court ruling), construction is prohibited within 30m of lakes, 50m of primary Rajakaluves, 25m of secondary drains, and 15m of tertiary drains.
   - *Observation*: Distances are rounded via `Math.round(dist * 10) / 10` before testing `dist <= bufferM`.
   - *Consequence*: Any property at `30.01m` up to `30.049m` from a lake is rounded to `30.0m` and marked `isInsideBuffer: true`, triggering a critical regulatory defect code `SPATIAL_WATERBODY_BUFFER` and levying 35 penalty points. This generates false-positive legal risk for compliant properties.

2. **Defect 2 (MultiPolygon Parcel Rejection)**:
   - *Premise*: Requirement R2 in `ORIGINAL_REQUEST.md` mandates: *"Validate the spatial screening engine across irregular cadastral survey boundaries, multi-polygon parcels..."*.
   - *Observation*: `validateCadastralGeoJSON` enforces `geometry.type === 'Polygon'` and rejects `MultiPolygon`.
   - *Consequence*: Karnataka revenue parcels split by roadways, nalas, or partition hissas cannot be loaded into the system.

3. **Defect 3 (Degenerate Coordinates & Server 500 Crash)**:
   - *Premise*: Cadastral boundary uploads from untrusted or noisy sources must be validated defensively against corrupt or non-numeric tokens.
   - *Observation*: `validatePolygonCoordinates` skips validation of intermediate coordinates.
   - *Consequence*: Non-numeric coordinates (`NaN`, string tokens) pass validation, corrupt centroid calculations, pass the `lat !== null && lon !== null` check, and trigger a database CHECK constraint violation, returning an unhandled 500 server error instead of a graceful 400 Bad Request.

4. **Defect 4 (Proximity Finding Dropping)**:
   - *Premise*: The engine contains code explicitly assigning medium-severity proximity findings for secondary drains up to 75m, tertiary up to 75m, and waterbodies up to 100m.
   - *Observation*: Line 410 enforces `dist <= bufferM * 2`, which limits secondary drains to 50m, tertiary to 30m, and waterbodies to 60m.
   - *Consequence*: Proximity warnings between 50m–75m (secondary), 30m–75m (tertiary), and 60m–100m (lakes) are silently suppressed.

5. **Defect 5 (Falsy 0 Coordinate Override)**:
   - *Premise*: Coordinate `0.0` is a valid geographic coordinate (Null Island).
   - *Observation*: `latitude || 12.887` treats `0` as falsy and substitutes default coordinates.
   - *Consequence*: Legitimate coordinate requests with zero latitude/longitude cannot be screened.

6. **Defect 6 (Topological Loss of Cadastral Boundaries)**:
   - *Premise*: Requirement R3 requires computing exact distances and intersections against drain and lake boundaries for cadastral parcels.
   - *Observation*: The uploaded parcel geometry is never stored in `properties` or queried by PostGIS; screening uses single-point distance and generates a synthetic 110m square.
   - *Consequence*: Large or irregular parcels touching drain boundaries are misclassified as clear if their center point is far from the drain.

---

## 3. Caveats

- Database integration tests in `apps/api/test/spatial-adversarial.stress.ts` rely on the local PostgreSQL/PostGIS instance on port 5433 or standard `DATABASE_URL`. The algorithmic tests in Suite 1 to 4 execute in pure Node.js memory without external database dependencies.
- MapLibre GL frontend rendering in `apps/web/src/components/MapViewer.tsx` renders concentric circles around the property center rather than buffering the waterbody/drain line features directly. This is a visual representation choice that mirrors point-based screening rather than full PostGIS polygon intersection.

---

## 4. Conclusion

**Verdict**: `REQUEST_CHANGES`

The Milestone 3 implementation cannot be approved in its current state due to 3 Critical and 3 High defects:
1. **CRITICAL**: False-positive statutory buffer violations on boundary points (e.g. 30.01m lake, 50.01m primary SWD) due to premature `Math.round(dist * 10) / 10`.
2. **CRITICAL**: Rejection of standard GeoJSON `MultiPolygon` cadastral parcels in violation of Requirement R2.
3. **CRITICAL**: Degenerate/non-numeric coordinate injection (`NaN`, strings) passes `validateCadastralGeoJSON` and crashes `POST /api/properties/:id/parcel-geometry` with unhandled 500 error.
4. **HIGH**: Secondary (50–75m), Tertiary (30–75m), and Lake (60–100m) proximity advisories are silently dropped by line 410.
5. **HIGH**: Falsy `0` check in `POST /api/spatial/screen-point` silently overwrites valid 0.0 coordinates with Bengaluru defaults.
6. **HIGH**: Cadastral parcel polygon geometry uploaded via API is not stored in the database and is replaced with a hardcoded synthetic square on screening.

---

## 5. Verification Method

### 1. Execute Adversarial Stress Test Suite
Run the 19-test empirical verification suite:
```bash
npx tsx --test apps/api/test/spatial-adversarial.stress.ts
```
*Expected Result*: 19 tests pass, verifying every edge case, false positive, MultiPolygon rejection, degenerate geometry crash, and proximity drop.

### 2. Verify Baseline GIS Tests
Run the worker's original test suite:
```bash
npx tsx --test apps/api/test/gis-buffer.test.ts
```
*Expected Result*: 45 tests pass.

### 3. Verify Combined Execution
```bash
npx tsx --test apps/api/test/gis-buffer.test.ts apps/api/test/spatial-adversarial.stress.ts
```
*Expected Result*: 64 tests pass.

### 4. Workspace Verification
```bash
npm run typecheck
npm run build
```
*Expected Result*: Exit code 0 across both backend and frontend packages.
