import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDocument,
  extractDocumentMetadata,
  validateBoundingBox,
  applyFieldOverride,
  computeSha256Checksum,
  verifyTenantIsolation,
  logAuditEvent,
  type BoundingBox,
} from '../src/document-extractor.js';


// ============================================================================
// FEATURE 1: Karnataka Document Classifier (R1)
// ============================================================================

test('F1 Tier 1: Classifies Sale Deed (Kraya Patra)', () => {
  const result = classifyDocument('This Absolute Sale Deed (Kraya Patra) is executed on this 12th day of May 2018');
  assert.equal(result.documentType, 'sale_deed');
  assert.ok(result.confidence >= 0.85);
});

test('F1 Tier 1: Classifies Gift Deed (Dhana Patra)', () => {
  const result = classifyDocument('Registered Gift Deed (Dhana Patra) executed out of natural love and affection without monetary consideration');
  assert.equal(result.documentType, 'gift_deed');
  assert.ok(result.confidence >= 0.85);
});

test('F1 Tier 1: Classifies RTC / Pahani (Bhoomi Form 16)', () => {
  const result = classifyDocument('Government of Karnataka - Revenue Department Bhoomi RTC Form No 16 Record of Rights, Tenancy and Crops');
  assert.equal(result.documentType, 'rtc_pahani');
  assert.ok(result.confidence >= 0.85);
});

test('F1 Tier 1: Classifies Encumbrance Certificate (Form 15 / Form 16)', () => {
  const result = classifyDocument('Department of Stamps and Registration Kaveri Encumbrance Certificate Form 15 for period 2004 to 2024');
  assert.equal(result.documentType, 'encumbrance_certificate');
  assert.ok(result.confidence >= 0.85);
});

test('F1 Tier 1: Classifies e-Khata (BBMP e-Aasthi Form 3 / e-Swathu)', () => {
  const result = classifyDocument('Bruhat Bengaluru Mahanagara Palike e-Aasthi e-Khata Certificate Form 3 Property Tax Register');
  assert.equal(result.documentType, 'e_khata');
  assert.ok(result.confidence >= 0.85);
});

test('F1 Tier 1: Classifies Mutation Extract (MR Register)', () => {
  const result = classifyDocument('Bhoomi Mutation Extract MR No 14/2012-13 certified by Tahsildar Bangalore South');
  assert.equal(result.documentType, 'mutation_extract');
  assert.ok(result.confidence >= 0.85);
});

test('F1 Tier 2: Classifies unknown document type gracefully', () => {
  const result = classifyDocument('Electricity Bill from BESCOM Bangalore for meter connection #98124');
  assert.equal(result.documentType, 'other');
  assert.ok(result.confidence <= 0.60);
});

test('F1 Tier 2: Handles mixed casing and excessive whitespace', () => {
  const result = classifyDocument('   REGISTERED    kRaYa   PATRA   (sAlE   dEeD)   ');
  assert.equal(result.documentType, 'sale_deed');
});

test('F1 Tier 2: Handles binary buffer input for classification', () => {
  const buffer = Buffer.from('Bhoomi RTC Form No 16 Pahani Record of Rights');
  const result = classifyDocument(buffer);
  assert.equal(result.documentType, 'rtc_pahani');
});

test('F1 Tier 2: Handles empty string input without crashing', () => {
  const result = classifyDocument('');
  assert.equal(result.documentType, 'other');
  assert.ok(result.confidence <= 0.50);
});

test('F1 Tier 2: Handles corrupted special-character string', () => {
  const result = classifyDocument('$$$%%%***###@@@!!!___+++===???');
  assert.equal(result.documentType, 'other');
  assert.equal(result.confidence, 0.40);
});

// ============================================================================
// FEATURE 2: Metadata Extractor (R1)
// ============================================================================

test('F2 Tier 1: Extracts parties with roles and parentage', () => {
  const text = 'Vendor: Sri K. R. Ramesh S/o Kadirappa, Purchaser: Smt Lakshmi W/o Suresh. Sy No: 34/2';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.ok(extracted.parties.length >= 2);
  const vendor = extracted.parties.find(p => p.role === 'vendor' || p.role === 'seller');
  assert.ok(vendor);
  assert.match(vendor.name, /Ramesh/i);
  assert.equal(vendor.relationship, 'S/o Kadirappa');
});

test('F2 Tier 1: Extracts execution and registration dates', () => {
  const text = 'Executed on 2018-05-12 at Bommanahalli Sub-Registrar Office. Document No: 1234/2018-19';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.executionDate, '2018-05-12');
  assert.equal(extracted.registrationDate, undefined, 'registration date must not be inferred from execution date');
  assert.equal(extracted.documentNumber, '1234/2018-19');
});

