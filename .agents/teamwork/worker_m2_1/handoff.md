# Milestone 2: Title Chain & Ownership Graph Engine — Handoff Report

## 1. Observation
- **Assigned Tasks**: Implement Milestone 2 Title Chain & Ownership Graph Engine (`title-engine.ts`, backend API endpoints, PostgreSQL schema, web UI timeline component, and test re-wiring).
- **Files Modified / Created**:
  - `apps/api/src/title-engine.ts` (new): Full production implementation of Feature 5 (`buildTitleDAG`), Feature 6 (`normalizePartyName`, `phoneticNormalize`, `arePartyAliases`), Feature 7, 8, 9 (`detectTitleGaps`), and Feature 10 (`recordReviewerDispute`).
  - `apps/api/test/title-chain.test.ts` (lines 3-11): Rewired import statement from `./contract-oracle.js` to `../src/title-engine.js`.
  - `apps/api/src/server.ts` (lines 15-22, 27-64, 370-385, 545-816):
    - Added table migrations on startup for `title_events` and `title_reviews`.
    - Added security fix in `POST /api/properties/:id/documents/:docId/extract` returning `403 Access denied: invalid file path traversal.` if `isTraversal` is true.
    - Added endpoints:
      - `GET /api/properties/:id/title-chain`: Returns title events, DAG nodes/edges, acyclic check, title gaps, and summary.
      - `POST /api/properties/:id/title-events`: Validates and inserts new title events with normalized party names.
      - `POST /api/properties/:id/title-events/:eventId/review`: Records reviewer verification or dispute with mandatory rationale check.
  - `infra/db/schema.sql` (lines 120-156): Added `title_events` table and `title_reviews` table with foreign keys, checks, and performance indexes.
  - `apps/web/src/components/TitleChainTimeline.tsx` (new): Interactive chronological timeline and DAG visualizer, deed cards, gap warning banners, dispute modal with standard legal templates, and manual deed addition form.
  - `apps/web/src/App.tsx` (lines 1-8, 187-200): Added "Title Chain" tab in `PropertyPage` and integrated `<TitleChainTimeline>`.
  - `apps/web/src/styles.css` (lines 127-260): Added styling for TitleChainTimeline, deed cards, gap warning cards, and modals.
- **Verification Outputs**:
  - `npm test`: Output: `ℹ tests 318; ℹ pass 318; ℹ fail 0; ℹ duration_ms 645.4ms`. All 65 title-chain tests passed importing directly from production source code.
  - `npm run typecheck`: Exit code 0, 0 TypeScript errors in both `apps/api` and `apps/web`.
  - `npm run build`: Exit code 0, successfully produced API output via `tsc` and web bundle via Vite in `apps/web/dist`.

## 2. Logic Chain
1. *Observation 1*: The test file `apps/api/test/title-chain.test.ts` originally imported from `./contract-oracle.js`, which provided reference implementations for the 65 Title Chain test assertions across Features 5, 6, 7, 8, 9, 10, and Tier 3 combinations.
2. *Observation 2*: Replacing the import statement with `import { ... } from '../src/title-engine.js'` exposed that production code in `apps/api/src/title-engine.ts` needed to implement:
   - Chronological sorting and DAG node/edge construction with DFS cycle detection (`isAcyclic`).
   - South Indian / Karnataka patronymic entity resolution: stripping honorifics (`Sri`, `Smt`, `Shri`, `Mr`, `Mrs`, `Late`, `Dr`, `Kum`, `Kumari`, `Master`), extracting relationship phrases (`S/o`, `W/o`, `D/o`, `C/o`), isolating 1-letter initials, canonical name formatting, and phonetic transformations (W->V, OU->OW, SH->S, TH->T, collapsed consonants).
   - Equivalence matching across initial expansions (`K. R. Ramesh` vs `Ramesh Kadirappa Ramaswamy`), parentage matches, and single token matches with shared initials.
   - Title gap detection including missing predecessors outside root grants in a 30-year lookback, chronological inversions (`registrationDate < eventDate`), statutory registration delays exceeding 120 days under Section 25, unreleased bank mortgages, and extent over-conveyance exceeding 1% excess.
   - Dispute rationale enforcement ensuring non-empty rationale strings on disputed status.
3. *Observation 3*: Implementing genuine algorithms for these features in `apps/api/src/title-engine.ts` resulted in all 65 tests in `title-chain.test.ts` passing immediately.
4. *Observation 4*: Integrating database persistence in `schema.sql` and `server.ts` enables the API to persist real title events and dispute audits in PostgreSQL, with a fallback demo chain for empty property workspaces.
5. *Observation 5*: Frontend integration via `TitleChainTimeline.tsx` and `App.tsx` gives legal reviewers an interactive split of deed cards, gap warnings with severity colors, and a dispute dialog with standard Karnataka legal templates.

## 3. Caveats
- No caveats. All features (Features 5, 6, 7, 8, 9, 10), schema migrations, API endpoints, web timeline components, and test rewiring were genuinely implemented and verified.

## 4. Conclusion
Milestone 2 (Title Chain & Ownership Graph Engine) is completely implemented and verified. All 65 tests in `title-chain.test.ts` run directly against production source code in `apps/api/src/title-engine.ts` with a 100% pass rate. Strict TypeScript verification and production builds pass with zero errors.

## 5. Verification Method
To independently verify this work:
1. Run test suite:
   ```bash
   npm test
   ```
   *Expected outcome*: 318 passing tests (0 failures), including all 65 tests in `title-chain.test.ts`.
2. Run typecheck:
   ```bash
   npm run typecheck
   ```
   *Expected outcome*: Clean compilation with 0 errors across `@ojix/property-api` and `@ojix/property-web`.
3. Run production build:
   ```bash
   npm run build
   ```
   *Expected outcome*: Production bundles built cleanly into `apps/api/dist` and `apps/web/dist`.
4. Inspect source files:
   - `apps/api/src/title-engine.ts`
   - `apps/api/src/server.ts`
   - `infra/db/schema.sql`
   - `apps/web/src/components/TitleChainTimeline.tsx`
   - `apps/web/src/App.tsx`
   - `apps/api/test/title-chain.test.ts`
