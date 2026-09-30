# Milestone 1 Code Review & Adversarial Audit Report

**Agent**: `reviewer_m1_2` (Independent Reviewer & Adversarial Critic)  
**Parent / Caller**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  
**Working Directory**: `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/reviewer_m1_2`  
**Timestamp**: 2026-09-30T15:37:00Z  
**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Automated Build and Test Execution

1. **`npm run typecheck`**:
   ```
   > ojix-property-intelligence@0.1.0 typecheck
   > npm run typecheck -w apps/api && npm run typecheck -w apps/web
   > @ojix/property-api@0.1.0 typecheck
   > tsc --noEmit -p tsconfig.json
   > @ojix/property-web@0.1.0 typecheck
   > tsc --noEmit
   ```
   Result: Exit code 0, 0 type errors across backend and frontend.

2. **`npm run build`**:
   ```
   > ojix-property-intelligence@0.1.0 build
   > npm run build -w apps/api && npm run build -w apps/web
   > @ojix/property-api@0.1.0 build
   > tsc -p tsconfig.json
   > @ojix/property-web@0.1.0 build
   > tsc --noEmit && vite build
   ✓ built in 2.52s
   ```
   Result: Exit code 0, clean build.

3. **`npm test`**:
   ```
   > ojix-property-intelligence@0.1.0 test
   > npm run test -w apps/api
   > tsx --test test/*.test.ts
   ℹ tests 297
   ℹ suites 0
   ℹ pass 297
   ℹ fail 0
   ```
   Result: Exit code 0. However, empirical inspection of test suites revealed that `apps/api/test/challenger-adversarial-extraction.test.ts` had to modify its assertions to assert the *presence* of existing defects (`assert.ok(isBugPresent)`, `assert.throws(..., TypeError)`), rather than failing the build.

---

### 1.2 Verbatim Code Observations & Direct Findings

#### Finding 1: [CRITICAL - SECURITY] Prototype Pollution in Reviewer Overrides Handler
- **Location**: `apps/api/src/server.ts:176-188`, invoked at line 346 & line 360 in `PATCH /api/properties/:id/documents/:docId/fields`.
- **Verbatim Code**:
  ```typescript
  function setNestedValue(obj: any, pathStr: string, value: any): void {
    if (!obj || !pathStr) return;
    const parts = pathStr.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part] || typeof curr[part] !== 'object') {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
  }
  ```
- **Observed Behavior**:
  Calling `setNestedValue(obj, '__proto__.polluted', 'CRITICAL_VULN')` traverses `curr['__proto__']`, directly attaching `.polluted` onto `Object.prototype`.
  Empirically verified in Node.js runtime:
  `({}).polluted === 'CRITICAL_VULN'` evaluates to `true`.
- **Security Impact**: Any authenticated user with write permissions (`writeGuard`) can submit `{ "fieldPath": "__proto__.role", "newValue": "admin" }` or `{ "overrides": { "__proto__.isAdmin": { "newValue": true, "rationale": "exploit" } } }`, modifying runtime objects across ALL tenants in the Express process.

---

#### Finding 2: [CRITICAL - DATA LOSS] Compound Extent Truncation in Document Extractor
- **Location**: `apps/api/src/document-extractor.ts:665`.
- **Verbatim Code**:
  ```typescript
  const extentMatch = rawText.match(/(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*([0-9\s\/\.,\-\w]+?(?:acres?|guntas?|sq\.?\s*ft|sqm|cents?|square\s*feet|sft)\b)/i);
  ```
- **Observed Behavior**:
  Because the character class `[0-9\s\/\.,\-\w]+?` is lazy (`+?`), when presented with standard Karnataka compound extents such as:
  `Extent: 1 Acre 20 Guntas` or `Extent: 3 Acres 10 Guntas`
  The regex immediately terminates at the first unit match `"1 Acre"` or `"3 Acres"`, completely discarding `"20 Guntas"` or `"10 Guntas"`.
- **Impact**: In `apps/api/test/challenger-adversarial-extraction.test.ts:110-121`:
  Document text `'Extent: 1 Acre 20 Guntas'` yields `rawText: '1 Acre'` and `normalizedSqFt: 43560` instead of the statutory `65340` sq ft (a 33.3% loss of recorded land area).

---

#### Finding 3: [HIGH - FUNCTIONAL] Boundary Regex Prematurely Truncates on Initials & Absorbs Leading Colon
- **Location**: `apps/api/src/document-extractor.ts:683-693`.
- **Verbatim Code**:
  ```typescript
  const northMatch = rawText.match(/(?:North\s*by|North\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  if (northMatch && !boundaries.north) boundaries.north = northMatch[1].trim();
  ```
- **Observed Behavior**:
  1. The character class `[^\n;,\.]` excludes period (`.`). When a boundary mentions a person with initials (e.g. `North by: Property of Sri K. R. Ramesh`), the match halts at `Sri K`, yielding `: Property of Sri K`.
  2. If the text has `North by: Main Road`, `(?:North\s*by|North\s*[:.\-])` matches `North by`, and the boundary string captures the colon `: Main Road`.
