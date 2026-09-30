# Milestone 3 Iteration 2: Empirical Challenger Verification Report

**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### Observation 1: Decoupled E2E Real-World Scenarios (`apps/api/test/e2e-real-world-scenarios.test.ts`)
- Inspection of `apps/api/test/e2e-real-world-scenarios.test.ts` lines 1-28 shows imports strictly from production code:
  ```typescript
  import { classifyDocument, extractDocumentMetadata, computeSha256Checksum } from '../src/document-extractor.js';
  import { parseKarnatakaLandExtent, compareExtents, calculateRiskScore } from '../src/discrepancy-engine.js';
  import { arePartyAliases, detectTitleGaps } from '../src/title-engine.js';
  import { screenSpatialBuffers } from '../src/spatial-rules-engine.js';
  import { createDueDiligenceSnapshot, generateDueDiligenceReport } from '../src/report-generator.js';
  import type { TitleEvent, EvidenceAnchor, DiscrepancyFinding } from '../src/types.js';
  ```
- A grep search for `contract-oracle` across `apps/api/test` confirmed 0 matches in test files.
- Execution command: `npx tsx --test apps/api/test/e2e-real-world-scenarios.test.ts`
- Result: **8 passed, 0 failed** in 161.68ms (Exit code 0).

### Observation 2: Title Adversarial Stress Suite (`apps/api/test/title-adversarial.test.ts`)
- Execution command: `npx tsx --test apps/api/test/title-adversarial.test.ts`
- Result: **19 passed, 0 failed** in 170.25ms (Exit code 0).
- All 19 stress tests covering graph topologies/cycles, patronymics, date boundaries, extent over-conveyance, and encumbrance isolation passed cleanly.

### Observation 3: TypeScript Typecheck and Production Build
- Command: `npm run typecheck`
  - Output: Clean typecheck across `@ojix/property-api` (`tsc --noEmit -p tsconfig.json`) and `@ojix/property-web` (`tsc --noEmit`). Exit code 0.
- Command: `npm run build`
  - Output: Clean compilation of backend (`tsc -p tsconfig.json`) and frontend (`vite build`). Exit code 0.

### Observation 4: CRITICAL DEFECT — Rate Limiting Flakiness & HTTP 429 Errors Under Rapid / Repeated Runs
- In `apps/api/src/server.ts:115-121`:
  ```typescript
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120,
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: true,
    legacyHeaders: false,
  }));
  ```
- The Express server runs in a long-lived dev process (`tsx watch src/server.ts`, PID 23198) where `process.env.NODE_ENV` is `undefined` (not `'test'`).
- The test runner runs in a separate child Node process. Setting `process.env.NODE_ENV = 'test'` in `challenger-adversarial-empirical.test.ts:1` or `challenger-adversarial-title.test.ts:1` does **not** cross the HTTP/process boundary to the server process.
- Consequently, the server evaluates `skip: () => process.env.NODE_ENV === 'test'` as `false`, enforcing the default limit of 120 requests per 60,000ms window on tests targeting `http://localhost:4000/api/...`.
- When tests are executed in rapid succession (e.g. running `npm test` twice or running test suites after manual tests), the server returns `HTTP 429 Too Many Requests` (`Too many requests, please try again later.`).
- Verbatim empirical failure from `npm test` run (Task-109):
  ```
  ✖ EMPIRICAL PROTO-1: Prototype pollution via fieldPath __proto__.polluted is rejected with 400
    429 !== 400
  ✖ SECURITY: Path Traversal blocked in GET /api/properties/:id/documents/:docId/file
    429 !== 403
  ✖ ADVERSARIAL REVIEW-1: Dispute with empty string "" rationale returns 400 Bad Request
    SyntaxError: Unexpected token 'T', "Too many r"... is not valid JSON
  ✖ ADVERSARIAL PAYLOAD-9: Valid title-event insertion succeeds with 201 Created and normalized parties
    429 !== 201
  ✖ ADVERSARIAL-5.3: POST /api/spatial/screen-point preserves valid 0.0 latitude or longitude
    429 !== 200
  ✖ ADVERSARIAL-5.4: POST /api/properties/:id/parcel-geometry accepts standard MultiPolygon with 200 OK
    429 !== 200
  npm error Lifecycle script `test` failed with error: npm error code 1
  ```

---

## 2. Logic Chain

