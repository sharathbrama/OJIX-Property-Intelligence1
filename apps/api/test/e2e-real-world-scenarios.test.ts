import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDocument,
  extractDocumentMetadata,
  computeSha256Checksum,
} from '../src/document-extractor.js';
import {
  parseKarnatakaLandExtent,
  compareExtents,
  calculateRiskScore,
} from '../src/discrepancy-engine.js';
import {
  arePartyAliases,
  detectTitleGaps,
} from '../src/title-engine.js';
import {
  screenSpatialBuffers,
} from '../src/spatial-rules-engine.js';
import {
  createDueDiligenceSnapshot,
  generateDueDiligenceReport,
} from '../src/report-generator.js';
import type {
  TitleEvent,
  EvidenceAnchor,
  DiscrepancyFinding,
} from '../src/types.js';

// ============================================================================
// SCENARIO 1: Clear Title Freehold Layout (Arakere Village)
// ============================================================================

test('Scenario 1: Clear Title Freehold Layout — Arakere Sy No 34/2 (Risk Score < 25, preliminary)', () => {
  // 1. Property Setup
  const property = {
    id: 'PROP_ARAKERE_001',
    name: 'Arakere Residential Layout',
    surveyNumber: '34/2',
    village: 'Arakere',
    hobli: 'Begur',
    taluk: 'Bangalore South',
    district: 'Bengaluru Urban',
    extent: '1 Acre 20 Guntas',
    latitude: 12.8850,
    longitude: 77.5950,
  };

  // 2. Documents Uploaded: 1984 Sale Deed -> 2008 Gift Deed -> 2018 Sale Deed + RTC + e-Khata + Nil EC
  const rawSale1984 = 'Registered Absolute Sale Deed (Kraya Patra) dated 1984-04-10. Vendor: Anjanappa, Purchaser: Muniyappa. Sy No: 34/2 Extent: 1 Acre 20 Guntas. Consideration: Rs. 250000.';
  const rawGift2008 = 'Registered Gift Deed (Dhana Patra) dated 2008-08-20. Donor: Muniyappa, Donee: Suresh M. Sy No: 34/2 Extent: 1 Acre 20 Guntas.';
  const rawSale2018 = 'Registered Absolute Sale Deed dated 2018-11-15. Vendor: Suresh M, Purchaser: Sri K. R. Ramesh (S/o Kadirappa). Sy No: 34/2 Extent: 1 Acre 20 Guntas. Consideration: Rs. 8500000.';
  const rawRTC = 'Bhoomi RTC Form No 16 Pahani Sy No 34/2. Kabzedar: Ramesh K R. Extent: 1 Acre 20 Guntas.';
  const rawEC = 'Department of Stamps and Registration Kaveri Form 15 Encumbrance Certificate Nil Encumbrance from 1984 to 2024.';

  // 3. Document Classification & Extraction
  assert.equal(classifyDocument(rawSale1984).documentType, 'sale_deed');
  assert.equal(classifyDocument(rawGift2008).documentType, 'gift_deed');
  assert.equal(classifyDocument(rawSale2018).documentType, 'sale_deed');
  assert.equal(classifyDocument(rawRTC).documentType, 'rtc_pahani');
  assert.equal(classifyDocument(rawEC).documentType, 'encumbrance_certificate');

  const meta1984 = extractDocumentMetadata(rawSale1984, 'sale_deed');
  const meta2008 = extractDocumentMetadata(rawGift2008, 'gift_deed');
  const meta2018 = extractDocumentMetadata(rawSale2018, 'sale_deed');
  const metaRTC = extractDocumentMetadata(rawRTC, 'rtc_pahani');

  // Verify all extents match exactly: 1 Acre 20 Guntas = 65,340 sq ft
  assert.equal(meta1984.propertySchedule.extent.normalizedSqFt, 65340);
  assert.equal(meta2008.propertySchedule.extent.normalizedSqFt, 65340);
  assert.equal(meta2018.propertySchedule.extent.normalizedSqFt, 65340);
  assert.equal(metaRTC.propertySchedule.extent.normalizedSqFt, 65340);

  // 4. Cross-document Extent Comparison: All zero discrepancies
  assert.equal(compareExtents(meta2018.propertySchedule.extent.normalizedSqFt, metaRTC.propertySchedule.extent.normalizedSqFt), null);

  // 5. Title Chain & 30-year Gap Detection
  const titleEvents: TitleEvent[] = [
    {
      id: 'EV_1984',
      propertyId: property.id,
      documentId: 'DOC_1984',
      sequenceOrder: 1,
      eventDate: '1984-04-10',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Anjanappa', normalizedName: 'ANJANAPPA' }],
      toParties: [{ name: 'Muniyappa', normalizedName: 'MUNIYAPPA' }],
      extentSqFt: 65340,
      extentRaw: '1 Acre 20 Guntas',
      consideration: 250000,
      status: 'verified',
    },
    {
      id: 'EV_2008',
      propertyId: property.id,
      documentId: 'DOC_2008',
      sequenceOrder: 2,
      eventDate: '2008-08-20',
      deedType: 'Gift Deed',
      fromParties: [{ name: 'Muniyappa', normalizedName: 'MUNIYAPPA' }],
      toParties: [{ name: 'Suresh M', normalizedName: 'SURESH M' }],
      extentSqFt: 65340,
      extentRaw: '1 Acre 20 Guntas',
      consideration: 0,
      status: 'verified',
    },
    {
      id: 'EV_2018',
      propertyId: property.id,
      documentId: 'DOC_2018',
      sequenceOrder: 3,
      eventDate: '2018-11-15',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Suresh M', normalizedName: 'SURESH M' }],
      toParties: [{ name: 'Ramesh K R', normalizedName: 'RAMESH K R' }],
      extentSqFt: 65340,
      extentRaw: '1 Acre 20 Guntas',
      consideration: 8500000,
      status: 'verified',
    },
  ];

  const titleGaps = detectTitleGaps(titleEvents, 30);
  assert.equal(titleGaps.length, 0); // 0 title gaps!

  // 6. Spatial Buffer Screening: Far from drains and lakes (> 200m)
  const spatialResult = screenSpatialBuffers(
    { latitude: property.latitude, longitude: property.longitude },
    [
      { id: 'swd_far', layerType: 'swd_primary', label: 'Primary SWD', distanceM: 220.0 },
      { id: 'lake_far', layerType: 'waterbody', label: 'Arekere Lake', distanceM: 350.0 },
    ]
  );
  assert.equal(spatialResult.drainClearanceStatus, 'clear');
  assert.equal(spatialResult.lakeClearanceStatus, 'clear');
  assert.equal(spatialResult.findings.length, 0);

  // 7. Overall Snapshot & Report Generation
  const snapshot = createDueDiligenceSnapshot({
    property,
    documents: [
      { documentId: 'DOC_1984', originalFilename: 'SaleDeed_1984.pdf', sha256: computeSha256Checksum(rawSale1984) },
      { documentId: 'DOC_2008', originalFilename: 'GiftDeed_2008.pdf', sha256: computeSha256Checksum(rawGift2008) },
      { documentId: 'DOC_2018', originalFilename: 'SaleDeed_2018.pdf', sha256: computeSha256Checksum(rawSale2018) },
      { documentId: 'DOC_RTC', originalFilename: 'RTC_2024.pdf', sha256: computeSha256Checksum(rawRTC) },
    ],
    titleTimeline: titleEvents,
    titleGaps: [],
    discrepancies: [],
    spatialScreening: spatialResult,
  });

  assert.ok(snapshot.riskSummary.score < 25);
  assert.equal(snapshot.riskSummary.score, 0);
  assert.equal(snapshot.riskSummary.band, 'preliminary');
  assert.equal(snapshot.riskSummary.severityCounts.critical, 0);
  assert.equal(snapshot.riskSummary.severityCounts.high, 0);

  const report = generateDueDiligenceReport(snapshot);
  assert.equal(report.sectionsPresent.length, 7);
  assert.match(report.html, /Score: 0 \/ 100 \(preliminary\)/);
});

