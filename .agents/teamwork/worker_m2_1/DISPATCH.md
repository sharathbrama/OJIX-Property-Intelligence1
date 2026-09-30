## 2026-09-30T16:11:36Z
You are worker_m2_1, an Implementation Worker for Milestone 2 (Title Chain & Ownership Graph Engine).
Your working directory is /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/worker_m2_1.
Your caller/parent is 3d42048c-91f5-4f22-8a89-e9bee87cdb59.

MANDATORY FIRST STEP:
Read /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md.

REFERENCE DOCUMENTS:
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/teamwork_preview_orchestrator/PROJECT.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/apps/api/test/title-chain.test.ts
- /Users/FOUDER/Downloads/ojix-property-intelligence/apps/api/test/contract-oracle.ts (reference for exact signatures & logic)

FILE OWNERSHIP:
You EXCLUSIVELY own:
- `apps/api/src/title-engine.ts`
- `apps/api/src/server.ts`
- `infra/db/schema.sql`
- `apps/web/src/components/TitleChainTimeline.tsx`
- `apps/web/src/App.tsx`
- `apps/api/test/title-chain.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASKS TO EXECUTE:
1. Implement `apps/api/src/title-engine.ts`:
   - Feature 5: `buildTitleDAG(events: TitleEvent[])`
     - Sort events chronologically by eventDate.
     - Build unique party nodes Map<string, { id: string; name: string }>.
     - Build directed edges from `fromParties` to `toParties` with eventId and extentSqFt.
     - Cycle detection via DFS with recursion stack tracking (`isAcyclic`).
     - Return `{ nodes, edges, isAcyclic, sortedEvents }`.
   - Feature 6: South Indian / Karnataka Alias Normalizer
     - `normalizePartyName(rawName: string)`:
       - Strip honorifics (Sri, Smt, Shri, Mr, Mrs, Late, Dr, Kum, Kumari, Master).
       - Extract relation phrases (S/o, D/o, W/o, C/o, son of, daughter of, wife of).
       - Separate 1-letter initials from name tokens.
       - Canonical format: normal words joined + parentage if present.
       - Return `{ canonicalName, honorificsRemoved, parentSpouse, relationType, initials, tokens }`.
     - `phoneticNormalize(text: string)`:
       - Normalizes South Indian variations: W -> V, OU -> OW, SH -> S, TH -> T, collapse doubled consonants.
     - `arePartyAliases(nameA: string, nameB: string): boolean`:
       - Check canonical equality, token intersections, parent/spouse matches, initial expansions and transpositions (e.g. 'K. R. Ramesh' vs 'Ramesh K R' vs 'Ramesh Kadirappa Ramaswamy'), single token matches with shared initials, and phonetic matches.
   - Feature 7: `detectTitleGaps(events: TitleEvent[], lookbackYears: number = 30)`:
     - 1. Missing Predecessor Detection: Check if transferor acquired property in an earlier title event within lookback window. If not (and not the earliest root grant outside 30 years), generate `TITLE_GAP_MISSING_PREDECESSOR` (severity 'high', 25 points).
     - 2. Chronological Inversion Detection: If `registrationDate < eventDate`, generate `TITLE_GAP_CHRONOLOGICAL_INVERSION` (severity 'critical', 35 points).
     - 3. Registration Delay Check: If `registrationDate - eventDate > 120 days` (4 months under Section 25), generate `TITLE_REGISTRATION_DELAY_EXCEEDED` (severity 'medium', 15 points).
     - 4. Unreleased Encumbrance Detection: If `encumbranceStatus === 'active_mortgage'` without subsequent discharge event, generate `TITLE_UNRELEASED_ENCUMBRANCE` (severity 'critical', 35 points).
     - 5. Extent Over-Conveyance Detection: Track cumulative conveyed vs acquired extents per party. If conveyed > acquired * 1.01, generate `TITLE_GAP_EXTENT_OVERCONVEYANCE` (severity 'critical', 35 points).
     - Return TitleGap array.
   - Feature 10: `recordReviewerDispute(event: TitleEvent, status: 'verified' | 'disputed' | 'unverified', rationale?: string, reviewerUid?: string)`:
     - Validates non-empty rationale if status is 'disputed' (throws Error if empty).
     - Returns updated event.
   - Export all types and helper functions: `TitleEvent`, `TitleGap`, `buildTitleDAG`, `normalizePartyName`, `arePartyAliases`, `detectTitleGaps`, `recordReviewerDispute`.

2. Update `apps/api/src/server.ts`:
   - Add routes:
     - `GET /api/properties/:id/title-chain`: Loads title events for property from DB (or demo fallback if none), builds DAG with `buildTitleDAG`, runs `detectTitleGaps`, returns DAG, gaps, and summary.
     - `POST /api/properties/:id/title-events`: Validates and inserts new title event.
     - `POST /api/properties/:id/title-events/:eventId/review`: Records verification or dispute with mandatory rationale.
   - Minor fix from M1 review: in `POST /api/properties/:id/documents/:docId/extract`, if `isTraversal` return `res.status(403).json({ error: 'Access denied: invalid file path traversal.' });`.
   - Ensure DB startup table migration for `title_events` and `title_reviews` if not exists.

3. Update `infra/db/schema.sql`:
   - Add `title_events` table (id uuid, tenant_id uuid, property_id uuid, document_id uuid, sequence_order int, event_date date, registration_date date, deed_type text, from_parties jsonb, to_parties jsonb, extent_sq_ft numeric, extent_raw text, consideration numeric, status text, dispute_rationale text, reviewed_by text, created_at timestamptz).
   - Add `title_reviews` table.

4. Implement `apps/web/src/components/TitleChainTimeline.tsx`:
   - Interactive, visual chronological timeline/DAG of title events.
   - Deed cards showing date, deed type, parties (From -> To), extent, consideration, verification status badge.
   - Warning banners for any detected title gaps (missing predecessor, chronological inversion, over-conveyance, unreleased mortgage) with severity colors.
   - Reviewer dispute dialog allowing lawyers to submit dispute rationale.

5. Integrate `TitleChainTimeline` into `apps/web/src/App.tsx`:
   - Under the "Title Chain" tab, render `TitleChainTimeline` passing property ID and sample/fetched events.

6. Re-wire `apps/api/test/title-chain.test.ts`:
   - Replace `import { ... } from './contract-oracle.js';` with direct production imports from `../src/title-engine.js`.
   - Ensure all 65 title-chain tests run directly against production source code!

7. Verification:
   - Run `npm test` -> ensure all tests pass (383+ tests passing, 100% pass rate).
   - Run `npm run typecheck` -> ensure 0 errors.
   - Run `npm run build` -> ensure 0 errors.
   - Document all changes and verification commands in `handoff.md` and send message back to parent.