test('F2 regression: Parses Kannada deed schedule, separate dates, and rejects challan validity as land extent', () => {
  const text = `ದಿನಾಂಕ: 17-01-2025
ಉಪ ನೋಂದಣಿ ಕಚೇರಿಯಲ್ಲಿ ದಿನಾಂಕ 20/01/2025 ರಂದು
ಸುಮಾರು 52 ವರ್ಷದ ದೇವರಾಜು.ಎಸ್.ಆರ್ S/o ಲೇಟ್:ರಾಮೇಗೌಡ
1). ಎಸ್.ಎಲ್.ರಾಮಕೃಷ್ಣ ಬಿನ್ ಲೇಟ್.ಎಸ್.ಲಿಂಗಪ್ಪಯ್ಯ (ಖಾತೆದಾರರು) ಸುಮಾರು 69 ವರ್ಷ
2). ಪವನಸುತ.ಆರ್ ಬಿನ್ ಎಸ್.ಎಲ್.ರಾಮಕೃಷ್ಣ (ಖಾತೆದಾರರ ಮಗ) ಸುಮಾರು 39 ವರ್ಷ
ಮತ್ತು ಷೆಡ್ಯೂಲ್ ಸ್ವತ್ತಿನ ವಿವರ:-
ಮಂಡ್ಯ ಜಿಲ್ಲೆ, ಪಾಂಡವಪುರ ತಾಲ್ಲೂಕು, ಕಸಬಾ ಹೋಬಳಿ, ಬಳೆಅತ್ತಿಗುಪ್ಪೆ ಗ್ರಾಮದ ಜಮೀನು:
MR.NO. 10/2006-2007 ಖಾತ ನಂ:7
ಪೂರ್ವಕ್ಕೆ:- ಕೀರೆ ಮಡವು
ಪಶ್ಚಿಮಕ್ಕೆ:- ಹರಿಜನ ಕಾಲೋನಿ
ಉತ್ತರಕ್ಕೆ :- ಪಟೇಲ್ ಚಂದ್ರು ರವರ ಜಮೀನು
ದಕ್ಷಿಣಕ್ಕೆ:- ಮಹದೇವಮ್ಮರ ಜಮೀನು
ಸರ್ವೆ ನಂಬರ್ 6 (ಆರು) ವಿಸ್ತಿರ್ಣ 3-09 (ಮೂರು ಎಕರೆ ಒಂಭತ್ತು ಗುಂಟೆ)
ಚಲನ್ ಚಾಲ್ತಿ ಅವಧಿ Challan Validity 7 Days 24-25
ಮೊಬಲಗು 10,00,000/-
ನಿಗದಿತ ಮುದ್ರಾಂಕ ಶುಲ್ಕವಾಗಿ ₹56,500.00
ನೋಂದಣಿ ಶುಲ್ಕ 10,000.00
ಸೇವಾ ಶುಲ್ಕ 350.00
ಪರಿವರ್ತನಾ ಶುಲ್ಕ 35.00
ಪ್ರಮಾಣ ಪತ್ರ ಮುದ್ರಾಂಕ ಶುಲ್ಕ 100.00
Online Challan Reference Number RG0125000014826200
Grand Total 66,985.00
RTGS (UTR NO - BARBR52025011700803229)`;
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.executionDate, '2025-01-17');
  assert.equal(extracted.registrationDate, '2025-01-20');
  assert.equal(extracted.propertySchedule.district, 'ಮಂಡ್ಯ');
  assert.equal(extracted.propertySchedule.taluk, 'ಪಾಂಡವಪುರ Taluk');
  assert.equal(extracted.propertySchedule.hobli, 'ಕಸಬಾ Hobli');
  assert.equal(extracted.propertySchedule.village, 'ಬಳೆಅತ್ತಿಗುಪ್ಪೆ');
  assert.equal(extracted.propertySchedule.surveyNumber, '6');
  assert.equal(extracted.propertySchedule.extent.rawText, '3-09 (ಮೂರು ಎಕರೆ ಒಂಭತ್ತು ಗುಂಟೆ)');
  assert.equal(extracted.propertySchedule.extent.acres, 3);
  assert.equal(extracted.propertySchedule.extent.guntas, 9);
  assert.equal(extracted.propertySchedule.boundaries.east, 'ಕೀರೆ ಮಡವು');
  assert.equal(extracted.propertySchedule.boundaries.west, 'ಹರಿಜನ ಕಾಲೋನಿ');
  assert.equal(extracted.propertySchedule.boundaries.north, 'ಪಟೇಲ್ ಚಂದ್ರು ರವರ ಜಮೀನು');
  assert.equal(extracted.propertySchedule.boundaries.south, 'ಮಹದೇವಮ್ಮರ ಜಮೀನು');
  assert.equal(extracted.propertySchedule.mutationReference, '10/2006-2007');
  assert.equal(extracted.propertySchedule.khataNumber, '7');
  assert.notEqual(extracted.propertySchedule.extent.rawText, '24-25');
  assert.ok(extracted.parties.some(p => p.role === 'buyer' && p.name.includes('ದೇವರಾಜು')));
  assert.ok(extracted.parties.some(p => p.role === 'seller' && p.name.includes('ರಾಮಕೃಷ್ಣ')));
  assert.equal(extracted.consideration?.amount, 1000000);
  assert.ok(extracted.financialItems?.some(item=>item.category==='stamp_duty'&&item.amount===56500));
  assert.ok(extracted.financialItems?.some(item=>item.category==='registration_fee'&&item.amount===10000));
  assert.ok(extracted.financialItems?.some(item=>item.category==='service_fee'&&item.amount===350));
  assert.ok(extracted.financialItems?.some(item=>item.category==='challan'&&item.reference==='RG0125000014826200'));
  assert.ok(extracted.financialItems?.some(item=>item.certificate==='Government e-payment challan'&&item.amount===66985));
});

test('F2 Tier 1: Extracts survey number and village schedule', () => {
  const text = 'Property Schedule: Survey No: 88/1, Village: Bellandur, Taluk: Bangalore East';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.propertySchedule.surveyNumber, '88/1');
  assert.equal(extracted.propertySchedule.village, 'Bellandur');
});