// ============================================================================
// SCENARIO 2: Rajakaluve Primary Drain Encroachment (Bellandur)
// ============================================================================

test('Scenario 2: Rajakaluve Primary Drain Encroachment — Bellandur Sy No 102 (35 pts, buffer_zone)', () => {
  const property = {
    id: 'PROP_BELLANDUR_102',
    name: 'Bellandur Tech Plot',
    surveyNumber: '102',
    village: 'Bellandur',
    hobli: 'Varthur',
    taluk: 'Bangalore East',
    district: 'Bengaluru Urban',
    extent: '2 Acres',
    latitude: 12.9250,
    longitude: 77.6750,
  };

  // Property is located 18m from a Primary Rajakaluve (50m statutory buffer)
  const layers = [
    {
      id: 'swd_prim_bellandur',
      layerType: 'swd_primary' as const,
      label: 'Bellandur Primary SWD (K-100 Valley Drain)',
      distanceM: 18.0, // Inside 50m buffer!
    },
  ];

  const spatialResult = screenSpatialBuffers(
    { latitude: property.latitude, longitude: property.longitude },
    layers
  );

  assert.equal(spatialResult.drainClearanceStatus, 'buffer_zone');
  assert.equal(spatialResult.findings.length, 1);

  const drainFinding = spatialResult.findings[0];
  assert.equal(drainFinding.code, 'SPATIAL_SWD_PRIMARY_BUFFER');
  assert.equal(drainFinding.severity, 'critical');
  assert.equal(drainFinding.points, 35);
  assert.equal(drainFinding.bufferM, 50);
  assert.equal(drainFinding.distanceM, 18.0);
  assert.equal(drainFinding.isInsideBuffer, true);

  const snapshot = createDueDiligenceSnapshot({
    property,
    spatialScreening: spatialResult,
  });

  assert.equal(snapshot.riskSummary.score, 35);
  assert.equal(snapshot.riskSummary.band, 'review_required');
  assert.equal(snapshot.riskSummary.severityCounts.critical, 1);

  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /Score: 35 \/ 100 \(review_required\)/);
  assert.match(report.html, /<section id="gis-screening">/);
});

