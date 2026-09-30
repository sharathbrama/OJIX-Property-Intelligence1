# Milestone 2: Adversarial Challenge & Verification Report

**Evaluator**: `challenger_m2_1` (Empirical Challenger)  
**Target**: Milestone 2 Title Chain & Ownership Graph Engine (`apps/api/src/title-engine.ts`)  
**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Baseline Test Suite Execution
- Executed `npm test` from repository root:
  ```bash
  npm test
  ```
  Result:
  ```text
  ℹ tests 318
  ℹ suites 0
  ℹ pass 318
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 419.4ms
  ```
  All 65 tests in `apps/api/test/title-chain.test.ts` passed.

### 1.2 Empirical Stress-Test Execution (`apps/api/test/title-adversarial.stress.ts`)
Executed the adversarial stress harness across all 4 mandatory challenge dimensions:
```bash
npx tsx apps/api/test/title-adversarial.stress.ts
```
Result summary: **19 tests executed | 14 passed | 5 failed**.

#### Detailed Findings:

#### Observation A — Robust Areas (PASS):
1. **Cyclic Ownership Chains**:
   - `buildTitleDAG` accurately flags cycles `A -> B -> C -> A` (`isAcyclic: false`), self-loops `A -> A` (`isAcyclic: false`), and multiple connected components containing cycles.
2. **Disconnected Title Subgraphs & Single-Node Graphs**:
   - Disconnected deed islands (`A -> B` and `X -> Y`) produce `nodes: 4, edges: 2, isAcyclic: true`.
   - Single grant order deed produces `nodes: 2, edges: 1, isAcyclic: true`. Empty array returns `nodes: 0, isAcyclic: true`.
3. **Compound Honorifics & Transliteration**:
   - Correctly strips compound honorifics `"Late Sri Dr. K. R. Ramesh S/o Late Kadirappa"`.
   - Matches transliterations: `"Gowda"` vs `"Gouda"` (`true`), `"Venkatesh Rao"` vs `"Wenkatesh Rao"` (`true`).
   - Matches valid transpositions: `"Ramesh K R"` vs `"K R Ramesh"` (`true`).
4. **Registration Delays (Section 25)**:
   - Same-day execution and registration: 0 inversion gaps, 0 delay gaps.
   - Exact 120-day registration delay (`2021-01-01` to `2021-05-01`): 0 delay gaps.
   - 121-day registration delay (`2021-01-01` to `2021-05-02`): emits 1 `TITLE_REGISTRATION_DELAY_EXCEEDED` (15 points).
5. **Extent Ratio Boundaries**:
   - Exact 1.00x (100,000 / 100,000 sq ft): 0 over-conveyance gaps.
   - Exact 1.01x (101,000 / 100,000 sq ft, 1% statutory margin): 0 over-conveyance gaps.
   - Exact 1.011x (101,100 / 100,000 sq ft, >1% margin): emits 1 `TITLE_GAP_EXTENT_OVERCONVEYANCE` (35 points).

---

#### Observation B — Critical Failure Modes (FAIL):

#### Vulnerability 1 (CRITICAL): False-Positive Alias Collisions Between Distinct Persons with Different Initials
- **Code Reference**: `apps/api/src/title-engine.ts`, lines 138–140 and line 161:
  ```typescript
  // Line 138-140:
  const canonicalName = normalWords.length > 0 
    ? (parentSpouse ? `${normalWords.join(' ')} (S/O ${parentSpouse.toUpperCase()})` : normalWords.join(' '))
    : rawName.toUpperCase().trim();

  // Line 161:
  if (normA.canonicalName === normB.canonicalName) return true;
  ```
- **Observed Behavior**:
  ```typescript
  arePartyAliases('A. Ramesh', 'B. Ramesh') // => true!
  arePartyAliases('A. B. Ramesh', 'X. Y. Ramesh') // => true!
  ```
  `normalizePartyName` discards all single-letter initials when constructing `canonicalName`. Consequently, `canonicalName` for both `'A. Ramesh'` and `'B. Ramesh'` is `'RAMESH'`. Line 161 matches them as identical aliases.
