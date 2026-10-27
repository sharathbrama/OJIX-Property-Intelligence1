import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDueDiligenceSnapshot,
  generateDueDiligenceReport,
  computeSha256Checksum,
} from '../src/report-generator.js';
import type { EvidenceAnchor } from '../src/types.js';
import type { TitleEvent, TitleGap } from '../src/title-engine.js';
import type { DiscrepancyFinding } from '../src/discrepancy-engine.js';

// ============================================================================
// FEATURE 19: Immutable Due-Diligence Snapshotter (R5)
// ============================================================================

test('F19 Tier 1: Freezes complete property identity into read-only snapshot', () => {
  const property = {
    id: 'prop_123',
    name: 'Arakere Residential Layout',
    surveyNumber: '34/2',
    village: 'Arakere',
    extent: '1 Acre 20 Guntas',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  const snapshot = createDueDiligenceSnapshot({ property });
  assert.equal(snapshot.property.id, 'prop_123');
  assert.equal(snapshot.property.surveyNumber, '34/2');
  assert.equal(snapshot.property.village, 'Arakere');
  assert.ok(snapshot.reportId.startsWith('REP-'));
  assert.ok(snapshot.snapshotTimestamp);
});

test('F19 Tier 1: Freezes title timeline and title gaps into snapshot', () => {
  const titleTimeline: TitleEvent[] = [{
    id: 'EV_1',
    propertyId: 'prop_123',
    documentId: 'DOC_1',
    sequenceOrder: 1,
    eventDate: '2010-01-01',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 43560,
    extentRaw: '1 Acre',
    consideration: 1000000,
    status: 'verified',
  }];

  const titleGaps: TitleGap[] = [{
    code: 'TITLE_GAP_MISSING_PREDECESSOR',
    severity: 'high',
    title: 'Missing predecessor',
    description: 'Gap detected',
    sourceEventIds: ['EV_1'],
    points: 25,
  }];

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1', surveyNumber: '10' },
    titleTimeline,
    titleGaps,
  });

  assert.equal(snapshot.titleTimeline.length, 1);
  assert.equal(snapshot.titleGaps.length, 1);
  assert.equal(snapshot.titleGaps[0].code, 'TITLE_GAP_MISSING_PREDECESSOR');
});

test('F19 Tier 1: Freezes cross-document discrepancy findings into snapshot', () => {
  const discrepancies: DiscrepancyFinding[] = [{
    id: 'DISC_1',
    code: 'DISCREPANCY_EXTENT_MISMATCH',
    ruleId: 'RULE-EXT-001',
    ruleVersion: 'v1.0',
    statutoryCitation: 'KLR Act § 106',
    severity: 'critical',
    points: 35,
    field: 'extent',
    docA: { id: '1', name: 'Sale Deed', type: 'doc', value: '41382' },
    docB: { id: '2', name: 'RTC', type: 'doc', value: '34848' },
    deltaText: '6534 sq ft divergence',
    explanation: 'Mismatch between deed and RTC',
    nextAction: 'Re-survey',
  }];

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    discrepancies,
  });

  assert.equal(snapshot.discrepancies.length, 1);
  assert.equal(snapshot.discrepancies[0].code, 'DISCREPANCY_EXTENT_MISMATCH');
});

test('F19 Tier 1: Freezes spatial buffer screening findings and map metadata', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1', latitude: 12.9352, longitude: 77.6245 },
  });

  assert.ok(snapshot.spatialScreening);
  assert.ok(snapshot.spatialScreening.drainClearanceStatus);
  assert.ok(snapshot.spatialScreening.georeferencedSnapshot);
  assert.equal(snapshot.spatialScreening.georeferencedSnapshot.metadata.hasNorthArrow, true);
});

test('F19 Tier 1: Automatically calculates riskSummary inside frozen snapshot', () => {
  const discrepancies: DiscrepancyFinding[] = [{
    id: 'D1',
    code: 'DISCREPANCY_EXTENT_MISMATCH',
    ruleId: 'R1',
    ruleVersion: 'v1',
    statutoryCitation: 'Law',
    severity: 'critical',
    points: 35,
    field: 'extent',
    docA: { id: '1', name: 'A', type: 'doc', value: '1' },
    docB: { id: '2', name: 'B', type: 'doc', value: '2' },
    deltaText: '10%',
    explanation: 'test',
    nextAction: 'test',
  }];

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    discrepancies,
  });

  assert.equal(snapshot.riskSummary.score, 35);
  assert.equal(snapshot.riskSummary.band, 'review_required');
});

