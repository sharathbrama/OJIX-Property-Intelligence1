import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {
  createDueDiligenceSnapshot,
  generateDueDiligenceHeadlessPdf,
  generateDueDiligenceReport,
  getChromiumExecutablePath,
  computeSha256Checksum,
  closeBrowserManager,
} from '../src/report-generator.js';

const artifactDir = 'C:\\Users\\KEERTHANA\\.gemini\\antigravity\\brain\\69c783a2-15fe-4a75-88bd-37b41612c13b';

async function main() {
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
      status: 'verified',
      encumbranceStatus: 'none',
    },
  ];

  const titleGaps = [
    {
      code: 'TITLE_GAP_NOTICE',
      severity: 'medium',
      title: 'Minor Verification Note',
      description: 'Prior revenue conversion entry confirmed by Tahsildar order.',
      sourceEventIds: ['te-1'],
      points: 10,
    },
  ];

  const discrepancies = [
    {
      field: 'extent',
      severity: 'low',
      deltaText: 'Survey report records 2A 30G vs RTC 2A 28G (2 Guntas road widening)',
      explanation: 'Public works department acquisition recorded in gazette notification.',
      nextAction: 'File mutation register extract Form 12',
      statutoryCitation: 'Karnataka Land Revenue Act Section 128',
      points: 5,
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

  const report = generateDueDiligenceReport(snapshot);

  // Generate PDF
  console.log('Generating Headless PDF...');
  const pdfBuffer = await generateDueDiligenceHeadlessPdf(snapshot);
  const pdfTargetPath = path.join(artifactDir, 'sample-headless-report.pdf');
  fs.writeFileSync(pdfTargetPath, pdfBuffer);
  fs.writeFileSync(path.resolve('sample-headless-report.pdf'), pdfBuffer);
  console.log('Saved PDF to:', pdfTargetPath, `(${pdfBuffer.length} bytes)`);

  // Generate Visual Screenshot
  console.log('Capturing full-page visual screenshot of web report HTML...');
  const exe = getChromiumExecutablePath();
  const tempProfile = path.resolve('temp-screenshot-profile');
  if (!fs.existsSync(tempProfile)) fs.mkdirSync(tempProfile, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: true,
    pipe: true,
    userDataDir: tempProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 2 });
  await page.setContent(report.html, { waitUntil: 'load' });
  const screenshotTargetPath = path.join(artifactDir, 'sample-web-report-preview.png');
  await page.screenshot({ path: screenshotTargetPath, fullPage: true });
  console.log('Saved visual comparison screenshot to:', screenshotTargetPath);

  await browser.close();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
  await closeBrowserManager();
  console.log('All artifacts generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