- **Empirical Consequence in `detectTitleGaps`**:
  If `'A. Ramesh'` buys property in 2000, and a completely unrelated person `'B. Ramesh'` sells it in 2010, `detectTitleGaps` reports:
  ```text
  Gaps detected: []
  ```
  No `TITLE_GAP_MISSING_PREDECESSOR` is raised because the engine treats `B. Ramesh` as having acquired the land under alias `A. Ramesh`.

#### Vulnerability 2 (CRITICAL): Complete Failure to Flag Missing Predecessor on Chains Under 30 Years (e.g., 29.99 Years)
- **Code Reference**: `apps/api/src/title-engine.ts`, lines 311–347:
  ```typescript
  const spanYears = (latestDate.getTime() - earliestDate.getTime()) / (365.25 * 24 * 3600 * 1000);

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (i === 0 && spanYears >= lookbackYears) {
      // First root document is accepted if outside lookback
      continue;
    }

    for (const fp of ev.fromParties) {
      ...
      if (!validAcquisition && i > 0) {  // LINE 337: Condition requires i > 0!
        gaps.push({ code: 'TITLE_GAP_MISSING_PREDECESSOR', ... });
      }
    }
  }
  ```
- **Observed Behavior**:
  When a property chain spans 29.99 years (e.g. `1994-01-10` to `2024-01-01`), or even 2 years (e.g. `2020` to `2022`), `spanYears < lookbackYears` is `true`. The code does not `continue` at line 317. However, when evaluating the transferor of the root instrument (`i = 0`), line 337 explicitly requires `&& i > 0`. Because `0 > 0` is `false`, the root deed is NEVER flagged for missing a registered prior acquisition document.
- **Empirical Consequence in `detectTitleGaps`**:
  A 2-year or 29.99-year recent title chain emits `0` gaps. The mandatory 30-year lookback requirement is completely bypassed.
  In `apps/api/test/title-chain.test.ts` (line 640), the worker masked this defect by asserting:
  ```typescript
  assert.ok(gaps.length >= 0); // Always passes, even with 0 gaps!
  ```

#### Vulnerability 3 (CRITICAL): Extent Over-Conveyance Tracking Completely Blind to Party Name Variations
- **Code Reference**: `apps/api/src/title-engine.ts`, lines 398–425:
  ```typescript
  for (const ev of sorted) {
    for (const tp of ev.toParties) {
      const current = partyExtentAcquired.get(tp.normalizedName) || 0;
      partyExtentAcquired.set(tp.normalizedName, current + ev.extentSqFt);
    }
    for (const fp of ev.fromParties) {
      const current = partyExtentConveyed.get(fp.normalizedName) || 0;
      partyExtentConveyed.set(fp.normalizedName, current + ev.extentSqFt);
    }
  }

  for (const [party, conveyed] of partyExtentConveyed.entries()) {
    const acquired = partyExtentAcquired.get(party) || 0;
    if (acquired > 0 && conveyed > acquired * 1.01) { ... }
  }
  ```
- **Observed Behavior**:
  Acquired and conveyed extents are keyed solely by raw `normalizedName` string equality without alias unification or entity resolution.
  If an owner acquires 10,000 sq ft as `'K. R. Ramesh'` and subsequently conveys 50,000 sq ft (500% over-conveyance) as `'Ramesh K. R.'`:
  - `partyExtentAcquired.get('RAMESH K. R.')` returns `0`.
  - Because `acquired === 0`, `acquired > 0` evaluates to `false`.
  - Result: `TITLE_GAP_EXTENT_OVERCONVEYANCE` is `NOT` flagged!
  - Simultaneously, in `buildTitleDAG`, `'K. R. RAMESH'` and `'RAMESH K. R.'` become two disconnected nodes, shattering the ownership graph.

#### Vulnerability 4 (MEDIUM): Unreleased Mortgage Discharge Masking Across Unrelated Lenders
- **Code Reference**: `apps/api/src/title-engine.ts`, lines 379–394:
  ```typescript
  if (ev.encumbranceStatus === 'active_mortgage') {
    const hasDischarge = sorted.some(subEv =>
      new Date(subEv.eventDate).getTime() > new Date(ev.eventDate).getTime() &&
      subEv.encumbranceStatus === 'discharged'
    );
    if (!hasDischarge) { ... }
  }
  ```
- **Observed Behavior**:
  If a borrower holds Mortgage 1 with Bank A and Mortgage 2 with Bank B, registering a discharge deed for Bank A causes `hasDischarge` to evaluate to `true` for Bank B as well. Bank B's active, undischarged mortgage is masked and receives no warning.

