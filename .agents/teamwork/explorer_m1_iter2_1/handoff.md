# Milestone 1 Iteration 2 Technical Exploration & Remediation Blueprint

**Agent**: `explorer_m1_iter2_1` (Technical Explorer)  
**Parent / Caller**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  
**Working Directory**: `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/explorer_m1_iter2_1`  
**Timestamp**: 2026-09-30T15:36:00Z  
**Type**: Hard Handoff (Investigation & Blueprint Complete)  
**Target File for Remediation**: `apps/api/src/document-extractor.ts` (with auxiliary recommendations for `apps/api/src/server.ts` and `apps/api/test/document-extraction.test.ts`)

---

## Executive Summary

A forensic investigation into `apps/api/src/document-extractor.ts` was conducted to pinpoint the root causes of all 5 defects identified during the Milestone 1 audit, review, and challenge phases. Each defect has been empirically analyzed, reproduced, and provided with exact, drop-in replacement code snippets tested in Node.js runtime. 

1. **Defect 1 (Extent Non-Greediness)**: Lazy quantifier `+?` at line 665 stops at the first unit boundary (`"3 Acres"`), dropping compound units (`"10 Guntas"`). Resolved via structured compound pattern priority.
2. **Defect 2 (Boundary Parsing)**: The negated class `[^\n;,\.]` at lines 683–694 aborts at personal initials (`Sri A. K. Rao`), while the prefix pattern fails to capture the delimiter colon, prepending `": "` to the value. Resolved with a lookahead-delimited capture group and prefix/suffix punctuation stripping.
3. **Defect 3 (Kannada Unicode Support)**: Document classification and extent normalization fail on native Kannada script because patterns were exclusively ASCII English. Note: JavaScript ASCII word boundaries `\b` fail on Unicode characters and must not be used on Kannada words. Resolved by introducing Unicode-flagged regexes covering official Bhoomi and Revenue terminology (`ಆರ್‌ಟಿಸಿ`, `ಪಹಣಿ`, `ಕ್ರಯ ಪತ್ರ`, `ದಾನ ಪತ್ರ`, `ಎಕರೆ`, `ಗುಂಟೆ`).
4. **Defect 4 (Defensive Type Guards)**: Unchecked property access (`(raw || '').trim()`, `name.replace()`, `p.name`, `p.trim()`) causes uncaught `TypeError` exceptions on non-string or null JSON payloads. Resolved with comprehensive `typeof` guards and string coercions.
5. **Defect 5 (OCR Bounding Box Inversion & NaN)**: OCR tokens with inverted coordinates (`ymin > ymax`, `xmin > xmax`) or `NaN` propagate into evidence anchors. Resolved via `Math.min`/`Math.max` ordering, `[0.0, 1.0]` clamping, and `NaN` fallbacks.

---

## 1. Observation

### Observation 1.1: Compound Extent Truncation (Defect 1)
- **Location**: `apps/api/src/document-extractor.ts:665`
- **Verbatim Code**:
  ```typescript
  const extentMatch = rawText.match(/(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*([0-9\s\/\.,\-\w]+?(?:acres?|guntas?|sq\.?\s*ft|sqm|cents?|square\s*feet|sft)\b)/i);
  ```
- **Observed Behavior**:
  For an input such as `'Absolute Sale Deed Extent: 3 Acres 10 Guntas Sy No 34/2'`, the lazy quantifier `[0-9\s\/\.,\-\w]+?` stops at the earliest point satisfying `(?:acres?|guntas?|...)`, which is `"3 Acres"`.
  `extentMatch[1]` receives `"3 Acres"`. The tail `" 10 Guntas"` is discarded.
  `normalizeKarnatakaExtent("3 Acres")` returns `acres: 3, guntas: undefined, normalizedSqFt: 130680`.
  The actual statutory land extent ($3 \times 43,560 + 10 \times 1,089 = 141,570 \text{ sq ft}$) is understated by $10,890 \text{ sq ft}$ (a 7.7% area loss).

### Observation 1.2: Boundary Initials Truncation & Colon Ingestion (Defect 2)
- **Location**: `apps/api/src/document-extractor.ts:683-694`
- **Verbatim Code**:
  ```typescript
  const northMatch = rawText.match(/(?:North\s*by|North\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  if (northMatch && !boundaries.north) boundaries.north = northMatch[1].trim();
  ```
- **Observed Behavior**:
  1. For text `'North by: Property of Sri A. K. Rao\nSouth by: 40ft Main Road'`, `North\s*by` matches `'North by'`, `\s*` matches nothing (next char is `:`), so the capture group `([^\n;,\.]{3,100})` begins with `:`.
  2. The character class `[^\n;,\.]` excludes period `\.`. When parsing initials (`A. K. Rao`), the capture group stops at `A.`, yielding `': Property of Sri A'`. Both the leading colon is captured and the name is truncated.

### Observation 1.3: Document Classifier & Unit Normalizer Lack Kannada Script (Defect 3)
- **Location**: `apps/api/src/document-extractor.ts:219-252` and `lines 52-157`
- **Verbatim Code**:
  `patterns` in `classifyKarnatakaDocument` contains only English terms:
  ```typescript
  rtc_pahani: [
    { pattern: /\b(?:rtc|pahani|form\s*(?:no\.?\s*)?16|bhoomi\s+portal|record\s+of\s+rights)\b/i, weight: 4, label: 'rtc pahani keyword' },
    ...
  ]
  ```
  `normalizeKarnatakaExtent` matches only ASCII unit names:
  ```typescript
  const acreGuntaMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b)\s*(?:and)?\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(?:guntas?|gunta|gts?\b)/i);
  ```