test('F2 Tier 1: Extracts 4-side schedule boundaries', () => {
  const text = 'Boundaries: North by: Public Road, South by: Survey 34/3, East by: Private Property, West by: Lake Boundary';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.propertySchedule.boundaries.north, 'Public Road');
  assert.equal(extracted.propertySchedule.boundaries.south, 'Survey 34/3');
  assert.equal(extracted.propertySchedule.boundaries.east, 'Private Property');
  assert.equal(extracted.propertySchedule.boundaries.west, 'Lake Boundary');
});

test('F2 Tier 1: Extracts extent and computes normalized square feet', () => {
  const text = 'Measuring an extent of 1 Acre 20 Guntas in Sy No 34/2';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.propertySchedule.extent.acres, 1);
  assert.equal(extracted.propertySchedule.extent.guntas, 20);
  assert.equal(extracted.propertySchedule.extent.normalizedSqFt, 65340);
});

test('F2 Tier 1: Extracts monetary consideration amount', () => {
  const text = 'The total sale consideration agreed is Rs. 4,500,000 paid by cheque';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.ok(extracted.consideration);
  assert.equal(extracted.consideration.amount, 4500000);
  assert.equal(extracted.consideration.currency, 'INR');
});

test('F2 Tier 2: Handles missing consideration gracefully', () => {
  const text = 'Gift Deed without any consideration. Sy No 12, Village Arakere';
  const extracted = extractDocumentMetadata(text, 'gift_deed');
  assert.equal(extracted.consideration, undefined);
});

test('F2 Tier 2: Handles compound survey numbers with multiple slashes/hissas', () => {
  const text = 'Schedule of land: Survey No: 102/1A2B Village Bellandur';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.propertySchedule.surveyNumber, '102/1A2B');
  assert.equal(extracted.propertySchedule.subdivisionHissa, '1A2B');
});

test('F2 Tier 2: Keeps missing boundaries unidentified instead of inventing values', () => {
  const text = 'Simple deed without schedule boundary recital. Sy No 55';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.equal(extracted.propertySchedule.boundaries.north, '');
  assert.equal(extracted.propertySchedule.boundaries.south, '');
});

test('F2 Tier 2: Handles date in DD/MM/YYYY format and normalizes to ISO', () => {
  const text = 'Registered on 15/08/2015 at Bangalore South SRO';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.match(extracted.registrationDate || '', /2015-08-15/);
});

test('F2 Tier 2: Handles empty text buffer with fallback metadata', () => {
  const extracted = extractDocumentMetadata('', 'other');
  assert.equal(extracted.documentType, 'other');
  assert.ok(extracted.overallConfidence <= 0.60);
});

// ============================================================================
// FEATURE 3: Evidence Anchor & Bounding Box Generator (R1)
// ============================================================================

test('F3 Tier 1: Validates compliant normalized bounding box coordinates', () => {
  const box: BoundingBox = { ymin: 0.12, xmin: 0.05, ymax: 0.25, xmax: 0.85 };
  assert.equal(validateBoundingBox(box), true);
});

test('F3 Tier 1: Rejects negative coordinates', () => {
  const box: BoundingBox = { ymin: -0.05, xmin: 0.1, ymax: 0.3, xmax: 0.5 };
  assert.equal(validateBoundingBox(box), false);
});

test('F3 Tier 1: Rejects coordinates greater than 1.0', () => {
  const box: BoundingBox = { ymin: 0.1, xmin: 0.1, ymax: 1.05, xmax: 0.8 };
  assert.equal(validateBoundingBox(box), false);
});

test('F3 Tier 1: Rejects inverted coordinates where ymax < ymin', () => {
  const box: BoundingBox = { ymin: 0.8, xmin: 0.1, ymax: 0.3, xmax: 0.5 };
  assert.equal(validateBoundingBox(box), false);
});

test('F3 Tier 1: Rejects inverted coordinates where xmax < xmin', () => {
  const box: BoundingBox = { ymin: 0.1, xmin: 0.9, ymax: 0.5, xmax: 0.2 };
  assert.equal(validateBoundingBox(box), false);
});

test('F3 Tier 2: Rejects NaN coordinates', () => {
  const box: BoundingBox = { ymin: NaN, xmin: 0.1, ymax: 0.5, xmax: 0.8 };
  assert.equal(validateBoundingBox(box), false);
});

test('F3 Tier 2: Accepts exact boundary limits [0.0, 0.0, 1.0, 1.0]', () => {
  const box: BoundingBox = { ymin: 0.0, xmin: 0.0, ymax: 1.0, xmax: 1.0 };
  assert.equal(validateBoundingBox(box), true);
});

test('F3 Tier 2: Accepts point/zero-area box where ymin==ymax and xmin==xmax', () => {
  const box: BoundingBox = { ymin: 0.5, xmin: 0.5, ymax: 0.5, xmax: 0.5 };
  assert.equal(validateBoundingBox(box), true);
});

test('F3 Tier 2: Rejects undefined or missing properties in bounding box', () => {
  const box = { ymin: 0.1, xmin: 0.1 } as any;
  assert.equal(validateBoundingBox(box), false);
});

test('F3 Tier 2: Verifies metadata extractor produces valid evidence anchors', () => {
  const text = 'Vendor: Sri K. R. Ramesh. Consideration: Rs. 5000000. Sy No: 34/2';
  const extracted = extractDocumentMetadata(text, 'sale_deed');
  assert.ok(extracted.propertySchedule.evidenceAnchor);
  assert.equal(validateBoundingBox(extracted.propertySchedule.evidenceAnchor.boundingBox), true);
  assert.ok(extracted.propertySchedule.evidenceAnchor.confidenceScore >= 0.80);
});

