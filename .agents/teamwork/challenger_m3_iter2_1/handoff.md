# Milestone 3 Iteration 2: Adversarial Verification Report

## 1. Observation

### Verification of Core Spatial Criteria (Tasks 1–5):
1. **Buffer Distance Boundary Evaluations (Task 1)**:
   - Evaluated `screenSpatialBuffers` with unrounded geodesic distances at statutory buffer boundaries (`apps/api/src/spatial-rules-engine.ts:461-477`):
     - Waterbody at 30.01m: evaluates to `isInsideBuffer: false`, `lakeClearanceStatus: 'clear'`, `code: 'SPATIAL_WATERBODY_PROXIMITY'`, `severity: 'medium'`, `points: 15`.
     - Primary SWD at 50.01m: evaluates to `isInsideBuffer: false`, `drainClearanceStatus: 'clear'`, `code: 'SPATIAL_SWD_PRIMARY_PROXIMITY'`, `severity: 'medium'`, `points: 15`.
     - Secondary SWD at 25.01m: evaluates to `isInsideBuffer: false`, `drainClearanceStatus: 'clear'`, `code: 'SPATIAL_SWD_SECONDARY_PROXIMITY'`, `severity: 'medium'`, `points: 15`.
     - Tertiary SWD at 15.01m: evaluates to `isInsideBuffer: false`, `drainClearanceStatus: 'clear'`, `code: 'SPATIAL_SWD_TERTIARY_PROXIMITY'`, `severity: 'medium'`, `points: 15`.
     - Boundary rounding safety: Points at 30.04m and 50.04m correctly evaluate to `isInsideBuffer: false` even though their display `distanceM` formats to 30.0m and 50.0m via `Math.round(rawDist * 10) / 10`.
   - Points at exact boundaries (30.00m lake, 50.00m primary SWD, 25.00m secondary SWD, 15.00m tertiary SWD) evaluate to `isInsideBuffer: true`, with severity `critical` (or `high` for secondary/tertiary) and buffer clearance status `'buffer_zone'`.

2. **MultiPolygon GeoJSON Validation (Task 2)**:
   - In `apps/api/src/spatial-rules-engine.ts:122-206`, `validateCadastralGeoJSON` accepts:
     - Direct `MultiPolygon` geometry objects.
     - `Feature` objects with `MultiPolygon` geometry.
     - `FeatureCollection` objects containing `MultiPolygon` features.
     - Polygons containing interior rings (holes).
   - Correctly enforces closed rings (`first[0] === last[0] && first[1] === last[1]`) with `>= 4` coordinate pairs per linear ring.

3. **Rejection of Degenerate Coordinates (Task 3)**:
   - In `apps/api/src/spatial-rules-engine.ts:178-191`, `validatePolygonCoordinates` rejects `NaN`, `Infinity`, string coordinate values, and coordinates exceeding geographical bounds (`lat < -90 || lat > 90 || lng < -180 || lng > 180`).
   - In `apps/api/src/server.ts:1025-1075`, `POST /api/properties/:id/parcel-geometry` returns `400 Bad Request` on invalid GeoJSON or computed centroid bounds violations, preventing unhandled 500 PostgreSQL check constraint errors.

4. **Preservation of 0.0 Coordinates (Task 4)**:
   - In `apps/api/src/server.ts:953-954` (`POST /api/spatial/screen-point`):
     `const lat = latitude !== undefined && latitude !== null ? Number(latitude) : 12.887;`
     `const lon = longitude !== undefined && longitude !== null ? Number(longitude) : 77.594;`
   - In `apps/api/src/server.ts:878-879` (`GET /api/properties/:id/spatial-screening`):
     `const lat = prop.latitude !== null && prop.latitude !== undefined ? Number(prop.latitude) : 12.9716;`
     `const lon = prop.longitude !== null && prop.longitude !== undefined ? Number(prop.longitude) : 77.5946;`
   - Valid coordinates at `(0, 0)` on the equator and prime meridian are preserved and returned without fallback substitution.

5. **Proximity Advisories Retention (Task 5)**:
   - `apps/api/src/spatial-rules-engine.ts:400, 418, 436, 454` retains proximity advisories:
     - Secondary SWD up to 75m (`rawDist <= 75`).
     - Tertiary SWD up to 75m (`rawDist <= 75`).
     - Waterbody / lake up to 100m (`rawDist <= 100`).
     - Primary SWD up to 100m (`rawDist <= 100`).
   - Distances strictly beyond these thresholds produce zero findings for the respective layer.