---

## 2. Logic Chain

1. *From Observation B.1*: `normalizePartyName` purges single-character words into `initials` and excludes them from `canonicalName`. In `arePartyAliases`, line 161 performs a short-circuit return of `true` whenever `normA.canonicalName === normB.canonicalName`.
   - *Inference*: Any two individuals sharing the same surname/given name but with opposing patronymics (e.g. `A. Ramesh` vs `B. Ramesh`) evaluate to identical canonical names (`"RAMESH"`), returning `true`.
   - *Inference*: This causes `detectTitleGaps` to treat fraudulent or distinct transfers by strangers as valid intra-family aliases, subverting property provenance.

2. *From Observation B.2*: `detectTitleGaps` calculates `spanYears = (latestDate - earliestDate) / 365.25 days`. If `spanYears < lookbackYears`, the code intends to verify whether the root deed (`i = 0`) has a preceding acquisition document.
   - *Inference*: Because line 337 guards the push to `gaps` with `&& i > 0`, the root event (`i = 0`) is unconditionally prevented from emitting `TITLE_GAP_MISSING_PREDECESSOR`.
   - *Inference*: Consequently, chains spanning 29.99 years, 5 years, or 1 deed are declared 100% gap-free, defeating the statutory 30-year due diligence standard.

3. *From Observation B.3*: Extent tracking maps `partyExtentAcquired` and `partyExtentConveyed` use strict string keys (`normalizedName`).
   - *Inference*: Even minor variations in name representation between deeds (transposed initials, honorific absence) result in different map keys.
   - *Inference*: Over-conveyance detection requires `acquired > 0`. Because the seller's conveyed name key has `acquired = 0`, massive over-conveyances (>500%) are completely overlooked.

---

## 3. Caveats

- Out of scope for this review: Database persistence in `server.ts` and React components (`TitleChainTimeline.tsx`), which depend on the underlying correctness of `title-engine.ts`.
- The current implementation passes all 318 preexisting unit tests, but only because the preexisting tests lacked adversarial edge cases and contained weak assertions (e.g. `assert.ok(gaps.length >= 0)`).

---

## 4. Conclusion & Actionable Verdict

**Final Verdict: `REQUEST_CHANGES`**

The implementation of `title-engine.ts` cannot be approved for production due to high-risk false negatives that directly undermine title security:
1. Two distinct individuals with different patronymic initials are falsely treated as identical aliases.
2. Incomplete title chains spanning less than 30 years (e.g., 29.99 years or 2 years) fail to flag missing predecessors.
3. Extent over-conveyance is bypassed when party names exhibit standard Karnataka alias variations.
4. Active mortgages are falsely cleared by unrelated subsequent discharge deeds.

### Actionable Remediation Required:
1. **Fix Initials Discrimination in `arePartyAliases`**:
   - If both names have initials, ensure that the initials are compatible before returning `true`. If name A has initial `A` and name B has initial `B` (and neither has the other's initials), return `false`.
2. **Fix 30-Year Lookback Gap for Root Instrument in `detectTitleGaps`**:
   - For `i === 0`, if `spanYears < lookbackYears`, raise `TITLE_GAP_MISSING_PREDECESSOR` if `ev.fromParties` does not represent a Sovereign/Government Root Grant (e.g., Grant Order, Inam Abolition Grant, KIADB Allotment).
3. **Unify Extent Tracking Across Aliases in `detectTitleGaps`**:
   - Cluster party names using `arePartyAliases` into canonical entity IDs before computing acquired and conveyed extents.
4. **Isolate Mortgage Discharges by Lender / Party in `detectTitleGaps`**:
   - Ensure a discharge deed only satisfies an active mortgage if the parties or document references match.

---

## 5. Verification Method

To independently reproduce all findings:
1. Run the baseline suite:
   ```bash
   npm test
   ```
   *Expected*: Passes 318/318 tests.
2. Run the empirical adversarial stress test harness:
   ```bash
   npx tsx apps/api/test/title-adversarial.stress.ts
   ```
   *Expected*: Exactly 5 tests fail, reproducing Vulnerabilities 1, 2, 3, and 4 with verbatim failure traces.
