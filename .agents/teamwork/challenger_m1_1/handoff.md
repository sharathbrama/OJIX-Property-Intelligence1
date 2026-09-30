# Milestone 1 Challenger Handoff Report: Adversarial Verification of Document Extractor

**Agent**: `challenger_m1_1` (Empirical Challenger & Adversarial Reviewer)  
**Parent / Caller**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  
**Working Directory**: `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/challenger_m1_1`  
**Timestamp**: 2026-09-30T15:32:00Z  
**Type**: Hard Handoff (Milestone 1 Verification Complete)  
**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

Direct empirical investigation and adversarial execution against `apps/api/src/document-extractor.ts` revealed multiple critical and high-severity defects. Verification was executed using standalone test scripts and `apps/api/test/challenger-adversarial-extraction.test.ts`.

### Bug 1 (Critical): Compound Extent Truncation & Severe Area Understatement
- **File**: `apps/api/src/document-extractor.ts`
- **Line Number**: 665
- **Direct Code Quote**:
  ```typescript
  665: const extentMatch = rawText.match(/(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*([0-9\s\/\.,\-\w]+?(?:acres?|guntas?|sq\.?\s*ft|sqm|cents?|square\s*feet|sft)\b)/i);
  666: if (extentMatch && extentMatch[1]) {
  667:   extent = normalizeKarnatakaExtent(extentMatch[1]);
  668: }
  ```
- **Verbatim Command & Output**:
  ```bash
  npx tsx -e "import('./src/document-extractor.js').then(m => { console.log(m.extractDocument('Absolute Sale Deed Extent: 1 Acre 20 Guntas Sy No 34/2').propertySchedule.extent); })"
  ```
  Result:
  ```json
  { "rawText": "1 Acre", "normalizedSqFt": 43560, "acres": 1 }
  ```
  *Observed defect*: The input clearly specifies `1 Acre 20 Guntas` (statutory standard: $1 \times 43560 + 20 \times 1089 = 65,340 \text{ sq ft}$). The regex on line 665 uses lazy quantifier `+?` followed immediately by `(?:acres?|...)`, halting matching at `"1 Acre"` and discarding `" 20 Guntas"`. The extractor returned $43,560 \text{ sq ft}$ instead of $65,340 \text{ sq ft}$ — a catastrophic 33.3% property area deficit.

### Bug 2 (High): Missing Kannada Unicode Classification for Revenue Documents
- **File**: `apps/api/src/document-extractor.ts`
- **Lines**: 201–252 (`classifyKarnatakaDocument`)
- **Direct Code Quote**:
  ```typescript
  230: rtc_pahani: [
  231:   { pattern: /\b(?:rtc|pahani|form\s*(?:no\.?\s*)?16|bhoomi\s+portal|record\s+of\s+rights)\b/i, weight: 4, label: 'rtc pahani keyword' },
  232:   { pattern: /\b(?:kabzedar|hissa|soil\s+class|kharab|pattadar|tenancy\s+and\s+crops|bhoomi)\b/i, weight: 3, label: 'rtc columns' },
  ...
  ```
- **Verbatim Command & Output**:
  ```bash
  npx tsx -e "import('./src/document-extractor.js').then(m => {
    console.log(m.classifyKarnatakaDocument('ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ\nಭೂಮಿ ಆರ್‌ಟಿಸಿ ನಮೂನೆ ೧೬ ಪಹಣಿ ಪತ್ರಿಕೆ\nದಸ್ತಾವೇಜು ಸಂಖ್ಯೆ: BHM-MR-2022-1045\nಕಬ್ಜೇದಾರ: ಶ್ರೀ ರಾಮಕೃಷ್ಣ'));
  })"
  ```
  Result:
  ```json
  {
    "docType": "other",
    "confidence": 0.35,
    "indicators": [ "default_fallback_unclassified" ]
  }
  ```
  *Observed defect*: Authentic Karnataka Bhoomi RTC/Pahani instruments printed in Kannada script fail classification because `patterns` only contains Latin ASCII words. Keywords such as `ಆರ್‌ಟಿಸಿ` (RTC), `ಪಹಣಿ` (Pahani), `ಭೂಮಿ` (Bhoomi), `ಕಬ್ಜೇದಾರ` (Kabzedar), `ಕ್ರಯ ಪತ್ರ` (Kraya Patra), `ದಾನ ಪತ್ರ` (Dhana Patra), `ಖಾತೆ` (Khata) are completely absent.

