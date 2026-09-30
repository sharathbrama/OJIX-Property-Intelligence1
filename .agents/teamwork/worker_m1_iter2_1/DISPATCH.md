## 2026-09-30T15:39:02Z
You are worker_m1_iter2_1, the Remediation Implementation Worker for Milestone 1.
Your working directory is /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/worker_m1_iter2_1.
Your caller/parent is 3d42048c-91f5-4f22-8a89-e9bee87cdb59.

MANDATORY FIRST STEP:
Read /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md.

FORENSIC AUDIT FAILURE EVIDENCE & REMEDIATION BLUEPRINTS:
- Full Auditor Report: /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/auditor_m1_1/handoff.md
- Extractor Fix Blueprint: /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/explorer_m1_iter2_1/handoff.md
- Server & UI Fix Blueprint: /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/explorer_m1_iter2_2/handoff.md
- Test Re-wiring Blueprint: /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/explorer_m1_iter2_3/handoff.md
- Scope Document: /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/teamwork_preview_orchestrator/PROJECT.md

FILE OWNERSHIP:
You EXCLUSIVELY own:
- `apps/api/src/document-extractor.ts`
- `apps/api/src/server.ts`
- `apps/web/src/components/SideBySideReview.tsx`
- `apps/api/test/document-extraction.test.ts`
- `apps/api/test/challenger-adversarial-extraction.test.ts`
- `apps/api/test/challenger-adversarial-server.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASKS TO EXECUTE:
1. `apps/api/src/document-extractor.ts`:
   - Replace extent regex with compound-first pattern so `"3 Acres 10 Guntas"` captures both units accurately and never truncates to `"3 Acres"`.
   - Update `normalizeKarnatakaExtent` with Kannada units (`ಎಕರೆ`, `ಗುಂಟೆ`).
   - Replace boundary regex with lookahead-delimited pattern so initials with dots (`Sri A. K. Rao`) are not truncated, and strip leading colons.
   - Add Kannada Unicode patterns to `classifyKarnatakaDocument` (`ಆರ್‌ಟಿಸಿ`, `ಪಹಣಿ`, `ಕ್ರಯ ಪತ್ರ`, `ದಾನ ಪತ್ರ`, `ಕಬ್ಜೇದಾರ`, etc.) without ASCII `\b`.
   - Add defensive type guards across `normalizeKarnatakaExtent`, `normalizePersonName`, `buildEvidenceAnchor`, and `extractDocument` so non-string/null JSON payloads never throw `TypeError`.
   - Sanitize bounding boxes: ensure `ymin <= ymax`, `xmin <= xmax`, clamp to `[0.0, 1.0]`, and handle `NaN`.
   - Update seller/buyer regexes to preserve initials (`Sri K. R. Ramesh S/o Kadirappa`) and dynamically capture `W/o`, `D/o`, `S/o`.
   - Export standard test aliases: `classifyDocument`, `extractDocumentMetadata`, `validateBoundingBox`, `applyFieldOverride`, `computeSha256Checksum`, `verifyTenantIsolation`, `logAuditEvent`.

2. `apps/api/src/server.ts`:
   - Implement `FORBIDDEN_PROTOTYPE_KEYS`, `isSafeFieldPath`, safe `getNestedValue` and `setNestedValue` blocking `__proto__`, `constructor`, `prototype`.
   - In `PATCH /api/properties/:id/documents/:docId/fields`, reject forbidden prototype keys with 400 Bad Request, and enforce mandatory non-empty review rationale.
   - Implement `resolveSafeUploadPath` and enforce in `GET /api/properties/:id/documents/:docId/file` and `POST /extract` (return 403 Forbidden on path traversal attempts).
   - Ensure idempotent database column migration on startup (`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type varchar(50)`).

3. `apps/web/src/components/SideBySideReview.tsx`:
   - Dynamically compute `totalPages` from all bounding box anchors and explicit page count.
   - Enable navigation buttons with `currentPage < totalPages` and display `Page {currentPage} of {totalPages}`.
   - Update schedule boundaries anchor to inherit `sched.evidenceAnchor?.pageNumber || 1`.
   - Update canvas placeholder to visually render the current sheet number.

4. Test Suite Re-wiring:
   - In `apps/api/test/document-extraction.test.ts`, import directly from `../src/document-extractor.js` rather than `contract-oracle.js`.
   - Restore assertion in line 633 to `assert.ok(extracted.parties.length >= 2)`.
   - Update `apps/api/test/challenger-adversarial-extraction.test.ts` and `apps/api/test/challenger-adversarial-server.test.ts` to assert the fixed, secure behaviors.

5. Verification:
   - Run `npm test` and verify 100% of tests pass.
   - Run `npm run typecheck` and verify 0 errors.
   - Run `npm run build` and verify 0 errors.
   - Write comprehensive `handoff.md` and report back to parent.

## 2026-09-30T15:50:25Z
**Context**: Milestone 1 Iteration 2 Remediation Implementation
**Content**: Heartbeat check at 10 minutes. Please provide a status update on your progress: which files have been modified, have builds/tests run, and are there any blocking issues?
**Action**: Update your progress.md with current status and reply with your latest checkpoint.