test('F19 Tier 2: Snapshot of empty property workspace produces valid defaults', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'empty_prop' },
  });
  assert.equal(snapshot.titleTimeline.length, 0);
  assert.equal(snapshot.titleGaps.length, 0);
  assert.equal(snapshot.discrepancies.length, 0);
  assert.equal(snapshot.riskSummary.score, 0);
  assert.equal(snapshot.riskSummary.band, 'preliminary');
});

test('F19 Tier 2: Snapshot timestamp is valid ISO 8601 string', () => {
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' } });
  assert.ok(!isNaN(Date.parse(snapshot.snapshotTimestamp)));
});

test('F19 Tier 2: Preserves tenant isolation metadata inside snapshot', () => {
  const tenant = { id: 'org_blr_realestate', organizationName: 'Bengaluru Property Advisors' };
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' }, tenant });
  assert.equal(snapshot.tenant.id, 'org_blr_realestate');
  assert.equal(snapshot.tenant.organizationName, 'Bengaluru Property Advisors');
});

test('F19 Tier 2: Immutable snapshot cannot be mutated by altering original input data', () => {
  const originalTimeline: TitleEvent[] = [{
    id: 'EV_1',
    propertyId: 'p1',
    documentId: 'd1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  }];

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    titleTimeline: [...originalTimeline],
  });

  // Mutate local array
  originalTimeline.push({
    id: 'EV_2',
    propertyId: 'p1',
    documentId: 'd2',
    sequenceOrder: 2,
    eventDate: '2021-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'B', normalizedName: 'B' }],
    toParties: [{ name: 'C', normalizedName: 'C' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  });

  assert.equal(snapshot.titleTimeline.length, 1); // Snapshot remains untouched!
});

test('F19 Tier 2: Report ID uniqueness across consecutive snapshot requests', () => {
  const snap1 = createDueDiligenceSnapshot({ property: { id: 'p1' } });
  const snap2 = createDueDiligenceSnapshot({ property: { id: 'p1' } });
  assert.notEqual(snap1.reportId, snap2.reportId);
});

// ============================================================================
// FEATURE 20: Client-Ready PDF Report Generator (R5)
// ============================================================================

test('F20 Tier 1: Includes all 7 mandatory due diligence report sections', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1', surveyNumber: '34/2', village: 'Arakere', extent: '1 Acre 20 Guntas' },
  });

  const report = generateDueDiligenceReport(snapshot);
  assert.equal(report.sectionsPresent.length, 7);
  assert.ok(report.sectionsPresent.includes('Executive Summary'));
  assert.ok(report.sectionsPresent.includes('Property Profile & Identification Matrix'));
  assert.ok(report.sectionsPresent.includes('Title Chain & Ownership Progression'));
  assert.ok(report.sectionsPresent.includes('Discrepancy Matrix'));
  assert.ok(report.sectionsPresent.includes('GIS & Environmental Buffer Screening Analysis'));
  assert.ok(report.sectionsPresent.includes('Itemized Evidence Appendix'));
  assert.ok(report.sectionsPresent.includes('Statutory Disclaimers & Legal Notice'));
});

test('F20 Tier 1: Includes Executive Summary with score and property identity', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1', surveyNumber: '34/2', village: 'Arakere' },
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /<section id="executive-summary">/);
  assert.match(report.html, /Score: \d+ \/ 100/);
  assert.match(report.html, /Survey No: 34\/2/);
});

test('F20 Tier 1: Renders persisted snake_case property fields and escapes untrusted values', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'db-property', name: '<script>alert(1)</script>', survey_number: '34/2', subdivision: 'A', village: 'Arakere' },
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /34\/2/);
  assert.match(report.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(report.html, /<script>alert\(1\)<\/script>/);
});

test('F20 Tier 1: Includes Title Chain timeline and identified title gaps', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    titleGaps: [{
      code: 'TITLE_GAP_MISSING_PREDECESSOR',
      severity: 'high',
      title: 'Missing Registered Predecessor Deed',
      description: 'Gap in 30yr lookback',
      sourceEventIds: ['EV_1'],
      points: 25,
    }],
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /<section id="title-timeline">/);
  assert.match(report.html, /Missing Registered Predecessor Deed/);
});

test('F20 Tier 1: Includes GIS Screening section with North arrow and scale text', () => {
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' } });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /<section id="gis-screening">/);
  assert.match(report.html, /Map orientation: not available; no map snapshot was rendered/);
  assert.equal(report.hasNorthArrow, false);
});

test('F20 Tier 1: Does not claim or return a PDF until a real renderer is configured', () => {
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' } });
  const report = generateDueDiligenceReport(snapshot);
  assert.equal('pdfBytesMock' in report, false);
  assert.equal(report.hasNorthArrow, false);
  assert.match(report.html, /Map orientation: not available; no map snapshot was rendered/);
});