- **Observed Behavior**:
  1. Pure Kannada document `'ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ ಭೂಮಿ ಆರ್‌ಟಿಸಿ ನಮೂನೆ ೧೬ ಪಹಣಿ ಪತ್ರಿಕೆ'` yields `docType: 'other', confidence: 0.35, indicators: ['default_fallback_unclassified']`.
  2. Kannada extent string `'1 ಎಕರೆ 20 ಗುಂಟೆ'` falls through all unit parsers to line 138 (`clean.replace(/,/g, '').match(/\d+(?:\.\d+)?/)`), which captures `"1"`, returning `normalizedSqFt: 1` instead of `65340`.
  3. **Critical JS Engine Nuance**: When attempting Unicode matching in JS, using ASCII `\b` (`/\bಆರ್‌ಟಿಸಿ\b/iu`) evaluates to `false` because Kannada characters are not recognized as ASCII word characters `\w`. Word boundaries around Kannada characters prevent matching.

### Observation 1.4: Uncaught `TypeError` Crashes on Malformed Payloads (Defect 4)
- **Location**: `apps/api/src/document-extractor.ts:53, 191-196, 354, 545-554, 717-730`
- **Verbatim Code**:
  - Line 53: `const clean = (raw || '').trim();` fails when `raw = 123` (`TypeError: (raw || "").trim is not a function`).
  - Line 193: `name.replace(...)` fails when `name = 123` (`TypeError: name.replace is not a function`).
  - Line 354: `matchSnippet.trim()` fails when `matchSnippet = undefined` (`TypeError: Cannot read properties of undefined (reading 'trim')`).
  - Line 547: `jsonPayload.parties` iteration accesses `p.name` directly on `[null]` (`TypeError: Cannot read properties of null (reading 'name')`).
  - Line 718: `consideration` assignment accepts `{ consideration: 'free' }`, bypassing the `{ amount: number, currency: 'INR' }` contract.

### Observation 1.5: Inverted OCR Coordinates & NaN Propagation (Defect 5)
- **Location**: `apps/api/src/document-extractor.ts:365-370`
- **Verbatim Code**:
  ```typescript
  boundingBox: {
    ymin: Math.max(0, Math.min(1, targetToken.bbox.ymin)),
    xmin: Math.max(0, Math.min(1, targetToken.bbox.xmin)),
    ymax: Math.max(0, Math.min(1, targetToken.bbox.ymax)),
    xmax: Math.max(0, Math.min(1, targetToken.bbox.xmax)),
  }
  ```
- **Observed Behavior**:
  When external OCR supplies inverted coordinates (e.g. `ymin: 0.8, ymax: 0.2` or `xmin: 0.9, xmax: 0.1`), the current code clamps each coordinate independently, producing `{ ymin: 0.8, xmin: 0.9, ymax: 0.2, xmax: 0.1 }` where `ymin > ymax` and `xmin > xmax`.
  When coordinates are `NaN`, `Math.max(0, Math.min(1, NaN))` returns `NaN`, emitting invalid numbers into the evidence anchor.

### Observation 1.6: Auxiliary Reviewer Findings (Parties & Server Security)
- **Parties with Initials & Relationship Corruption (`document-extractor.ts:558-565`)**:
  `sellerRegexes[0]` contains `(?:,|\.|\n|residing|aged|PAN)`. The `\.` causes `'Vendor: Sri K. R. Ramesh S/o Kadirappa'` to terminate at `K.`, leaving `m[1] = 'K'`, failing the `> 2` length check, and dropping the vendor entirely. Additionally, lines 565 and 595 hardcode `S/o`, corrupting `W/o` and `D/o` relationships.
- **Prototype Pollution (`apps/api/src/server.ts:176-188`)**:
  `setNestedValue` allows `__proto__`, permitting prototype pollution via `PATCH /api/properties/:id/documents/:docId/fields`.

---

## 2. Logic Chain

1. **Acceptance Criteria & Integrity Link**:
   `ORIGINAL_REQUEST.md` line 30 mandates:
   > *"Comprehensive unit and integration test suite covering document field extraction, title gap detection, unit conversions, and spatial buffer rules passes with 100% success (`npm test`)."*
   When genuine adversarial tests are run without mock oracles, the 5 defects in `apps/api/src/document-extractor.ts` cause immediate test failures and uncaught exceptions.

2. **Downstream Milestone Cascading Impact**:
   - **Milestone 2 (Title Chain)**: If compound extents are truncated (Observation 1.1) and vendors with initials are dropped (Observation 1.6), the title DAG cannot connect predecessor deeds, generating false `TITLE_GAP_EXTENT_OVERCONVEYANCE` and `TITLE_GAP_MISSING_PREDECESSOR` errors.
   - **Milestone 4 (Discrepancy Engine)**: Truncated boundaries (Observation 1.2) cause spurious boundary discrepancy flags. Kannada extents collapsing to $1 \text{ sq ft}$ (Observation 1.3) cause massive artificial discrepancy findings.
   - **Milestone 5 (PDF Reports & Evidence Appendix)**: Inverted bounding boxes and `NaN` coordinates (Observation 1.5) break SVG canvas overlays and corrupt PDF evidence coordinates.
   - **API Stability**: Lack of defensive type guards (Observation 1.4) causes uncaught 500 crashes during batch document processing.

3. **Technical Correctness of Proposed Solutions**:
   - Structuring the extent regex to prioritize compound expressions (`\d+\s*acres?\s*(?:and\s+)?\d+\s*guntas?`) guarantees both units are captured before single-unit matchers fire.
   - Replacing `[^\n;,\.]` with a lookahead-delimited capture group `([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:South|East|West|North)\s*(?:by|[:.\-])|[;\n]|$))` allows internal initials with dots while properly halting at the next boundary recital or line break.
   - Adding Unicode patterns without `\b` enables exact recognition of official Kannada documents.
   - Enforcing `ymin = Math.min(y1, y2)` and `ymax = Math.max(y1, y2)` with `NaN` defaults guarantees strict bounding box validity.
   - Applying `typeof === 'string'` guards guarantees zero uncaught `TypeError` crashes on malformed JSON.

---

## 3. Caveats

