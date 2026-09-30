# Milestone 3 Iteration 2: Security & Architecture Review Report

## 1. Observation

Direct empirical observations from independent security inspection, code audit, adversarial stress testing, and pipeline execution:

1. **Monorepo Build and Quality Verification**:
   - `npm run typecheck`:
     - Command exited with code `0`.
     - Zero TypeScript errors across `@ojix/property-api` (`tsc --noEmit -p tsconfig.json`) and `@ojix/property-web` (`tsc --noEmit`).
   - `npm run build`:
     - Command exited with code `0`.
     - `@ojix/property-api`: clean compilation to `dist/`.
     - `@ojix/property-web`: Vite 6.4.3 production build succeeded in 2.59s (1592 modules transformed, output in `dist/assets/`).
   - `npm test`:
     - Command exited with code `0`.
     - Exact test summary:
       ```
       ℹ tests 402
       ℹ suites 0
       ℹ pass 402
       ℹ fail 0
       ℹ cancelled 0
       ℹ skipped 0
       ℹ todo 0
       ℹ duration_ms 31095.469917
       ```

2. **Rate Limiter Configuration & Scoping (`apps/api/src/server.ts:115-121`)**:
   - Implementation:
     ```typescript
     app.use('/api', rateLimit({
       windowMs: 60_000,
       limit: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120,
       skip: () => process.env.NODE_ENV === 'test',
       standardHeaders: true,
       legacyHeaders: false,
     }));
     ```
   - Scoping: `skip` directly inspects `process.env.NODE_ENV === 'test'`. In production (`NODE_ENV=production`), `skip` strictly evaluates to `false`. External HTTP requests cannot forge or manipulate `process.env.NODE_ENV`.
   - Adversarial finding: When running tests as an external client against a pre-existing development server process (`npm run dev`) where `NODE_ENV` is unset, the dev server process retains `NODE_ENV !== 'test'`. Running multiple test runs within 60 seconds from the same loopback IP (`127.0.0.1`) accumulates requests and triggers temporary `HTTP 429 Too Many Requests` (`RateLimit-Policy: 120;w=60`) once the 120-request threshold is crossed.

3. **Multi-Tenant Isolation & SQL Parameterization (`apps/api/src/server.ts`)**:
   - Evaluated all 35+ routes and database queries across `apps/api/src/server.ts`.
   - `authGuard` (lines 124-141) resolves `tenantId` server-side from `org_memberships` table using the authenticated user's `uid`:
     ```typescript
     const membership = await pool.query(
       'SELECT organization_id, role FROM org_memberships WHERE user_uid=$1 ORDER BY created_at LIMIT 1',
       [identity.uid]
     );
     authReq.user = { ...identity, tenantId: membership.rows[0].organization_id, role: membership.rows[0].role };
     ```
   - Every route operating on tenant-owned entities strictly parameters `tenant_id`:
     - Properties: `WHERE id=$1 AND tenant_id=$2` (lines 225, 242, 250, 628, 873, 1021, 1079, 1102, 1119, 1147, 1206, 1257, 1377, 1389, 1438).
     - Documents: `WHERE property_id=$1 AND tenant_id=$2` (lines 227, 253, 1104, 1124, 1150, 1209, 1260) and `WHERE id=$1 AND property_id=$2 AND tenant_id=$3` (lines 391, 421, 462, 489, 576).
     - Title Events & Reviews: `WHERE property_id=$1 AND tenant_id=$2` (lines 632, 1152, 1210, 1261) and `WHERE id=$1 AND property_id=$2 AND tenant_id=$3` (lines 790, 837).
     - Parcel Geometry Audit Lookup: `WHERE tenant_id=$1 AND entity_type='property' AND entity_id=$2 AND action='UPDATE_PARCEL_GEOMETRY'` (line 927).
     - Legal Bookmarks: `WHERE b.tenant_id=$1` (line 1330) and `DELETE WHERE id=$1 AND tenant_id=$2` (line 1356).
     - Source Registry Verifications: `WHERE property_id=$1 AND tenant_id=$2` (line 1381).
     - Workspace Settings: `WHERE tenant_id=$1` (line 1523).
   - Zero dynamic SQL string interpolations of user data; 100% parameterized queries (`$1, $2, ...`).

4. **Coordinate Validation & Check Constraint Integrity (`server.ts`, `spatial-rules-engine.ts`)**:
   - Zero coordinate preservation: In `POST /api/spatial/screen-point` (line 953):
     ```typescript
     const lat = latitude !== undefined && latitude !== null ? Number(latitude) : 12.887;
     const lon = longitude !== undefined && longitude !== null ? Number(longitude) : 77.594;
     ```
     `0.0` is preserved and not overwritten by defaults.
   - Coordinate boundary validation:
     ```typescript
     if (
       typeof lat !== 'number' || typeof lon !== 'number' ||
       !Number.isFinite(lat) || !Number.isFinite(lon) ||
       lat < -90 || lat > 90 || lon < -180 || lon > 180
     ) {
       return res.status(400).json({ error: 'Invalid coordinates...' });
     }
     ```
     Degenerate inputs (`NaN`, `Infinity`, strings, out-of-range coordinates) are intercepted and rejected with `400 Bad Request` prior to executing any SQL.
   - `validateCadastralGeoJSON` (lines 118-206 in `spatial-rules-engine.ts`) verifies closed linear rings, minimum 4 coordinates, and finite numerical values within `[-180, 180]` and `[-90, 90]` across `Polygon`, `MultiPolygon`, `Feature`, and `FeatureCollection`.
   - PostgreSQL schema check constraints `CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)` and `CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)` are fully shielded from invalid data.