// ============================================================================
// FEATURE 4: Side-by-Side Review UI & Document Overrides (R1)
// ============================================================================

test('F4 Tier 1: Allows reviewer to override extracted survey number with rationale', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2 Village Arakere', 'sale_deed');
  const updated = applyFieldOverride(
    initial,
    'propertySchedule.surveyNumber',
    '34/2A',
    'Corrected OCR error where A was blurred',
    'reviewer_legal_01'
  );
  assert.equal(updated.propertySchedule.surveyNumber, '34/2A');
  assert.equal(updated.reviewState.isVerified, true);
  assert.equal(updated.reviewState.verifiedByUid, 'reviewer_legal_01');
  assert.ok(updated.reviewState.overrides?.['propertySchedule.surveyNumber']);
  assert.equal(updated.reviewState.overrides['propertySchedule.surveyNumber'].previousValue, '34/2');
  assert.equal(updated.reviewState.overrides['propertySchedule.surveyNumber'].newValue, '34/2A');
});

test('F4 Tier 1: Allows reviewer to override extent and updates reviewState', () => {
  const initial = extractDocumentMetadata('Extent 1 Acre 20 Guntas', 'sale_deed');
  const updated = applyFieldOverride(
    initial,
    'propertySchedule.extent.normalizedSqFt',
    65340,
    'Verified with schedule clause on page 3',
    'reviewer_legal_02'
  );
  assert.equal(updated.propertySchedule.extent.normalizedSqFt, 65340);
  assert.equal(updated.reviewState.isVerified, true);
});

test('F4 Tier 1: Rejects override without rationale', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2', 'sale_deed');
  assert.throws(() => {
    applyFieldOverride(initial, 'propertySchedule.surveyNumber', '99', '', 'reviewer_legal_01');
  }, /rationale is mandatory/i);
});

test('F4 Tier 1: Rejects override without reviewer UID', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2', 'sale_deed');
  assert.throws(() => {
    applyFieldOverride(initial, 'propertySchedule.surveyNumber', '99', 'Reason here', '');
  }, /reviewer uid is mandatory/i);
});

test('F4 Tier 1: Throws error on non-existent field path', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2', 'sale_deed');
  assert.throws(() => {
    applyFieldOverride(initial, 'nonExistentObject.childField', 'value', 'Reason', 'reviewer_01');
  }, /invalid field path/i);
});

test('F4 Tier 2: Handles multiple consecutive overrides cleanly', () => {
  let doc = extractDocumentMetadata('Sy No: 34/2 Extent: 1 Acre', 'sale_deed');
  doc = applyFieldOverride(doc, 'propertySchedule.surveyNumber', '34/2B', 'Correction 1', 'rev_1');
  doc = applyFieldOverride(doc, 'propertySchedule.village', 'Begur', 'Correction 2', 'rev_2');
  assert.equal(doc.propertySchedule.surveyNumber, '34/2B');
  assert.equal(doc.propertySchedule.village, 'Begur');
  assert.equal(Object.keys(doc.reviewState.overrides || {}).length, 2);
  assert.equal(doc.reviewState.verifiedByUid, 'rev_2');
});

test('F4 Tier 2: Rejects whitespace-only rationale string', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2', 'sale_deed');
  assert.throws(() => {
    applyFieldOverride(initial, 'propertySchedule.surveyNumber', '99', '    ', 'reviewer_legal_01');
  }, /rationale is mandatory/i);
});

test('F4 Tier 2: Preserves original object immutability', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2', 'sale_deed');
  const initialSurvey = initial.propertySchedule.surveyNumber;
  applyFieldOverride(initial, 'propertySchedule.surveyNumber', '100', 'Test immutability', 'rev_1');
  assert.equal(initial.propertySchedule.surveyNumber, initialSurvey);
});

test('F4 Tier 2: Overrides nested boundary directions', () => {
  const initial = extractDocumentMetadata('North by: Old Road', 'sale_deed');
  const updated = applyFieldOverride(initial, 'propertySchedule.boundaries.north', '60ft Ring Road', 'Updated layout road name', 'rev_1');
  assert.equal(updated.propertySchedule.boundaries.north, '60ft Ring Road');
});

test('F4 Tier 2: Preserves fieldConfidence scores after override', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2', 'sale_deed');
  const origConf = initial.fieldConfidence.surveyNumber;
  const updated = applyFieldOverride(initial, 'propertySchedule.surveyNumber', '34/2C', 'Updated', 'rev_1');
  assert.equal(updated.fieldConfidence.surveyNumber, origConf);
});

// ============================================================================
// FEATURE 22: Tenant Isolation & Access Guard (Security)
// ============================================================================

test('F22 Tier 1: Allows access when user organization matches resource organization', () => {
  const allowed = verifyTenantIsolation('org_karnataka_legal', 'org_karnataka_legal');
  assert.equal(allowed, true);
});

test('F22 Tier 1: Blocks access when user attempts cross-organization resource access', () => {
  const allowed = verifyTenantIsolation('org_hacker_corp', 'org_karnataka_legal');
  assert.equal(allowed, false);
});

test('F22 Tier 1: Rejects empty user organization', () => {
  const allowed = verifyTenantIsolation('', 'org_karnataka_legal');
  assert.equal(allowed, false);
});

test('F22 Tier 1: Rejects empty resource organization', () => {
  const allowed = verifyTenantIsolation('org_karnataka_legal', '');
  assert.equal(allowed, false);
});

test('F22 Tier 1: Rejects both empty organizations', () => {
  const allowed = verifyTenantIsolation('', '');
  assert.equal(allowed, false);
});