- **Scope Boundary**: This report provides analysis, regex replacements, and architectural guidance. In accordance with explorer agent constraints, no implementation changes have been written directly to `apps/api/src/` or `apps/api/test/`.
- **Cloud vs Local OCR**: Bounding box anchors in this iteration are generated from simulated/tokenized OCR inputs. Integration with external cloud OCR endpoints (Google Cloud Document AI / AWS Textract) is handled at higher ingestion layers; the coordinate clamping logic formulated here is fully compatible with any normalized OCR output.
- No other caveats.

---

## 4. Conclusion & Exact Fix Plan

The implementation worker (`worker_m1_iter2_1`) should apply the following precise, drop-in modifications to `apps/api/src/document-extractor.ts`.

### Remediation Blueprint 1: Extent Parsing Regex (Defects 1 & 3)

#### Target 1A: `apps/api/src/document-extractor.ts` (Lines 664–673)
Replace lines 664–673:
```typescript
<<<< BEFORE
    // Look for extent in raw text
    const extentMatch = rawText.match(/(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*([0-9\s\/\.,\-\w]+?(?:acres?|guntas?|sq\.?\s*ft|sqm|cents?|square\s*feet|sft)\b)/i);
    if (extentMatch && extentMatch[1]) {
      extent = normalizeKarnatakaExtent(extentMatch[1]);
    } else {
      // Search for standalone extent patterns
      const standalone = rawText.match(/(\d+\s*(?:acres?|ac)\s*(?:and)?\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gt)|\d+\s*[-–]\s*\d+\s*(?:guntas?|gt)|\d+[\d,]*\s*(?:sq\.?\s*ft|square\s*feet|sft))/i);
      extent = standalone ? normalizeKarnatakaExtent(standalone[0]) : { rawText: '', normalizedSqFt: 0 };
    }
====
>>>> AFTER
    // Look for extent in raw text with compound unit priority and Kannada support
    const extentPattern = /(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*((?:\d+(?:\.\d+)?\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)(?:\s*(?:and\s+)?\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ))?|\d+\s*[-–]\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?|\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)\b|\d+(?:\.\d+)?\s*(?:cents?|cent\b)|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b|\d+(?:\.\d+)?\s*(?:ft|feet)?\s*[xX*×]\s*\d+(?:\.\d+)?\s*(?:ft|feet)?|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b))/i;
    const extentMatch = rawText.match(extentPattern);
    if (extentMatch && extentMatch[1]) {
      extent = normalizeKarnatakaExtent(extentMatch[1]);
    } else {
      // Search for standalone extent patterns
      const standalonePattern = /((?:\d+(?:\.\d+)?\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)(?:\s*(?:and\s+)?\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ))?|\d+\s*[-–]\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?|\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)\b|\d+(?:\.\d+)?\s*(?:cents?|cent\b)|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b|\d+(?:\.\d+)?\s*(?:ft|feet)?\s*[xX*×]\s*\d+(?:\.\d+)?\s*(?:ft|feet)?|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b))/i;
      const standalone = rawText.match(standalonePattern);
      extent = standalone ? normalizeKarnatakaExtent(standalone[0]) : { rawText: '', normalizedSqFt: 0 };
    }
<<<<
```

#### Target 1B: `normalizeKarnatakaExtent` in `apps/api/src/document-extractor.ts` (Lines 52–95)
Update `normalizeKarnatakaExtent` to recognize Kannada units (`ಎಕರೆ`, `ಗುಂಟೆ`):
```typescript
<<<< BEFORE
  // 1. Check for compound Acre and Gunta: e.g. "1 Acre 15 Guntas", "2 Acres 5 1/2 Guntas", "1 Ac 10 Gts"
  const acreGuntaMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b)\s*(?:and)?\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(?:guntas?|gunta|gts?\b)/i);
  if (acreGuntaMatch) {
    acres = parseFloat(acreGuntaMatch[1]);
    guntas = parseFractionOrDecimal(acreGuntaMatch[2]);
    hasParsed = true;
  } else {
    // 2. Check for Acre only: e.g. "2 Acres", "1.5 Acre"
    const acreOnlyMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b)/i);
    if (acreOnlyMatch) {
      acres = parseFloat(acreOnlyMatch[1]);
      hasParsed = true;
    }

    // 3. Check for Gunta only or Hyphenated Gunta format: e.g. "0-30 Guntas", "38 Guntas", "25 Gts", "0 - 15 Guntas"
    const hyphenGuntaMatch = clean.match(/(\d+)\s*[-–]\s*(\d+(?:\s+\d+\/\d+|\.\d+)?)\s*(?:guntas?|gunta|gts?\b)?/i);
    const guntaOnlyMatch = clean.match(/(?:^|\s)(\d+(?:\s+\d+\/\d+|\.\d+)?)\s*(?:guntas?|gunta|gts?\b)/i);

    if (hyphenGuntaMatch && (clean.toLowerCase().includes('gunta') || clean.toLowerCase().includes('gt') || hyphenGuntaMatch[1] === '0')) {
====
>>>> AFTER
  // 1. Check for compound Acre and Gunta (English & Kannada): e.g. "1 Acre 15 Guntas", "1 ಎಕರೆ 20 ಗುಂಟೆ"
  const acreGuntaMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)\s*(?:and)?\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)/i);
  if (acreGuntaMatch) {
    acres = parseFloat(acreGuntaMatch[1]);
    guntas = parseFractionOrDecimal(acreGuntaMatch[2]);
    hasParsed = true;
  } else {
    // 2. Check for Acre only (English & Kannada): e.g. "2 Acres", "2 ಎಕರೆ"
    const acreOnlyMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)/i);
    if (acreOnlyMatch) {
      acres = parseFloat(acreOnlyMatch[1]);
      hasParsed = true;
    }

    // 3. Check for Gunta only or Hyphenated Gunta format: e.g. "0-30 Guntas", "30 ಗುಂಟೆ"
    const hyphenGuntaMatch = clean.match(/(\d+)\s*[-–]\s*(\d+(?:\s+\d+\/\d+|\.\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?/i);
    const guntaOnlyMatch = clean.match(/(?:^|\s)(\d+(?:\s+\d+\/\d+|\.\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)/i);

    if (hyphenGuntaMatch && (clean.toLowerCase().includes('gunta') || clean.toLowerCase().includes('gt') || clean.includes('ಗುಂಟೆ') || clean.includes('ಗುಂಟಾ') || hyphenGuntaMatch[1] === '0')) {
<<<<
```

