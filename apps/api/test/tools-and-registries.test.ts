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

test('Source Registry Engine: Reports all 6 sources as not connected', async () => {
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
    assert.equal(h.status, 'not_connected');
    assert.equal(h.portalReachability, 'not_checked');
    assert.equal(h.uptimePct, null);
  }
});

test('Source Registry Engine: Bhoomi does not fabricate an official record', () => {
  const propConsistent = {
    id: 'prop-1',
    name: 'Sample Property',
    village: 'Arakere',
    surveyNumber: '34',
    subdivision: '1',
    extent: '30 guntas'
  };
  const resConsistent = sourceRegistryEngine.verifyBhoomi(propConsistent);
  assert.equal(resConsistent.status, 'not_connected');
  assert.equal(resConsistent.matchScorePct, 0);
  assert.equal(resConsistent.matchedRecord.isOfficialRecord, false);
  assert.equal(resConsistent.matchedRecord.dataStatus, 'not_connected');
  assert.equal(resConsistent.discrepancies.length, 0);
  assert.ok(resConsistent.evidenceHash.length === 64, 'Must have 64-char SHA256 hash');
});

test('Source Registry Engine: Kaveri does not fabricate deeds or EC data', () => {
  const prop = {
    id: 'prop-1',
    name: 'Sample Property',
    village: 'Arakere',
    surveyNumber: '34'
  };
  const res = sourceRegistryEngine.verifyKaveri(prop);
  assert.equal(res.status, 'not_connected');
  assert.equal(res.matchedRecord.isOfficialRecord, false);
  assert.match(res.matchedRecord.requiredAction, /official portal|upload/i);
});

test('Source Registry Engine: Dishaank does not fabricate spatial clearances', () => {
  const prop = {
    id: 'prop-1',
    name: 'Sample Property',
    village: 'Arakere',
    surveyNumber: '34',
    latitude: 12.887,
    longitude: 77.596
  };
  const res = sourceRegistryEngine.verifyDishaank(prop);
  assert.equal(res.status, 'not_connected');
  assert.equal(res.matchedRecord.isOfficialRecord, false);
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
  assert.equal(result.overallTrustScorePct, 0);
  assert.equal(result.totalDiscrepancies, 0);
  assert.ok(result.verifications.every(item => item.status === 'not_connected'));
});