1. The dispatch tasked the challenger with:
   - "1. Run `npm test` across the full monorepo. Verify that all 402+ tests execute with 100% pass rate and ZERO HTTP 429 rate limit errors."
   - "2. Run `npx tsx --test apps/api/test/e2e-real-world-scenarios.test.ts`. Verify all scenarios execute directly against production code without any import from `contract-oracle.js`."
   - "3. Run `npx tsx --test apps/api/test/title-adversarial.test.ts`. Verify all 19 title stress tests pass."
   - "4. Run `npm run typecheck` and `npm run build`. Verify zero errors."
2. Scenarios 2, 3, and 4 passed completely and without flaws.
3. However, regarding task 1:
   - In `worker_m3_iter2_1/handoff.md`, the worker claimed:
     *"By adding `skip: () => process.env.NODE_ENV === 'test'` and reading `process.env.RATE_LIMIT_MAX`, automated test runs (which execute in `NODE_ENV=test`) bypass the 120 req/min rate limiter completely. Zero HTTP 429 errors occur across any test suite."*
   - This claim is logically and empirically flawed because `express-rate-limit` runs inside the server process, while `process.env.NODE_ENV = 'test'` was set inside the test runner process.
   - Empirical test execution proved that once the 120 request quota is consumed in the 60-second window, any subsequent test run against `http://localhost:4000` triggers cascading `HTTP 429` failures.
4. Therefore, the rate limit bypass is incomplete and unstable, failing acceptance criterion 1 under realistic test/CI workloads.

---

## 3. Caveats

- In a single isolated run where the 60-second window is completely fresh, `npm test` passes all 402 tests in ~31 seconds because the suite consumes ~35 HTTP requests, which is below the 120 threshold.
- However, as soon as tests are rerun within 60 seconds or run alongside other test tasks, it crashes with HTTP 429s.
- This can be remediated without compromising production security by allowing the rate limiter to skip when in non-production environments (`process.env.NODE_ENV !== 'production'`) or when a test header (e.g. `req.headers['x-test-suite'] === 'true'` or `req.headers['x-test-mode'] === 'true'`) is passed, or defaulting `RATE_LIMIT_MAX` to a high number (e.g. 10,000) in `package.json` dev scripts.

---

## 4. Conclusion

Verdict: **REQUEST_CHANGES**

The decoupled E2E real-world scenarios, title adversarial suite, typecheck, and build are completely verified and sound. However, the rate-limiting configuration remains vulnerable to `HTTP 429` rate limit exhaustion during successive automated test runs due to cross-process environment isolation.

### Required Changes for Worker:
1. In `apps/api/src/server.ts:118`:
   Update rate limit skip condition to bypass in development/test environments or via header:
   ```typescript
   skip: (req) =>
     process.env.NODE_ENV === 'test' ||
     process.env.NODE_ENV !== 'production' ||
     req.headers['x-test-mode'] === 'true' ||
     req.headers['x-test-suite'] === 'true',
   ```
2. Verify that sending 150 consecutive requests to `http://localhost:4000/api/overview` does not return `HTTP 429`.
3. Verify that running `npm test` twice in immediate succession succeeds with `tests 402, pass 402, fail 0` on both runs.

---

## 5. Verification Method

1. **Reproduce the 429 rate limit failure**:
   ```bash
   # Send 125 requests to exhaust the 120-request window
   node -e "async function f(){ for(let i=0;i<125;i++) await fetch('http://localhost:4000/api/overview'); } f();"
   # Immediately run the server-dependent tests
   npx tsx --test apps/api/test/challenger-adversarial-server.test.ts
   ```
   *Observed Failure*: Tests fail with `AssertionError: 429 !== 403`, `429 !== 400`, `429 !== 404`, and JSON parse `SyntaxError: Unexpected token 'T', "Too many r"...`.

2. **Verify decoupled E2E real-world scenarios**:
   ```bash
   npx tsx --test apps/api/test/e2e-real-world-scenarios.test.ts
   ```
   *Expected*: 8/8 tests pass.

3. **Verify title adversarial tests**:
   ```bash
   npx tsx --test apps/api/test/title-adversarial.test.ts
   ```
   *Expected*: 19/19 tests pass.

4. **Verify typecheck & build**:
   ```bash
   npm run typecheck && npm run build
   ```
   *Expected*: 0 errors.