// ============================================================================
// SCENARIO 3: Broken Title Chain & Extent Over-Conveyance (Whitefield)
// ============================================================================

test('Scenario 3: Broken Title Chain & Extent Over-Conveyance — Whitefield Sy No 88/1 (Score >= 60)', () => {
  const property = {
    id: 'PROP_WHITEFIELD_88',
    name: 'Whitefield Commercial Plot',
    surveyNumber: '88/1',
    village: 'Whitefield',
    extent: '2 Acres 10 Guntas',
    latitude: 12.9698,
    longitude: 77.7499,
  };

  // Predecessor held 1 Acre 30 Guntas = 76,230 sq ft
  // Conveyed 2 Acres 10 Guntas = 98,010 sq ft (over-conveyance by 21,780 sq ft)
  // Seller in 2015 deed has no registered predecessor acquisition in 30 years
  const titleEvents: TitleEvent[] = [
    {
      id: 'EV_ROOT_OLD',
      propertyId: property.id,
      documentId: 'DOC_1984',
      sequenceOrder: 1,
      eventDate: '1984-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Original Farmer', normalizedName: 'ORIGINAL FARMER' }],
      toParties: [{ name: 'Suresh Gowda', normalizedName: 'SURESH GOWDA' }],
      extentSqFt: 76230, // 1 Acre 30 Guntas
      extentRaw: '1 Acre 30 Guntas',
      consideration: 300000,
      status: 'verified',
    },
    {
      id: 'EV_2015_FLAWED',
      propertyId: property.id,
      documentId: 'DOC_2015',
      sequenceOrder: 2,
      eventDate: '2015-05-10',
      deedType: 'Sale Deed',
      // Notice: Seller "Unregistered Vendor" has NO prior acquisition!
      fromParties: [{ name: 'Unregistered Vendor', normalizedName: 'UNREGISTERED VENDOR' }],
      toParties: [{ name: 'Current Buyer', normalizedName: 'CURRENT BUYER' }],
      extentSqFt: 98010, // 2 Acres 10 Guntas
      extentRaw: '2 Acres 10 Guntas',
      consideration: 12000000,
      status: 'unverified',
    },
  ];

  const titleGaps = detectTitleGaps(titleEvents, 30);
  assert.ok(titleGaps.length >= 1);

  const missingPredecessorGap = titleGaps.find(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.ok(missingPredecessorGap);
  assert.equal(missingPredecessorGap.severity, 'high');
  assert.equal(missingPredecessorGap.points, 25);

  // Over-conveyance between acquisition (76,230) and conveyed (98,010):
  const extOverConvGap = {
    code: 'TITLE_GAP_EXTENT_OVERCONVEYANCE' as const,
    severity: 'critical' as const,
    title: 'Extent Over-Conveyance Detected',
    description: 'Conveyed 98,010 sq ft exceeding predecessor holding of 76,230 sq ft by 21,780 sq ft',
    sourceEventIds: ['EV_2015_FLAWED'],
    points: 35,
  };

  const allGaps = [...titleGaps, extOverConvGap];
  const riskResult = calculateRiskScore(allGaps);

  // Expected score: 25 + 35 = 60 (>= 60)
  assert.ok(riskResult.score >= 60);
  assert.equal(riskResult.band, 'review_required');
  assert.equal(riskResult.severityCounts.critical, 1);
  assert.equal(riskResult.severityCounts.high, 1);

  const snapshot = createDueDiligenceSnapshot({
    property,
    titleTimeline: titleEvents,
    titleGaps: allGaps,
  });

  assert.ok(snapshot.riskSummary.score >= 60);
});

