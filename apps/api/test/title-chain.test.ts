import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTitleDAG,
  normalizePartyName,
  arePartyAliases,
  detectTitleGaps,
  recordReviewerDispute,
  calculateRiskScore,
  type TitleEvent,
} from '../src/title-engine.js';

// ============================================================================
// FEATURE 5: Ownership Graph DAG Builder (R2)
// ============================================================================

test('F5 Tier 1: Builds linear 3-deed chain (A -> B -> C) correctly', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1994',
      propertyId: 'PROP_1',
      documentId: 'DOC_1994',
      sequenceOrder: 1,
      eventDate: '1994-04-10',
      registrationDate: '1994-04-10',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Anjanappa', normalizedName: 'ANJANAPPA' }],
      toParties: [{ name: 'Muniyappa', normalizedName: 'MUNIYAPPA' }],
      extentSqFt: 65340,
      extentRaw: '1 Acre 20 Guntas',
      consideration: 250000,
      status: 'verified',
    },
    {
      id: 'EV_2008',
      propertyId: 'PROP_1',
      documentId: 'DOC_2008',
      sequenceOrder: 2,
      eventDate: '2008-08-20',
      registrationDate: '2008-08-20',
      deedType: 'Gift Deed',
      fromParties: [{ name: 'Muniyappa', normalizedName: 'MUNIYAPPA' }],
      toParties: [{ name: 'Suresh M', normalizedName: 'SURESH M' }],
      extentSqFt: 65340,
      extentRaw: '1 Acre 20 Guntas',
      consideration: 0,
      status: 'verified',
    },
    {
      id: 'EV_2018',
      propertyId: 'PROP_1',
      documentId: 'DOC_2018',
      sequenceOrder: 3,
      eventDate: '2018-11-15',
      registrationDate: '2018-11-15',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Suresh M', normalizedName: 'SURESH M' }],
      toParties: [{ name: 'Ramesh K R', normalizedName: 'RAMESH K R' }],
      extentSqFt: 65340,
      extentRaw: '1 Acre 20 Guntas',
      consideration: 8500000,
      status: 'verified',
    },
  ];

  const dag = buildTitleDAG(events);
  assert.equal(dag.isAcyclic, true);
  assert.equal(dag.nodes.length, 4); // Anjanappa, Muniyappa, Suresh M, Ramesh K R
  assert.equal(dag.edges.length, 3);
  assert.equal(dag.sortedEvents[0].id, 'EV_1994');
  assert.equal(dag.sortedEvents[2].id, 'EV_2018');
});

test('F5 Tier 1: Handles branched inheritance / multiple transferees', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_PARENT',
      propertyId: 'PROP_1',
      documentId: 'DOC_PARENT',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Govinda', normalizedName: 'GOVINDA' }],
      toParties: [{ name: 'Venkatesh', normalizedName: 'VENKATESH' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 500000,
      status: 'verified',
    },
    {
      id: 'EV_PARTITION',
      propertyId: 'PROP_1',
      documentId: 'DOC_PARTITION',
      sequenceOrder: 2,
      eventDate: '2015-06-01',
      deedType: 'Partition Deed',
      fromParties: [{ name: 'Venkatesh', normalizedName: 'VENKATESH' }],
      toParties: [
        { name: 'Son A', normalizedName: 'SON A' },
        { name: 'Son B', normalizedName: 'SON B' },
      ],
      extentSqFt: 21780,
      extentRaw: '20 Guntas each',
      consideration: 0,
      status: 'verified',
    },
  ];

  const dag = buildTitleDAG(events);
  assert.equal(dag.isAcyclic, true);
  assert.equal(dag.edges.length, 3); // Govinda->Venkatesh, Venkatesh->Son A, Venkatesh->Son B
});

test('F5 Tier 1: Single root deed produces valid 2-node graph', () => {
  const events: TitleEvent[] = [{
    id: 'EV_ROOT',
    propertyId: 'PROP_1',
    documentId: 'DOC_ROOT',
    sequenceOrder: 1,
    eventDate: '2010-01-01',
    deedType: 'Grant Order',
    fromParties: [{ name: 'Tahsildar', normalizedName: 'TAHSILDAR' }],
    toParties: [{ name: 'Kadirappa', normalizedName: 'KADIRAPPA' }],
    extentSqFt: 43560,
    extentRaw: '1 Acre',
    consideration: 10000,
    status: 'verified',
  }];

  const dag = buildTitleDAG(events);
  assert.equal(dag.isAcyclic, true);
  assert.equal(dag.nodes.length, 2);
  assert.equal(dag.edges.length, 1);
});