- **Impact**: Truncated and mangled boundary descriptions directly degrade downstream discrepancy detection in Milestone 4 (`Four-Side Boundary Comparator`).

---

#### Finding 4: [HIGH - UNHANDLED EXCEPTIONS] Unsafe Input Access / Lack of Type Guards
- **Location**: `apps/api/src/document-extractor.ts:53`, `apps/api/src/document-extractor.ts:413`, `apps/api/src/document-extractor.ts:566-574`.
- **Verbatim Code**:
  - Line 53: `const clean = (raw || '').trim();` fails if `raw` is a number (e.g. `{ rawText: 123 }`), throwing `TypeError: raw.trim is not a function`.
  - Line 413: `const cleanName = (name || '').replace(...)` fails if `name` is not a string, throwing `TypeError: name.replace is not a function`.
  - Line 566: Iterating `jsonPayload.parties` without verifying array elements throws `TypeError: Cannot read properties of null` if a party element is `null`.
- **Impact**: Triggers unhandled server 500 errors when clients submit partially typed JSON extraction inputs.

---

#### Finding 5: [HIGH - DOMAIN SPECIFICATION] Missing Native Kannada Unicode Script Support
- **Location**: `apps/api/src/document-extractor.ts:182-252` (`classifyKarnatakaDocument`) and lines 58-125 (`normalizeKarnatakaExtent`).
- **Observed Behavior**:
  The document classifier and extent parser only match English transliterations (`sale deed`, `rtc`, `bhoomi`, `pahani`, `acre`, `gunta`). When given official Kannada script documents:
  `ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ ಭೂಮಿ ಆರ್‌ಟಿಸಿ ನಮೂನೆ ೧೬ ಪಹಣಿ ಪತ್ರಿಕೆ`
  The classifier classifies it as `other` with low confidence (`0.35`). Extent string `'1 ಎಕರೆ 20 ಗುಂಟೆ'` normalizes to `1 sq ft` rather than `65340 sq ft`.
- **Impact**: Fails core requirement R1 for Karnataka land records, which are officially issued in Kannada script via the Bhoomi portal.

---

#### Finding 6: [MEDIUM - SECURITY] Defensive Path Traversal Vulnerability in File Streaming
- **Location**: `apps/api/src/server.ts:238-242`.
- **Verbatim Code**:
  ```typescript
  const doc = docResult.rows[0];
  const filePath = path.join(uploadDir, doc.storage_key);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document file not found on disk.' });
  }
  ```
- **Observed Behavior**: `path.join(uploadDir, doc.storage_key)` does not ensure `path.resolve(filePath).startsWith(uploadDir)`. If `storage_key` in the database contains directory traversal sequences (`../../`), `fs.createReadStream` will stream arbitrary host files.
- **Defensive Fix**: Enforce `path.basename(doc.storage_key)` and assert `filePath.startsWith(uploadDir)`.

---

#### Finding 7: [MEDIUM - ROBUSTNESS] Bounding Box Out-of-Bounds & Token Inversion
- **Location**: `apps/api/src/document-extractor.ts:348-370` (`buildEvidenceAnchor`).
- **Observed Behavior**:
  When external OCR tokens have inverted coordinates (`ymin > ymax` or `xmin > xmax`) or `NaN` coordinates, `buildEvidenceAnchor` propagates them directly into `EvidenceAnchor.boundingBox` instead of normalizing or clamping them into the required `[0.0, 1.0]` range.

---

#### Finding 8: [MINOR - UI ERGONOMICS] Side-by-Side Reviewer Page Navigation Hardcoded
- **Location**: `apps/web/src/components/SideBySideReview.tsx:448-456`.
- **Verbatim Code**:
  ```typescript
  <span>Page {currentPage} of 1</span>
  <button
    className="icon-btn-small"
    onClick={() => setCurrentPage(currentPage + 1)}
    disabled={true}
  >
    <ChevronRight size={16} />
  </button>
  ```
- **Observed Behavior**: Total page count is hardcoded to `1`, and the next page button is permanently `disabled={true}`. In multi-page documents where evidence anchors exist on page > 1, the user cannot click to page forward, and two-way focus jumping sets `currentPage` to 2 while the header confusingly displays `Page 2 of 1`.

---

## 2. Logic Chain

1. **API Security & Tenant Isolation (R1, Feature 22)**:
   - Tenant isolation via `authGuard` and SQL parameterization (`WHERE tenant_id = $X`) was thoroughly verified and found robust against basic SQL injection and tenant ID spoofing.
   - However, `setNestedValue` in `server.ts` allows arbitrary object path traversal. Because JavaScript objects inherit from `Object.prototype`, unvalidated user input containing `__proto__` breaks memory boundary isolation across the entire Node.js runtime process. This directly threatens multi-tenant isolation at the application layer.

2. **Data Integrity & Extent Calculation (R1, Feature 2)**:
   - The primary purpose of the document intelligence pipeline is accurate extraction of property schedule extents.
   - Truncating `"1 Acre 20 Guntas"` to `"1 Acre"` creates an erroneous normalized square footage (`43,560` instead of `65,340`). Downstream in Milestone 4, this defect will cause false positive discrepancy alerts and over-conveyance false alarms.