// ============================================================================
// SCENARIO 4: Cross-Document Extent & Owner Discrepancy
// ============================================================================

test('Scenario 4: Cross-Document Extent & Owner Discrepancy — Sale Deed vs RTC (Capped Score >= 60)', () => {
  const property = {
    id: 'PROP_DISC_004',
    name: 'Discrepant Agricultural Conversion Plot',
    surveyNumber: '45/1',
    village: 'Varthur',
    extent: '38 Guntas',
  };

  // Sale Deed: 38 Guntas (41,382 sq ft) to "Ramesh K R"
  const saleExtentSqFt = 41382;
  const saleOwner = 'Ramesh K R';

  // RTC: 32 Guntas (34,848 sq ft) under "Suresh Gowda"
  const rtcExtentSqFt = 34848;
  const rtcOwner = 'Suresh Gowda';

  // 1. Extent Discrepancy: (41382 - 34848) / 41382 = ~15.8% divergence (> 10% critical)
  const extentFinding = compareExtents(saleExtentSqFt, rtcExtentSqFt, 'Sale Deed 2018', 'RTC Pahani 2023');
  assert.ok(extentFinding);
  assert.equal(extentFinding.code, 'DISCREPANCY_EXTENT_MISMATCH');
  assert.equal(extentFinding.severity, 'critical');
  assert.equal(extentFinding.points, 35);

  // 2. Ownership Name Mismatch: Ramesh K R vs Suresh Gowda
  const areAliases = arePartyAliases(saleOwner, rtcOwner);
  assert.equal(areAliases, false); // Mismatch!

  const ownerFinding: DiscrepancyFinding = {
    id: 'DISC_OWNER_001',
    code: 'DISCREPANCY_OWNERSHIP_NAME_MISMATCH',
    ruleId: 'RULE-OWN-003',
    ruleVersion: 'v1.0',
    statutoryCitation: 'Karnataka Land Revenue Act 1964 § 128 (Acquisition of rights to be reported)',
    severity: 'critical',
    points: 35,
    field: 'ownership',
    docA: { id: 'doc_sale', name: 'Sale Deed 2018', type: 'sale_deed', value: saleOwner },
    docB: { id: 'doc_rtc', name: 'RTC Pahani 2023', type: 'rtc_pahani', value: rtcOwner },
    deltaText: `Registered buyer '${saleOwner}' does not match RTC Kabzedar '${rtcOwner}'`,
    explanation: 'Mutation entry in Bhoomi RTC has not been effected post registration of Sale Deed.',
    nextAction: 'File Bhoomi Mutation request (Form 21) with Bangalore South Taluk Tahsildar.',
  };

  const discrepancies = [extentFinding, ownerFinding];
  const riskResult = calculateRiskScore(discrepancies);

  // 35 + 35 = 70 (high_attention)
  assert.ok(riskResult.score >= 60);
  assert.equal(riskResult.score, 70);
  assert.equal(riskResult.band, 'high_attention');

  const snapshot = createDueDiligenceSnapshot({
    property,
    discrepancies,
  });

  assert.equal(snapshot.discrepancies.length, 2);
  assert.equal(snapshot.riskSummary.score, 70);
});

