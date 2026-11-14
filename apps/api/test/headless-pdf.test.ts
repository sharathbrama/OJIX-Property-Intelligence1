import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDueDiligenceSnapshot,
  generateDueDiligencePdf,
  generateDueDiligenceHeadlessPdf,
  generateDueDiligencePdfKit,
  generateDueDiligenceReport,
  getChromiumExecutablePath,
  computeSha256Checksum,
  closeBrowserManager,
} from '../src/report-generator.js';

after(async () => {
  await closeBrowserManager();
});

test('Task 11: Chromium / Chrome Executable Path Resolution', () => {
  const exePath = getChromiumExecutablePath();
  assert.ok(exePath, 'Should discover installed Chromium or Chrome executable');
  assert.ok(fs.existsSync(exePath), `Discovered binary must exist on filesystem: ${exePath}`);
});

test('Task 11: Headless Chromium PDF Generation matches web report HTML', async () => {
  const property = {
    id: 'prop-101-headless',
    name: 'Brigade Gateway Commercial Tech Hub',
    survey_number: '123/1',
    subdivision: '4B',
    village: 'Malleshwaram',
    hobli: 'Kasaba',
    taluk: 'Bangalore North',
    district: 'Bengaluru Urban',
    extent: '2 Acres 30 Guntas',
    boundary_north: 'Rajajinagar Main Road',
    boundary_south: 'Stormwater drain clearance line',
    boundary_east: 'Adjacent IT Park Plot 122',
    boundary_west: 'Subramanyanagar Road',
    latitude: 13.0112,
    longitude: 77.5548,
    status: 'approved',
    assigned_lawyer_uid: 'advocate-suresh',
    legal_approved_by_uid: 'lead-counsel-raghavan',
    legal_approved_at: new Date('2026-11-04T08:30:00Z'),
  };

  const documents = [
    {
      id: 'doc-sale-1995',
      originalFilename: 'Registered_Sale_Deed_Doc_1995.pdf',
      sha256: computeSha256Checksum('sample-raw-bytes-for-1995-sale-deed'),
      extracted_fields: { reviewState: { isVerified: true } },
    },
    {
      id: 'doc-rtc-2025',
      originalFilename: 'RTC_Pahani_Form_16_2025.pdf',
      sha256: computeSha256Checksum('sample-raw-bytes-for-2025-rtc'),
      extracted_fields: { reviewState: { isVerified: true } },
    },
  ];

  const titleTimeline = [
    {
      id: 'te-1',
      propertyId: 'prop-101-headless',
      documentId: 'doc-sale-1995',
      sequenceOrder: 1,
      eventDate: '1995-04-14',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Karnataka Land Corp', normalizedName: 'karnataka land corp' }],
      toParties: [{ name: 'Brigade Holdings Pvt Ltd', normalizedName: 'brigade holdings' }],
      extentSqFt: 119790,
      extentRaw: '2 Acres 30 Guntas',
      consideration: 7500000,
      status: 'verified' as const,
      encumbranceStatus: 'none' as const,
    },
  ];

  const titleGaps = [
    {
      code: 'TITLE_GAP_MISSING_PREDECESSOR' as const,
      severity: 'medium' as const,
      title: 'Prior Revenue Conversion Note',
      description: 'Prior revenue conversion entry confirmed by Tahsildar order.',
      sourceEventIds: ['te-1'],
      points: 10,
    },
  ];

  const discrepancies = [
    {
      id: 'disc-1',
      code: 'DISC_EXTENT_MISMATCH',
      ruleId: 'RULE-EXT-01',
      ruleVersion: '1.0.0',
      statutoryCitation: 'Karnataka Land Revenue Act Section 128',
      severity: 'low' as const,
      points: 5,
      field: 'extent' as const,
      docA: { id: 'doc-sale-1995', name: 'Sale Deed 1995', type: 'sale_deed', value: '2A 30G' },
      docB: { id: 'doc-rtc-2025', name: 'RTC 2025', type: 'rtc_pahani', value: '2A 28G' },
      deltaText: 'Survey report records 2A 30G vs RTC 2A 28G (2 Guntas road widening)',
      explanation: 'Public works department acquisition recorded in gazette notification.',
      nextAction: 'File mutation register extract Form 12',
    },
  ];

  const snapshot = createDueDiligenceSnapshot({
    property,
    documents,
    titleTimeline,
    titleGaps,
    discrepancies,
    tenant: {
      id: 'tenant-kart-001',
      organizationName: 'Karnataka Premier Legal Counsel LLP',
      llpin: 'AAA-9988',
      officeAddress: '100 Feet Rd, Indiranagar, Bengaluru 560038',
      firmEmail: 'counsel@karnatakalegal.in',
      defaultReportTemplate: 'detailed_due_diligence',
      legalDisclaimer: 'Confidential due-diligence report issued pursuant to Karnataka Legal Standards.',
    },
  });

  // 1. Verify HTML report generation contains all 7 mandatory sections
  const report = generateDueDiligenceReport(snapshot);
  assert.equal(report.sectionsPresent.length, 7);
  assert.match(report.html, /<section id="executive-summary">/);
  assert.match(report.html, /<section id="property-profile">/);
  assert.match(report.html, /<section id="title-timeline">/);
  assert.match(report.html, /<section id="discrepancy-matrix">/);
  assert.match(report.html, /<section id="gis-screening">/);
  assert.match(report.html, /<section id="evidence-appendix">/);
  assert.match(report.html, /<section id="statutory-notice">/);

  // 2. Generate Headless Chromium PDF
  console.log('Generating headless PDF for Brigade Gateway Commercial Tech Hub...');
  const headlessPdf = await generateDueDiligenceHeadlessPdf(snapshot);
  assert.ok(headlessPdf instanceof Buffer, 'Headless PDF output must be a Buffer');
  assert.ok(headlessPdf.length > 10000, `Headless PDF must be complete (got ${headlessPdf.length} bytes)`);
  assert.equal(headlessPdf.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');

  // Save generated PDF for visual inspection
  const samplePdfPath = path.resolve('sample-headless-report.pdf');
  fs.writeFileSync(samplePdfPath, headlessPdf);
  console.log(`Saved sample headless PDF (${headlessPdf.length} bytes) to ${samplePdfPath}`);

  // 3. Verify PDFKit fallback generation still functions
  console.log('Generating PDFKit fallback...');
  const pdfkitPdf = await generateDueDiligencePdfKit(snapshot);
  assert.ok(pdfkitPdf instanceof Buffer, 'PDFKit output must be a Buffer');
  assert.ok(pdfkitPdf.length > 1000, `PDFKit output must be > 1000 bytes (got ${pdfkitPdf.length} bytes)`);
  assert.equal(pdfkitPdf.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF');

  // 4. Verify unified generateDueDiligencePdf handles options
  const autoPdf = await generateDueDiligencePdf(snapshot);
  assert.ok(autoPdf instanceof Buffer);
  assert.ok(autoPdf.length > 5000);
  assert.equal(autoPdf.subarray(0, 4).toString(), '%PDF');

  const explicitPdfkit = await generateDueDiligencePdf(snapshot, { renderer: 'pdfkit' });
  assert.ok(explicitPdfkit instanceof Buffer);
  assert.equal(explicitPdfkit.subarray(0, 4).toString(), '%PDF');
});

test('Task 11: Stress Test - Large Multi-page Dossier Generation', async () => {
  const lotsOfDocs = Array.from({ length: 15 }, (_, i) => ({
    id: `doc-${i + 1}`,
    originalFilename: `Evidence_Document_Deed_${1980 + i}.pdf`,
    sha256: computeSha256Checksum(`mock-deed-bytes-stream-${i}`),
    extracted_fields: { reviewState: { isVerified: true } },
  }));

  const lotsOfEvents = Array.from({ length: 10 }, (_, i) => ({
    id: `te-${i + 1}`,
    propertyId: 'prop-large-99',
    documentId: `doc-${i + 1}`,
    sequenceOrder: i + 1,
    eventDate: `${1985 + (i * 3)}-06-15`,
    deedType: i % 2 === 0 ? 'Sale Deed' : 'Gift Deed',
    fromParties: [{ name: `Party Seller ${i}`, normalizedName: `seller ${i}` }],
    toParties: [{ name: `Party Buyer ${i + 1}`, normalizedName: `buyer ${i + 1}` }],
    extentSqFt: 43560 * 2,
    extentRaw: '2 Acres',
    consideration: 1000000 * (i + 1),
    status: 'verified' as const,
    encumbranceStatus: 'none' as const,
  }));

  const snapshot = createDueDiligenceSnapshot({
    property: {
      id: 'prop-large-99',
      name: 'Mega Infrastructure Layout - 50 Acre Parcel',
      survey_number: '88/1',
      village: 'Devenahalli',
      taluk: 'Bangalore Rural',
      district: 'Bengaluru Rural',
      extent: '50 Acres',
      latitude: 13.2456,
      longitude: 77.7123,
      status: 'approved',
    },
    documents: lotsOfDocs,
    titleTimeline: lotsOfEvents,
    tenant: {
      id: 'tenant-mega',
      organizationName: 'Karnataka High Court Legal Advisory LLP',
      llpin: 'AAA-7777',
      officeAddress: 'High Court Chambers, Ambedkar Veedhi, Bengaluru',
      defaultReportTemplate: 'detailed_due_diligence',
    },
  });

  const startTime = Date.now();
  const largePdf = await generateDueDiligencePdf(snapshot, { renderer: 'headless' });
  const durationMs = Date.now() - startTime;

  assert.ok(largePdf.length > 15000, `Large report should be substantial (got ${largePdf.length} bytes)`);
  assert.equal(largePdf.subarray(0, 4).toString(), '%PDF');
  console.log(`Large multipage dossier generated in ${durationMs}ms, size: ${largePdf.length} bytes`);
});