test('F5 Tier 1: Orders events chronologically regardless of input order', () => {
  const ev1: TitleEvent = {
    id: 'EV_2015',
    propertyId: 'PROP_1',
    documentId: 'DOC_2015',
    sequenceOrder: 2,
    eventDate: '2015-05-01',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'B', normalizedName: 'B' }],
    toParties: [{ name: 'C', normalizedName: 'C' }],
    extentSqFt: 2000,
    extentRaw: '2000 sq ft',
    consideration: 100000,
    status: 'verified',
  };
  const ev2: TitleEvent = {
    id: 'EV_2005',
    propertyId: 'PROP_1',
    documentId: 'DOC_2005',
    sequenceOrder: 1,
    eventDate: '2005-05-01',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 2000,
    extentRaw: '2000 sq ft',
    consideration: 50000,
    status: 'verified',
  };

  const dag = buildTitleDAG([ev1, ev2]);
  assert.equal(dag.sortedEvents[0].id, 'EV_2005');
  assert.equal(dag.sortedEvents[1].id, 'EV_2015');
});

test('F5 Tier 1: Captures directed edge extent attributes', () => {
  const events: TitleEvent[] = [{
    id: 'EV_1',
    propertyId: 'PROP_1',
    documentId: 'DOC_1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'X', normalizedName: 'X' }],
    toParties: [{ name: 'Y', normalizedName: 'Y' }],
    extentSqFt: 54450,
    extentRaw: '1 Acre 10 Guntas',
    consideration: 1000000,
    status: 'verified',
  }];

  const dag = buildTitleDAG(events);
  assert.equal(dag.edges[0].extentSqFt, 54450);
});

test('F5 Tier 2: Detects cyclic conveyance transactions (A -> B -> A)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'PROP_1',
      documentId: 'DOC_1',
      sequenceOrder: 1,
      eventDate: '2010-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Ramesh', normalizedName: 'RAMESH' }],
      toParties: [{ name: 'Suresh', normalizedName: 'SURESH' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 500000,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'PROP_1',
      documentId: 'DOC_2',
      sequenceOrder: 2,
      eventDate: '2015-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Suresh', normalizedName: 'SURESH' }],
      toParties: [{ name: 'Ramesh', normalizedName: 'RAMESH' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 800000,
      status: 'verified',
    },
  ];

  const dag = buildTitleDAG(events);
  assert.equal(dag.isAcyclic, false); // Cycle detected!
});

test('F5 Tier 2: Handles disconnected islands of deeds', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'PROP_1',
      documentId: 'DOC_1',
      sequenceOrder: 1,
      eventDate: '2010-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 1000,
      extentRaw: '1000 sq ft',
      consideration: 1000,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'PROP_1',
      documentId: 'DOC_2',
      sequenceOrder: 2,
      eventDate: '2012-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'C', normalizedName: 'C' }],
      toParties: [{ name: 'D', normalizedName: 'D' }],
      extentSqFt: 1000,
      extentRaw: '1000 sq ft',
      consideration: 1000,
      status: 'verified',
    },
  ];

  const dag = buildTitleDAG(events);
  assert.equal(dag.nodes.length, 4);
  assert.equal(dag.edges.length, 2);
  assert.equal(dag.isAcyclic, true);
});

test('F5 Tier 2: Handles simultaneous transfers executed on the same date', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_A',
      propertyId: 'PROP_1',
      documentId: 'DOC_A',
      sequenceOrder: 1,
      eventDate: '2020-03-15',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'P', normalizedName: 'P' }],
      toParties: [{ name: 'Q', normalizedName: 'Q' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_B',
      propertyId: 'PROP_1',
      documentId: 'DOC_B',
      sequenceOrder: 2,
      eventDate: '2020-03-15',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Q', normalizedName: 'Q' }],
      toParties: [{ name: 'R', normalizedName: 'R' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 120,
      status: 'verified',
    },
  ];

  const dag = buildTitleDAG(events);
  assert.equal(dag.sortedEvents.length, 2);
  assert.equal(dag.isAcyclic, true);
});

test('F5 Tier 2: Handles empty title events array without crashing', () => {
  const dag = buildTitleDAG([]);
  assert.equal(dag.nodes.length, 0);
  assert.equal(dag.edges.length, 0);
  assert.equal(dag.isAcyclic, true);
});

test('F5 Tier 2: Multiple sellers conveying to multiple buyers in single deed', () => {
  const events: TitleEvent[] = [{
    id: 'EV_JOINT',
    propertyId: 'PROP_1',
    documentId: 'DOC_JOINT',
    sequenceOrder: 1,
    eventDate: '2021-01-01',
    deedType: 'Sale Deed',
    fromParties: [
      { name: 'Seller 1', normalizedName: 'SELLER 1' },
      { name: 'Seller 2', normalizedName: 'SELLER 2' },
    ],
    toParties: [
      { name: 'Buyer 1', normalizedName: 'BUYER 1' },
      { name: 'Buyer 2', normalizedName: 'BUYER 2' },
    ],
    extentSqFt: 2400,
    extentRaw: '2400',
    consideration: 5000000,
    status: 'verified',
  }];

  const dag = buildTitleDAG(events);
  assert.equal(dag.edges.length, 4); // S1->B1, S1->B2, S2->B1, S2->B2
});

// ============================================================================
// FEATURE 6: South Indian / Karnataka Alias Normalizer (R2)
// ============================================================================