test('F22 Tier 2: Case-sensitive organization ID matching', () => {
  const allowed = verifyTenantIsolation('Org_Karnataka', 'org_karnataka');
  assert.equal(allowed, false);
});

test('F22 Tier 2: Handles special characters in organization IDs', () => {
  const allowed = verifyTenantIsolation('org_abc-123_test.blr', 'org_abc-123_test.blr');
  assert.equal(allowed, true);
});

test('F22 Tier 2: Rejects sub-tenant / prefix spoofing', () => {
  const allowed = verifyTenantIsolation('org_karnataka_legal', 'org_karnataka_legal_admin');
  assert.equal(allowed, false);
});

test('F22 Tier 2: Handles UUID formatted organization identifiers', () => {
  const uuid = '3d42048c-91f5-4f22-8a89-e9bee87cdb59';
  assert.equal(verifyTenantIsolation(uuid, uuid), true);
  assert.equal(verifyTenantIsolation(uuid, '3d42048c-91f5-4f22-8a89-e9bee87cdb00'), false);
});

test('F22 Tier 2: Rejects undefined or null organization inputs', () => {
  assert.equal(verifyTenantIsolation(null as any, 'org_test'), false);
  assert.equal(verifyTenantIsolation('org_test', undefined as any), false);
});

// ============================================================================
// FEATURE 23: SHA-256 Cryptographic Checksumming (Security)
// ============================================================================

