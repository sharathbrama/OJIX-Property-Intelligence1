# Progress — Milestone 2 Implementation

Last visited: 2026-09-30T16:21:00Z
Status: Completed

## Completed Steps
1. Initialized DISPATCH.md and BRIEFING.md.
2. Analyzed ORIGINAL_REQUEST.md, PROJECT.md, title-chain.test.ts, and contract-oracle.ts.
3. Implemented production `apps/api/src/title-engine.ts` with:
   - Feature 5: `buildTitleDAG` (chronological sort, unique party nodes, directed edges, DFS cycle detection `isAcyclic`).
   - Feature 6: South Indian / Karnataka alias normalizer (`normalizePartyName`, `phoneticNormalize`, `arePartyAliases`).
   - Feature 7: Title gap detection (`detectTitleGaps`: 30-year lookback missing predecessors, chronological inversions, Section 25 registration delays > 120 days, unreleased active mortgages, and extent over-conveyance).
   - Feature 10: `recordReviewerDispute` (validation of mandatory non-empty dispute rationale, immutability, reviewer tracking).
4. Extended database schema in `infra/db/schema.sql` with `title_events` and `title_reviews` tables and indexes.
5. Updated `apps/api/src/server.ts`:
   - Added startup table migrations for `title_events` and `title_reviews`.
   - Added `GET /api/properties/:id/title-chain` endpoint with DAG building, gap detection, and fallback demo chain.
   - Added `POST /api/properties/:id/title-events` endpoint with Zod schema validation, party normalization, and DB insertion.
   - Added `POST /api/properties/:id/title-events/:eventId/review` endpoint with mandatory rationale verification.
   - Fixed path traversal check in `POST /api/properties/:id/documents/:docId/extract` to return 403.
6. Implemented interactive UI component `apps/web/src/components/TitleChainTimeline.tsx` with chronological deed cards, gap warnings, DAG metrics, party flow, dispute dialogs, and deed creation.
7. Integrated `TitleChainTimeline` into `apps/web/src/App.tsx` under the new "Title Chain" tab.
8. Re-wired `apps/api/test/title-chain.test.ts` to directly import from `../src/title-engine.js`.
9. Verified all 318 tests pass with 100% pass rate (`npm test`), 0 TypeScript errors (`npm run typecheck`), and successful production build (`npm run build`).

## Next Steps
- Deliver handoff report and notify parent orchestrator.