---

### Remediation Blueprint 2: Boundary Parsing Regex (Defect 2)

#### Target 2: `apps/api/src/document-extractor.ts` (Lines 682–694)
Replace boundary parsing to preserve initials, prevent prefix colon capture, and strip trailing punctuation:
```typescript
<<<< BEFORE
  const northMatch = rawText.match(/(?:North\s*by|North\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  if (northMatch && !boundaries.north) boundaries.north = northMatch[1].trim();

  const southMatch = rawText.match(/(?:South\s*by|South\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  if (southMatch && !boundaries.south) boundaries.south = southMatch[1].trim();

  const eastMatch = rawText.match(/(?:East\s*by|East\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  if (eastMatch && !boundaries.east) boundaries.east = eastMatch[1].trim();

  const westMatch = rawText.match(/(?:West\s*by|West\s*[:.\-])\s*([^\n;,\.]{3,100})/i);
  if (westMatch && !boundaries.west) boundaries.west = westMatch[1].trim();
====
>>>> AFTER
  const northMatch = rawText.match(/(?:(?:On\s+the\s+)?North(?:\s+side)?\s*(?:by|is)?|North)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:South|East|West|North)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (northMatch && !boundaries.north) {
    boundaries.north = northMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const southMatch = rawText.match(/(?:(?:On\s+the\s+)?South(?:\s+side)?\s*(?:by|is)?|South)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|East|West|South)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (southMatch && !boundaries.south) {
    boundaries.south = southMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const eastMatch = rawText.match(/(?:(?:On\s+the\s+)?East(?:\s+side)?\s*(?:by|is)?|East)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|South|West|East)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (eastMatch && !boundaries.east) {
    boundaries.east = eastMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const westMatch = rawText.match(/(?:(?:On\s+the\s+)?West(?:\s+side)?\s*(?:by|is)?|West)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|South|East|West)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (westMatch && !boundaries.west) {
    boundaries.west = westMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }
<<<<
```

---

### Remediation Blueprint 3: Kannada Script Classification (Defect 3)