test('F23 Tier 1: Computes valid 64-character hex SHA-256 for string content', () => {
  const hash = computeSha256Checksum('OJIX Property Document Intelligence');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('F23 Tier 1: Computes identical checksum for identical binary buffers', () => {
  const buf1 = Buffer.from([1, 2, 3, 4, 5]);
  const buf2 = Buffer.from([1, 2, 3, 4, 5]);
  assert.equal(computeSha256Checksum(buf1), computeSha256Checksum(buf2));
});

test('F23 Tier 1: Computes distinct checksum when 1 byte is modified (avalanche effect)', () => {
  const buf1 = Buffer.from('Sale Deed Sy No 34/2 Extent 1 Acre');
  const buf2 = Buffer.from('Sale Deed Sy No 34/2 Extent 2 Acre');
  assert.notEqual(computeSha256Checksum(buf1), computeSha256Checksum(buf2));
});

test('F23 Tier 1: Validates known SHA-256 test vector for empty string', () => {
  const hash = computeSha256Checksum('');
  assert.equal(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('F23 Tier 1: Handles PDF binary header checksum', () => {
  const pdfHeader = Buffer.from('%PDF-1.4\n%OJIX-LEGAL\n');
  const hash = computeSha256Checksum(pdfHeader);
  assert.equal(hash.length, 64);
});

test('F23 Tier 2: Handles 1MB binary buffer checksum efficiently', () => {
  const largeBuf = Buffer.alloc(1024 * 1024, 0x42);
  const start = Date.now();
  const hash = computeSha256Checksum(largeBuf);
  const elapsed = Date.now() - start;
  assert.equal(hash.length, 64);
  assert.ok(elapsed < 200); // Must be fast
});

test('F23 Tier 2: Handles non-ASCII Unicode characters (Kannada script)', () => {
  const kannadaText = 'ಕರ್ನಾಟಕ ಭೂ ಕಂದಾಯ ಕಾಯ್ದೆ ೧೯೬೪';
  const hash = computeSha256Checksum(kannadaText);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('F23 Tier 2: Checksum remains consistent across string and UTF-8 buffer representation', () => {
  const str = 'Kaveri 2.0 Department of Stamps and Registration';
  const strHash = computeSha256Checksum(str);
  const bufHash = computeSha256Checksum(Buffer.from(str, 'utf8'));
  assert.equal(strHash, bufHash);
});

test('F23 Tier 2: Handles buffer with null bytes', () => {
  const nullBuf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  const hash = computeSha256Checksum(nullBuf);
  assert.equal(hash.length, 64);
});

test('F23 Tier 2: Case consistency (always returns lowercase hex)', () => {
  const hash = computeSha256Checksum('Test Case Sensitivity');
  assert.equal(hash, hash.toLowerCase());
});

// ============================================================================
// FEATURE 24: Mutation Audit Logger (Security)
// ============================================================================

test('F24 Tier 1: Records document upload audit event with timestamp and payload', () => {
  const audit = logAuditEvent('user_advocate_01', 'org_karnataka_legal', 'DOCUMENT_UPLOAD', 'document', 'doc_123', {
    filename: 'SaleDeed_2018.pdf',
    sizeBytes: 1048576,
    sha256: 'abc123def456',
  });
  assert.ok(audit.id.startsWith('AUDIT-'));
  assert.equal(audit.action, 'DOCUMENT_UPLOAD');
  assert.equal(audit.entityType, 'document');
  assert.equal(audit.entityId, 'doc_123');
  assert.ok(audit.timestamp);
});

test('F24 Tier 1: Records field override audit event with previous and new values', () => {
  const audit = logAuditEvent('user_advocate_02', 'org_karnataka_legal', 'FIELD_OVERRIDE', 'document', 'doc_123', {
    fieldPath: 'propertySchedule.surveyNumber',
    previousValue: '34/2',
    newValue: '34/2A',
    rationale: 'Corrected blurring',
  });
  assert.equal(audit.action, 'FIELD_OVERRIDE');
  assert.equal(audit.payload.previousValue, '34/2');
  assert.equal(audit.payload.newValue, '34/2A');
});

test('F24 Tier 1: Records spatial screening run audit event', () => {
  const audit = logAuditEvent('system_gis_worker', 'org_karnataka_legal', 'SPATIAL_SCREENING_EXECUTED', 'property', 'prop_999', {
    layersEvaluated: ['swd_primary', 'swd_secondary', 'waterbody'],
    findingsCount: 2,
  });
  assert.equal(audit.action, 'SPATIAL_SCREENING_EXECUTED');
  assert.equal(audit.payload.findingsCount, 2);
});

test('F24 Tier 1: Records PDF report export audit event', () => {
  const audit = logAuditEvent('user_client_01', 'org_karnataka_legal', 'REPORT_EXPORTED', 'report_snapshot', 'rep_555', {
    format: 'pdf',
    riskScore: 35,
  });
  assert.equal(audit.action, 'REPORT_EXPORTED');
  assert.equal(audit.payload.format, 'pdf');
});

test('F24 Tier 1: Records title dispute logged audit event', () => {
  const audit = logAuditEvent('legal_lead_01', 'org_karnataka_legal', 'TITLE_EVENT_DISPUTED', 'title_event', 'te_001', {
    rationaleCategory: 'MISSING_LINK_DOC',
    rationale: 'Missing preceding 1995 deed',
  });
  assert.equal(audit.action, 'TITLE_EVENT_DISPUTED');
  assert.equal(audit.payload.rationaleCategory, 'MISSING_LINK_DOC');
});

test('F24 Tier 2: Generates unique audit IDs for consecutive calls', () => {
  const audit1 = logAuditEvent('user1', 'org1', 'ACTION', 'entity', 'e1', {});
  const audit2 = logAuditEvent('user1', 'org1', 'ACTION', 'entity', 'e1', {});
  assert.notEqual(audit1.id, audit2.id);
});

test('F24 Tier 2: Audit timestamp is valid ISO 8601 string', () => {
  const audit = logAuditEvent('user1', 'org1', 'ACTION', 'entity', 'e1', {});
  assert.ok(!isNaN(Date.parse(audit.timestamp)));
});

test('F24 Tier 2: Handles complex nested payload structures', () => {
  const payload = { a: { b: { c: [1, 2, 3] } }, flag: true };
  const audit = logAuditEvent('user1', 'org1', 'COMPLEX_ACTION', 'entity', 'e1', payload);
  assert.deepEqual(audit.payload, payload);
});

test('F24 Tier 2: Preserves actor UID and tenant ID integrity', () => {
  const audit = logAuditEvent('actor_special_#42', 'tenant_blr_east', 'TEST', 'type', 'id', {});
  assert.equal(audit.actorUid, 'actor_special_#42');
  assert.equal(audit.tenantId, 'tenant_blr_east');
});

test('F24 Tier 2: Handles null or empty payload gracefully', () => {
  const audit = logAuditEvent('user1', 'org1', 'PING', 'system', 'sys1', null);
  assert.equal(audit.payload, null);
});

// ============================================================================
// TIER 3: Cross-Feature Combinations (Pairwise)
// ============================================================================

test('Tier 3 Pairwise: Document Classification -> Extraction -> Bounding Box Anchoring', () => {
  const rawText = 'Absolute Sale Deed (Kraya Patra). Vendor: Sri K. R. Ramesh S/o Kadirappa. Sy No: 34/2. Extent: 1 Acre 20 Guntas. Consideration: Rs. 4,500,000';
  const classification = classifyDocument(rawText);
  assert.equal(classification.documentType, 'sale_deed');

  const metadata = extractDocumentMetadata(rawText, classification.documentType);
  assert.equal(metadata.propertySchedule.surveyNumber, '34/2');
  assert.equal(metadata.propertySchedule.extent.normalizedSqFt, 65340);

  // Verify bounding box on schedule anchor
  const anchor = metadata.propertySchedule.evidenceAnchor;
  assert.ok(anchor);
  assert.equal(validateBoundingBox(anchor.boundingBox), true);
  assert.ok(anchor.confidenceScore >= 0.85);
});

test('Tier 3 Pairwise: Document Upload -> Checksum -> Tenant Isolation -> Audit Logging', () => {
  const fileBuffer = Buffer.from('%PDF-1.4\nSale Deed executed at Bommanahalli SRO\n');
  const checksum = computeSha256Checksum(fileBuffer);
  assert.equal(checksum.length, 64);

  const tenantAllowed = verifyTenantIsolation('org_karnataka_legal', 'org_karnataka_legal');
  assert.equal(tenantAllowed, true);

  const audit = logAuditEvent('user_1', 'org_karnataka_legal', 'DOCUMENT_UPLOAD', 'document', 'doc_999', {
    sha256: checksum,
    byteSize: fileBuffer.length,
  });
  assert.equal(audit.payload.sha256, checksum);
});

test('Tier 3 Pairwise: Field Extraction -> Reviewer Override -> Audit Trail', () => {
  const initial = extractDocumentMetadata('Sy No: 34/2 Extent: 1 Acre', 'sale_deed');
  const overridden = applyFieldOverride(
    initial,
    'propertySchedule.surveyNumber',
    '34/2B',
    'Subdivision sketch indicates hissa 2B',
    'advocate_reviewer_1'
  );

  const audit = logAuditEvent('advocate_reviewer_1', 'org_karnataka_legal', 'FIELD_OVERRIDE', 'document', 'doc_001', {
    field: 'propertySchedule.surveyNumber',
    previous: initial.propertySchedule.surveyNumber,
    new: overridden.propertySchedule.surveyNumber,
    rationale: overridden.reviewState.overrides?.['propertySchedule.surveyNumber']?.rationale,
  });

  assert.equal(overridden.propertySchedule.surveyNumber, '34/2B');
  assert.equal(audit.payload.previous, '34/2');
  assert.equal(audit.payload.new, '34/2B');
  assert.equal(audit.payload.rationale, 'Subdivision sketch indicates hissa 2B');
});

// ============================================================================
// DIRECT INTEGRATION TESTS WITH apps/api/src/document-extractor.ts
// ============================================================================

test('Direct Extractor Integration: classifyKarnatakaDocument classifies all 6 Karnataka types', async () => {
  const { classifyKarnatakaDocument } = await import('../src/document-extractor.js');

  const sale = classifyKarnatakaDocument('Registered Absolute Sale Deed Kraya Patra executed at Bommanahalli');
  assert.equal(sale.docType, 'sale_deed');

  const gift = classifyKarnatakaDocument('Gift Deed Dhana Patra executed in favor of daughter');
  assert.equal(gift.docType, 'gift_deed');

  const rtc = classifyKarnatakaDocument('Bhoomi RTC Form No 16 Record of Rights Pahani');
  assert.equal(rtc.docType, 'rtc_pahani');

  const ec = classifyKarnatakaDocument('Kaveri Form 15 Encumbrance Certificate Nil Encumbrance');
  assert.equal(ec.docType, 'encumbrance_certificate');

  const khata = classifyKarnatakaDocument('BBMP e-Aasthi Form 3 e-Khata Certificate');
  assert.equal(khata.docType, 'e_khata');

  const mutation = classifyKarnatakaDocument('Bhoomi Mutation Extract MR No 14/2021-22');
  assert.equal(mutation.docType, 'mutation_extract');
});

test('Direct Extractor Integration: extractDocument parses full text into ExtractedDocumentFields', async () => {
  const { extractDocument } = await import('../src/document-extractor.js');

  const docText = `
    Registered Absolute Sale Deed (Kraya Patra)
    Document No: BMA-1-04521-2018-19
    Executed on: 12/05/2018 at Bommanahalli SRO
    Vendor: Sri K. R. Ramesh S/o Kadirappa, residing at Bangalore
    Purchaser: Smt Lakshmi W/o Suresh, residing at Bangalore
    Property Schedule:
    Survey Number: 34/2 Village: Arakere
    Extent: 1 Acre
    Boundaries:
    North by 60ft Main Road
    South by Survey 34/3
    East by Private Land
    West by Lake Boundary
    Sale Consideration: Rs. 8,500,000
  `;

  const extracted = extractDocument(docText, { documentId: 'test-doc-1' });
  assert.equal(extracted.documentType, 'sale_deed');
  assert.equal(extracted.propertySchedule.surveyNumber, '34/2');
  assert.equal(extracted.propertySchedule.subdivisionHissa, '2');
  assert.equal(extracted.propertySchedule.extent.normalizedSqFt, 43560);
  assert.ok(extracted.parties.length >= 2);
  assert.equal(extracted.propertySchedule.boundaries.north, '60ft Main Road');
  assert.equal(extracted.consideration?.amount, 8500000);
  assert.ok(extracted.propertySchedule.evidenceAnchor);
  assert.equal(validateBoundingBox(extracted.propertySchedule.evidenceAnchor.boundingBox), true);
});

test('Sale deed OCR: structures Kannada identity, parties, dates, schedule and separate charges', async () => {
  const { extractDocument } = await import('../src/document-extractor.js');
  const text = `ಶುದ್ಧ ಕ್ರಯ ಪತ್ರ
ದಸ್ತಾವೇಜು ಸಂಖ್ಯೆ 489
໖: 17-01-2025
ಸುಮಾರು 52 ವರ್ಷದ ದೇವರಾಜು.ಎಸ್.ಆರ್ ಬಿನ್ ರಾಮೇಗೌಡ
1). ಎಸ್.ಎಲ್.ರಾಮಕೃಷ್ಣ ಬಿನ್ ಎಸ್.ಲಿಂಗಪ್ಪಯ್ಯ ಸುಮಾರು 69 ವರ್ಷ
2). ಪವನಸುತ.ಆರ್ ಬಿನ್ ಎಸ್.ಎಲ್.ರಾಮಕೃಷ್ಣ ಸುಮಾರು 39 ವರ್ಷ
3). ಶ್ವೇತ.ಹೆಚ್.ಎಸ್ ಕೋಂ ಪವನಸುತ.ಆರ್ ಸುಮಾರು 37 ವರ್ಷ
4). ಜೀವನ್.ಆರ್ ಬಿನ್ ಎಸ್.ಎಲ್.ರಾಮಕೃಷ್ಣ ಸುಮಾರು 36 ವರ್ಷ
5). ರಮ್ಯ.ಎಸ್.ಪಿ ಕೋಂ ಜೀವನ್.ಆರ್ ಸುಮಾರು 29 ವರ್ಷ
ನಿಗದಿತ ಮುದ್ರಾಂಕ ಶುಲ್ಕವಾಗಿ ₹56,500.00 ಪಾವತಿಸಿರುವುದನ್ನು ದೃಢೀಕರಿಸಲಾಗಿದೆ.
Online Challan Reference Number RG0125000014826200
MR.NO. 10/2006-2007 ಖಾತ ನಂ:7
ಶುದ್ಧ ಕ್ರಯಕ್ಕೆ ಮೊಬಲಗು 10,00,000/- ರೂಪಾಯಿಗಳು.
ನೋಂದಣಿ ಶುಲ್ಕ 10,000.00
ಸೇವಾ ಶುಲ್ಕ 350.00
ಪರಿವರ್ತನಾ ಶುಲ್ಕ 35.00
ಪ್ರಮಾಣ ಪತ್ರ ಮುದ್ರಾಂಕ ಶುಲ್ಕ 100.00
10,485.00
ದಸ್ತಾವೇಜು ಸಂಖ್ಯೆ :- PDP-1-05489-2024-25
ಪಾಂಡವಪುರ ಉಪ ನೋಂದಣಿ ಕಚೇರಿಯಲ್ಲಿ ದಿನಾಂಕ 20/01/2025 ರಂದು
ಮಂಡ್ಯ ಜಿಲ್ಲೆ, ಪಾಂಡವಪುರ ತಾಲ್ಲೂಕು, ಕಸಬಾ ಹೋಬಳಿ, ಬಳೆಅತ್ತಿಗುಪ್ಪೆ ಗ್ರಾಮದ ಸರ್ವೆ ನಂ: 6
ಉತ್ತರಕ್ಕೆ :- ಪಟೇಲ್ ಚಂದ್ರು ರವರ ಜಮೀನು
ಪೂರ್ವಕ್ಕೆ:- ಕೀರೆ ಮಡವು
ಪಶ್ಚಿಮಕ್ಕೆ:- ಹರಿಜನ ಕಾಲೋನಿ
ದಕ್ಷಿಣಕ್ಕೆ:- ಮಹದೇವಮ್ಮರ ಜಮೀನು
ಖುಷಿ ವಿಸ್ತಿರ್ಣ 3-09 (ಮೂರು ಎಕರೆ ಒಂಭತ್ತು ಗುಂಟೆ)
`;
  const extracted = extractDocument(text, { documentId: 'sale-deed-ocr-test' });
  assert.equal(extracted.documentType, 'sale_deed');
  assert.equal(extracted.executionDate, '2025-01-17');
  assert.equal(extracted.registrationDate, '2025-01-20');
  assert.equal(extracted.subRegistrarOffice, 'SRO ಪಾಂಡವಪುರ');
  assert.equal(extracted.documentNumber, '489');
  assert.equal(extracted.registrationNumber, 'PDP-1-05489-2024-25');
  assert.equal(extracted.propertySchedule.district, 'ಮಂಡ್ಯ');
  assert.equal(extracted.propertySchedule.taluk, 'ಪಾಂಡವಪುರ Taluk');
  assert.equal(extracted.propertySchedule.hobli, 'ಕಸಬಾ Hobli');
  assert.equal(extracted.propertySchedule.village, 'ಬಳೆಅತ್ತಿಗುಪ್ಪೆ');
  assert.equal(extracted.propertySchedule.surveyNumber, '6');
  assert.equal(extracted.propertySchedule.subdivisionHissa, undefined);
  assert.equal(extracted.propertySchedule.extent.acres, 3);
  assert.equal(extracted.propertySchedule.extent.guntas, 9);
  assert.equal(extracted.propertySchedule.khataNumber, '7');
  assert.equal(extracted.propertySchedule.mutationReference, '10/2006-2007');
  assert.equal(extracted.propertySchedule.boundaries.east, 'ಕೀರೆ ಮಡವು');
  assert.equal(extracted.propertySchedule.boundaries.west, 'ಹರಿಜನ ಕಾಲೋನಿ');
  assert.equal(extracted.propertySchedule.boundaries.north, 'ಪಟೇಲ್ ಚಂದ್ರು ರವರ ಜಮೀನು');
  assert.equal(extracted.propertySchedule.boundaries.south, 'ಮಹದೇವಮ್ಮರ ಜಮೀನು');
  assert.equal(extracted.parties.filter(p => p.role === 'seller').length, 5);
  assert.equal(extracted.parties.find(p => p.role === 'buyer')?.name, 'ದೇವರಾಜು.ಎಸ್.ಆರ್');
  assert.equal(extracted.consideration?.amount, 1_000_000);
  assert.ok(extracted.financialItems?.some(i => i.category === 'stamp_duty' && i.amount === 56_500));
  assert.ok(extracted.financialItems?.some(i => i.category === 'registration_fee' && i.amount === 10_000));
  assert.ok(extracted.financialItems?.some(i => i.category === 'service_fee' && i.amount === 350));
  assert.ok(extracted.financialItems?.some(i => i.category === 'challan' && i.reference === 'RG0125000014826200'));
  assert.ok(extracted.ownershipEvents?.some(event => event.eventType === 'Mutation / khata entry stated'));
  assert.ok(extracted.ownershipEvents?.some(event => event.sourceStatus === 'registered_document'));
});

test('Direct Extractor Integration: normalizeKarnatakaExtent converts compound guntas and dimensions', async () => {
  const { normalizeKarnatakaExtent } = await import('../src/document-extractor.js');

  const e1 = normalizeKarnatakaExtent('1 Acre 20 Guntas');
  assert.equal(e1.normalizedSqFt, 65340);

  const e2 = normalizeKarnatakaExtent('1 Acre 5 1/2 Guntas');
  assert.equal(e2.normalizedSqFt, 49549.5);

  const e3 = normalizeKarnatakaExtent('40 x 60 ft');
  assert.equal(e3.normalizedSqFt, 2400);

  const e4 = normalizeKarnatakaExtent('50 Cents');
  assert.equal(e4.normalizedSqFt, 21780);
});
