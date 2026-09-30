# Forensic Integrity Audit Report: Milestone 2 Deliverables

**Work Product**: Milestone 2 Title Chain & Ownership Graph Engine (`apps/api/src/title-engine.ts`, `apps/api/src/server.ts`, `apps/api/test/title-chain.test.ts`, `apps/web/src/components/TitleChainTimeline.tsx`, `infra/db/schema.sql`)
**Profile**: General Project
**Integrity Mode**: `development` (per `ORIGINAL_REQUEST.md`)
**Auditor**: `auditor_m2_1`
**Verdict**: **CLEAN**

---

## 1. Observation

### Observation 1.1: Build and Run Verification (Check 4)
- Command: `npm run typecheck`
  - Output:
    ```
    > ojix-property-intelligence@0.1.0 typecheck
    > npm run typecheck -w apps/api && npm run typecheck -w apps/web

    > @ojix/property-api@0.1.0 typecheck
    > tsc --noEmit -p tsconfig.json

    > @ojix/property-web@0.1.0 typecheck
    > tsc --noEmit
    ```
  - Exit code: 0. Zero TypeScript diagnostic errors.
- Command: `npm run build`
  - Output:
    ```
    > @ojix/property-api@0.1.0 build
    > tsc -p tsconfig.json

    > @ojix/property-web@0.1.0 build
    > tsc --noEmit && vite build

    ✓ 1583 modules transformed.
    dist/index.html                     0.56 kB │ gzip:   0.35 kB
    dist/assets/index-CgvGMRH9.css    121.48 kB │ gzip:  21.07 kB
    dist/assets/index-By7_Z0jg.js   1,315.65 kB │ gzip: 360.37 kB
    ✓ built in 2.51s
    ```
  - Exit code: 0. Clean production builds for both backend API and React frontend.
- Command: `npm test`
  - Output:
    ```
    ℹ tests 318
    ℹ suites 0
    ℹ pass 318
    ℹ fail 0
    ℹ cancelled 0
    ℹ skipped 0
    ℹ todo 0
    ℹ duration_ms 568.051041
    ```
  - Exit code: 0. 100% test pass rate across all 318 tests.

### Observation 1.2: Test Suite Decoupling & Direct Imports (Check 5)
- Inspected `apps/api/test/title-chain.test.ts` lines 1–11:
  ```typescript
  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import {
    buildTitleDAG,
    normalizePartyName,
    arePartyAliases,
    detectTitleGaps,
    recordReviewerDispute,
    calculateRiskScore,
    type TitleEvent,
  } from '../src/title-engine.js';
  ```
- Grep query for `contract-oracle` in `apps/api/test/title-chain.test.ts`: **0 matches**.
- Direct test execution: `npx tsx --test test/title-chain.test.ts`:
  ```
  ℹ tests 65
  ℹ suites 0
  ℹ pass 65
  ℹ fail 0
  ℹ duration_ms 139.775709
  ```
  All 65 Milestone 2 tests run directly against production `apps/api/src/title-engine.js`.

### Observation 1.3: Hardcoded Output & Facade Detection (Checks 1 & 2)
- Direct inspection of `apps/api/src/title-engine.ts`:
  - **DFS Cycle Detection** (`buildTitleDAG`, lines 248–284): Builds directed adjacency map `adj`, maintains `visited` Set and `recStack` Set, recurses through neighbors, correctly sets `hasCycle = true` upon encountering a node in `recStack`.
  - **Regex Patronymic Parsing & Honorific Extraction** (`normalizePartyName`, lines 77–150): Iterative regex `/^(sri|srimathi|smt|shri|mr|mrs|ms|dr|late|master|kumari)\.?\s+/i` strips multi-honorific prefixes; relational regex `/\b(s\/o|w\/o|d\/o|c\/o|son of|wife of|daughter of)\s+([^,)\n;]+)/i` parses familial relations; identifies 1-letter initials vs multi-letter tokens; builds canonical name strings.
  - **Phonetic Normalization** (`phoneticNormalize`, lines 55–71): Transforms Kannada/South Indian transliteration variants (`GOUDA`->`GOWDA`, `OU`->`OW`, `W`->`V`, `SH`->`S`, `TH`->`T`, `LAXMI`->`LAKSHMI`->`LAKSMI`), collapses doubled consonants `([A-Z])\1+` -> `$1`.
  - **Gap Detection & Statutory Rules** (`detectTitleGaps`, lines 294–428):
    - 30-year search window computation based on earliest vs latest deed dates.
    - Missing predecessor check verifying prior registered acquisition or alias match.
    - Chronological inversion check (`regTime < execTime` -> `TITLE_GAP_CHRONOLOGICAL_INVERSION`, 35 pts).
    - Section 25 statutory registration window exceeding 120 days (`diffDays > 120` -> `TITLE_REGISTRATION_DELAY_EXCEEDED`, 15 pts).
    - Active mortgage encumbrance tracking with discharge deed matching (`TITLE_UNRELEASED_ENCUMBRANCE`, 35 pts).
    - Extent over-conveyance tracking comparing acquired vs conveyed extents per owner with 1% survey margin tolerance (`conveyed > acquired * 1.01`).
  - **Reviewer Dispute Rationale Enforcement** (`recordReviewerDispute`, lines 434–449): Throws Error when status is `'disputed'` if rationale is missing or whitespace-only.
