import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaselineFindings, calculateRisk } from '../src/risk-engine.js';

test('baseline flags missing survey, documents and location', () => {
  const findings = buildBaselineFindings({ hasSurveyNumber: false, documentCount: 0, coordinatesPresent: false });
  assert.equal(findings.length, 3);
  assert.ok(findings.some(f => f.code === 'IDENTITY_SURVEY_MISSING'));
  assert.ok(findings.some(f => f.code === 'DOCUMENTS_NOT_UPLOADED'));
  assert.ok(findings.some(f => f.code === 'SPATIAL_LOCATION_MISSING'));
});

test('risk score is capped and transparent', () => {
  const findings = Array.from({ length: 5 }, (_, i) => ({ code: String(i), title: 'High finding', severity: 'critical' as const, points: 35, explanation: 'test', evidenceStatus: 'demo' as const, nextAction: 'review' }));
  const result = calculateRisk(findings);
  assert.equal(result.score, 100);
  assert.equal(result.band, 'high_attention');
  assert.equal(result.unverifiedCount, 5);
  assert.match(result.disclaimer, /not a legal opinion/);
});

test('a clean workspace remains preliminary, not certified safe', () => {
  const result = calculateRisk([]);
  assert.equal(result.score, 0);
  assert.equal(result.band, 'preliminary');
  assert.match(result.disclaimer, /professional review/);
});
