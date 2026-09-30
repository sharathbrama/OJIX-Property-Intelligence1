import test from 'node:test';
import assert from 'node:assert/strict';
import { legalResearchEngine } from '../src/legal-research-engine.js';
import { sourceRegistryEngine } from '../src/source-registry-engine.js';

test('Legal Research Engine: Retrieves statutory provisions by search keyword', () => {
  const ptclResults = legalResearchEngine.search('PTCL');
  assert.ok(ptclResults.length >= 1, 'Should find at least 1 provision for PTCL');
  assert.equal(ptclResults[0].id, 'ptcl_1978_sec4_5');
  assert.equal(ptclResults[0].severity, 'critical');
  assert.ok(ptclResults[0].keyPrecedents.length >= 1);
  assert.match(ptclResults[0].keyPrecedents[0].caseName, /Nekkanti/);
});

test('Legal Research Engine: Filters by category accurately', () => {
  const bufferResults = legalResearchEngine.search('', 'environmental_buffer');
  assert.ok(bufferResults.length >= 1);
  assert.equal(bufferResults[0].id, 'ngt_lake_swd_buffers');
  assert.match(bufferResults[0].title, /Buffer Zones/i);
});

test('Legal Research Engine: Returns categories with non-zero counts', () => {
  const cats = legalResearchEngine.getCategories();
  assert.ok(cats.length >= 8, 'Expected at least 8 categories');
  const allCat = cats.find(c => c.category === 'all');
  assert.ok(allCat && allCat.count >= 8);
});

test('Legal Research Engine: Gets single provision by ID with precedents', () => {
  const item = legalResearchEngine.getById('tpa_1882_sec52');
  assert.ok(item, 'Should find Section 52 provision');
  assert.equal(item.section, 'Section 52');
  assert.match(item.title, /Lis Pendens/i);
  assert.ok(item.mandatoryChecks.length >= 2);
});

test('Source Registry Engine: Reports operational status for all 6 Karnataka registries', async () => {
  const healthList = await sourceRegistryEngine.getRegistryHealth();
  assert.equal(healthList.length, 6, 'Must include all 6 registries: Bhoomi, Kaveri, Mojini, Dishaank, e-Aasthi, RERA');

  const names = healthList.map(h => h.name);
  assert.ok(names.includes('bhoomi'));
  assert.ok(names.includes('kaveri'));
  assert.ok(names.includes('mojini'));
  assert.ok(names.includes('dishaank'));
  assert.ok(names.includes('easthi'));
  assert.ok(names.includes('rera'));
  for (const h of healthList) {
    assert.equal(h.status, 'operational');
    assert.ok(h.uptimePct >= 95);
    assert.ok(h.averageLatencyMs > 0);
  }
});

test('Source Registry Engine: Bhoomi verification checks extent consistency', () => {
  const propConsistent = {
    id: 'prop-1',
    name: 'Sample Property',
    village: 'Arakere',
    surveyNumber: '34',
    subdivision: '1',
    extent: '30 guntas'
  };
  const resConsistent = sourceRegistryEngine.verifyBhoomi(propConsistent);
  assert.equal(resConsistent.status, 'verified');
  assert.equal(resConsistent.discrepancies.length, 0);
  assert.ok(resConsistent.evidenceHash.length === 64, 'Must have 64-char SHA256 hash');

  const propMismatched = {
    id: 'prop-2',
    name: 'Mismatched Extent',
    village: 'Arakere',
    surveyNumber: '34',
    subdivision: '1',
    extent: '10 acres' // differing from 30 guntas
  };
  const resMismatched = sourceRegistryEngine.verifyBhoomi(propMismatched);
  assert.equal(resMismatched.status, 'mismatch');
  assert.ok(resMismatched.discrepancies.length > 0);
  assert.equal(resMismatched.discrepancies[0].field, 'extent');
});

test('Source Registry Engine: Kaveri 2.0 verification returns registered deeds and EC', () => {
  const prop = {
    id: 'prop-1',
    name: 'Sample Property',
    village: 'Arakere',
    surveyNumber: '34'
  };
  const res = sourceRegistryEngine.verifyKaveri(prop);
  assert.equal(res.status, 'verified');
  assert.ok(res.matchedRecord.registeredInstruments.length >= 2);
  assert.match(res.matchedRecord.formIssued, /Form 15/);
  assert.ok(res.matchedRecord.guidanceValuePerSqFt > 0);
});

test('Source Registry Engine: Dishaank verification calculates spatial distances and buffers', () => {
  const prop = {
    id: 'prop-1',
    name: 'Sample Property',
    village: 'Arakere',
    surveyNumber: '34',
    latitude: 12.887,
    longitude: 77.596
  };
  const res = sourceRegistryEngine.verifyDishaank(prop);
  assert.equal(res.status, 'verified');
  assert.ok(res.matchedRecord.swdBufferRequirementM === 25);
  assert.match(res.matchedRecord.swdBufferStatus, /Safe/);
});

test('Source Registry Engine: verifyAll aggregates all 6 registries with trust score', async () => {
  const prop = {
    id: 'prop-demo-all',
    name: 'Demo Estate',
    village: 'Arakere',
    surveyNumber: '34',
    subdivision: '1',
    extent: '30 guntas',
    latitude: 12.887,
    longitude: 77.596
  };
  const result = await sourceRegistryEngine.verifyAll(prop);
  assert.equal(result.propertyId, 'prop-demo-all');
  assert.equal(result.verifications.length, 6);
  assert.ok(result.overallTrustScorePct >= 90);
  assert.equal(result.totalDiscrepancies, 0);
});