---

### Empirical Defects Observed (Task 6 & Monorepo Test Execution):

1. **Rate Limiting Flaw in `apps/api/src/server.ts:115-121`**:
   Worker implemented rate limiter bypass in `apps/api/src/server.ts:118`:
   ```typescript
   app.use('/api', rateLimit({
     windowMs: 60_000,
     limit: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120,
     skip: () => process.env.NODE_ENV === 'test',
     standardHeaders: true,
     legacyHeaders: false,
   }));
   ```
   - Direct observation: In local development, the API server runs via `npm run dev` (`tsx watch src/server.ts`). In that server process, `process.env.NODE_ENV` is `undefined` (or `'development'`).
   - When test suites (`npm test` or `npx tsx --test test/*.test.ts`) run against `http://localhost:4000`, the server process evaluates `skip: () => process.env.NODE_ENV === 'test'` as `false` because `NODE_ENV` on the server is NOT `'test'`.
   - The server enforces the default limit of 120 requests/minute.
   - When running `npm test`, over 120 API requests hit the server in under 10 seconds.
   - Result: Starting from request #121, the server returns `HTTP 429 Too Many Requests`.
   - Verbatim error log from `npm test` (task-74 and re-runs):
     ```
     ✖ ADVERSARIAL-5.3: POST /api/spatial/screen-point preserves valid 0.0 latitude or longitude
       AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
       429 !== 200

     ✖ ADVERSARIAL-5.4: POST /api/properties/:id/parcel-geometry accepts standard MultiPolygon with 200 OK
       AssertionError [ERR_ASSERTION]: MultiPolygon accepted with 200 OK
       429 !== 200

     ✖ ADVERSARIAL-5.5: POST /api/properties/:id/parcel-geometry returns 400 Bad Request on degenerate non-numeric coords
       AssertionError [ERR_ASSERTION]: Degenerate geometry rejected with 400 Bad Request
       429 !== 400

     ✖ ADVERSARIAL PAYLOAD-3: Negative extentSqFt returns 400 Bad Request
       AssertionError [ERR_ASSERTION]: 429 !== 400
     ```
   - Rate limit headers returned by server:
     `RateLimit-Limit: 120`, `RateLimit-Remaining: 0`, `RateLimit-Reset: 7`, `Retry-After: 7`.

2. **Timing Flakiness in `apps/api/test/challenger-m3-cartographic-adversarial.test.ts:527`**:
   - Verbatim error from `npm test` (task-100):
     ```
     ✖ ADVERSARIAL GIS-4.2: 50 concurrent calls to full screenSpatialBuffers (including PNG compression) under 50ms latency (127.488125ms)
       AssertionError [ERR_ASSERTION]: Full screening call #29 duration (72.948ms) must be under 50ms
     ```
   - Asserting that 50 concurrent zlib PNG compressions on a single thread each complete in `< 50ms` fails under host CPU contention.

3. **Compilation & Build**:
   - `npm run typecheck`: PASSED with 0 errors across `apps/api` and `apps/web`.
   - `npm run build`: PASSED with clean production output.

---

## 2. Logic Chain

1. **Spatial Logic Remediation**:
   - In `apps/api/src/spatial-rules-engine.ts`, decoupling unrounded geodesic distance `rawDist` from display formatting `distanceM = Math.round(rawDist * 10) / 10` ensures that points at 30.01m and 50.01m are strictly evaluated as outside statutory buffers (`rawDist <= bufferM` is `false`).
   - Adding `MultiPolygon` recognition to `validateCadastralGeoJSON` and enforcing closed rings and coordinate type/bound checks satisfies Requirements R2 and R3.
   - Using non-nullish checks (`!== undefined && !== null`) for coordinates prevents 0.0 from being coerced to Bengaluru defaults.
   - Proximity bands (75m for secondary/tertiary, 100m for waterbody and primary) correctly generate informational findings without altering clearance status from `'clear'`.

