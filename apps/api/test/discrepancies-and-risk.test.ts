import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseKarnatakaLandExtent,
  compareExtents,
  compareBoundaries,
  calculateRiskScore,
} from '../src/discrepancy-engine.js';

// ============================================================================
// FEATURE 15: Karnataka Land Unit Normalizer (R4)
// ============================================================================

test('F15 Tier 1: Converts 1 Acre to exactly 43,560 sq ft', () => {
  const result = parseKarnatakaLandExtent('1 Acre');
  assert.equal(result.acres, 1);
  assert.equal(result.normalizedSqFt, 43560);
});

test('F15 Tier 1: Converts 1 Gunta to exactly 1,089 sq ft', () => {
  const result = parseKarnatakaLandExtent('1 Gunta');
  assert.equal(result.guntas, 1);
  assert.equal(result.normalizedSqFt, 1089);
});

test('F15 Tier 1: Converts compound 1 Acre 20 Guntas to 65,340 sq ft', () => {
  const result = parseKarnatakaLandExtent('1 Acre 20 Guntas');
  assert.equal(result.acres, 1);
  assert.equal(result.guntas, 20);
  assert.equal(result.normalizedSqFt, 65340);
});

test('F15 Tier 1: Converts Coastal Karnataka Cents to Sq. Ft. (50 Cents = 21,780 sq ft)', () => {
  const result = parseKarnatakaLandExtent('50 Cents');
  assert.equal(result.cents, 50);
  assert.equal(result.normalizedSqFt, 21780);
});

test('F15 Tier 1: Converts Square Metres to Sq. Ft. (500 sq.m = 5,381.96 sq ft)', () => {
  const result = parseKarnatakaLandExtent('500 sq.mtr');
  assert.ok(result.normalizedSqFt >= 5381 && result.normalizedSqFt <= 5383);
});

test('F15 Tier 1: Converts plot dimensions to Sq. Ft. (40 x 60 ft = 2,400 sq ft)', () => {
  const result = parseKarnatakaLandExtent('40 x 60 ft');
  assert.equal(result.normalizedSqFt, 2400);
});

test('F15 Tier 2: Parses fractional guntas "1 Acre 5 1/2 Guntas" to 49,549.5 sq ft', () => {
  const result = parseKarnatakaLandExtent('1 Acre 5 1/2 Guntas');
  assert.equal(result.acres, 1);
  assert.equal(result.guntas, 5.5);
  // 43560 + 5.5 * 1089 = 49549.5
  assert.equal(result.normalizedSqFt, 49549.5);
});

test('F15 Tier 2: Parses hyphenated format "0-30 Guntas" to 32,670 sq ft', () => {
  const result = parseKarnatakaLandExtent('0-30 Guntas');
  assert.equal(result.acres, 0);
  assert.equal(result.guntas, 30);
  assert.equal(result.normalizedSqFt, 32670);
});

test('F15 Tier 2: Parses quarter gunta "1/4 Gunta" to 272.25 sq ft', () => {
  const result = parseKarnatakaLandExtent('1/4 Gunta');
  assert.equal(result.guntas, 0.25);
  assert.equal(result.normalizedSqFt, 272.25);
});

test('F15 Tier 2: Parses three-quarters gunta "3/4 Gunta" to 816.75 sq ft', () => {
  const result = parseKarnatakaLandExtent('3/4 Gunta');
  assert.equal(result.guntas, 0.75);
  assert.equal(result.normalizedSqFt, 816.75);
});

test('F15 Tier 2: Handles zero extent string "0 Acres 0 Guntas"', () => {
  const result = parseKarnatakaLandExtent('0 Acres 0 Guntas');
  assert.equal(result.normalizedSqFt, 0);
});

test('F15 Tier 2: Handles large rural parcel "100 Acres 0 Guntas"', () => {
  const result = parseKarnatakaLandExtent('100 Acres');
  assert.equal(result.normalizedSqFt, 4356000);
});

// ============================================================================
// FEATURE 16: Cross-Document Extent Comparator (R4)
// ============================================================================

test('F16 Tier 1: Matching extents (<1% diff) return null finding', () => {
  const finding = compareExtents(65340, 65340, 'Sale Deed', 'RTC');
  assert.equal(finding, null);
});

test('Active discrepancy rules override extent thresholds and severity mapping', () => {
  const finding = compareExtents(10000, 9700, 'A', 'B', {tolerancePct:0.02,highPct:0.04,criticalPct:0.08,severityByBand:{medium:'low'}});
  assert.ok(finding);
  assert.equal(finding.severity,'low');
  assert.equal(compareExtents(10000,9900,'A','B',{tolerancePct:0.02}),null);
});