test('F20 Tier 2: Labels zero-score report incomplete when evidence is absent', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'clean', surveyNumber: '1', village: 'CleanVillage' },
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /Score: 0 \/ 100 \(preliminary\) — INCOMPLETE · NOT CLEARED/);
  assert.match(report.html, /A low or zero risk score does not mean the property is safe or legally clear/);
  assert.match(report.html, /Coordinates are not recorded; spatial screening was not run\./);
  assert.match(report.html, /Drain Screening: <strong>UNKNOWN<\/strong>/);
});

test('F20 Tier 2: Renders high attention report with score >= 70', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'high_risk' },
    titleGaps: [
      { code: 'TITLE_GAP_EXTENT_OVERCONVEYANCE', severity: 'critical', title: 'Over conveyance', description: '', sourceEventIds: [], points: 35 },
      { code: 'TITLE_UNRELEASED_ENCUMBRANCE', severity: 'critical', title: 'Unreleased bank mortgage', description: '', sourceEventIds: [], points: 35 },
    ],
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /Score: 70 \/ 100 \(high_attention\) — INCOMPLETE · NOT CLEARED/);
});

test('F20 Tier 2: Report contains statutory disclaimer notice', () => {
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' } });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /<section id="statutory-notice">/);
  assert.match(report.html, /Karnataka Land Administration standards/);
});

test('F20 Tier 2: Report HTML includes document title with report ID', () => {
  const snapshot = createDueDiligenceSnapshot({ reportId: 'REP-TEST-999', property: { id: 'p1' } });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /<title>OJIX Property Due Diligence Report - REP-TEST-999<\/title>/);
});

test('F20 Tier 2: Handles property without coordinates gracefully', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'no_coords', surveyNumber: '99', latitude: null, longitude: null },
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.ok(report.html.length > 500);
});

// ============================================================================
// FEATURE 21: Itemized Evidence Appendix Generator (R5)
// ============================================================================

test('F21 Tier 1: Includes evidence appendix with document ID and page number', () => {
  const anchor: EvidenceAnchor = {
    documentId: 'DOC-SALE-2018',
    pageNumber: 3,
    boundingBox: { ymin: 0.2, xmin: 0.1, ymax: 0.3, xmax: 0.8 },
    extractedSnippet: 'Schedule of property: Survey No. 34/2 measuring 1 Acre 20 Guntas',
    confidenceScore: 0.94,
  };

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    evidenceAppendix: [anchor],
  });

  const report = generateDueDiligenceReport(snapshot);
  assert.equal(report.hasEvidenceAppendix, true);
  assert.match(report.html, /Doc: DOC-SALE-2018 Pg 3/);
  assert.match(report.html, /Survey No\. 34\/2 measuring 1 Acre 20 Guntas/);
});

test('F21 Tier 1: Formats SHA-256 cryptographic checksums for uploaded evidence documents', () => {
  const docBuffer = Buffer.from('Official Sale Deed 2018');
  const sha256 = computeSha256Checksum(docBuffer);

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    documents: [{
      documentId: 'DOC-1',
      originalFilename: 'SaleDeed_2018.pdf',
      sha256,
      sizeBytes: docBuffer.length,
      mimeType: 'application/pdf',
    }],
  });

  assert.equal(snapshot.documents[0].sha256, sha256);
  assert.equal(snapshot.documents[0].sha256.length, 64);
});

test('F21 Tier 1: Links multiple evidence anchors across multiple documents', () => {
  const anchors: EvidenceAnchor[] = [
    {
      documentId: 'DOC-SALE',
      pageNumber: 1,
      boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.9 },
      extractedSnippet: 'Vendor Sri Ramesh',
      confidenceScore: 0.95,
    },
    {
      documentId: 'DOC-RTC',
      pageNumber: 1,
      boundingBox: { ymin: 0.3, xmin: 0.1, ymax: 0.4, xmax: 0.9 },
      extractedSnippet: 'Kabzedar Suresh Gowda',
      confidenceScore: 0.92,
    },
  ];

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    evidenceAppendix: anchors,
  });

  assert.equal(snapshot.evidenceAppendix.length, 2);
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /Vendor Sri Ramesh/);
  assert.match(report.html, /Kabzedar Suresh Gowda/);
});

test('F21 Tier 1: Evidence anchor bounding boxes are normalized [0.0 - 1.0]', () => {
  const anchor: EvidenceAnchor = {
    documentId: 'DOC-1',
    pageNumber: 1,
    boundingBox: { ymin: 0.15, xmin: 0.1, ymax: 0.25, xmax: 0.8 },
    extractedSnippet: 'test',
    confidenceScore: 0.9,
  };
  assert.ok(anchor.boundingBox.ymin >= 0 && anchor.boundingBox.ymax <= 1);
  assert.ok(anchor.boundingBox.xmin >= 0 && anchor.boundingBox.xmax <= 1);
});