### Bug 3 (High): Kannada Land Measurement Units Collapse to 1 Sq Ft
- **File**: `apps/api/src/document-extractor.ts`
- **Lines**: 52–157 (`normalizeKarnatakaExtent`)
- **Verbatim Command & Output**:
  ```bash
  npx tsx -e "import('./src/document-extractor.js').then(m => { console.log(m.normalizeKarnatakaExtent('1 ಎಕರೆ 20 ಗುಂಟೆ')); })"
  ```
  Result:
  ```json
  { "rawText": "1 ಎಕರೆ 20 ಗುಂಟೆ", "normalizedSqFt": 1 }
  ```
  *Observed defect*: `normalizeKarnatakaExtent` does not recognize Kannada unit names `"ಎಕರೆ"` (Acre) and `"ಗುಂಟೆ"` (Gunta). It falls through to the numeric fallback on line 138, capturing the first digit `"1"` and returning `normalizedSqFt: 1` instead of `65,340`.

### Bug 4 (High): Malformed Boundaries with Leading Colons and Premature Initial Truncation
- **File**: `apps/api/src/document-extractor.ts`
- **Lines**: 683–693
- **Direct Code Quote**:
  ```typescript
  683: const northMatch = rawText.match(/(?:North\s*by|North\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  684: if (northMatch && !boundaries.north) boundaries.north = northMatch[1].trim();
  ```
- **Verbatim Command & Output**:
  ```bash
  npx tsx -e "import('./src/document-extractor.js').then(m => {
    console.log(m.extractDocument('Absolute Sale Deed North by: Property of Sri K. R. Ramesh\nSouth by: 40ft Main Road').propertySchedule.boundaries);
  })"
  ```
  Result:
  ```json
  { "north": ": Property of Sri K", "south": ": 40ft Main Road", "east": "", "west": "" }
  ```
  *Observed defects*:
  1. The regex matches `North by` but does not consume the colon `:`. The colon is captured into the boundary value, prepending `": "` to extracted boundaries.
  2. The capture group `([^\n;,\.]{3,100})` explicitly terminates on `\.` (period). Since South Indian party recitals routinely use initials (`Sri K. R. Ramesh`), the boundary string truncates at the first period: `": Property of Sri K"`.

### Bug 5 (Medium / High): Bounding Box Inversion and NaN Propagation from OCR Tokens
- **File**: `apps/api/src/document-extractor.ts`
- **Lines**: 365–370 (`buildEvidenceAnchor`)
- **Direct Code Quote**:
  ```typescript
  365: boundingBox: {
  366:   ymin: Math.max(0, Math.min(1, targetToken.bbox.ymin)),
  367:   xmin: Math.max(0, Math.min(1, targetToken.bbox.xmin)),
  368:   ymax: Math.max(0, Math.min(1, targetToken.bbox.ymax)),
  369:   xmax: Math.max(0, Math.min(1, targetToken.bbox.xmax)),
  370: }
  ```
