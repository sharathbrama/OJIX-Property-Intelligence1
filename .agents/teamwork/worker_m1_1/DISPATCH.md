## 2026-09-30T15:15:35Z
You are worker_m1_1, an Implementation Worker for Milestone 1 (Document Intelligence Pipeline & Review UI).
Your working directory is /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/worker_m1_1.
Your caller/parent is 3d42048c-91f5-4f22-8a89-e9bee87cdb59.

MANDATORY FIRST STEP:
Read /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md.

REFERENCE DOCUMENTS:
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/teamwork_preview_orchestrator/PROJECT.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/survey_spec_miner_1/handoff.md
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/survey_code_explorer_2/handoff.md

FILE OWNERSHIP:
You EXCLUSIVELY own:
- `apps/api/src/types.ts`
- `apps/api/src/document-extractor.ts`
- `apps/api/src/server.ts` (document routes)
- `infra/db/schema.sql` (schema updates for documents)
- `apps/web/src/components/SideBySideReview.tsx`
- `apps/web/src/App.tsx` (integration of SideBySideReview)
- `apps/web/src/styles.css`
Do NOT modify `apps/api/test/`!

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASKS FOR MILESTONE 1:
1. Define shared TypeScript interfaces in `apps/api/src/types.ts` matching `PROJECT.md § Interface Contracts` for all modules (R1-R5).
2. Implement `apps/api/src/document-extractor.ts`:
   - Classify 6 Karnataka property document types: `sale_deed`, `gift_deed`, `rtc_pahani`, `encumbrance_certificate`, `e_khata`, `mutation_extract`, plus `other`.
   - Extract key metadata: parties (names, roles, relationships e.g. S/o, W/o), property schedule (survey number, hissa, village, extent with raw text, acres, guntas, sq ft, normalized sq ft), 4-side boundaries (north, south, east, west), execution & registration dates, consideration amount, issuing authority/SRO.
   - Generate page-level bounding boxes `[ymin, xmin, ymax, xmax]` (normalized 0.0 - 1.0) and confidence scores for every extracted field and party entity.
   - Robust parsing supporting text buffers, OCR token streams, and JSON payloads.
3. Enhance `apps/api/src/server.ts`:
   - Add file streaming/retrieval route: `GET /api/properties/:id/documents/:docId/file` (serves the uploaded document file with appropriate MIME headers so web clients can preview it).
   - Add trigger extraction route: `POST /api/properties/:id/documents/:docId/extract` (invokes document extractor, updates `extracted_fields` and `doc_type` in DB).
   - Add field override route: `PATCH /api/properties/:id/documents/:docId/fields` (saves human reviewer corrections, records previous value, new value, reviewer UID, and rationale).
4. Update `infra/db/schema.sql`:
   - Add `doc_type VARCHAR(50)` and ensure `extracted_fields jsonb` supports full schema.
5. Implement `apps/web/src/components/SideBySideReview.tsx`:
   - Split 50/50 dual-viewport:
     - Left pane: Document viewer displaying document page canvas with bounding box overlays colored by confidence (Green: >=0.85, Amber: 0.60-0.84, Red: <0.60).
     - Right pane: Structured inspection form showing extracted fields, confidence badges, verification status.
     - Two-way focus binding: clicking an extracted form field focuses and scrolls to the target bounding box; clicking a bounding box focuses the form field.
     - Reviewer correction controls: edit button opening override dialog that saves previous value, new value, and rationale.
6. Integrate `SideBySideReview` into `apps/web/src/App.tsx` under Documents tab with a "Review Document" action button on each document card.
7. Verification:
   - Run `npm run typecheck` and `npm run build` and ensure both succeed with 0 errors.
   - Document commands, code changes, and verification output in `handoff.md` and report back to parent.