- Direct inspection of `apps/api/src/server.ts` and `infra/db/schema.sql`:
  - PostgreSQL tables `title_events` and `title_reviews` with foreign keys, checks, and performance indexes.
  - Endpoint `GET /api/properties/:id/title-chain` (lines 572–674) performs tenant isolation, queries database rows, maps to `TitleEvent`, executes `buildTitleDAG` and `detectTitleGaps`, returns DAG, gaps, and summary.
  - Endpoint `POST /api/properties/:id/title-events` (lines 676–730) parses input with Zod, canonicalizes parties with `normalizePartyName`, inserts into database, logs audit entry.
  - Endpoint `POST /api/properties/:id/title-events/:eventId/review` (lines 732–813) validates event, invokes `recordReviewerDispute` enforcing non-empty rationale, updates database, writes to `title_reviews`, logs audit entry.

### Observation 1.4: Preservation of Milestone 1 Path Traversal Fix
- Inspected `apps/api/src/server.ts` lines 363–376:
  ```typescript
  app.post('/api/properties/:id/documents/:docId/extract', authGuard, writeGuard, asyncRoute(async (req, res) => {
    ...
    const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);
    if (isTraversal) {
      return res.status(403).json({ error: 'Access denied: invalid file path traversal.' });
    }
  ```
- Empirical verification:
  - Injected document record with `storage_key = '../package.json'`.
  - Sent `POST /api/properties/22222222-2222-4222-8222-222222222222/documents/<docId>/extract`.
  - Server returned HTTP `403` with body `{"error": "Access denied: invalid file path traversal."}`.
  - Confirmed traversal fix in `POST /extract` and `GET /file` is intact and active.

### Observation 1.5: Pre-populated Artifacts & Layout Discipline (Check 3)
- Command: `find . -name '*.log' -o -name '*result*' -o -name '*output*'`
  - Only internal `node_modules` dependencies matched. Zero test logs, pre-computed fixtures, or attestation files exist in the repository.
- Command: `find .agents/teamwork -type f`
  - All files within `.agents/teamwork/` are markdown metadata files. Zero source code, tests, or application binaries reside in `.agents/teamwork/`.

### Observation 1.6: Dependency Audit (Check 6)
- Integrity mode is `development`.
- Target deliverable is Title Chain & Ownership Graph Engine.
- No third-party graph analysis libraries or proprietary title search packages were introduced. All core graph algorithms, entity resolution, and gap calculations are implemented directly in `apps/api/src/title-engine.ts`.

---

## 2. Logic Chain

1. *Step 1 (Check 4 Verification)*: Running `npm run typecheck` returned 0 errors across all monorepo packages. Running `npm run build` cleanly compiled `apps/api` via `tsc` and built `apps/web` via `vite` into `dist`. Running `npm test` executed 318 tests with 318 passing and 0 failing. This confirms Check 4 satisfies all requirements.
2. *Step 2 (Check 5 Verification)*: Inspecting `apps/api/test/title-chain.test.ts` confirmed that the test suite imports directly from `../src/title-engine.js` (lines 3–11) and contains 0 references to `./contract-oracle.js`. Executing `npx tsx --test test/title-chain.test.ts` confirms that all 65 tests pass directly against the production source code without relying on any test oracle. The test assertions evaluate genuine domain properties (acyclicity, node counts, gap findings, over-conveyance math, and dispute validation).
3. *Step 3 (Checks 1 & 2 Verification)*: Source code analysis of `apps/api/src/title-engine.ts` proved that the algorithms are genuine implementations and not facades or hardcoded values:
   - `buildTitleDAG` implements true DFS with a recursion stack to identify cycles.
   - `normalizePartyName` and `arePartyAliases` parse multi-token Karnataka names, initials, honorifics, and relationships via regex and phonetic transforms.
   - `detectTitleGaps` evaluates genuine mathematical differences in square footage against a 1% tolerance threshold and calculates date differentials against statutory windows (Section 25).
   - `recordReviewerDispute` rejects missing or whitespace rationales.
   - `apps/api/src/server.ts` exposes live database-backed endpoints that execute these algorithms and persist records to PostgreSQL with audit logging.