- **Verbatim Command & Output**:
  ```bash
  npx tsx -e "import('./src/document-extractor.js').then(m => {
    const tokens = [{ text: 'Survey', pageNumber: 1, bbox: { ymin: 0.8, xmin: 0.9, ymax: 0.2, xmax: 0.1 }, confidence: 0.9 }];
    const a = m.buildEvidenceAnchor('Survey', 'Survey 34/2', m.splitIntoPages('Survey 34/2'), tokens, 'doc-1', 0.9);
    console.log(a.boundingBox);
  })"
  ```
  Result:
  ```json
  { "ymin": 0.8, "xmin": 0.9, "ymax": 0.2, "xmax": 0.1 }
  ```
  And with `ymin: NaN`:
  ```json
  { "ymin": NaN, "xmin": 0.1, "ymax": 0.8, "xmax": 0.9 }
  ```
  *Observed defect*: `buildEvidenceAnchor` clamps individual values into $[0.0, 1.0]$, but fails to enforce `ymin <= ymax` and `xmin <= xmax` and fails to guard against `NaN`. This emits inverted/invalid bounding boxes that fail `validateBoundingBox`.

### Bug 6 (High): Uncaught `TypeError` Crashes on Malformed Structured Inputs
- **File**: `apps/api/src/document-extractor.ts`
- **Lines**: 53, 193, 354, 547
- **Verbatim Commands & Errors**:
  1. Extent non-string `rawText`:
     ```bash
     npx tsx -e "import('./src/document-extractor.js').then(m => { m.extractDocument('{\"propertySchedule\": {\"extent\": {\"rawText\": 123}}}'); })"
     ```
     `TypeError: (raw || "").trim is not a function at normalizeKarnatakaExtent (document-extractor.ts:53:29)`
  2. Party numeric `name`:
     ```bash
     npx tsx -e "import('./src/document-extractor.js').then(m => { m.extractDocument('{\"parties\": [{\"name\": 123}]}'); })"
     ```
     `TypeError: name.replace is not a function at normalizePersonName (document-extractor.ts:193:6)`
  3. Empty party object `{}`:
     ```bash
     npx tsx -e "import('./src/document-extractor.js').then(m => { m.extractDocument('{\"parties\": [{}]}'); })"
     ```
     `TypeError: Cannot read properties of undefined (reading 'trim') at buildEvidenceAnchor (document-extractor.ts:354:37)`
  4. Null element in parties array `[null]`:
     ```bash
     npx tsx -e "import('./src/document-extractor.js').then(m => { m.extractDocument('{\"parties\": [null]}'); })"
     ```
     `TypeError: Cannot read properties of null (reading 'name') at extractDocument (document-extractor.ts:547:42)`
  5. Invalid consideration type:
     ```bash
     npx tsx -e "import('./src/document-extractor.js').then(m => { const r = m.extractDocument('{\"documentType\": \"sale_deed\", \"consideration\": \"free\"}'); console.log(r.consideration); })"
     ```
     Returns `"free"` (a string) where `Consideration` interface contract requires `{ amount: number, currency: 'INR' }`.

---

## 2. Logic Chain

1. **Impact of Compound Extent Truncation (Bug 1)**:
   - In Karnataka land conveyance, parcels are predominantly measured in compound units ("1 Acre 20 Guntas").
   - Truncating "20 Guntas" reduces the extracted extent from $65,340 \text{ sq ft}$ to $43,560 \text{ sq ft}$ ($33.3\%$ discrepancy).
   - In Milestone 2 (Title Chain Engine), this false deficit triggers spurious `TITLE_GAP_EXTENT_OVERCONVEYANCE` findings.
   - In Milestone 4 (Discrepancy Engine), comparing a Sale Deed with an RTC will flag massive artificial extent discrepancies.
2. **Impact of Missing Kannada Classifiers and Units (Bugs 2 & 3)**:
   - FRD R1 specifically mandates classification and extraction of Karnataka property documents (RTC/Pahani, Mutation Extract).
   - Real-world Bhoomi RTCs and Mutation Extracts are issued in Kannada.
   - Classifying all pure Kannada RTCs as `other` (0.35 confidence) and normalizing their extent as $1 \text{ sq ft}$ completely undermines the core premise of Karnataka property intelligence.
3. **Impact of Boundary Extraction Bugs (Bug 4)**:
   - Milestone 4 features cross-document 4-side boundary comparison (`Four-Side Boundary Comparator`).
   - Prepending `": "` to strings and truncating names at the first initial (e.g. `": Property of Sri K"`) guarantees that boundary comparisons across instruments will continuously report false mismatches.
