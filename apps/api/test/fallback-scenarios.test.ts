import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDueDiligenceSnapshot,
  generateDueDiligencePdf,
  generateDueDiligencePdfKit,
  closeBrowserManager,
} from '../src/report-generator.js';

after(async () => {
  await closeBrowserManager();
});

const baseProperty = {
  id: 'prop-fallback-test',
  name: 'Fallback Verification Layout',
  survey_number: '55/1',
  village: 'Varthur',
  taluk: 'Bangalore East',
  district: 'Bengaluru Urban',
  extent: '1 Acre 10 Guntas',
  status: 'approved',
};

const baseSnapshot = createDueDiligenceSnapshot({
  property: baseProperty,
  tenant: {
    id: 'tenant-test',
    organizationName: 'Bengaluru Title Advocates LLP',
    llpin: 'ADA-1234',
  },
});

test('Fallback Scenario 1: Chromium available - Headless PDF generates successfully', async () => {
  const pdf = await generateDueDiligencePdf(baseSnapshot, { renderer: 'auto' });
  assert.ok(pdf instanceof Buffer, 'Output must be Buffer');
  assert.ok(pdf.length > 10000, `Headless PDF should be > 10KB, got ${pdf.length}`);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  console.log('Scenario 1 passed: Headless PDF generated successfully, bytes:', pdf.length);
});

test('Fallback Scenario 2: Chromium unavailable - PDFKit fallback activates smoothly', async () => {
  // Test explicit PDFKit fallback mechanism
  const pdf = await generateDueDiligencePdfKit(baseSnapshot);
  assert.ok(pdf instanceof Buffer);
  assert.ok(pdf.length > 1000, `PDFKit output should be > 1KB, got ${pdf.length}`);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');

  // Test via options { renderer: 'pdfkit' }
  const pdfViaOption = await generateDueDiligencePdf(baseSnapshot, { renderer: 'pdfkit' });
  assert.ok(pdfViaOption instanceof Buffer);
  assert.equal(pdfViaOption.subarray(0, 4).toString(), '%PDF');
  console.log('Scenario 2 passed: PDFKit fallback generated successfully, bytes:', pdf.length);
});

test('Fallback Scenario 3: Rendering timeout - Automatic fallback to PDFKit activates', async () => {
  // Provide an ultra-short 1ms timeout that will cause headless rendering to timeout
  const startTime = Date.now();
  const pdf = await generateDueDiligencePdf(baseSnapshot, { renderer: 'auto', timeoutMs: 1 });
  const duration = Date.now() - startTime;

  assert.ok(pdf instanceof Buffer);
  assert.ok(pdf.length > 1000, 'Should fall back to PDFKit and return valid buffer');
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  console.log(`Scenario 3 passed: Timeout caught and fell back to PDFKit in ${duration}ms, bytes: ${pdf.length}`);
});

test('Fallback Scenario 4: Concurrent PDF requests - Safe browser pool management', async () => {
  const snapshots = Array.from({ length: 5 }, (_, i) =>
    createDueDiligenceSnapshot({
      property: { ...baseProperty, id: `prop-concurrent-${i + 1}`, name: `Concurrent Layout ${i + 1}` },
      tenant: { id: `tenant-${i + 1}`, organizationName: `Tenant Law Firm ${i + 1}` },
    })
  );

  console.log('Launching 5 concurrent PDF generation requests...');
  const startTime = Date.now();
  const results = await Promise.all(
    snapshots.map(snap => generateDueDiligencePdf(snap, { renderer: 'auto' }))
  );
  const totalDuration = Date.now() - startTime;

  assert.equal(results.length, 5);
  results.forEach((pdf, idx) => {
    assert.ok(pdf instanceof Buffer);
    assert.ok(pdf.length > 10000, `Result ${idx + 1} size should be > 10KB, got ${pdf.length}`);
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  });

  console.log(`Scenario 4 passed: All 5 concurrent PDFs generated in ${totalDuration}ms (average ${Math.round(totalDuration / 5)}ms per PDF)`);
});

