## 2026-09-30T16:45:53Z
You are worker_m2_iter2_1, the Remediation Implementation Worker for Milestone 2.
Your working directory is /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/worker_m2_iter2_1.
Your caller/parent is 3d42048c-91f5-4f22-8a89-e9bee87cdb59.

MANDATORY FIRST STEP:
Read /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md.

CHALLENGER FAILURE EVIDENCE & REMEDIATION SPECIFICATIONS (READ FULL REPORT):
- /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/challenger_m2_1/handoff.md
- Scope Document: /Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/teamwork_preview_orchestrator/PROJECT.md

FILE OWNERSHIP:
You EXCLUSIVELY own:
- `apps/api/src/title-engine.ts`
- `apps/api/test/title-chain.test.ts`
- `apps/api/test/title-adversarial.stress.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASKS TO EXECUTE IN apps/api/src/title-engine.ts:
1. Fix Vulnerability 1 (Patronymic Initial Collisions in `arePartyAliases`):
   - In `arePartyAliases(nameA, nameB)`, when checking canonical equality (`normA.canonicalName === normB.canonicalName`), if BOTH names have initials (`normA.initials.length > 0 && normB.initials.length > 0`), verify that their initials are compatible: they must share initials or one set must be a subset of the other. If name A has initial ['A'] and name B has initial ['B'], return `false`! Do NOT treat 'A. Ramesh' and 'B. Ramesh' as aliases!
2. Fix Vulnerability 2 (30-Year Lookback Gap on Root Deed in `detectTitleGaps`):
   - If `spanYears < lookbackYears`: For root deed (`i === 0`), if it is a private conveyance (e.g., Sale Deed, Gift Deed) by a transferor and NOT a sovereign/government root grant (e.g., deedType containing 'Grant', 'Allotment', 'Inam', 'Auction', 'Sovereign', or having no fromParties), emit `TITLE_GAP_MISSING_PREDECESSOR`.
   - Remove the `&& i > 0` condition that unconditionally blocked the root deed from flagging a missing predecessor when the chain is under 30 years.
3. Fix Vulnerability 3 (Extent Over-Conveyance Tracking Across Aliases):
   - In `detectTitleGaps`, cluster party names using `arePartyAliases` so that acquired and conveyed extents are aggregated under a unified canonical entity ID. When checking if conveyed > acquired * 1.01, variations of the same person (e.g. "K. R. Ramesh" and "Ramesh K. R.") must correctly share their acquired balance!
4. Fix Vulnerability 4 (Mortgage Discharge Isolation):
   - In `detectTitleGaps`, ensure a discharge deed only satisfies an active mortgage if it matches the mortgagee/lender, or has overlapping parties / document reference.
5. In `apps/api/test/title-chain.test.ts`:
   - Strengthen the assertion on line 640 from `assert.ok(gaps.length >= 0)` to assert the specific expected gaps.
6. Verification:
   - Run `npx tsx apps/api/test/title-adversarial.stress.ts` and verify 100% of adversarial tests pass!
   - Run `npm test` and verify 100% of test suite passes (0 failures)!
   - Run `npm run typecheck` and `npm run build` and verify 0 errors!
   - Write comprehensive `handoff.md` in your working directory and notify parent.