test('F6 Tier 1: Strips honorifics: Sri, Smt, Srimathi, Mr, Dr, Late', () => {
  const n1 = normalizePartyName('Sri K. R. Ramesh');
  assert.ok(n1.honorificsRemoved.includes('sri'));
  assert.equal(n1.tokens[0], 'RAMESH');

  const n2 = normalizePartyName('Smt. Lakshmi Devi');
  assert.ok(n2.honorificsRemoved.includes('smt'));

  const n3 = normalizePartyName('Late Kadirappa');
  assert.ok(n3.honorificsRemoved.includes('late'));
});

test('F6 Tier 1: Identifies initials and parentage relationship (S/o, W/o, D/o)', () => {
  const res = normalizePartyName('Sri K. R. Ramesh (S/o Kadirappa)');
  assert.equal(res.parentSpouse, 'Kadirappa');
  assert.equal(res.relationType, 's/o');
  assert.ok(res.initials.includes('K'));
  assert.ok(res.initials.includes('R'));
});

test('F6 Tier 1: Equates initial-transposed name variations (K. R. Ramesh vs Ramesh K R)', () => {
  const match = arePartyAliases('Sri K. R. Ramesh', 'Ramesh K. R.');
  assert.equal(match, true);
});

test('F6 Tier 1: Equates full parentage expansion with abbreviated patronymics', () => {
  const match = arePartyAliases('Ramesh Kadirappa Ramaswamy (S/o Late Kadirappa)', 'Sri K. R. Ramesh (S/o Kadirappa)');
  assert.equal(match, true);
});

test('F6 Tier 1: Matches Kannada transliteration variations (Venkatesh vs Wenkatesh)', () => {
  const match = arePartyAliases('Venkatesh Rao', 'Wenkatesh Rao');
  assert.equal(match, true);
});

test('F6 Tier 1: Matches phonetic community variations (Gowda vs Gouda)', () => {
  const match = arePartyAliases('Suresh Gowda', 'Suresh Gouda');
  assert.equal(match, true);
});

test('F6 Tier 2: Correctly distinguishes completely different persons', () => {
  const match = arePartyAliases('Ramesh K R', 'Suresh Gowda');
  assert.equal(match, false);
});

test('F6 Tier 2: Handles excessive whitespace and punctuations', () => {
  const res = normalizePartyName('   Sri.   K.   R.,   Ramesh   ');
  assert.equal(res.tokens[0], 'RAMESH');
  assert.ok(res.initials.includes('K'));
  assert.ok(res.initials.includes('R'));
});

test('F6 Tier 2: Handles single letter or minimal names', () => {
  const res = normalizePartyName('A');
  assert.ok(res.canonicalName);
});

test('F6 Tier 2: Handles wife-of (W/o) relationship extraction', () => {
  const res = normalizePartyName('Srimathi Shailaja (W/o Dr. Krishna Murthy)');
  assert.equal(res.relationType, 'w/o');
  assert.match(res.parentSpouse || '', /Krishna Murthy/i);
});

test('F6 Tier 2: Handles daughter-of (D/o) relationship extraction', () => {
  const res = normalizePartyName('Kumari Deepa D/o Narayana Swamy');
  assert.equal(res.relationType, 'd/o');
  assert.match(res.parentSpouse || '', /Narayana Swamy/i);
});

test('F6 Tier 2: Empty string party name normalizer fallback', () => {
  const res = normalizePartyName('');
  assert.equal(res.canonicalName, '');
});

// ============================================================================
// FEATURE 7: Unbroken Chain Gap Detector (30-year lookback) (R2)
// ============================================================================

test('F7 Tier 1: Unbroken 30-year chain generates 0 missing predecessor gaps', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1984',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '1984-04-10',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Anjanappa', normalizedName: 'ANJANAPPA' }],
      toParties: [{ name: 'Muniyappa', normalizedName: 'MUNIYAPPA' }],
      extentSqFt: 65340,
      extentRaw: '1-20',
      consideration: 250000,
      status: 'verified',
    },
    {
      id: 'EV_2008',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2008-08-20',
      deedType: 'Gift Deed',
      fromParties: [{ name: 'Muniyappa', normalizedName: 'MUNIYAPPA' }],
      toParties: [{ name: 'Suresh', normalizedName: 'SURESH' }],
      extentSqFt: 65340,
      extentRaw: '1-20',
      consideration: 0,
      status: 'verified',
    },
    {
      id: 'EV_2018',
      propertyId: 'P1',
      documentId: 'D3',
      sequenceOrder: 3,
      eventDate: '2018-11-15',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Suresh', normalizedName: 'SURESH' }],
      toParties: [{ name: 'Ramesh', normalizedName: 'RAMESH' }],
      extentSqFt: 65340,
      extentRaw: '1-20',
      consideration: 8500000,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events, 30);
  const missingGaps = gaps.filter(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.equal(missingGaps.length, 0);
});