#### Target 3: `classifyKarnatakaDocument` in `apps/api/src/document-extractor.ts` (Lines 219–252)
Add Kannada patterns without `\b` word boundary operators:
```typescript
<<<< BEFORE
  const patterns: Record<KarnatakaDocumentType, Array<{ pattern: RegExp; weight: number; label: string }>> = {
    sale_deed: [
      { pattern: /\b(?:absolute\s+sale\s+deed|deed\s+of\s+sale|sale\s+deed|kraya\s*patra)\b/i, weight: 4, label: 'sale deed keyword' },
      { pattern: /\b(?:vendor|purchaser|sale\s+consideration|schedule\s+property|conveyance)\b/i, weight: 2, label: 'conveyance terms' },
      { pattern: /\b(?:sub-registrar|registration\s+act|kaveri)\b/i, weight: 1, label: 'registration reference' },
    ],
    gift_deed: [
      { pattern: /\b(?:gift\s+deed|deed\s+of\s+gift|dhana\s*patra|dhanapatra|settlement\s+deed)\b/i, weight: 4, label: 'gift deed keyword' },
      { pattern: /\b(?:donor|donee|natural\s+love\s+and\s+affection|without\s+any\s+monetary\s+consideration)\b/i, weight: 3, label: 'gift terms' },
    ],
    rtc_pahani: [
      { pattern: /\b(?:rtc|pahani|form\s*(?:no\.?\s*)?16|bhoomi\s+portal|record\s+of\s+rights)\b/i, weight: 4, label: 'rtc pahani keyword' },
      { pattern: /\b(?:kabzedar|hissa|soil\s+class|kharab|pattadar|tenancy\s+and\s+crops|bhoomi)\b/i, weight: 3, label: 'rtc columns' },
      { pattern: /\b(?:tahsildar|village\s+accountant|revenue\s+inspector)\b/i, weight: 1, label: 'revenue authorities' },
    ],
    encumbrance_certificate: [
      { pattern: /\b(?:encumbrance\s+certificate|certificate\s+of\s+encumbrance|nil\s+encumbrance|form\s*(?:no\.?\s*)?15|form\s*(?:no\.?\s*)?16)\b/i, weight: 4, label: 'ec keyword' },
      { pattern: /\b(?:statement\s+of\s+encumbrance|search\s+period|no\s+encumbrance\s+found|mortgage|charge)\b/i, weight: 3, label: 'ec schedule' },
      { pattern: /\b(?:sro|kaveri|department\s+of\s+stamps)\b/i, weight: 1, label: 'sro stamps' },
    ],
    e_khata: [
      { pattern: /\b(?:e-?khata|e-?aasthi|aasthi|e-?swathu|eswathu|form\s*(?:no\.?\s*)?3|form\s*(?:no\.?\s*)?9|form\s*(?:no\.?\s*)?11)\b/i, weight: 4, label: 'khata keyword' },
      { pattern: /\b(?:property\s+tax|bbmp|bruhat\s+bengaluru|panchayat|khata\s+certificate|khata\s+extract|pid\s+no)\b/i, weight: 3, label: 'khata terms' },
      { pattern: /\b(?:assessment\s+register|sas\s+base|annual\s+rateable\s+value)\b/i, weight: 2, label: 'tax assessment' },
    ],
    mutation_extract: [
      { pattern: /\b(?:mutation\s+extract|mutation\s+register|m\.?r\.?\s*(?:extract|register|no)|form\s*(?:no\.?\s*)?12)\b/i, weight: 4, label: 'mutation keyword' },
      { pattern: /\b(?:bhoomi\s+mutation|mutation\s+order|j-slip|pauti|inheritance|inheritance\s+khata)\b/i, weight: 3, label: 'mutation terms' },
      { pattern: /\b(?:certified\s+by\s+tahsildar|sheristedar|deputy\s+tahsildar)\b/i, weight: 2, label: 'revenue certification' },
    ],
    other: [
      { pattern: /\b(?:general\s+power\s+of\s+attorney|gpa|affidavit|conversion\s+order|akarband|tippani)\b/i, weight: 2, label: 'ancillary legal document' },
    ],
  };
====
>>>> AFTER
  const patterns: Record<KarnatakaDocumentType, Array<{ pattern: RegExp; weight: number; label: string }>> = {
    sale_deed: [
      { pattern: /\b(?:absolute\s+sale\s+deed|deed\s+of\s+sale|sale\s+deed|kraya\s*patra)\b/i, weight: 4, label: 'sale deed keyword' },
      { pattern: /(?:ಕ್ರಯ\s*ಪತ್ರ|ಕ್ರಯಪತ್ರ|ಮಾರಾಟ\s*ಪತ್ರ|ಮಾರಾಟಪತ್ರ)/iu, weight: 4, label: 'kannada sale deed keyword' },
      { pattern: /\b(?:vendor|purchaser|sale\s+consideration|schedule\s+property|conveyance)\b/i, weight: 2, label: 'conveyance terms' },
      { pattern: /(?:ಖರೀದಿದಾರ|ಮಾರಾಟಗಾರ|ಪ್ರತಿಫಲ)/iu, weight: 2, label: 'kannada conveyance terms' },
      { pattern: /\b(?:sub-registrar|registration\s+act|kaveri)\b/i, weight: 1, label: 'registration reference' },
    ],
    gift_deed: [
      { pattern: /\b(?:gift\s+deed|deed\s+of\s+gift|dhana\s*patra|dhanapatra|settlement\s+deed)\b/i, weight: 4, label: 'gift deed keyword' },
      { pattern: /(?:ದಾನ\s*ಪತ್ರ|ದಾನಪತ್ರ|ದಾನದ\s*ಪತ್ರ|ಉಡುಗೊರೆ\s*ಪತ್ರ)/iu, weight: 4, label: 'kannada gift deed keyword' },
      { pattern: /\b(?:donor|donee|natural\s+love\s+and\s+affection|without\s+any\s+monetary\s+consideration)\b/i, weight: 3, label: 'gift terms' },
    ],
    rtc_pahani: [
      { pattern: /\b(?:rtc|pahani|form\s*(?:no\.?\s*)?16|bhoomi\s+portal|record\s+of\s+rights)\b/i, weight: 4, label: 'rtc pahani keyword' },
      { pattern: /(?:ಆರ್‌ಟಿಸಿ|ಆರ್\s*ಟಿ\s*ಸಿ|ಪಹಣಿ|ಪಹಣಿ\s*ಪತ್ರಿಕೆ|ಭೂಮಿ|ಕಬ್ಜೇದಾರ|ನಮೂನೆ\s*೧೬|ಹಕ್ಕು\s*ದಾಖಲೆ)/iu, weight: 4, label: 'kannada rtc keyword' },
      { pattern: /\b(?:kabzedar|hissa|soil\s+class|kharab|pattadar|tenancy\s+and\s+crops|bhoomi)\b/i, weight: 3, label: 'rtc columns' },
      { pattern: /\b(?:tahsildar|village\s+accountant|revenue\s+inspector)\b/i, weight: 1, label: 'revenue authorities' },
      { pattern: /(?:ತಹಶೀಲ್ದಾರ್|ಗ್ರಾಮ\s*ಲೆಕ್ಕಿಗ|ಕಂದಾಯ\s*ನಿರೀಕ್ಷಕ)/iu, weight: 1, label: 'kannada revenue authorities' },
    ],
    encumbrance_certificate: [
      { pattern: /\b(?:encumbrance\s+certificate|certificate\s+of\s+encumbrance|nil\s+encumbrance|form\s*(?:no\.?\s*)?15|form\s*(?:no\.?\s*)?16)\b/i, weight: 4, label: 'ec keyword' },
      { pattern: /(?:ಭಾರ\s*ಪ್ರಮಾಣ\s*ಪತ್ರ|ಋಣ\s*ಭಾರ|ನಮೂನೆ\s*೧೫|ಎನ್‌ಕಂಬರೆನ್ಸ್)/iu, weight: 4, label: 'kannada ec keyword' },
      { pattern: /\b(?:statement\s+of\s+encumbrance|search\s+period|no\s+encumbrance\s+found|mortgage|charge)\b/i, weight: 3, label: 'ec schedule' },
      { pattern: /\b(?:sro|kaveri|department\s+of\s+stamps)\b/i, weight: 1, label: 'sro stamps' },
    ],
    e_khata: [
      { pattern: /\b(?:e-?khata|e-?aasthi|aasthi|e-?swathu|eswathu|form\s*(?:no\.?\s*)?3|form\s*(?:no\.?\s*)?9|form\s*(?:no\.?\s*)?11)\b/i, weight: 4, label: 'khata keyword' },
      { pattern: /(?:ಇ-?ಖಾತಾ|ಇ-?ಆಸ್ತಿ|ಇ-?ಸ್ವತ್ತು|ಖಾತೆ|ಖಾತಾ\s*ಪ್ರಮಾಣ\s*ಪತ್ರ|ನಮೂನೆ\s*೩|ನಮೂನೆ\s*೯|ನಮೂನೆ\s*೧೧)/iu, weight: 4, label: 'kannada khata keyword' },
      { pattern: /\b(?:property\s+tax|bbmp|bruhat\s+bengaluru|panchayat|khata\s+certificate|khata\s+extract|pid\s+no)\b/i, weight: 3, label: 'khata terms' },
      { pattern: /\b(?:assessment\s+register|sas\s+base|annual\s+rateable\s+value)\b/i, weight: 2, label: 'tax assessment' },
    ],
    mutation_extract: [
      { pattern: /\b(?:mutation\s+extract|mutation\s+register|m\.?r\.?\s*(?:extract|register|no)|form\s*(?:no\.?\s*)?12)\b/i, weight: 4, label: 'mutation keyword' },
      { pattern: /(?:ಮ್ಯುಟೇಶನ್|ಮ್ಯುಟೇಷನ್|ಪೌತಿ\s*ಖಾತೆ|ಮ್ಯುಟೇಶನ್\s*ರಿಜಿಸ್ಟರ್|ನಮೂನೆ\s*೧೨)/iu, weight: 4, label: 'kannada mutation keyword' },
      { pattern: /\b(?:bhoomi\s+mutation|mutation\s+order|j-slip|pauti|inheritance|inheritance\s+khata)\b/i, weight: 3, label: 'mutation terms' },
      { pattern: /\b(?:certified\s+by\s+tahsildar|sheristedar|deputy\s+tahsildar)\b/i, weight: 2, label: 'revenue certification' },
    ],
    other: [
      { pattern: /\b(?:general\s+power\s+of\s+attorney|gpa|affidavit|conversion\s+order|akarband|tippani)\b/i, weight: 2, label: 'ancillary legal document' },
      { pattern: /(?:ಅಫಿಡವಿಟ್|ಜಿಪಿಎ|ಪವರ್\s*ಆಫ್\s*ಅಟಾರ್ನಿ|ಆಕಾರಬಂಧು|ಟಿಪ್ಪಣಿ)/iu, weight: 2, label: 'kannada ancillary document' },
    ],
  };
<<<<
```