test('F16 Tier 1: Minor divergence (1% to 5%) flags medium severity (15 pts)', () => {
  // 65340 vs 63500 (~2.8% diff)
  const finding = compareExtents(65340, 63500, 'Sale Deed', 'RTC');
  assert.ok(finding);
  assert.equal(finding.code, 'DISCREPANCY_EXTENT_MISMATCH');
  assert.equal(finding.severity, 'medium');
  assert.equal(finding.points, 15);
  assert.match(finding.statutoryCitation, /Karnataka Land Revenue Act/);
});

test('F16 Tier 1: Moderate divergence (5% to 10%) flags high severity (25 pts)', () => {
  // 65340 vs 60000 (~8.1% diff)
  const finding = compareExtents(65340, 60000, 'Sale Deed', 'RTC');
  assert.ok(finding);
  assert.equal(finding.severity, 'high');
  assert.equal(finding.points, 25);
});

test('F16 Tier 1: Major divergence (>10%) flags critical severity (35 pts)', () => {
  // Sale Deed: 38 Guntas (41,382 sq ft) vs RTC: 32 Guntas (34,848 sq ft) -> ~15.8% diff
  const finding = compareExtents(41382, 34848, 'Sale Deed 2018', 'RTC Pahani 2023');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
  assert.equal(finding.points, 35);
  assert.match(finding.deltaText, /15.8% divergence/);
  assert.match(finding.nextAction, /Re-survey by Licensed Taluk Surveyor/);
});

test('F16 Tier 1: Includes documented statutory citation and rule version', () => {
  const finding = compareExtents(50000, 40000, 'Deed A', 'Deed B');
  assert.ok(finding);
  assert.equal(finding.ruleId, 'RULE-EXT-001');
  assert.equal(finding.ruleVersion, 'v1.0');
});

test('F16 Tier 2: Boundary exactly 1.0% diff returns null (within margin)', () => {
  const finding = compareExtents(10000, 9900, 'Doc A', 'Doc B'); // exactly 1.0%
  assert.equal(finding, null);
});

test('F16 Tier 2: Boundary 1.1% diff flags medium severity', () => {
  const finding = compareExtents(10000, 9890, 'Doc A', 'Doc B'); // 1.1%
  assert.ok(finding);
  assert.equal(finding.severity, 'medium');
});

test('F16 Tier 2: Boundary exactly 5.0% diff flags medium severity', () => {
  const finding = compareExtents(10000, 9500, 'Doc A', 'Doc B'); // exactly 5.0%
  assert.ok(finding);
  assert.equal(finding.severity, 'medium');
});

test('F16 Tier 2: Boundary 5.1% diff flags high severity', () => {
  const finding = compareExtents(10000, 9490, 'Doc A', 'Doc B'); // 5.1%
  assert.ok(finding);
  assert.equal(finding.severity, 'high');
});

test('F16 Tier 2: Symmetric comparison (swapping Doc A and Doc B produces identical points and severity)', () => {
  const findingAB = compareExtents(40000, 30000, 'Doc A', 'Doc B');
  const findingBA = compareExtents(30000, 40000, 'Doc B', 'Doc A');
  assert.ok(findingAB && findingBA);
  assert.equal(findingAB.severity, findingBA.severity);
  assert.equal(findingAB.points, findingBA.points);
});

test('F16 Tier 2: Zero extent in one document returns null gracefully', () => {
  assert.equal(compareExtents(0, 1000, 'Doc A', 'Doc B'), null);
  assert.equal(compareExtents(1000, 0, 'Doc A', 'Doc B'), null);
});

// ============================================================================
// FEATURE 17: Four-Side Schedule Boundary Comparator (R4)
// ============================================================================

test('F17 Tier 1: Identical 4-side boundaries yield 0 conflict findings', () => {
  const b1 = { north: 'Public Road', south: 'Survey 34/3', east: 'Private Land', west: 'Lake Buffer' };
  const b2 = { north: 'Public Road', south: 'Survey 34/3', east: 'Private Land', west: 'Lake Buffer' };
  const findings = compareBoundaries(b1, b2);
  assert.equal(findings.length, 0);
});

test('F17 Tier 1: North boundary mismatch flags DISCREPANCY_SCHEDULE_BOUNDARY_CONFLICT (25 pts)', () => {
  const b1 = { north: '60ft Main Road', south: 'Survey 34/3', east: 'Private Land', west: 'Lake' };
  const b2 = { north: 'Private Site No. 4', south: 'Survey 34/3', east: 'Private Land', west: 'Lake' };
  const findings = compareBoundaries(b1, b2, 'Sale Deed 2018', 'Sale Deed 2008');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'DISCREPANCY_SCHEDULE_BOUNDARY_CONFLICT');
  assert.equal(findings[0].field, 'boundary');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].points, 25);
  assert.match(findings[0].deltaText, /NORTH boundary conflict/i);
});

