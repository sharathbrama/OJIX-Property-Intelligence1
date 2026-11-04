import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDueDiligenceSnapshot,
  generateDueDiligencePdf,
} from '../src/report-generator.js';

test('API Route Simulation: Default renderer produces headless PDF', async () => {
  const req: { query: Record<string, string | undefined> } = { query: {} };
  const requestedRenderer = typeof req.query.renderer === 'string' && ['headless', 'pdfkit'].includes(req.query.renderer)
    ? (req.query.renderer as 'headless' | 'pdfkit')
    : 'auto';
  assert.equal(requestedRenderer, 'auto');

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p-api-1', name: 'API Test Property', survey_number: '12/1', village: 'Kadubeesanahalli' },
    tenant: { id: 't1', organizationName: 'OJIX Law LLP' },
  });

  const pdfBuffer = await generateDueDiligencePdf(snapshot, { renderer: requestedRenderer });
  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 10000, 'Default auto should produce full-fidelity headless PDF (>10KB)');
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
});

test('API Route Simulation: ?renderer=pdfkit forces PDFKit output', async () => {
  const req = { query: { renderer: 'pdfkit' } };
  const requestedRenderer = typeof req.query.renderer === 'string' && ['headless', 'pdfkit'].includes(req.query.renderer)
    ? (req.query.renderer as 'headless' | 'pdfkit')
    : 'auto';
  assert.equal(requestedRenderer, 'pdfkit');

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p-api-2', name: 'API Test Property 2', survey_number: '13/1', village: 'Kadubeesanahalli' },
    tenant: { id: 't1', organizationName: 'OJIX Law LLP' },
  });

  const pdfBuffer = await generateDueDiligencePdf(snapshot, { renderer: requestedRenderer });
  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 1000 && pdfBuffer.length < 20000, 'Explicit pdfkit should produce compact PDFKit buffer');
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
});

test('API Route Simulation: ?renderer=headless forces Chromium headless output', async () => {
  const req = { query: { renderer: 'headless' } };
  const requestedRenderer = typeof req.query.renderer === 'string' && ['headless', 'pdfkit'].includes(req.query.renderer)
    ? (req.query.renderer as 'headless' | 'pdfkit')
    : 'auto';
  assert.equal(requestedRenderer, 'headless');

  const snapshot = createDueDiligenceSnapshot({
    property: { id: 'p-api-3', name: 'API Test Property 3', survey_number: '14/1', village: 'Kadubeesanahalli' },
    tenant: { id: 't1', organizationName: 'OJIX Law LLP' },
  });

  const pdfBuffer = await generateDueDiligencePdf(snapshot, { renderer: requestedRenderer });
  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 10000);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
});