---

### Remediation Blueprint 4: Defensive Type Guards (Defect 4)

#### Target 4A: `normalizeKarnatakaExtent` (Line 52)
```typescript
<<<< BEFORE
export function normalizeKarnatakaExtent(raw: string): PropertyExtent {
  const clean = (raw || '').trim();
====
>>>> AFTER
export function normalizeKarnatakaExtent(raw: string | any): PropertyExtent {
  const clean = typeof raw === 'string' ? raw.trim() : (raw !== null && raw !== undefined ? String(raw).trim() : '');
<<<<
```

#### Target 4B: `normalizePersonName` (Line 190)
```typescript
<<<< BEFORE
export function normalizePersonName(name: string): string {
  if (!name) return '';
  return name
    .replace(/^(?:sri|srimathi|smt|mr|mrs|ms|dr|late|master)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
====
>>>> AFTER
export function normalizePersonName(name: string | any): string {
  if (typeof name !== 'string') {
    if (name === null || name === undefined) return '';
    name = String(name);
  }
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^(?:sri|srimathi|smt|mr|mrs|ms|dr|late|master)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
<<<<
```

#### Target 4C: `buildEvidenceAnchor` (Line 346)
```typescript
<<<< BEFORE
export function buildEvidenceAnchor(
  matchSnippet: string,
  fullText: string,
  pages: Array<{ pageNumber: number; text: string; startChar: number }>,
  tokens: OCRToken[] | undefined,
  documentId: string,
  confidence: number
): EvidenceAnchor {
  const cleanSnippet = matchSnippet.trim().slice(0, 150);
====
>>>> AFTER
export function buildEvidenceAnchor(
  matchSnippet: string | any,
  fullText: string | any,
  pages: Array<{ pageNumber: number; text: string; startChar: number }>,
  tokens: OCRToken[] | undefined,
  documentId: string,
  confidence: number
): EvidenceAnchor {
  const safeSnippet = typeof matchSnippet === 'string' ? matchSnippet : (matchSnippet !== null && matchSnippet !== undefined ? String(matchSnippet) : '');
  const safeFullText = typeof fullText === 'string' ? fullText : (fullText !== null && fullText !== undefined ? String(fullText) : '');
  const cleanSnippet = safeSnippet.trim().slice(0, 150);
<<<<
```

#### Target 4D: `extractDocument` Parties Loop (Line 545)
```typescript
<<<< BEFORE
  const parties: ExtractedParty[] = [];
  if (jsonPayload?.parties && Array.isArray(jsonPayload.parties) && jsonPayload.parties.length > 0) {
    for (const p of jsonPayload.parties) {
      const norm = normalizePersonName(p.name);
      parties.push({
        ...p,
        normalizedName: p.normalizedName || norm,
        evidenceAnchor: p.evidenceAnchor || buildEvidenceAnchor(p.name, rawText, pages, tokens, documentId, 0.88),
      });
    }
  }
====
>>>> AFTER
  const parties: ExtractedParty[] = [];
  if (jsonPayload?.parties && Array.isArray(jsonPayload.parties) && jsonPayload.parties.length > 0) {
    for (const p of jsonPayload.parties) {
      if (!p || typeof p !== 'object') continue;
      const pName = typeof p.name === 'string' ? p.name.trim() : (p.name !== null && p.name !== undefined ? String(p.name).trim() : '');
      if (!pName) continue;
      const norm = normalizePersonName(pName);
      parties.push({
        ...p,
        name: pName,
        normalizedName: (typeof p.normalizedName === 'string' && p.normalizedName) ? p.normalizedName : norm,
        role: typeof p.role === 'string' ? p.role : 'party',
        relationship: typeof p.relationship === 'string' ? p.relationship : undefined,
        evidenceAnchor: p.evidenceAnchor || buildEvidenceAnchor(pName, rawText, pages, tokens, documentId, 0.88),
      });
    }
  }
<<<<
```

#### Target 4E: `extractDocument` Consideration Type Validation (Lines 717–730)
```typescript
<<<< BEFORE
  let consideration: Consideration | undefined = jsonPayload?.consideration;
====
>>>> AFTER
  let consideration: Consideration | undefined = undefined;
  if (jsonPayload?.consideration && typeof jsonPayload.consideration === 'object' && jsonPayload.consideration !== null) {
    const amt = Number(jsonPayload.consideration.amount);
    if (!isNaN(amt) && amt > 0) {
      consideration = {
        amount: amt,
        currency: 'INR',
        evidenceAnchor: jsonPayload.consideration.evidenceAnchor,
      };
    }
  }
<<<<
```

---

### Remediation Blueprint 5: Inverted OCR Coordinates Sanitization (Defect 5)