test('F7 Tier 1: Missing intermediate deed flags TITLE_GAP_MISSING_PREDECESSOR', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1995',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '1995-01-01',
      deedType: 'Grant Order',
      fromParties: [{ name: 'Government of Karnataka', normalizedName: 'GOVERNMENT OF KARNATAKA' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 100000,
      status: 'verified',
    },
    {
      id: 'EV_2015',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2015-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Unknown Stranger', normalizedName: 'UNKNOWN STRANGER' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 2000000,
      status: 'unverified',
    },
  ];

  const gaps = detectTitleGaps(events, 30);
  const missingGap = gaps.find(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.ok(missingGap);
  assert.equal(missingGap.severity, 'high');
  assert.equal(missingGap.points, 25);
  assert.ok(missingGap.sourceEventIds.includes('EV_2015'));
});

test('F7 Tier 1: Root deed older than 30 years is accepted without predecessor gap', () => {
  const events: TitleEvent[] = [{
    id: 'EV_1985',
    propertyId: 'P1',
    documentId: 'D_OLD',
    sequenceOrder: 1,
    eventDate: '1985-05-01',
    deedType: 'Absolute Sale Deed',
    fromParties: [{ name: 'Old Farmer', normalizedName: 'OLD FARMER' }],
    toParties: [{ name: 'Buyer 1985', normalizedName: 'BUYER 1985' }],
    extentSqFt: 43560,
    extentRaw: '1 Acre',
    consideration: 50000,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events, 30);
  const missingGaps = gaps.filter(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.equal(missingGaps.length, 0);
});

test('F7 Tier 1: Multiple disconnected sellers generate multiple gap findings', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Grant Order',
      fromParties: [{ name: 'State Government', normalizedName: 'STATE GOVERNMENT' }],
      toParties: [{ name: 'Buyer A', normalizedName: 'BUYER A' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2010-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Seller B', normalizedName: 'SELLER B' }],
      toParties: [{ name: 'Buyer B', normalizedName: 'BUYER B' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 200,
      status: 'verified',
    },
    {
      id: 'EV_3',
      propertyId: 'P1',
      documentId: 'D3',
      sequenceOrder: 3,
      eventDate: '2020-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'Seller C', normalizedName: 'SELLER C' }],
      toParties: [{ name: 'Buyer C', normalizedName: 'BUYER C' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 300,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events, 30);
  const missingGaps = gaps.filter(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.equal(missingGaps.length, 2); // EV_2 and EV_3 have sellers without acquisition
});

test('F7 Tier 1: Identifies source event IDs in gap finding object', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_ROOT',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2005-01-01',
      deedType: 'Grant',
      fromParties: [{ name: 'Government', normalizedName: 'GOVERNMENT' }],
      toParties: [{ name: 'First', normalizedName: 'FIRST' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_GAP',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2015-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Unrelated', normalizedName: 'UNRELATED' }],
      toParties: [{ name: 'Second', normalizedName: 'SECOND' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 200,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  const gap = gaps.find(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.ok(gap);
  assert.deepEqual(gap.sourceEventIds, ['EV_GAP']);
});

test('F7 Tier 2: Zero events returns empty gaps array', () => {
  const gaps = detectTitleGaps([]);
  assert.equal(gaps.length, 0);
});

test('F7 Tier 2: Single recent deed within lookback window flags missing predecessor', () => {
  const events: TitleEvent[] = [{
    id: 'EV_ONLY_RECENT',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2023-01-01', // only 1 year ago, not 30 years
    deedType: 'Sale Deed',
    fromParties: [{ name: 'Sudden Owner', normalizedName: 'SUDDEN OWNER' }],
    toParties: [{ name: 'Buyer', normalizedName: 'BUYER' }],
    extentSqFt: 10000,
    extentRaw: '10000 sq ft',
    consideration: 10000000,
    status: 'unverified',
  }];

  const gaps = detectTitleGaps(events, 30);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].code, 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.equal(gaps[0].severity, 'high');
  assert.deepEqual(gaps[0].sourceEventIds, ['EV_ONLY_RECENT']);
});

test('F7 Tier 2: Handles custom lookback window (e.g. 12-year standard limitation period)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_2005',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2005-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2020',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2020-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 200,
      status: 'verified',
    },
  ];

  const gaps12 = detectTitleGaps(events, 12);
  assert.equal(gaps12.filter(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR').length, 0);
});

test('F7 Tier 2: Multiple buyers from earlier deed where only one conveys later', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Grant',
      fromParties: [{ name: 'Government of Karnataka', normalizedName: 'GOVERNMENT OF KARNATAKA' }],
      toParties: [
        { name: 'Brother 1', normalizedName: 'BROTHER 1' },
        { name: 'Brother 2', normalizedName: 'BROTHER 2' },
      ],
      extentSqFt: 2000,
      extentRaw: '2000',
      consideration: 200,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2010-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Brother 1', normalizedName: 'BROTHER 1' }],
      toParties: [{ name: 'Y', normalizedName: 'Y' }],
      extentSqFt: 1000,
      extentRaw: '1000',
      consideration: 150,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  const missingGaps = gaps.filter(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
  assert.equal(missingGaps.length, 0); // Brother 1 has valid acquisition
});

test('F7 Tier 2: Unreleased encumbrance detection in timeline', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_SALE',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2010-01-01',
      deedType: 'Sale Deed',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 2000,
      extentRaw: '2000',
      consideration: 1000,
      status: 'verified',
    },
    {
      id: 'EV_MORTGAGE',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2016-04-10',
      deedType: 'Mortgage Deed',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'State Bank of India', normalizedName: 'STATE BANK OF INDIA' }],
      extentSqFt: 2000,
      extentRaw: '2000',
      consideration: 5000000,
      status: 'unverified',
      encumbranceStatus: 'active_mortgage',
    },
  ];

  const gaps = detectTitleGaps(events);
  const unreleased = gaps.find(g => g.code === 'TITLE_UNRELEASED_ENCUMBRANCE');
  assert.ok(unreleased);
  assert.equal(unreleased.severity, 'critical');
  assert.equal(unreleased.points, 35);
});

// ============================================================================
// FEATURE 8: Chronological Inversion Detector (R2)
// ============================================================================

test('F8 Tier 1: Inverted registration preceding execution flags TITLE_GAP_CHRONOLOGICAL_INVERSION', () => {
  const events: TitleEvent[] = [{
    id: 'EV_INVERTED',
    propertyId: 'P1',
    documentId: 'DOC_BAD_DATE',
    sequenceOrder: 1,
    eventDate: '2020-05-10', // executed May 10
    registrationDate: '2020-05-01', // registered May 01 (impossible!)
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  }];

  const gaps = detectTitleGaps(events);
  const inv = gaps.find(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION');
  assert.ok(inv);
  assert.equal(inv.severity, 'critical');
  assert.equal(inv.points, 35);
});

test('F8 Tier 1: Registration delay > 120 days flags TITLE_REGISTRATION_DELAY_EXCEEDED (15 pts)', () => {
  const events: TitleEvent[] = [{
    id: 'EV_DELAYED',
    propertyId: 'P1',
    documentId: 'DOC_DELAY',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    registrationDate: '2020-06-15', // ~166 days delay (> 120 days Section 25)
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  }];

  const gaps = detectTitleGaps(events);
  const delay = gaps.find(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED');
  assert.ok(delay);
  assert.equal(delay.severity, 'medium');
  assert.equal(delay.points, 15);
});

test('F8 Tier 1: Same day execution and registration passes with 0 inversion gaps', () => {
  const events: TitleEvent[] = [{
    id: 'EV_NORMAL',
    propertyId: 'P1',
    documentId: 'DOC_NORMAL',
    sequenceOrder: 1,
    eventDate: '2021-02-14',
    registrationDate: '2021-02-14',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION').length, 0);
  assert.equal(gaps.filter(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED').length, 0);
});

test('F8 Tier 1: Registration within 60 days (<120 days limit) passes cleanly', () => {
  const events: TitleEvent[] = [{
    id: 'EV_60DAYS',
    propertyId: 'P1',
    documentId: 'DOC_60D',
    sequenceOrder: 1,
    eventDate: '2022-03-01',
    registrationDate: '2022-04-15', // 45 days
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED').length, 0);
});

test('F8 Tier 1: Missing registrationDate skips inversion check gracefully', () => {
  const events: TitleEvent[] = [{
    id: 'EV_NO_REG_DATE',
    propertyId: 'P1',
    documentId: 'DOC_NODATE',
    sequenceOrder: 1,
    eventDate: '2022-03-01',
    deedType: 'Agreement of Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION').length, 0);
});

test('F8 Tier 2: Registration delayed exactly 120 days passes boundary', () => {
  const events: TitleEvent[] = [{
    id: 'EV_EXACT_120',
    propertyId: 'P1',
    documentId: 'DOC_120',
    sequenceOrder: 1,
    eventDate: '2021-01-01',
    registrationDate: '2021-05-01', // exactly 120 days
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED').length, 0);
});

test('F8 Tier 2: Registration delayed 121 days flags boundary violation', () => {
  const events: TitleEvent[] = [{
    id: 'EV_121',
    propertyId: 'P1',
    documentId: 'DOC_121',
    sequenceOrder: 1,
    eventDate: '2021-01-01',
    registrationDate: '2021-05-02', // 121 days
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED').length, 1);
});

test('F8 Tier 2: Leap year date handling (February 29 execution)', () => {
  const events: TitleEvent[] = [{
    id: 'EV_LEAP',
    propertyId: 'P1',
    documentId: 'DOC_LEAP',
    sequenceOrder: 1,
    eventDate: '2020-02-29',
    registrationDate: '2020-03-05',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION').length, 0);
});

test('F8 Tier 2: Gross chronological inversion (e.g. 10 years inversion)', () => {
  const events: TitleEvent[] = [{
    id: 'EV_GROSS_INV',
    propertyId: 'P1',
    documentId: 'DOC_GROSS',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    registrationDate: '2010-01-01', // 10 years before execution!
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION').length, 1);
});

test('F8 Tier 2: Inverted dates report offending instrument ID in sourceEventIds', () => {
  const events: TitleEvent[] = [{
    id: 'EV_OFFENDER_77',
    propertyId: 'P1',
    documentId: 'DOC_77',
    sequenceOrder: 1,
    eventDate: '2022-01-02',
    registrationDate: '2022-01-01',
    deedType: 'Sale Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  }];

  const gaps = detectTitleGaps(events);
  const gap = gaps.find(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION');
  assert.deepEqual(gap?.sourceEventIds, ['EV_OFFENDER_77']);
});

// ============================================================================
// FEATURE 9: Extent Over-Conveyance Detector (R2)
// ============================================================================

test('F9 Tier 1: Seller conveys exact acquired extent (passes)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'X', normalizedName: 'X' }],
      toParties: [{ name: 'Y', normalizedName: 'Y' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 100000,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2010-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Y', normalizedName: 'Y' }],
      toParties: [{ name: 'Z', normalizedName: 'Z' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 500000,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

test('F9 Tier 1: Seller conveys partial extent (passes)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'X', normalizedName: 'X' }],
      toParties: [{ name: 'Y', normalizedName: 'Y' }],
      extentSqFt: 43560, // 1 Acre (40 Guntas)
      extentRaw: '1 Acre',
      consideration: 100000,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2010-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Y', normalizedName: 'Y' }],
      toParties: [{ name: 'Z', normalizedName: 'Z' }],
      extentSqFt: 21780, // 20 Guntas
      extentRaw: '20 Guntas',
      consideration: 300000,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

test('F9 Tier 1: Seller conveys more than acquired flags TITLE_GAP_EXTENT_OVERCONVEYANCE', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_ACQ',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Govinda', normalizedName: 'GOVINDA' }],
      toParties: [{ name: 'Suresh', normalizedName: 'SURESH' }],
      extentSqFt: 76230, // 1 Acre 30 Guntas = 76,230 sq ft
      extentRaw: '1 Acre 30 Guntas',
      consideration: 1000000,
      status: 'verified',
    },
    {
      id: 'EV_SALE',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2015-05-10',
      deedType: 'Sale',
      fromParties: [{ name: 'Suresh', normalizedName: 'SURESH' }],
      toParties: [{ name: 'Buyer X', normalizedName: 'BUYER X' }],
      extentSqFt: 98010, // 2 Acres 10 Guntas = 98,010 sq ft (OVER-CONVEYANCE by 21,780 sq ft!)
      extentRaw: '2 Acres 10 Guntas',
      consideration: 15000000,
      status: 'unverified',
    },
  ];

  const gaps = detectTitleGaps(events);
  const overConv = gaps.find(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE');
  assert.ok(overConv);
  assert.equal(overConv.severity, 'critical');
  assert.equal(overConv.points, 35);
  assert.match(overConv.description, /conveyed 98,010 sq ft exceeding acquired extent of 76,230 sq ft/i);
});

test('F9 Tier 1: Cumulative split sales exceeding acquired extent flags over-conveyance', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'O', normalizedName: 'O' }],
      toParties: [{ name: 'A', normalizedName: 'A' }],
      extentSqFt: 43560, // 40 Guntas (1 Acre)
      extentRaw: '1 Acre',
      consideration: 1000,
      status: 'verified',
    },
    {
      id: 'EV_SPLIT_1',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2005-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 27225, // 25 Guntas
      extentRaw: '25 Guntas',
      consideration: 1000,
      status: 'verified',
    },
    {
      id: 'EV_SPLIT_2',
      propertyId: 'P1',
      documentId: 'D3',
      sequenceOrder: 3,
      eventDate: '2010-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 21780, // 20 Guntas (Total conveyed = 45 Guntas > 40 Guntas!)
      extentRaw: '20 Guntas',
      consideration: 1000,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  const overConv = gaps.find(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE');
  assert.ok(overConv);
  assert.equal(overConv.severity, 'critical');
});

test('F9 Tier 1: Survey margin tolerance 1% is respected (no false alarm for 0.5% difference)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 10000,
      extentRaw: '10000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2005-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 10050, // 0.5% extra (within 1% margin)
      extentRaw: '10050',
      consideration: 100,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

test('F9 Tier 2: Boundary 1.009% excess passes (within 1.01 margin)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 100000,
      extentRaw: '100000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2005-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 100900, // exactly 0.9% excess
      extentRaw: '100900',
      consideration: 100,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

test('F9 Tier 2: Boundary 1.011% excess flags over-conveyance', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 100000,
      extentRaw: '100000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2005-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 101200, // 1.2% excess (>1.01)
      extentRaw: '101200',
      consideration: 100,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 1);
});

test('F9 Tier 2: Owner acquires from two deeds and conveys aggregate extent (passes)', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 20000,
      extentRaw: '20000',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2002-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'X', normalizedName: 'X' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 30000,
      extentRaw: '30000',
      consideration: 150,
      status: 'verified',
    },
    {
      id: 'EV_3',
      propertyId: 'P1',
      documentId: 'D3',
      sequenceOrder: 3,
      eventDate: '2010-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 50000, // Exactly 20k + 30k
      extentRaw: '50000',
      consideration: 500,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

test('F9 Tier 2: Zero extent conveyed produces no over-conveyance error', () => {
  const events: TitleEvent[] = [{
    id: 'EV_ZERO',
    propertyId: 'P1',
    documentId: 'D_Z',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Release Deed',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 0,
    extentRaw: '0',
    consideration: 0,
    status: 'verified',
  }];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

test('F9 Tier 2: Fractional extent difference calculations', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 1089.5,
      extentRaw: '1 Gunta and 0.5 sq ft',
      consideration: 100,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2010-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'B', normalizedName: 'B' }],
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 1089.5,
      extentRaw: '1 Gunta and 0.5 sq ft',
      consideration: 200,
      status: 'verified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.equal(gaps.filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE').length, 0);
});

// ============================================================================
// FEATURE 10: Reviewer Dispute & Verification Engine (R2)
// ============================================================================

test('F10 Tier 1: Allows legal reviewer to mark title event as verified', () => {
  const ev: TitleEvent = {
    id: 'EV_1',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(ev, 'verified', undefined, 'legal_advocate_01');
  assert.equal(updated.status, 'verified');
  assert.equal(updated.reviewedBy, 'legal_advocate_01');
});

test('F10 Tier 1: Allows reviewer to record dispute with MISSING_LINK_DOC rationale', () => {
  const ev: TitleEvent = {
    id: 'EV_1',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(ev, 'disputed', 'MISSING_LINK_DOC: 1995 predecessor deed not uploaded', 'legal_lead');
  assert.equal(updated.status, 'disputed');
  assert.match(updated.disputeRationale || '', /MISSING_LINK_DOC/);
  assert.equal(updated.reviewedBy, 'legal_lead');
});

test('F10 Tier 1: Allows reviewer to record dispute with SUSPICIOUS_POA rationale', () => {
  const ev: TitleEvent = {
    id: 'EV_POA',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2021-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'POA Agent', normalizedName: 'POA AGENT' }],
    toParties: [{ name: 'Buyer', normalizedName: 'BUYER' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(ev, 'disputed', 'SUSPICIOUS_POA: GPA not registered or verified with principal', 'reviewer_1');
  assert.equal(updated.status, 'disputed');
  assert.match(updated.disputeRationale || '', /SUSPICIOUS_POA/);
});

test('F10 Tier 1: Allows reviewer to record dispute with PENDING_LITIGATION rationale', () => {
  const ev: TitleEvent = {
    id: 'EV_LIT',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2022-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'Seller', normalizedName: 'SELLER' }],
    toParties: [{ name: 'Buyer', normalizedName: 'BUYER' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(ev, 'disputed', 'PENDING_LITIGATION: OS No 1234/2021 pending in City Civil Court', 'reviewer_1');
  assert.equal(updated.status, 'disputed');
});

test('F10 Tier 1: Rejects dispute without mandatory rationale string', () => {
  const ev: TitleEvent = {
    id: 'EV_1',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  assert.throws(() => {
    recordReviewerDispute(ev, 'disputed', '');
  }, /rationale is mandatory/i);
});

test('F10 Tier 2: Rejects whitespace-only dispute rationale', () => {
  const ev: TitleEvent = {
    id: 'EV_1',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  assert.throws(() => {
    recordReviewerDispute(ev, 'disputed', '   \t  \n  ');
  }, /rationale is mandatory/i);
});

test('F10 Tier 2: Allows clearing dispute back to unverified status', () => {
  const disputedEv: TitleEvent = {
    id: 'EV_1',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'disputed',
    disputeRationale: 'Previous dispute',
  };

  const cleared = recordReviewerDispute(disputedEv, 'unverified', undefined, 'rev_lead');
  assert.equal(cleared.status, 'unverified');
  assert.equal(cleared.disputeRationale, undefined);
});

test('F10 Tier 2: Preserves title event immutability on dispute recording', () => {
  const ev: TitleEvent = {
    id: 'EV_1',
    propertyId: 'P1',
    documentId: 'D1',
    sequenceOrder: 1,
    eventDate: '2020-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'A', normalizedName: 'A' }],
    toParties: [{ name: 'B', normalizedName: 'B' }],
    extentSqFt: 1000,
    extentRaw: '1000',
    consideration: 100,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(ev, 'verified');
  assert.equal(ev.status, 'unverified'); // original object unchanged
  assert.equal(updated.status, 'verified');
});

test('F10 Tier 2: Disputing root ancestral grant with HINDU_SUCCESSION_VIOLATION rationale', () => {
  const ev: TitleEvent = {
    id: 'EV_ANC',
    propertyId: 'P1',
    documentId: 'D_ANC',
    sequenceOrder: 1,
    eventDate: '2012-05-01',
    deedType: 'Partition Deed',
    fromParties: [{ name: 'Father', normalizedName: 'FATHER' }],
    toParties: [{ name: 'Son Only', normalizedName: 'SON ONLY' }],
    extentSqFt: 10000,
    extentRaw: '10000',
    consideration: 0,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(
    ev,
    'disputed',
    'HINDU_SUCCESSION_VIOLATION: Daughters excluded from coparcenary partition post 2005',
    'advocate_expert'
  );
  assert.equal(updated.status, 'disputed');
  assert.match(updated.disputeRationale || '', /HINDU_SUCCESSION_VIOLATION/);
});

test('F10 Tier 2: Dispute with SC_ST_PTCL_ACT_RESTRICTION rationale', () => {
  const ev: TitleEvent = {
    id: 'EV_PTCL',
    propertyId: 'P1',
    documentId: 'D_PTCL',
    sequenceOrder: 1,
    eventDate: '2018-01-01',
    deedType: 'Sale',
    fromParties: [{ name: 'Grantee', normalizedName: 'GRANTEE' }],
    toParties: [{ name: 'Buyer', normalizedName: 'BUYER' }],
    extentSqFt: 43560,
    extentRaw: '1 Acre',
    consideration: 2000000,
    status: 'unverified',
  };

  const updated = recordReviewerDispute(
    ev,
    'disputed',
    'SC_ST_PTCL_ACT_RESTRICTION: Granted land transferred without prior permission of Deputy Commissioner',
    'advocate_expert'
  );
  assert.equal(updated.status, 'disputed');
});

// ============================================================================
// TIER 3: Cross-Feature Combinations (Pairwise)
// ============================================================================

test('Tier 3 Pairwise: South Indian Alias Normalization -> Ownership DAG Construction', () => {
  const name1 = 'Sri K. R. Ramesh (S/o Kadirappa)';
  const name2 = 'Ramesh Kadirappa Ramaswamy';
  assert.equal(arePartyAliases(name1, name2), true);

  const events: TitleEvent[] = [
    {
      id: 'EV_1',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2005-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Vendor 1', normalizedName: 'VENDOR 1' }],
      toParties: [{ name: name1, normalizedName: normalizePartyName(name1).canonicalName }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 100000,
      status: 'verified',
    },
    {
      id: 'EV_2',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2015-01-01',
      deedType: 'Sale',
      fromParties: [{ name: name2, normalizedName: normalizePartyName(name1).canonicalName }], // Unified canonical name
      toParties: [{ name: 'Buyer Final', normalizedName: 'BUYER FINAL' }],
      extentSqFt: 43560,
      extentRaw: '1 Acre',
      consideration: 500000,
      status: 'verified',
    },
  ];

  const dag = buildTitleDAG(events);
  assert.equal(dag.isAcyclic, true);
  assert.equal(dag.nodes.length, 3); // Vendor 1, Ramesh (unified), Buyer Final
  assert.equal(dag.edges.length, 2);
});

test('Tier 3 Pairwise: Title Gap Detection + Over-Conveyance Detection', () => {
  const events: TitleEvent[] = [
    {
      id: 'EV_ROOT',
      propertyId: 'P1',
      documentId: 'D1',
      sequenceOrder: 1,
      eventDate: '2000-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'A', normalizedName: 'A' }],
      toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 43560, // 1 Acre
      extentRaw: '1 Acre',
      consideration: 1000,
      status: 'verified',
    },
    {
      id: 'EV_GAP_AND_OVERCONV',
      propertyId: 'P1',
      documentId: 'D2',
      sequenceOrder: 2,
      eventDate: '2015-01-01',
      deedType: 'Sale',
      fromParties: [{ name: 'Stranger X', normalizedName: 'STRANGER X' }], // Gap: Missing predecessor!
      toParties: [{ name: 'C', normalizedName: 'C' }],
      extentSqFt: 87120, // 2 Acres
      extentRaw: '2 Acres',
      consideration: 5000,
      status: 'unverified',
    },
  ];

  const gaps = detectTitleGaps(events);
  assert.ok(gaps.some(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR'));
});

test('Tier 3 Pairwise: Title Gaps + Reviewer Dispute -> Risk Score Calculation', () => {
  const gaps = [
    {
      code: 'TITLE_GAP_MISSING_PREDECESSOR' as const,
      severity: 'high' as const,
      title: 'Missing predecessor',
      description: 'Test',
      sourceEventIds: ['ev_1'],
      points: 25,
    },
    {
      code: 'TITLE_GAP_EXTENT_OVERCONVEYANCE' as const,
      severity: 'critical' as const,
      title: 'Over conveyance',
      description: 'Test',
      sourceEventIds: ['ev_2'],
      points: 35,
    },
  ];

  const risk = calculateRiskScore(gaps);
  assert.equal(risk.score, 60); // 25 + 35 = 60
  assert.equal(risk.band, 'review_required');
  assert.equal(risk.severityCounts.critical, 1);
  assert.equal(risk.severityCounts.high, 1);
});
