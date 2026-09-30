## 2026-09-30T21:34:42Z
You are worker_m3_iter2_1, the implementation worker for Milestone 3 Iteration 2 (Remediation & Hardening).
Your working directory is /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/worker_m3_iter2_1.
Your caller/parent conversation ID is 73951fd4-89f0-42d4-b0d4-878f34a497d3.

MANDATORY FIRST STEP:
Read /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md.

REFERENCE DOCUMENTS:
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/teamwork_preview_orchestrator/PROJECT.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/reviewer_m3_2/handoff.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/challenger_m3_1/handoff.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/challenger_m3_2/handoff.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/auditor_m3_1/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK & REMEDIATION PLAN:
Address all defects identified by reviewer_m3_2, challenger_m3_1, and challenger_m3_2:

1. Rate Limiter in `apps/api/src/server.ts`:
   In line 115, configure rate limiting to skip during testing:
   ```typescript
   app.use('/api', rateLimit({
     windowMs: 60_000,
     limit: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120,
     skip: () => process.env.NODE_ENV === 'test',
     standardHeaders: true,
     legacyHeaders: false,
   }));
   ```

2. Spatial Rules Engine in `apps/api/src/spatial-rules-engine.ts`:
   a. Premature rounding: Do NOT round `dist = Math.round(dist * 10) / 10` before `dist <= bufferM` comparisons! Use raw distance for buffer zone checks (`dist <= bufferM`). Only format/round `distanceM: Math.round(dist * 10) / 10` for output findings. Ensure coordinates at 30.01m (lake) and 50.01m (primary SWD) evaluate to `isInsideBuffer: false`.
   b. MultiPolygon GeoJSON support: Update `validateCadastralGeoJSON` to accept `MultiPolygon`, `Feature` with `MultiPolygon`, and `FeatureCollection` with `MultiPolygon` features, validating all polygon rings.
   c. Coordinate & Bounds Validation: In `validatePolygonCoordinates`, check every coordinate `[lng, lat]` in every ring. Verify `typeof lng === 'number' && typeof lat === 'number' && Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90`. Reject `NaN`, strings, null, and out-of-bounds coordinates with `false`.
   d. Proximity Advisory Filtering: Ensure secondary SWD (up to 75m), tertiary SWD (up to 75m), and waterbody (up to 100m) proximity advisories are retained in `findings` rather than dropped by a strict `dist <= bufferM * 2` filter.

3. Server Endpoints in `apps/api/src/server.ts`:
   a. In `POST /api/spatial/screen-point`: Fix coordinate parsing so valid `0` coordinates are not overwritten with defaults:
      `const lat = latitude !== undefined && latitude !== null ? Number(latitude) : 12.887;`
      `const lon = longitude !== undefined && longitude !== null ? Number(longitude) : 77.594;`
      Validate `-90 <= lat <= 90` and `-180 <= lon <= 180` and finite, returning HTTP 400 if invalid.
   b. In `POST /api/properties/:id/parcel-geometry`:
      Validate that computed centroid coordinates are finite and within `[-90, 90]` and `[-180, 180]`. Return HTTP 400 Bad Request on invalid coordinates, preventing PostgreSQL CHECK constraint 500 errors.
   c. In `GET /api/properties/:id/spatial-screening`:
      Ensure the property's actual linked cadastral geometry is returned in `cadastralParcelGeoJSON` when available.

4. E2E Decoupling in `apps/api/test/e2e-real-world-scenarios.test.ts`:
   Replace imports from `./contract-oracle.js` with direct imports from `../src/` (`document-extractor.js`, `discrepancy-engine.js`, `title-engine.js`, `spatial-rules-engine.js`, `report-generator.js`, `types.js`).

5. Automated Test Suite Integration:
   Rename `apps/api/test/title-adversarial.stress.ts` -> `apps/api/test/title-adversarial.test.ts` and `apps/api/test/spatial-adversarial.stress.ts` -> `apps/api/test/spatial-adversarial.test.ts` so that `npm test` (`tsx --test test/*.test.ts`) runs all tests including the adversarial stress suites.

6. Verification:
   Run:
   - `npm test` -> verify 100% pass rate across ALL tests (>390 tests pass cleanly, 0 failures, 0 HTTP 429).
   - `npm run typecheck` -> verify 0 type errors.
   - `npm run build` -> verify clean production build.