#### Target 5: `buildEvidenceAnchor` in `apps/api/src/document-extractor.ts` (Lines 357–375)
Sanitize token coordinates to guarantee `ymin <= ymax`, `xmin <= xmax`, clamping in `[0.0, 1.0]`, and `NaN` recovery:
```typescript
<<<< BEFORE
    const matchedTokens = tokens.filter(t => t.text.toLowerCase().includes(firstWord));
    if (matchedTokens.length > 0) {
      const targetToken = matchedTokens[0];
      return {
        documentId,
        pageNumber: targetToken.pageNumber,
        boundingBox: {
          ymin: Math.max(0, Math.min(1, targetToken.bbox.ymin)),
          xmin: Math.max(0, Math.min(1, targetToken.bbox.xmin)),
          ymax: Math.max(0, Math.min(1, targetToken.bbox.ymax)),
          xmax: Math.max(0, Math.min(1, targetToken.bbox.xmax)),
        },
        extractedSnippet: cleanSnippet,
        confidenceScore: Math.round(confidence * 100) / 100,
      };
    }
====
>>>> AFTER
    const matchedTokens = firstWord ? tokens.filter(t => typeof t.text === 'string' && t.text.toLowerCase().includes(firstWord)) : [];
    if (matchedTokens.length > 0) {
      const targetToken = matchedTokens[0];
      const sanitizeCoord = (val: any, fallback: number) => {
        const num = Number(val);
        if (typeof num !== 'number' || isNaN(num)) return fallback;
        return Math.max(0, Math.min(1, num));
      };

      const y1 = sanitizeCoord(targetToken.bbox.ymin, 0.1);
      const y2 = sanitizeCoord(targetToken.bbox.ymax, 0.2);
      const x1 = sanitizeCoord(targetToken.bbox.xmin, 0.1);
      const x2 = sanitizeCoord(targetToken.bbox.xmax, 0.9);

      let ymin = Math.min(y1, y2);
      let ymax = Math.max(y1, y2);
      let xmin = Math.min(x1, x2);
      let xmax = Math.max(x1, x2);

      if (ymax === ymin) ymax = Math.min(1, ymin + 0.02);
      if (xmax === xmin) xmax = Math.min(1, xmin + 0.05);

      const targetPage = (typeof targetToken.pageNumber === 'number' && !isNaN(targetToken.pageNumber) && targetToken.pageNumber >= 1)
        ? targetToken.pageNumber
        : 1;

      return {
        documentId,
        pageNumber: targetPage,
        boundingBox: {
          ymin: Math.round(ymin * 1000) / 1000,
          xmin: Math.round(xmin * 1000) / 1000,
          ymax: Math.round(ymax * 1000) / 1000,
          xmax: Math.round(xmax * 1000) / 1000,
        },
        extractedSnippet: cleanSnippet,
        confidenceScore: Math.round(confidence * 100) / 100,
      };
    }
<<<<
```

---

### Auxiliary Remediation: Parties Extraction & Security Hardening

#### Auxiliary 1: Party Initials & Relationship Preservation (`document-extractor.ts:557–600`)
Update `sellerRegexes` and `buyerRegexes` to allow initials without terminating on `.` before names, and preserve `W/o` / `D/o` / `S/o` dynamically:
```typescript
    // Look for Vendor / Seller / First Party
    const sellerRegexes = [
      /(?:Vendor|Seller|First\s*Party|Executant|Donor)\s*[:.\-]?\s*(?:Sri|Smt|Mr|Mrs|Late)?\s*([A-Za-z\s\.]+?)(?:\s+(S\/o|W\/o|D\/o|son\s+of|wife\s+of|daughter\s+of)\s+([A-Za-z\s\.]+?))?(?:,|\n|\r|residing|aged|PAN|hereinafter)/i,
      /(?:between\s+)(?:Sri|Smt|Mr|Mrs|Late)?\s*([A-Za-z\s\.]+?)(?:\s+(S\/o|W\/o|D\/o|son\s+of|wife\s+of|daughter\s+of)\s+([A-Za-z\s\.]+?))?(?:,|\n|\r|hereinafter\s*called\s*the\s*Vendor)/i,
    ];
    for (const rx of sellerRegexes) {
      const m = rawText.match(rx);
      if (m && m[1] && m[1].trim().length > 2) {
        const rawName = m[1].trim();
        let relation: string | undefined = undefined;
        if (m[3]) {
          const relType = m[2].toUpperCase().startsWith('W') ? 'W/o' : m[2].toUpperCase().startsWith('D') ? 'D/o' : 'S/o';
          relation = `${relType} ${m[3].trim()}`;
        }
        const norm = normalizePersonName(rawName);
        const role = docType === 'gift_deed' ? 'donor' : 'seller';
        parties.push({
          name: rawName,
          normalizedName: norm,
          role,
          relationship: relation,
          evidenceAnchor: buildEvidenceAnchor(m[0], rawText, pages, tokens, documentId, 0.90),
        });
        break;
      }
    }

    // Look for Purchaser / Buyer / Second Party
    const buyerRegexes = [
      /(?:Purchaser|Buyer|Second\s*Party|Transferee|Claimant|Donee)\s*[:.\-]?\s*(?:Sri|Smt|Mr|Mrs|Late)?\s*([A-Za-z\s\.]+?)(?:\s+(S\/o|W\/o|D\/o|son\s+of|wife\s+of|daughter\s+of)\s+([A-Za-z\s\.]+?))?(?:,|\n|\r|residing|aged|PAN|hereinafter)/i,
      /(?:in\s*favour\s*of\s+|to\s+)(?:Sri|Smt|Mr|Mrs|Late)?\s*([A-Za-z\s\.]+?)(?:\s+(S\/o|W\/o|D\/o|son\s+of|wife\s+of|daughter\s+of)\s+([A-Za-z\s\.]+?))?(?:,|\n|\r|hereinafter\s*called\s*the\s*Purchaser)/i,
    ];
    for (const rx of buyerRegexes) {
      const m = rawText.match(rx);
      if (m && m[1] && m[1].trim().length > 2) {
        const rawName = m[1].trim();
        let relation: string | undefined = undefined;
        if (m[3]) {
          const relType = m[2].toUpperCase().startsWith('W') ? 'W/o' : m[2].toUpperCase().startsWith('D') ? 'D/o' : 'S/o';
          relation = `${relType} ${m[3].trim()}`;
        }
        const norm = normalizePersonName(rawName);
        const role = docType === 'gift_deed' ? 'donee' : 'buyer';
        parties.push({
          name: rawName,
          normalizedName: norm,
          role,
          relationship: relation,
          evidenceAnchor: buildEvidenceAnchor(m[0], rawText, pages, tokens, documentId, 0.90),
        });
        break;
      }
    }
```