4. *Step 4 (Security Fix Preservation)*: Empirical test against `POST /api/properties/:id/documents/:docId/extract` with a path traversal storage key (`../package.json`) verified that the server returned HTTP 403 Forbidden with `{ error: 'Access denied: invalid file path traversal.' }`. Both `POST /extract` and `GET /file` routes enforce `resolveSafeUploadPath`.
5. *Step 5 (Empirical Stress Testing)*: Independent execution of adversarial test cases verified:
   - Multi-node cycle (`A -> B -> C -> A`) and self-loop (`A -> A`) are both detected (`isAcyclic: false`).
   - Honorific and relationship parsing handles compound inputs like `"Dr. Smt. Lakshmi Devi W/o Late Muniyappa"`.
   - Extent over-conveyance respects the 1.00% survey margin (passes at 1.00% excess, flags at 1.10% excess).
   - Empty/whitespace dispute rationale throws expected error.
6. *Step 6 (Synthesis)*: Because all forensic checks (Check 1, 2, 3, 4, 5, 6) passed, no facades or hardcoded results exist, the test suite is decoupled, and security fixes remain active, the verdict is unambiguously CLEAN.

---

## 3. Caveats

1. **Rate Limiting During Consecutive Test Executions**: In `apps/api/src/server.ts` (line 89), Express rate limiting is set to 120 requests per 60 seconds across `/api`. When running rapid sequential test suites against a live server instance on port 4000, subsequent calls to server integration tests (`challenger-adversarial-server.test.ts`) can hit the rate limit and return HTTP 429 if executed more than 120 times in a minute. When the 60-second window expires, all tests pass cleanly (318/318). For production CI/CD, configuring `skip: () => process.env.NODE_ENV === 'test'` in the rate limiter middleware is recommended to avoid transient 429 errors during high-frequency integration testing.
2. **Frontend UI Testing Scope**: UI components (`TitleChainTimeline.tsx`) were audited via static analysis, TypeScript compilation (`tsc --noEmit`), and Vite production bundle generation. End-to-end browser automation (e.g. Playwright) is scheduled for Milestone 6.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 2 (Title Chain & Ownership Graph Engine) fully satisfies all integrity and forensic criteria:
- `apps/api/test/title-chain.test.ts` is fully decoupled from `contract-oracle.ts` and imports directly from `../src/title-engine.js`.
- All 65 title-chain tests and all 318 repository tests pass with a 100% success rate.
- Core algorithms (DFS cycle detection, South Indian patronymic normalization, 30-year lookback gap analysis, Section 25 registration delays, 1% survey margin over-conveyance, and dispute rationale validation) are authentic, production-grade implementations without facades.
- Database persistence and audit logging are fully implemented across PostgreSQL schema and Express routes.
- The Milestone 1 path traversal security fix returning HTTP 403 on traversal attempts is strictly preserved.

---

## 5. Verification Method

To independently reproduce and verify this audit:

1. **Typecheck Monorepo**:
   ```bash
   npm run typecheck
   ```
   *Expected outcome*: Exit code 0, 0 errors.

2. **Production Build Monorepo**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Exit code 0, bundles emitted in `apps/api/dist` and `apps/web/dist`.

3. **Execute Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected outcome*: Exit code 0, 318 passing tests (0 failures).

4. **Verify Title Chain Test Decoupling & Isolation**:
   ```bash
   cd apps/api && npx tsx --test test/title-chain.test.ts
   ```
   *Expected outcome*: 65 tests passing in <200ms with zero references to `contract-oracle`.

5. **Empirical Path Traversal Security Verification**:
   ```bash
   npx tsx -e "
   import { resolveSafeUploadPath } from './src/server.ts';
   import assert from 'node:assert/strict';
   assert.equal(resolveSafeUploadPath('../package.json').isTraversal, true);
   "
   ```
   *Expected outcome*: Assertion passes.