4. **Impact of Bounding Box Inversion (Bug 5)**:
   - R1 UI specifies a side-by-side review interface with canvas bounding box overlays.
   - Inverted coordinates (`ymin > ymax`, `xmin > xmax`) cause rendering glitches in the canvas SVG overlay and fail automated evidence appendix verification.
5. **Impact of Uncaught TypeErrors (Bug 6)**:
   - `POST /api/properties/:id/documents` and `POST /api/properties/:id/documents/:docId/extract` directly invoke `extractDocument`.
   - Passing malformed JSON or non-string attributes crashes the Express route handler, returning unhandled 500 errors to clients and threatening API reliability.

---

## 3. Caveats

- Tests were run against direct code exports of `apps/api/src/document-extractor.ts`.
- The existing test suite in `apps/api/test/document-extraction.test.ts` predominantly tested `contract-oracle.ts` (a mock oracle) rather than `apps/api/src/document-extractor.ts`. When `apps/api/src/document-extractor.ts` was tested directly by the worker in lines 586-654 of that file, only a single unit ("1 Acre") was used, leaving the compound extent truncation undetected.
- No caveats regarding reproducibility: all 6 defects are 100% reproducible with standalone commands and recorded in `apps/api/test/challenger-adversarial-extraction.test.ts`.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

Milestone 1 cannot be approved in its current state. The worker (`worker_m1_1`) must remediate the following concrete items in `apps/api/src/document-extractor.ts`:

1. **Fix Compound Extent Regex (Line 665)**:
   Update the extent extractor regex to match compound expressions (e.g. `(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b)\s*(?:and)?\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(?:guntas?|gunta|gts?\b)`) before or in conjunction with single-unit matches, ensuring "1 Acre 20 Guntas" extracts both acres and guntas.
2. **Add Kannada Script Keywords to `classifyKarnatakaDocument` (Lines 219–252)**:
   Include Kannada Unicode patterns:
   - `rtc_pahani`: `/(?:ಆರ್‌ಟಿಸಿ|ಆರ್ ಟಿ ಸಿ|ಪಹಣಿ|ಭೂಮಿ|ಕಬ್ಜೇದಾರ|ನಮೂನೆ\s*೧೬)/i`
   - `sale_deed`: `/(?:ಕ್ರಯ\s*ಪತ್ರ|ಮಾರಾಟ\s*ಪತ್ರ)/i`
   - `gift_deed`: `/(?:ದಾನ\s*ಪತ್ರ|ದಾನಪತ್ರ)/i`
   - `e_khata`: `/(?:ಇ-?ಖಾತಾ|ಇ-?ಆಸ್ತಿ|ಇ-?ಸ್ವತ್ತು|ಖಾತೆ)/i`
   - `mutation_extract`: `/(?:ಮ್ಯುಟೇಶನ್|ಮ್ಯುಟೇಷನ್|ಪೌತಿ\s*ಖಾತೆ|ಮ್ಯುಟೇಶನ್\s*ರಿಜಿಸ್ಟರ್)/i`
3. **Add Kannada Units to `normalizeKarnatakaExtent` (Line 52)**:
   Add patterns for Kannada units:
   - Acres: `(?:ಎಕರೆ|ಎಕ್ರೆ)`
   - Guntas: `(?:ಗುಂಟೆ|ಗುಂಟಾ)`
4. **Fix Boundary Regexes (Lines 683–693)**:
   - Update direction prefixes to match optional trailing colon/whitespace: `/(?:North\s*(?:by|[:.\-])|North)\s*[:.\-]?\s*([^\n;]{3,150})/i`.
   - Strip leading colons/punctuation via `.replace(/^[:.\-\s]+/, '')`.
   - Allow periods `.` within the boundary name to preserve initials (`Sri K. R. Ramesh`).
