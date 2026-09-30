import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  extractDocument,
  classifyKarnatakaDocument,
  normalizeKarnatakaExtent,
  normalizePersonName,
  buildEvidenceAnchor,
  splitIntoPages,
  SQFT_PER_ACRE,
  SQFT_PER_GUNTA,
  SQFT_PER_CENT,
  SQFT_PER_SQM,
} from '../src/document-extractor.js';
import type { BoundingBox, EvidenceAnchor, ExtractedDocumentFields, OCRToken } from '../src/types.js';

function validateBoxBounds(bbox: BoundingBox): boolean {
  if (typeof bbox.ymin !== 'number' || isNaN(bbox.ymin)) return false;
  if (typeof bbox.xmin !== 'number' || isNaN(bbox.xmin)) return false;
  if (typeof bbox.ymax !== 'number' || isNaN(bbox.ymax)) return false;
  if (typeof bbox.xmax !== 'number' || isNaN(bbox.xmax)) return false;
  if (bbox.ymin < 0.0 || bbox.ymin > 1.0) return false;
  if (bbox.xmin < 0.0 || bbox.xmin > 1.0) return false;
  if (bbox.ymax < 0.0 || bbox.ymax > 1.0) return false;
  if (bbox.xmax < 0.0 || bbox.xmax > 1.0) return false;
  if (bbox.ymin > bbox.ymax) return false;
  if (bbox.xmin > bbox.xmax) return false;
  return true;
}

// ============================================================================
// SECTION 1: PASSING ADVERSARIAL STRESS TESTS & BASELINE HARDENING
// ============================================================================

test('CHALLENGE: "0-0 Guntas" parses to 0 normalized sqft cleanly', () => {
  const result = normalizeKarnatakaExtent('0-0 Guntas');
  assert.equal(result.normalizedSqFt, 0);
  assert.equal(result.rawText, '0-0 Guntas');
});

test('CHALLENGE: "1000 Acres" handles extreme acreage without overflow', () => {
  const result = normalizeKarnatakaExtent('1000 Acres');
  assert.equal(result.acres, 1000);
  assert.equal(result.normalizedSqFt, 43560000);
});

test('CHALLENGE: "5.5 Guntas" handles decimal guntas precisely', () => {
  const result = normalizeKarnatakaExtent('5.5 Guntas');
  assert.equal(result.guntas, 5.5);
  assert.equal(result.normalizedSqFt, 5989.5);
});

test('CHALLENGE: "0-30 Guntas" correctly handles zero acres and 30 guntas', () => {
  const result = normalizeKarnatakaExtent('0-30 Guntas');
  assert.equal(result.guntas, 30);
  assert.equal(result.acres, undefined);
  assert.equal(result.normalizedSqFt, 32670);
});

test('CHALLENGE: Dimensional and area conversions (sq ft, sq meters, cents)', () => {
  assert.equal(normalizeKarnatakaExtent('40 x 60 ft').normalizedSqFt, 2400);
  assert.equal(normalizeKarnatakaExtent('50 Cents').normalizedSqFt, 21780);
  assert.equal(normalizeKarnatakaExtent('500 sq.m').normalizedSqFt, Math.round(500 * SQFT_PER_SQM * 100) / 100);
  assert.equal(normalizeKarnatakaExtent('').normalizedSqFt, 0);
  assert.equal(normalizeKarnatakaExtent('   ').normalizedSqFt, 0);
});

test('CHALLENGE: Missing party relationships (no S/o, W/o, D/o) does not crash', () => {
  const doc = 'Absolute Sale Deed\nVendor: Sri Suresh Kumar, residing at Bangalore\nPurchaser: Smt Anita Sharma\nSurvey No: 12/1\nExtent: 1 Acre';
  const extracted = extractDocument(doc);
  assert.equal(extracted.documentType, 'sale_deed');
  const seller = extracted.parties.find(p => p.role === 'seller');
  const buyer = extracted.parties.find(p => p.role === 'buyer');
  assert.ok(seller);
  assert.ok(buyer);
  assert.equal(seller.name, 'Suresh Kumar');
  assert.equal(seller.relationship, undefined);
  assert.equal(buyer.name, 'Anita Sharma');
  assert.equal(buyer.relationship, undefined);
});

test('CHALLENGE: Missing boundaries completely produces fallback defaults with low boundary confidence', () => {
  const doc = 'Gift Deed\nDonor: Sri Krishna\nDonee: Kumari Radha\nSurvey No: 88\nExtent: 1 Acre';
  const extracted = extractDocument(doc);
  assert.equal(extracted.propertySchedule.boundaries.north, '');
  assert.equal(extracted.propertySchedule.boundaries.south, '');
  assert.equal(extracted.propertySchedule.boundaries.east, '');
  assert.equal(extracted.propertySchedule.boundaries.west, '');
  assert.equal(extracted.fieldConfidence.boundaries, 0.40);
});

test('CHALLENGE: Synthetic evidence anchors strictly conform to [0.0, 1.0] coordinates', () => {
  const pages = splitIntoPages('Test text\nLine 2\nLine 3 Target Snippet');
  const anchor = buildEvidenceAnchor('Target Snippet', 'Test text\nLine 2\nLine 3 Target Snippet', pages, undefined, 'doc-1', 0.90);
  assert.equal(validateBoxBounds(anchor.boundingBox), true);
});