#### Auxiliary 2: Prototype Pollution Guard in `server.ts` (Lines 176–188)
In `apps/api/src/server.ts:176-188`:
```typescript
function setNestedValue(obj: any, pathStr: string, value: any): void {
  if (!obj || !pathStr) return;
  const parts = pathStr.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return;
    if (!curr[part] || typeof curr[part] !== 'object') {
      curr[part] = {};
    }
    curr = curr[part];
  }
  const lastKey = parts[parts.length - 1];
  if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') return;
  curr[lastKey] = value;
}
```

---

## 5. Verification Method

Once the implementation worker applies these changes, the following verification commands must be executed to independently confirm resolution:

### 1. Automated Monorepo Checks
```bash
npm run typecheck
npm run build
npm test
```
*Expected Result*:
- `npm run typecheck` exits 0.
- `npm run build` exits 0.
- `npm test` runs with 100% pass rate.

### 2. Standalone Behavioral Verifications

#### A. Verify Compound Extent Parsing
```bash
node -e "
import('./apps/api/dist/src/document-extractor.js').then(m => {
  const r = m.extractDocument('Absolute Sale Deed Extent: 3 Acres 10 Guntas Sy No 34/2');
  console.assert(r.propertySchedule.extent.normalizedSqFt === 141570, 'Expected 141570, got ' + r.propertySchedule.extent.normalizedSqFt);
  console.assert(r.propertySchedule.extent.acres === 3, 'Expected 3 acres');
  console.assert(r.propertySchedule.extent.guntas === 10, 'Expected 10 guntas');
  console.log('✅ Extent compound parsing verified.');
});
"
```

#### B. Verify Boundary Parsing with Initials & Colon Stripping
```bash
node -e "
import('./apps/api/dist/src/document-extractor.js').then(m => {
  const r = m.extractDocument('Absolute Sale Deed North by: Property of Sri A. K. Rao\nSouth by: 40ft Main Road');
  console.assert(r.propertySchedule.boundaries.north === 'Property of Sri A. K. Rao', 'Failed: ' + r.propertySchedule.boundaries.north);
  console.assert(!r.propertySchedule.boundaries.north.startsWith(':'), 'Leading colon present');
  console.log('✅ Boundary parsing with initials verified.');
});
"
```

#### C. Verify Kannada Document Classification & Extent
```bash
node -e "
import('./apps/api/dist/src/document-extractor.js').then(m => {
  const c = m.classifyKarnatakaDocument('ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ ಭೂಮಿ ಆರ್‌ಟಿಸಿ ನಮೂನೆ ೧೬ ಪಹಣಿ ಪತ್ರಿಕೆ ಕಬ್ಜೇದಾರ: ಶ್ರೀ ರಾಮಕೃಷ್ಣ');
  console.assert(c.docType === 'rtc_pahani', 'Expected rtc_pahani, got ' + c.docType);
  console.assert(c.confidence >= 0.80, 'Confidence too low: ' + c.confidence);
  const ext = m.normalizeKarnatakaExtent('1 ಎಕರೆ 20 ಗುಂಟೆ');
  console.assert(ext.normalizedSqFt === 65340, 'Expected 65340, got ' + ext.normalizedSqFt);
  console.log('✅ Kannada classification & units verified.');
});
"
```

#### D. Verify Bounding Box Coordinate Sanitization
```bash
node -e "
import('./apps/api/dist/src/document-extractor.js').then(m => {
  const tokens = [{ text: 'Survey', pageNumber: 1, bbox: { ymin: 0.8, xmin: 0.9, ymax: 0.2, xmax: 0.1 }, confidence: 0.9 }];
  const pages = m.splitIntoPages('Survey 34/2');
  const a = m.buildEvidenceAnchor('Survey', 'Survey 34/2', pages, tokens, 'doc-1', 0.9);
  console.assert(a.boundingBox.ymin <= a.boundingBox.ymax, 'ymin must be <= ymax');
  console.assert(a.boundingBox.xmin <= a.boundingBox.xmax, 'xmin must be <= xmax');
  console.assert(a.boundingBox.ymin === 0.2 && a.boundingBox.ymax === 0.8, 'Coordinates not sanitized');
  console.log('✅ Bounding box coordinate sanitization verified.');
});
"
```

#### E. Verify Non-String JSON Payload Type Guards
```bash
node -e "
import('./apps/api/dist/src/document-extractor.js').then(m => {
  m.extractDocument('{\"propertySchedule\": {\"extent\": {\"rawText\": 123}}}');
  m.extractDocument('{\"parties\": [null, {\"name\": 123}, {}]}');
  m.extractDocument('{\"consideration\": \"free\"}');
  console.log('✅ Defensive type guards verified without crash.');
});
"
```

#### F. Invalidation Conditions
This remediation blueprint will be considered invalid if:
1. `normalizeKarnatakaExtent` or `extractDocument` returns `guntas: undefined` on `"3 Acres 10 Guntas"`.
2. A boundary value starts with `:` or halts prematurely on an initial with a dot.
3. Pure Kannada Bhoomi documents classify as `other` or confidence is `< 0.70`.
4. Any `TypeError` is thrown when passing non-string parameters to extractor entrypoints.
5. Any bounding box anchor has `ymin > ymax`, `xmin > xmax`, or `NaN`.