5. **Sanitize OCR Token Bounding Boxes (Lines 365–370)**:
   In `buildEvidenceAnchor`:
   - Replace `NaN` coordinates with safe fallback defaults.
   - Enforce `ymin = Math.min(y1, y2)` and `ymax = Math.max(y1, y2)` (and similarly for `xmin`, `xmax`) so that `ymin <= ymax` and `xmin <= xmax` are guaranteed.
6. **Add Defensive Type Checking on Structured / JSON Inputs (Lines 53, 193, 354, 547)**:
   - Ensure `clean = typeof raw === 'string' ? raw.trim() : String(raw || '').trim()`.
   - Ensure `normalizePersonName(name)` guards against non-string input (`if (typeof name !== 'string') return ''`).
   - Validate that party objects in `jsonPayload.parties` are non-null objects with a string `name` before invoking `normalizePersonName` and `buildEvidenceAnchor`.
   - Ensure `consideration` is validated to match `{ amount: number, currency: 'INR' }` before assignment.

---

## 5. Verification Method

To verify these defects and confirm future fixes:

1. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   Runs all unit and adversarial tests, including `apps/api/test/challenger-adversarial-extraction.test.ts`.

2. **Verify Compound Extent Extraction**:
   ```bash
   npx tsx -e "import('./apps/api/src/document-extractor.js').then(m => {
     const res = m.extractDocument('Absolute Sale Deed Extent: 1 Acre 20 Guntas Sy No 34/2');
     console.log(res.propertySchedule.extent);
   })"
   ```
   Must output `{ rawText: '1 Acre 20 Guntas', normalizedSqFt: 65340, acres: 1, guntas: 20 }`.

3. **Verify Kannada Document Classification**:
   ```bash
   npx tsx -e "import('./apps/api/src/document-extractor.js').then(m => {
     const res = m.classifyKarnatakaDocument('ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ ಭೂಮಿ ಆರ್‌ಟಿಸಿ ನಮೂನೆ ೧೬ ಪಹಣಿ ಪತ್ರಿಕೆ ಕಬ್ಜೇದಾರ: ಶ್ರೀ ರಾಮಕೃಷ್ಣ');
     console.log(res);
   })"
   ```
   Must classify as `docType: 'rtc_pahani'` with confidence $\ge 0.85$.

4. **Verify Boundary Initials and Colon Formatting**:
   ```bash
   npx tsx -e "import('./apps/api/src/document-extractor.js').then(m => {
     const res = m.extractDocument('Absolute Sale Deed North by: Property of Sri K. R. Ramesh\nSouth by: 40ft Main Road');
     console.log(res.propertySchedule.boundaries);
   })"
   ```
   Must output `{ north: 'Property of Sri K. R. Ramesh', south: '40ft Main Road', ... }` (no leading `:` and no truncation of `Ramesh`).

5. **Verify OCR Token Bounding Box Normalization**:
   ```bash
   npx tsx -e "import('./apps/api/src/document-extractor.js').then(m => {
     const tokens = [{ text: 'Survey', pageNumber: 1, bbox: { ymin: 0.8, xmin: 0.9, ymax: 0.2, xmax: 0.1 }, confidence: 0.9 }];
     const a = m.buildEvidenceAnchor('Survey', 'Survey 34/2', m.splitIntoPages('Survey 34/2'), tokens, 'doc-1', 0.9);
     console.log(a.boundingBox);
   })"
   ```
   Must enforce `ymin <= ymax` and `xmin <= xmax` (e.g. `{ ymin: 0.2, xmin: 0.1, ymax: 0.8, xmax: 0.9 }`).

6. **Verify Non-String JSON Payload Resilience**:
   ```bash
   npx tsx -e "import('./apps/api/src/document-extractor.js').then(m => {
     m.extractDocument('{\"propertySchedule\": {\"extent\": {\"rawText\": 123}}}');
     m.extractDocument('{\"parties\": [null, {\"name\": 123}, {}]}');
     console.log('Passed without crash');
   })"
   ```
   Must complete without throwing uncaught `TypeError` exceptions.