3. **Adversarial & Multi-Language Robustness (R1, Feature 1)**:
   - Real-world Karnataka revenue documents (RTC/Pahani from Bhoomi, Mutation Registers) frequently use Kannada script. A classifier that labels pure Kannada RTCs as `other` with low confidence fails the domain requirements.
   - The lack of defensive type validation allows malformed JSON extraction requests to trigger uncaught 500 exceptions.

4. **Integrity & Attestation Assessment**:
   - Source code analysis confirmed that `apps/api/src/document-extractor.ts` and `apps/web/src/components/SideBySideReview.tsx` contain genuine implementations with substantial business logic (no dummy facades or hardcoded return stubs).
   - However, the presence of the Prototype Pollution security vulnerability, the critical extent truncation defect, and boundary parsing bugs prevents approval of Milestone 1 in its current form.

---

## 3. Caveats

- The current environment tests file extraction against local disk storage (`./uploads`); cloud object storage (AWS S3 / GCP Cloud Storage) and live Document AI OCR APIs are slated for future deployment phases.
- PostgreSQL PostGIS tests in the test suite execute using the contract oracle test harness and synthetic schemas when a live database is not connected.
- No other caveats.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 1 has successfully established the foundational architecture, types, UI components, and test framework. However, changes are mandatory before Milestone 1 can be certified:

1. **Fix Prototype Pollution**: Update `setNestedValue` in `apps/api/src/server.ts` to explicitly disallow `__proto__`, `constructor`, and `prototype` keys.
2. **Fix Compound Extent Regex**: Update `apps/api/src/document-extractor.ts:665` to capture the complete compound extent string (e.g. `X Acres Y Guntas`) rather than stopping at the first unit match.
3. **Fix Boundary Extraction**: Update boundary regexes in `apps/api/src/document-extractor.ts:683-693` to support personal initials (`.`) and strip any leading punctuation/colons (`:`).
4. **Harden Type Guards**: Add `typeof input === 'string'` guards in `normalizeKarnatakaExtent`, `normalizePersonName`, and array element checks in `extractDocument`.
5. **Add Kannada Script Indicators**: Add Kannada Unicode keywords (`ಭೂಮಿ`, `ಆರ್‌ಟಿಸಿ`, `ಪಹಣಿ`, `ಕಬ್ಜೇದಾರ`, `ಕ್ರಯ ಪತ್ರ`, `ದಾನ ಪತ್ರ`, `ಎಕರೆ`, `ಗುಂಟೆ`) to `classifyKarnatakaDocument` and `normalizeKarnatakaExtent`.
6. **Defensive Path Validation**: Add `path.basename` and `filePath.startsWith(uploadDir)` verification to `GET /file` streaming in `apps/api/src/server.ts:238`.
7. **Sanitize Bounding Boxes**: Ensure `buildEvidenceAnchor` sanitizes inverted coordinates (`ymin > ymax`) and rejects `NaN` values.
8. **Fix UI Page Navigation**: Dynamically calculate total pages from anchors in `apps/web/src/components/SideBySideReview.tsx`.

---

## 5. Verification Method

To verify the remediation of these findings:

1. **Verify Prototype Pollution Fix**:
   ```bash
   node -e "
   const { setNestedValue } = await import('./apps/api/src/server.js'); // or equivalent helper
   const obj = {};
   try { setNestedValue(obj, '__proto__.polluted', true); } catch(e) {}
   console.assert(({}).polluted === undefined, 'Prototype pollution still possible!');
   "
   ```

2. **Verify Compound Extent Parsing**:
   ```bash
   node -e "
   const { extractDocument } = await import('./apps/api/dist/document-extractor.js');
   const res = extractDocument('Absolute Sale Deed Extent: 1 Acre 20 Guntas');
   console.assert(res.propertySchedule.extent.normalizedSqFt === 65340, 'Compound extent calculation failed: ' + res.propertySchedule.extent.normalizedSqFt);
   console.log('Compound extent verified:', res.propertySchedule.extent);
   "
   ```

3. **Verify Boundary Parsing with Initials**:
   ```bash
   node -e "
   const { extractDocument } = await import('./apps/api/dist/document-extractor.js');
   const res = extractDocument('Sale Deed North by: Property of Sri K. R. Ramesh\nSouth by: 40ft Road');
   console.assert(res.propertySchedule.boundaries.north.includes('Sri K. R. Ramesh'), 'Boundary initials truncated: ' + res.propertySchedule.boundaries.north);
   console.assert(!res.propertySchedule.boundaries.north.startsWith(':'), 'Leading colon present');
   console.log('Boundaries verified:', res.propertySchedule.boundaries);
   "
   ```

4. **Run Full Monorepo Test and Typecheck**:
   ```bash
   npm run typecheck
   npm run build
   npm test
   ```
   All test suites, including adversarial stress tests, must exit with code 0.
