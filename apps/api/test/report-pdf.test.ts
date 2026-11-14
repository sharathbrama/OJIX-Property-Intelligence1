import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeReportPdfBrowser, renderReportPdf } from '../src/report-pdf.js';

after(async () => closeReportPdfBrowser());

test('Chromium produces a readable, paginated PDF from report content', async () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px Arial}h1{color:#352267}</style></head><body>
    <h1>OJIX Synthetic Test Report</h1>
    <h2>Property profile</h2><p>Fixture only: TEST-SURVEY-1, Test Village.</p>
    <h2>Reviewer approval</h2><p>Reviewed by Test Reviewer on 2026-11-14T12:00:00Z.</p>
    <h2>Evidence and findings</h2><p>Test evidence file deed-fixture.pdf · SHA-256 abc123.</p>
    <h2>Risk and limitations</h2><p>GIS data unavailable. No legal conclusion is implied.</p>
  </body></html>`;
  const pdf = await renderReportPdf(html);
  assert.ok(pdf.length > 1200, 'PDF should contain rendered page content');
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  const extracted = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf, encoding: 'utf8' });
  assert.match(extracted, /OJIX Synthetic Test Report/);
  assert.match(extracted, /TEST-SURVEY-1/);
  assert.match(extracted, /Test Reviewer/);
  assert.match(extracted, /deed-fixture\.pdf/);
  assert.match(extracted, /GIS data unavailable/);
});

test('PDF renderer rejects empty and oversized content before launching Chromium', async () => {
  await assert.rejects(renderReportPdf('  '), /empty/);
  await assert.rejects(renderReportPdf('x'.repeat(5 * 1024 * 1024 + 1)), /5 MB/);
});