5. **Prototype Pollution Protection (`apps/api/src/server.ts:276-320`)**:
   - `FORBIDDEN_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])`.
   - `isSafeFieldPath(pathStr)` rejects any path containing forbidden keys.
   - `getNestedValue` and `setNestedValue` inspect every path segment before traversing or mutating objects.
   - In `PATCH /api/properties/:id/documents/:docId/fields` (lines 505-516), both `fieldPath` and all keys in `overrides` are checked and rejected with `400 Bad Request`.
   - Tests `EMPIRICAL PROTO-1` through `PROTO-4` verify that `Object.prototype` remains unpolluted.

6. **Integrity & Implementation Realism Audit**:
   - `spatial-rules-engine.ts`:
     - Real Haversine spherical distance calculation (`calculateGeodesicDistance`).
     - Genuine pure Node.js PNG encoder (`createCartographicMapPng`) constructing valid IHDR, IDAT (zlib deflate), and IEND chunks with true CRC32 checksums.
     - Unrounded raw distance (`rawDist <= bufferM`) used for statutory comparisons, preventing false-positive buffer violations.
   - `title-engine.ts`: Real topological sort (DAG), 30-year lookback calculations, and running cumulative extent over-conveyance tracking.
   - `e2e-real-world-scenarios.test.ts`: Decoupled from `contract-oracle.ts`; imports and validates production modules directly. All 8 tests pass cleanly.

---

## 2. Logic Chain

1. **Rate Limiting Security**:
   - From Observation 2, `skip` depends solely on `process.env.NODE_ENV === 'test'`. Because environment variables cannot be modified by HTTP client requests, production deployments running under `NODE_ENV=production` are invulnerable to client-side rate limit bypass. Rate limiting is strictly enforced in production.

2. **Tenant Isolation Enforcement**:
   - From Observation 3, every query on tenant-scoped tables binds `tenant_id` to `$N` from `req.user?.tenantId`. `req.user?.tenantId` is populated exclusively by `authGuard` querying `org_memberships` by user UID. Even if an attacker attempts IDOR (insecure direct object references) by passing another tenant's property ID or document ID, the database query returns 0 rows, resulting in `404 Not Found`. Cross-tenant data exfiltration or tampering is prevented.

3. **Database Stability & Boundary Defense**:
   - From Observation 4, all spatial endpoints enforce finite number checks and geographic bounding checks `[-90, 90]` and `[-180, 180]` before invoking database functions or queries. This guarantees that unhandled PostgreSQL exceptions, such as check constraint violations (`properties_latitude_check`, `properties_longitude_check`) or PostGIS `ST_MakePoint` crashes on `NaN`, cannot be provoked by malformed client payloads.

4. **Integrity Verification**:
   - From Observation 6, core algorithms (geodesic distance, DAG generation, unit conversion, PNG generation) execute authentic logic rather than returning hardcoded constants or facade stubs. E2E tests validate real production code without mock oracles.

---

## 3. Caveats

- **Dev Server Rate Limit Cooldown**: When executing automated test suites against a dev server started with `npm run dev` (where `NODE_ENV` is not `'test'`), consecutive test runs within the same 60-second window share the 120 req/minute quota. Running multiple suites in quick succession can trigger temporary `429 Too Many Requests` until the window expires. For continuous local test execution, setting `RATE_LIMIT_MAX=10000` in `.env` or starting the dev server with `NODE_ENV=test` avoids this friction.

---

## 4. Conclusion

**Verdict: APPROVE**

The implementation in Milestone 3 Iteration 2 is robust, secure, and production-ready:
- Rate limiter bypass is strictly scoped to test mode and cannot be abused in production.
- Multi-tenant data isolation is strictly enforced across all routes and SQL queries with zero leaks.
- Coordinate validation reliably handles `0.0` coordinates, rejects `NaN`/degenerate geometries, and shields PostgreSQL check constraints from crashes.
- Prototype pollution guards remain active and verified.
- Monorepo passes 100% of TypeScript type checks, production builds, and automated tests (402/402 passed).
- Zero integrity violations, hardcoded test facades, or task bypasses detected.

---

## 5. Verification Method

To independently verify this evaluation:

1. **Verify TypeScript type checking across monorepo**:
   ```bash
   npm run typecheck
   ```
   *Expected*: Exit code 0, 0 errors.

2. **Verify production bundle build**:
   ```bash
   npm run build
   ```
   *Expected*: Exit code 0, Vite builds successfully.

3. **Verify automated test suite (402 tests)**:
   ```bash
   npm test
   ```
   *Expected*: `tests 402, pass 402, fail 0` with exit code 0.

4. **Verify decoupled E2E real-world scenarios**:
   ```bash
   npx tsx --test apps/api/test/e2e-real-world-scenarios.test.ts
   ```
   *Expected*: 8/8 tests pass against production modules.

5. **Verify adversarial spatial and title suites**:
   ```bash
   npx tsx --test apps/api/test/spatial-adversarial.test.ts
   npx tsx --test apps/api/test/title-adversarial.test.ts
   ```
   *Expected*: 19/19 tests pass in each suite.