test('F17 Tier 1: South boundary mismatch flags conflict', () => {
  const b1 = { north: 'Road', south: 'Survey 34/3', east: 'Land', west: 'Drain' };
  const b2 = { north: 'Road', south: 'Government Gramatana', east: 'Land', west: 'Drain' };
  const findings = compareBoundaries(b1, b2);
  assert.equal(findings.length, 1);
  assert.match(findings[0].deltaText, /SOUTH boundary conflict/i);
});

test('F17 Tier 1: East and West simultaneous boundary mismatches generate 2 findings', () => {
  const b1 = { north: 'Road', south: 'Drain', east: 'Site 10', west: 'Site 12' };
  const b2 = { north: 'Road', south: 'Drain', east: 'Park Area', west: 'Ring Road' };
  const findings = compareBoundaries(b1, b2);
  assert.equal(findings.length, 2);
});

test('F17 Tier 1: Includes statutory citation § 21 Registration Act 1908', () => {
  const b1 = { north: 'Road A', south: 'S', east: 'E', west: 'W' };
  const b2 = { north: 'Road B', south: 'S', east: 'E', west: 'W' };
  const findings = compareBoundaries(b1, b2);
  assert.match(findings[0].statutoryCitation, /Registration Act 1908 § 21/);
});

test('F17 Tier 2: Case-insensitive comparison treats "ROAD" and "road" as match', () => {
  const b1 = { north: 'PUBLIC ROAD', south: 'SURVEY 10', east: 'EAST LAND', west: 'WEST LAND' };
  const b2 = { north: 'public road', south: 'survey 10', east: 'east land', west: 'west land' };
  const findings = compareBoundaries(b1, b2);
  assert.equal(findings.length, 0);
});

test('F17 Tier 2: Trims leading and trailing whitespace before comparison', () => {
  const b1 = { north: '   Road   ', south: 'S', east: 'E', west: 'W' };
  const b2 = { north: 'Road', south: 'S', east: 'E', west: 'W' };
  const findings = compareBoundaries(b1, b2);
  assert.equal(findings.length, 0);
});

test('F17 Tier 2: Empty boundary string in one document does not throw error', () => {
  const b1 = { north: 'Road', south: '', east: 'E', west: 'W' };
  const b2 = { north: 'Road', south: 'Survey 22', east: 'E', west: 'W' };
  const findings = compareBoundaries(b1, b2);
  assert.ok(Array.isArray(findings));
});

test('F17 Tier 2: All 4 boundaries mismatch returns 4 findings', () => {
  const b1 = { north: 'A', south: 'B', east: 'C', west: 'D' };
  const b2 = { north: 'W', south: 'X', east: 'Y', west: 'Z' };
  const findings = compareBoundaries(b1, b2);
  assert.equal(findings.length, 4);
});

test('F17 Tier 2: Preserves document names in docA and docB fields', () => {
  const b1 = { north: 'Road 1', south: 'S', east: 'E', west: 'W' };
  const b2 = { north: 'Road 2', south: 'S', east: 'E', west: 'W' };
  const findings = compareBoundaries(b1, b2, 'e-Khata 2022', 'Sale Deed 2015');
  assert.equal(findings[0].docA.name, 'e-Khata 2022');
  assert.equal(findings[0].docB.name, 'Sale Deed 2015');
});

// ============================================================================
// FEATURE 18: Capped Explainable Risk Scorer & UI Matrix (R4)
// ============================================================================

test('F18 Tier 1: Zero findings returns score 0 and preliminary band', () => {
  const result = calculateRiskScore([]);
  assert.equal(result.score, 0);
  assert.equal(result.band, 'preliminary');
  assert.equal(result.findingCount, 0);
});

test('F18 Tier 1: Single critical finding (35 pts) assigns review_required band', () => {
  const result = calculateRiskScore([{ severity: 'critical', points: 35 }]);
  assert.equal(result.score, 35);
  assert.equal(result.band, 'review_required');
  assert.equal(result.severityCounts.critical, 1);
});

test('F18 Tier 1: Two critical findings (70 pts) assigns high_attention band', () => {
  const result = calculateRiskScore([
    { severity: 'critical', points: 35 },
    { severity: 'critical', points: 35 },
  ]);
  assert.equal(result.score, 70);
  assert.equal(result.band, 'high_attention');
});

test('F18 Tier 1: Three critical findings (105 pts) is capped strictly at 100', () => {
  const result = calculateRiskScore([
    { severity: 'critical', points: 35 },
    { severity: 'critical', points: 35 },
    { severity: 'critical', points: 35 },
  ]);
  assert.equal(result.score, 100);
  assert.equal(result.band, 'high_attention');
});