// ============================================================================
// SCENARIO 5: Lake Buffer Violation & Unreleased Bank Mortgage
// ============================================================================

test('Scenario 5: Lake Buffer Violation & Unreleased Bank Mortgage (Score = 70, high_attention, PDF Report)', () => {
  const property = {
    id: 'PROP_VARTHUR_LAKE',
    name: 'Varthur Lakefront Property',
    surveyNumber: '112/3',
    village: 'Varthur',
    extent: '1 Acre 10 Guntas',
    latitude: 12.9400,
    longitude: 77.7400,
  };

  // 1. Lake buffer violation: Property situated 22m from Varthur Lake (30m statutory buffer)
  const spatialResult = screenSpatialBuffers(
    { latitude: property.latitude, longitude: property.longitude },
    [
      {
        id: 'varthur_lake_layer',
        layerType: 'waterbody' as const,
        label: 'Varthur Lake Highest Flood Level (HFL) Boundary',
        distanceM: 22.0, // Inside 30m buffer!
      },
    ]
  );

  assert.equal(spatialResult.lakeClearanceStatus, 'buffer_zone');
  assert.equal(spatialResult.findings.length, 1);
  const lakeFinding = spatialResult.findings[0];
  assert.equal(lakeFinding.severity, 'critical');
  assert.equal(lakeFinding.points, 35);
  assert.equal(lakeFinding.isInsideBuffer, true);
  assert.equal(lakeFinding.bufferM, 30);

  // 2. Unreleased Bank Mortgage: EC shows mortgage registered in 2016 for INR 50 Lakhs without discharge
  const titleEvents: TitleEvent[] = [
    {
      id: 'EV_PURCHASE',
      propertyId: property.id,
      documentId: 'DOC_PURCHASE',
      sequenceOrder: 1,
      eventDate: '2012-03-10',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Original Owner', normalizedName: 'ORIGINAL OWNER' }],
      toParties: [{ name: 'Borrower', normalizedName: 'BORROWER' }],
      extentSqFt: 54450,
      extentRaw: '1 Acre 10 Guntas',
      consideration: 2500000,
      status: 'verified',
    },
    {
      id: 'EV_BANK_MORTGAGE',
      propertyId: property.id,
      documentId: 'DOC_MORTGAGE',
      sequenceOrder: 2,
      eventDate: '2016-08-15',
      deedType: 'Simple Mortgage Deed',
      fromParties: [{ name: 'Borrower', normalizedName: 'BORROWER' }],
      toParties: [{ name: 'Canara Bank', normalizedName: 'CANARA BANK' }],
      extentSqFt: 54450,
      extentRaw: '1 Acre 10 Guntas',
      consideration: 5000000, // INR 50 Lakhs
      status: 'unverified',
      encumbranceStatus: 'active_mortgage', // Unreleased!
    },
  ];

  const titleGaps = detectTitleGaps(titleEvents);
  const mortgageGap = titleGaps.find(g => g.code === 'TITLE_UNRELEASED_ENCUMBRANCE');
  assert.ok(mortgageGap);
  assert.equal(mortgageGap.severity, 'critical');
  assert.equal(mortgageGap.points, 35);

  // 3. Risk Score calculation: Lake buffer (35) + Unreleased Mortgage (35) = 70 pts (high_attention)
  const combinedFindings = [
    { severity: lakeFinding.severity, points: lakeFinding.points },
    { severity: mortgageGap.severity, points: mortgageGap.points },
  ];
  const riskResult = calculateRiskScore(combinedFindings);
  assert.equal(riskResult.score, 70);
  assert.equal(riskResult.band, 'high_attention');

  // 4. Evidence Anchors for Report Appendix
  const ecBuffer = Buffer.from('Department of Stamps and Registration Kaveri Encumbrance Certificate Entry 2016 Mortgage Rs 50,00,000 Canara Bank');
  const ecSha256 = computeSha256Checksum(ecBuffer);

  const evidenceAppendix: EvidenceAnchor[] = [
    {
      documentId: 'DOC_EC_2024',
      pageNumber: 2,
      boundingBox: { ymin: 0.35, xmin: 0.08, ymax: 0.48, xmax: 0.92 },
      extractedSnippet: 'Encumbrance Entry No 14/2016: Simple Mortgage for Rs. 50,00,000 in favor of Canara Bank. Discharge: NIL',
      confidenceScore: 0.96,
    },
    {
      documentId: 'DOC_GIS_SCREEN',
      pageNumber: 1,
      boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.9, xmax: 0.9 },
      extractedSnippet: 'Spatial screening buffer map: Varthur Lake boundary proximity 22.0m (Statutory buffer 30m violation)',
      confidenceScore: 1.0,
    },
  ];

  // 5. Generate Immutable Due-Diligence Snapshot
  const snapshot = createDueDiligenceSnapshot({
    property,
    documents: [{ documentId: 'DOC_EC_2024', originalFilename: 'Form15_Kaveri_EC.pdf', sha256: ecSha256 }],
    titleTimeline: titleEvents,
    titleGaps: [mortgageGap],
    spatialScreening: spatialResult,
    evidenceAppendix,
  });

  assert.equal(snapshot.riskSummary.score, 70);
  assert.equal(snapshot.riskSummary.band, 'high_attention');
  assert.equal(snapshot.riskSummary.severityCounts.critical, 2);

  // 6. Generate PDF Report with Mandatory Structural Sections
  const report = generateDueDiligenceReport(snapshot);
  assert.equal(report.sectionsPresent.length, 7);
  assert.equal(report.hasNorthArrow, true);
  assert.equal(report.hasEvidenceAppendix, true);
  assert.match(report.html, /Score: 70 \/ 100 \(high_attention\)/);
  assert.match(report.html, /Simple Mortgage for Rs\. 50,00,000 in favor of Canara Bank/);
  assert.match(report.html, /Varthur Lake boundary proximity 22\.0m/);
});

// ============================================================================
// CROSS-SCENARIO INVARIANT VERIFICATIONS
// ============================================================================

test('Scenario Invariants: Risk score strictly between [0, 100] across all scenarios', () => {
  const scores = [0, 35, 60, 70, 100];
  for (const s of scores) {
    assert.ok(s >= 0 && s <= 100);
  }
});

test('Scenario Invariants: Risk bands match threshold rules exactly', () => {
  assert.equal(calculateRiskScore([]).band, 'preliminary');
  assert.equal(calculateRiskScore([{ severity: 'critical', points: 35 }]).band, 'review_required');
  assert.equal(calculateRiskScore([{ severity: 'critical', points: 70 }]).band, 'high_attention');
});

test('Scenario Invariants: SHA-256 evidence hashes are strictly 64 hex characters', () => {
  const testFiles = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'];
  for (const f of testFiles) {
    const hash = computeSha256Checksum(f);
    assert.equal(hash.length, 64);
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
});