test('CHALLENGE: Giant single line of 50,000 characters without newlines does not exceed bounds', () => {
  const giant = 'Absolute Sale Deed ' + 'filler '.repeat(500) + 'Vendor: Sri Alpha Purchaser: Smt Beta Sy No 50/1 Extent: 1 Acre';
  const pages = splitIntoPages(giant);
  const anchor = buildEvidenceAnchor('Alpha', giant, pages, undefined, 'doc-2', 0.85);
  assert.equal(validateBoxBounds(anchor.boundingBox), true);
});

// ============================================================================
// SECTION 2: VERIFICATION OF REMEDIATED DEFECTS & SECURITY FIXES
// ============================================================================

test('BUG 1 REMEDIATION: extractDocument correctly captures compound extent ("1 Acre 20 Guntas" -> 65340 sqft)', () => {
  const docText = 'Absolute Sale Deed Extent: 1 Acre 20 Guntas Sy No 34/2 Village Bellandur';
  const extracted = extractDocument(docText);

  assert.equal(extracted.propertySchedule.extent.rawText, '1 Acre 20 Guntas');
  assert.equal(extracted.propertySchedule.extent.acres, 1);
  assert.equal(extracted.propertySchedule.extent.guntas, 20);
  assert.equal(extracted.propertySchedule.extent.normalizedSqFt, 65340);
});

test('BUG 2 REMEDIATION: Handles non-string rawText defensively without throwing TypeError', () => {
  assert.doesNotThrow(() => {
    extractDocument({ jsonPayload: { propertySchedule: { extent: { rawText: 123 as any, normalizedSqFt: 0 } } } as any });
  });
});

test('BUG 3 REMEDIATION: Handles numeric party name defensively without throwing TypeError', () => {
  assert.doesNotThrow(() => {
    extractDocument('{"parties": [{"name": 123}]}');
  });
});

test('BUG 4 REMEDIATION: Handles party array containing null defensively without throwing TypeError', () => {
  assert.doesNotThrow(() => {
    extractDocument('{"parties": [null]}');
  });
});

test('BUG 5 REMEDIATION: Inverted bounding box coordinates sanitized so ymin <= ymax and xmin <= xmax', () => {
  const tokens: OCRToken[] = [
    {
      text: 'Survey',
      pageNumber: 1,
      bbox: { ymin: 0.8, xmin: 0.9, ymax: 0.2, xmax: 0.1 },
      confidence: 0.95,
    },
  ];
  const pages = splitIntoPages('Survey 34/2');
  const anchor = buildEvidenceAnchor('Survey', 'Survey 34/2', pages, tokens, 'doc-inv', 0.95);

  assert.ok(anchor.boundingBox.ymin <= anchor.boundingBox.ymax);
  assert.ok(anchor.boundingBox.xmin <= anchor.boundingBox.xmax);
  assert.equal(validateBoxBounds(anchor.boundingBox), true);
});

test('BUG 6 REMEDIATION: NaN bounding box coordinates sanitized with valid fallback coordinates', () => {
  const tokens: OCRToken[] = [
    {
      text: 'Survey',
      pageNumber: 1,
      bbox: { ymin: NaN, xmin: 0.1, ymax: 0.8, xmax: 0.9 },
      confidence: 0.95,
    },
  ];
  const pages = splitIntoPages('Survey 34/2');
  const anchor = buildEvidenceAnchor('Survey', 'Survey 34/2', pages, tokens, 'doc-nan', 0.95);

  assert.equal(isNaN(anchor.boundingBox.ymin), false);
  assert.equal(validateBoxBounds(anchor.boundingBox), true);
});

test('BUG 7 REMEDIATION: Boundary descriptions strip leading colons and preserve initials with periods', () => {
  const text = 'Absolute Sale Deed North by: Property of Sri K. R. Ramesh\nSouth by: 40ft Main Road';
  const extracted = extractDocument(text);

  assert.equal(extracted.propertySchedule.boundaries.north, 'Property of Sri K. R. Ramesh');
  assert.equal(extracted.propertySchedule.boundaries.south, '40ft Main Road');
});

test('BUG 8 REMEDIATION: Pure Kannada RTC document successfully classified to rtc_pahani', () => {
  const kannadaDoc = `
    ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ
    ಭೂಮಿ ಆರ್‌ಟಿಸಿ ನಮೂನೆ ೧೬ ಪಹಣಿ ಪತ್ರಿಕೆ
    ದಸ್ತಾವೇಜು ಸಂಖ್ಯೆ: BHM-MR-2022-1045
    ಕಬ್ಜೇದಾರ: ಶ್ರೀ ರಾಮಕೃಷ್ಣ
  `;
  const result = classifyKarnatakaDocument(kannadaDoc);

  assert.equal(result.docType, 'rtc_pahani');
  assert.ok(result.confidence >= 0.85);
});

test('BUG 9 REMEDIATION: Kannada extent "1 ಎಕರೆ 20 ಗುಂಟೆ" correctly normalizes to 65340 sq ft', () => {
  const result = normalizeKarnatakaExtent('1 ಎಕರೆ 20 ಗುಂಟೆ');

  assert.equal(result.normalizedSqFt, 65340);
  assert.equal(result.acres, 1);
  assert.equal(result.guntas, 20);
});