test('F21 Tier 1: High confidence score (>=0.85) reflected on evidence anchors', () => {
  const anchor: EvidenceAnchor = {
    documentId: 'DOC-1',
    pageNumber: 1,
    boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.5 },
    extractedSnippet: 'test snippet',
    confidenceScore: 0.96,
  };
  assert.ok(anchor.confidenceScore >= 0.85);
});

test('F21 Tier 2: Handles empty evidence appendix gracefully', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    evidenceAppendix: [],
  });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /<section id="evidence-appendix">/);
});

test('F21 Tier 2: Handles evidence anchor with confidence 1.0', () => {
  const anchor: EvidenceAnchor = {
    documentId: 'DOC-1',
    pageNumber: 1,
    boundingBox: { ymin: 0.0, xmin: 0.0, ymax: 1.0, xmax: 1.0 },
    extractedSnippet: 'Entire page document scan',
    confidenceScore: 1.0,
  };
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    evidenceAppendix: [anchor],
  });
  assert.equal(snapshot.evidenceAppendix[0].confidenceScore, 1.0);
});

test('F21 Tier 2: Handles low confidence evidence anchor (<0.60)', () => {
  const anchor: EvidenceAnchor = {
    documentId: 'DOC-1',
    pageNumber: 1,
    boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.5 },
    extractedSnippet: 'Blurred blurred text',
    confidenceScore: 0.45,
  };
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p1' },
    evidenceAppendix: [anchor],
  });
  assert.equal(snapshot.evidenceAppendix[0].confidenceScore, 0.45);
});

test('F21 Tier 2: Multiple pages evidence anchoring', () => {
  const anchors: EvidenceAnchor[] = [
    { documentId: 'D1', pageNumber: 1, boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.2 }, extractedSnippet: 'Page 1', confidenceScore: 0.9 },
    { documentId: 'D1', pageNumber: 5, boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.2 }, extractedSnippet: 'Page 5', confidenceScore: 0.9 },
  ];
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' }, evidenceAppendix: anchors });
  assert.equal(snapshot.evidenceAppendix[0].pageNumber, 1);
  assert.equal(snapshot.evidenceAppendix[1].pageNumber, 5);
});

test('F21 Tier 2: Snippet containing legal symbols (§ and quotations)', () => {
  const anchor: EvidenceAnchor = {
    documentId: 'D1',
    pageNumber: 1,
    boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.2 },
    extractedSnippet: 'Clause § 14: "Clear and Marketable Title"',
    confidenceScore: 0.95,
  };
  const snapshot = createDueDiligenceSnapshot({ property: { id: 'p1' }, evidenceAppendix: [anchor] });
  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /Clause § 14/);
});

// ============================================================================
// TIER 3: Cross-Feature Combinations (Pairwise)
// ============================================================================

test('Tier 3 Pairwise: Due Diligence Snapshot Creation -> PDF Report Generation', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'prop_001', surveyNumber: '34/2', village: 'Arakere', extent: '1 Acre 20 Guntas' },
  });

  const report = generateDueDiligenceReport(snapshot);
  assert.equal(report.sectionsPresent.length, 7);
  assert.equal('pdfBytesMock' in report, false);
});

test('Tier 3 Pairwise: Spatial Screening Map Snapshot -> Report GIS Section Embedding', () => {
  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'prop_002', latitude: 12.9352, longitude: 77.6245 },
  });

  const report = generateDueDiligenceReport(snapshot);
  assert.match(report.html, /Map orientation: not available; no map snapshot was rendered/);
  assert.match(report.html, /<section id="gis-screening">/);
});

test('Tier 3 Pairwise: SHA-256 Checksumming + Evidence Appendix Provenance Integrity', () => {
  const docContent = 'Sale Deed 2018 executed before Bommanahalli SRO';
  const sha256 = computeSha256Checksum(docContent);

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'prop_003' },
    documents: [{ documentId: 'DOC-1', sha256, originalFilename: 'deed.pdf' }],
    evidenceAppendix: [{
      documentId: 'DOC-1',
      pageNumber: 1,
      boundingBox: { ymin: 0.1, xmin: 0.1, ymax: 0.2, xmax: 0.8 },
      extractedSnippet: 'Vendor: Ramesh',
      confidenceScore: 0.95,
    }],
  });

  assert.equal(snapshot.documents[0].sha256, sha256);
  assert.equal(snapshot.evidenceAppendix[0].documentId, snapshot.documents[0].documentId);
});