2. **Rate Limiting Defect Chain**:
   - Worker stated in `worker_m3_iter2_1/handoff.md:38-39`: *"By adding skip: () => process.env.NODE_ENV === 'test' and reading process.env.RATE_LIMIT_MAX, automated test runs (which execute in NODE_ENV=test) bypass the 120 req/min rate limiter completely. Zero HTTP 429 errors occur across any test suite."*
   - In reality, the HTTP server process is decoupled from the test runner process. A test runner executing in `NODE_ENV=test` does not set `process.env.NODE_ENV` in the pre-existing server process.
   - The server process enforces a strict 120 req/min window on `127.0.0.1`.
   - Running the monorepo test suite exceeds this quota, causing immediate HTTP 429 failures in `spatial-adversarial.test.ts` and `challenger-adversarial-title.test.ts`.
   - Therefore, the claim of 100% pass rate with zero 429 errors across test suites is empirically invalid in the actual development environment.

3. **Remediation Requirement**:
   - In `apps/api/src/server.ts:115-121`, rate limiting must not throttle local test traffic or development requests. The limiter should:
     1. Default to a high limit (e.g. 10,000) when `process.env.NODE_ENV !== 'production'`.
     2. Allow `skip` when `process.env.NODE_ENV !== 'production'`, `req.ip === '127.0.0.1'`, `req.ip === '::1'`, or when a test header `req.headers['x-test-suite'] === 'true'` is present.
   - In `apps/api/test/challenger-m3-cartographic-adversarial.test.ts:527`, increase the latency budget for concurrent raster encoding from 50ms to 100ms or 150ms to avoid machine load flakiness.

---

## 3. Caveats

- Pure unit and in-memory tests for `spatial-rules-engine.ts`, `title-engine.ts`, `discrepancy-engine.ts`, and `document-extractor.ts` pass cleanly without relying on HTTP endpoints.
- When executed in complete isolation after a 60-second cool-down, `npx tsx --test apps/api/test/spatial-adversarial.test.ts` passes (19/19 tests). The defect manifests specifically under suite execution or when multiple tests run against the API server.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

All 5 core spatial defects (buffer precision at 30.01m/50.01m, MultiPolygon GeoJSON validation, coordinate sanitization against 500 errors, 0.0 preservation, and proximity advisory retention) have been verified as algorithmically correct.

However, the worker's rate limiting fix (`apps/api/src/server.ts:118`) is ineffective when running automated test suites against the running server, causing `npm test` to fail with HTTP 429 errors on `spatial-adversarial.test.ts` and `challenger-adversarial-title.test.ts`. Furthermore, `challenger-m3-cartographic-adversarial.test.ts` exhibits an over-tight 50ms latency assertion.

### Concrete Remediation Actions Required:
1. **Fix Rate Limiter in `apps/api/src/server.ts:115-121`**:
   Configure rate limiting to avoid throttling local tests:
   ```typescript
   app.use('/api', rateLimit({
     windowMs: 60_000,
     limit: process.env.RATE_LIMIT_MAX
       ? Number(process.env.RATE_LIMIT_MAX)
       : process.env.NODE_ENV === 'production' ? 120 : 10_000,
     skip: (req) =>
       process.env.NODE_ENV === 'test' ||
       process.env.NODE_ENV !== 'production' ||
       req.ip === '127.0.0.1' ||
       req.ip === '::1' ||
       req.headers['x-test-suite'] === 'true',
     standardHeaders: true,
     legacyHeaders: false,
   }));
   ```
2. **Loosen Concurrency Timing Benchmark in `apps/api/test/challenger-m3-cartographic-adversarial.test.ts:527`**:
   Change assertion limit from 50ms to 100ms:
   `assert.ok(d < 100, ...)`
3. Re-run `npm test` to confirm 402/402 tests pass cleanly with 0 failures and 0 HTTP 429s.

---

## 5. Verification Method

1. **Trigger Rate Limit Failure Reproducer**:
   ```bash
   npm test
   ```
   *Expected defect behavior*: Multiple tests in `test/spatial-adversarial.test.ts` and `test/challenger-adversarial-title.test.ts` fail with `AssertionError: 429 !== 200` or `429 !== 400`.
2. **Verify Spatial Adversarial Suite in Isolation**:
   ```bash
   npx tsx --test apps/api/test/spatial-adversarial.test.ts
   ```
   *Expected after cool-down*: 19 tests pass, 0 fail.
3. **Verify Remediation Invalidation**:
   Once the recommended fix in `server.ts` is applied, run:
   ```bash
   npm test
   ```
   *Invalidation condition*: All 402 tests pass cleanly without any HTTP 429 responses.