test('F18 Tier 1: Uses default severity weights when points omitted', () => {
  // critical: 35, high: 25, medium: 15, low: 5 -> total 80 -> capped at 80
  const result = calculateRiskScore([
    { severity: 'critical' },
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'low' },
  ]);
  assert.equal(result.score, 80);
  assert.equal(result.band, 'high_attention');
  assert.equal(result.severityCounts.critical, 1);
  assert.equal(result.severityCounts.high, 1);
  assert.equal(result.severityCounts.medium, 1);
  assert.equal(result.severityCounts.low, 1);
});

test('F18 Tier 2: Single low finding (5 pts) remains preliminary band', () => {
  const result = calculateRiskScore([{ severity: 'low', points: 5 }]);
  assert.equal(result.score, 5);
  assert.equal(result.band, 'preliminary');
});

test('F18 Tier 2: Score exactly 34 is in preliminary band', () => {
  const result = calculateRiskScore([
    { severity: 'medium', points: 20 },
    { severity: 'low', points: 14 },
  ]);
  assert.equal(result.score, 34);
  assert.equal(result.band, 'preliminary');
});

test('F18 Tier 2: Score exactly 35 transitions to review_required band', () => {
  const result = calculateRiskScore([{ severity: 'critical', points: 35 }]);
  assert.equal(result.score, 35);
  assert.equal(result.band, 'review_required');
});

test('F18 Tier 2: Score exactly 69 is in review_required band', () => {
  const result = calculateRiskScore([
    { severity: 'critical', points: 35 },
    { severity: 'high', points: 25 },
    { severity: 'low', points: 9 },
  ]);
  assert.equal(result.score, 69);
  assert.equal(result.band, 'review_required');
});

test('F18 Tier 2: Score exactly 70 transitions to high_attention band', () => {
  const result = calculateRiskScore([
    { severity: 'critical', points: 35 },
    { severity: 'critical', points: 35 },
  ]);
  assert.equal(result.score, 70);
  assert.equal(result.band, 'high_attention');
});

test('F18 Tier 2: Unverified findings contribute 0 points', () => {
  const result = calculateRiskScore([
    { severity: 'unverified', points: 0 },
    { severity: 'unverified', points: 0 },
  ]);
  assert.equal(result.score, 0);
  assert.equal(result.band, 'preliminary');
});

// ============================================================================
// TIER 3: Cross-Feature Combinations (Pairwise)
// ============================================================================

test('Tier 3 Pairwise: Land Unit Normalization -> Cross-Document Extent Comparison', () => {
  const deedExtent = parseKarnatakaLandExtent('1 Acre 20 Guntas'); // 65,340 sq ft
  const rtcExtent = parseKarnatakaLandExtent('1 Acre 10 Guntas');  // 54,450 sq ft
  assert.equal(deedExtent.normalizedSqFt, 65340);
  assert.equal(rtcExtent.normalizedSqFt, 54450);

  const finding = compareExtents(deedExtent.normalizedSqFt, rtcExtent.normalizedSqFt, 'Sale Deed', 'RTC');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical'); // ~16.7% diff (>10%)
  assert.equal(finding.points, 35);
});

test('Tier 3 Pairwise: Boundary Conflict + Extent Mismatch -> Combined Risk Scoring', () => {
  const extentFinding = compareExtents(41382, 34848, 'Sale Deed', 'RTC'); // critical, 35 pts
  const boundaryFindings = compareBoundaries(
    { north: '60ft Road', south: 'S', east: 'E', west: 'W' },
    { north: 'Private Site', south: 'S', east: 'E', west: 'W' },
    'Sale Deed',
    'Prior Deed'
  ); // high, 25 pts

  assert.ok(extentFinding);
  assert.equal(boundaryFindings.length, 1);

  const combinedFindings = [extentFinding, ...boundaryFindings];
  const risk = calculateRiskScore(combinedFindings);
  assert.equal(risk.score, 60); // 35 + 25 = 60
  assert.equal(risk.band, 'review_required');
  assert.equal(risk.findingCount, 2);
});

test('Tier 3 Pairwise: Multi-Document Extent Normalization (Sale Deed vs e-Khata vs RTC)', () => {
  const docSale = parseKarnatakaLandExtent('2400 sq.ft');
  const docKhata = parseKarnatakaLandExtent('222.96 sq.m'); // ~2399.93 sq ft (<0.01% diff)
  const docRTC = parseKarnatakaLandExtent('3000 sq.ft');    // 25% diff

  // Sale vs Khata (matches)
  assert.equal(compareExtents(docSale.normalizedSqFt, docKhata.normalizedSqFt), null);

  // Sale vs RTC (critical mismatch)
  const finding = compareExtents(docSale.normalizedSqFt, docRTC.normalizedSqFt);
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
});
