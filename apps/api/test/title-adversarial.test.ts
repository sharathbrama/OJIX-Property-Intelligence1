/**
 * OJIX Property Intelligence - Title Engine Adversarial Stress Test Suite
 * Empirical Challenger Verification Harness for Milestone 2
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTitleDAG,
  normalizePartyName,
  arePartyAliases,
  detectTitleGaps,
  type TitleEvent,
} from '../src/title-engine.js';

export interface StressTestReport {
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export function runAdversarialSuite(): StressTestReport[] {
  const reports: StressTestReport[] = [];

  function record(name: string, category: string, passed: boolean, expected: string, actual: string, severity?: 'critical' | 'high' | 'medium' | 'low') {
    reports.push({ name, category, passed, expected, actual, severity });
  }

  // =========================================================================
  // 1. Graph Topologies & Cycles
  // =========================================================================
  {
    // 1.1 Cyclic chain A -> B -> C -> A
    const cycleEvents: TitleEvent[] = [
      {
        id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Sale',
        fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2005-01-01', deedType: 'Sale',
        fromParties: [{ name: 'B', normalizedName: 'B' }], toParties: [{ name: 'C', normalizedName: 'C' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_3', propertyId: 'P1', documentId: 'D3', sequenceOrder: 3, eventDate: '2010-01-01', deedType: 'Sale',
        fromParties: [{ name: 'C', normalizedName: 'C' }], toParties: [{ name: 'A', normalizedName: 'A' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
      },
    ];
    const dag = buildTitleDAG(cycleEvents);
    record('Cyclic chain A -> B -> C -> A detection', 'Graph Topologies', dag.isAcyclic === false, 'isAcyclic = false', `isAcyclic = ${dag.isAcyclic}`);
  }

  {
    // 1.2 Disconnected title subgraphs
    const discEvents: TitleEvent[] = [
      {
        id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Sale',
        fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2005-01-01', deedType: 'Sale',
        fromParties: [{ name: 'X', normalizedName: 'X' }], toParties: [{ name: 'Y', normalizedName: 'Y' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
      },
    ];
    const dag = buildTitleDAG(discEvents);
    record('Disconnected title subgraphs', 'Graph Topologies', dag.isAcyclic === true && dag.nodes.length === 4 && dag.edges.length === 2, 'nodes: 4, edges: 2, isAcyclic: true', `nodes: ${dag.nodes.length}, edges: ${dag.edges.length}, isAcyclic: ${dag.isAcyclic}`);
  }

  {
    // 1.3 Single-node / single-grant deed
    const singleEvents: TitleEvent[] = [{
      id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Grant',
      fromParties: [{ name: 'State', normalizedName: 'STATE' }], toParties: [{ name: 'A', normalizedName: 'A' }],
      extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
    }];
    const dag = buildTitleDAG(singleEvents);
    record('Single deed chain', 'Graph Topologies', dag.isAcyclic === true && dag.nodes.length === 2, 'nodes: 2, isAcyclic: true', `nodes: ${dag.nodes.length}, isAcyclic: ${dag.isAcyclic}`);
  }

  {
    // 1.4 Empty input array
    const dag = buildTitleDAG([]);
    record('Empty title events array', 'Graph Topologies', dag.isAcyclic === true && dag.nodes.length === 0, 'nodes: 0, isAcyclic: true', `nodes: ${dag.nodes.length}, isAcyclic: ${dag.isAcyclic}`);
  }

  // =========================================================================
  // 2. Patronymics & Name Resolution
  // =========================================================================
  {
    // 2.1 Compound honorifics + multiple initials
    const raw = 'Late Sri Dr. K. R. Ramesh S/o Late Kadirappa';
    const norm = normalizePartyName(raw);
    const pass = norm.honorificsRemoved.includes('late') &&
                 norm.honorificsRemoved.includes('sri') &&
                 norm.honorificsRemoved.includes('dr') &&
                 norm.parentSpouse === 'Late Kadirappa' &&
                 norm.tokens.includes('RAMESH') &&
                 norm.initials.includes('K') && norm.initials.includes('R');
    record('Compound honorifics extraction', 'Patronymics', pass, 'extract late, sri, dr, Kadirappa, K, R, RAMESH', JSON.stringify(norm));
  }

  {
    // 2.2 Transposition: Ramesh K R vs K R Ramesh
    const pass = arePartyAliases('Ramesh K R', 'K R Ramesh');
    record('Initial transposition Ramesh K R vs K R Ramesh', 'Patronymics', pass === true, 'true', String(pass));
  }

  {
    // 2.3 Kannada transliteration: Gowda vs Gouda
    const pass = arePartyAliases('Suresh Gowda', 'Suresh Gouda');
    record('Kannada transliteration Gowda vs Gouda', 'Patronymics', pass === true, 'true', String(pass));
  }

  {
    // 2.4 Kannada transliteration: Venkatesh vs Wenkatesh
    const pass = arePartyAliases('Venkatesh Rao', 'Wenkatesh Rao');
    record('Kannada transliteration Venkatesh vs Wenkatesh', 'Patronymics', pass === true, 'true', String(pass));
  }

  {
    // 2.5 ADVERSARIAL: Distinct individuals with different initials (A. Ramesh vs B. Ramesh)
    const match = arePartyAliases('A. Ramesh', 'B. Ramesh');
    record(
      'Different initials distinction (A. Ramesh vs B. Ramesh)',
      'Patronymics',
      match === false,
      'false (different individuals with distinct initials)',
      `match = ${match} (FALSE POSITIVE COLLISION!)`,
      'critical'
    );
  }

  {
    // 2.6 ADVERSARIAL: Multiple different initials (A. B. Ramesh vs X. Y. Ramesh)
    const match = arePartyAliases('A. B. Ramesh', 'X. Y. Ramesh');
    record(
      'Multiple different initials distinction (A. B. Ramesh vs X. Y. Ramesh)',
      'Patronymics',
      match === false,
      'false (different patronymics A.B. vs X.Y.)',
      `match = ${match} (FALSE POSITIVE COLLISION!)`,
      'critical'
    );
  }

  // =========================================================================
  // 3. Date Boundaries & Registration Delays
  // =========================================================================
  {
    // 3.1 Same-day execution and registration
    const ev: TitleEvent = {
      id: 'EV_SAME', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1,
      eventDate: '2021-03-01', registrationDate: '2021-03-01', deedType: 'Sale Deed',
      fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
    };
    const gaps = detectTitleGaps([ev]);
    const inv = gaps.filter(g => g.code === 'TITLE_GAP_CHRONOLOGICAL_INVERSION' || g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED');
    record('Same-day execution & registration', 'Date Boundaries', inv.length === 0, '0 date gaps', `${inv.length} gaps`);
  }

  {
    // 3.2 Exact 120-day registration delay
    const ev: TitleEvent = {
      id: 'EV_120', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1,
      eventDate: '2021-01-01', registrationDate: '2021-05-01', deedType: 'Sale Deed', // 120 days
      fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
    };
    const gaps = detectTitleGaps([ev]);
    const delayGaps = gaps.filter(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED');
    record('Exact 120-day delay threshold', 'Date Boundaries', delayGaps.length === 0, '0 delay gaps (within limit)', `${delayGaps.length} gaps`);
  }

  {
    // 3.3 121-day registration delay
    const ev: TitleEvent = {
      id: 'EV_121', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1,
      eventDate: '2021-01-01', registrationDate: '2021-05-02', deedType: 'Sale Deed', // 121 days
      fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
      extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
    };
    const gaps = detectTitleGaps([ev]);
    const delayGaps = gaps.filter(g => g.code === 'TITLE_REGISTRATION_DELAY_EXCEEDED');
    record('121-day delay threshold violation', 'Date Boundaries', delayGaps.length === 1, '1 delay gap (TITLE_REGISTRATION_DELAY_EXCEEDED)', `${delayGaps.length} gaps`);
  }

  {
    // 3.4 ADVERSARIAL: Exact 30.00 years vs 29.99 years lookback gap detection
    // In a 30-year statutory search, if the earliest deed is only 29.99 years old (or 2 years old),
    // its predecessor deed is missing from the 30-year window!
    const chain29_99: TitleEvent[] = [
      {
        id: 'EV_1994', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1,
        eventDate: '1994-01-10', deedType: 'Sale Deed',
        fromParties: [{ name: 'Predecessor', normalizedName: 'PREDECESSOR' }],
        toParties: [{ name: 'Buyer 1', normalizedName: 'BUYER 1' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2024', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2,
        eventDate: '2024-01-01', deedType: 'Sale Deed',
        fromParties: [{ name: 'Buyer 1', normalizedName: 'BUYER 1' }],
        toParties: [{ name: 'Buyer 2', normalizedName: 'BUYER 2' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 200, status: 'verified',
      }
    ];
    // 1994-01-10 to 2024-01-01 is 29.975 years (< 30 years)
    const gaps29_99 = detectTitleGaps(chain29_99, 30);
    const predGaps = gaps29_99.filter(g => g.code === 'TITLE_GAP_MISSING_PREDECESSOR');
    record(
      '29.99-year chain missing predecessor detection',
      'Date Boundaries',
      predGaps.length >= 1,
      '>= 1 TITLE_GAP_MISSING_PREDECESSOR (chain covers < 30 years)',
      `${predGaps.length} gaps (FAILED TO FLAG MISSING ROOT PREDECESSOR)`,
      'critical'
    );
  }

  // =========================================================================
  // 4. Extent Over-Conveyance Ratios
  // =========================================================================
  {
    // 4.1 Exact 1.00x extent ratio (100,000 / 100,000)
    const evs: TitleEvent[] = [
      {
        id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Sale',
        fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
        extentSqFt: 100000, extentRaw: '100000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2005-01-01', deedType: 'Sale',
        fromParties: [{ name: 'B', normalizedName: 'B' }], toParties: [{ name: 'C', normalizedName: 'C' }],
        extentSqFt: 100000, extentRaw: '100000', consideration: 100, status: 'verified',
      }
    ];
    const gaps = detectTitleGaps(evs).filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE');
    record('Exact 1.00x extent ratio', 'Extent Boundaries', gaps.length === 0, '0 overconveyance gaps', `${gaps.length} gaps`);
  }

  {
    // 4.2 Exact 1.01x extent ratio (101,000 / 100,000)
    const evs: TitleEvent[] = [
      {
        id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Sale',
        fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
        extentSqFt: 100000, extentRaw: '100000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2005-01-01', deedType: 'Sale',
        fromParties: [{ name: 'B', normalizedName: 'B' }], toParties: [{ name: 'C', normalizedName: 'C' }],
        extentSqFt: 101000, extentRaw: '101000', consideration: 100, status: 'verified',
      }
    ];
    const gaps = detectTitleGaps(evs).filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE');
    record('Exact 1.01x extent ratio (1% survey margin)', 'Extent Boundaries', gaps.length === 0, '0 overconveyance gaps (allowed tolerance)', `${gaps.length} gaps`);
  }

  {
    // 4.3 Exact 1.011x extent ratio (101,100 / 100,000)
    const evs: TitleEvent[] = [
      {
        id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Sale',
        fromParties: [{ name: 'A', normalizedName: 'A' }], toParties: [{ name: 'B', normalizedName: 'B' }],
        extentSqFt: 100000, extentRaw: '100000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2005-01-01', deedType: 'Sale',
        fromParties: [{ name: 'B', normalizedName: 'B' }], toParties: [{ name: 'C', normalizedName: 'C' }],
        extentSqFt: 101100, extentRaw: '101100', consideration: 100, status: 'verified',
      }
    ];
    const gaps = detectTitleGaps(evs).filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE');
    record('Exact 1.011x extent ratio (>1% threshold)', 'Extent Boundaries', gaps.length === 1, '1 overconveyance gap', `${gaps.length} gaps`);
  }

  {
    // 4.4 ADVERSARIAL: Extent tracking across alias name spellings (K. R. Ramesh vs Ramesh K. R.)
    const evs: TitleEvent[] = [
      {
        id: 'EV_1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2000-01-01', deedType: 'Sale',
        fromParties: [{ name: 'Vendor', normalizedName: 'VENDOR' }],
        toParties: [{ name: 'K. R. Ramesh', normalizedName: 'K. R. RAMESH' }],
        extentSqFt: 10000, extentRaw: '10000', consideration: 100, status: 'verified',
      },
      {
        id: 'EV_2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2010-01-01', deedType: 'Sale',
        fromParties: [{ name: 'Ramesh K. R.', normalizedName: 'RAMESH K. R.' }],
        toParties: [{ name: 'Buyer', normalizedName: 'BUYER' }],
        extentSqFt: 50000, // 500% over-conveyance!
        extentRaw: '50000', consideration: 500, status: 'verified',
      }
    ];
    const gaps = detectTitleGaps(evs).filter(g => g.code === 'TITLE_GAP_EXTENT_OVERCONVEYANCE');
    record(
      'Extent overconveyance tracking across party name variations',
      'Extent Boundaries',
      gaps.length === 1,
      '1 TITLE_GAP_EXTENT_OVERCONVEYANCE (50,000 sq ft > 10,000 sq ft)',
      `${gaps.length} gaps (FAILED TO DETECT OVERCONVEYANCE DUE TO ALIAS MISMATCH)`,
      'critical'
    );
  }

  // =========================================================================
  // 5. Encumbrance Multi-Mortgage Isolation
  // =========================================================================
  {
    // 5.1 ADVERSARIAL: Multiple mortgages, only one discharged
    const evs: TitleEvent[] = [
      {
        id: 'EV_M1', propertyId: 'P1', documentId: 'D1', sequenceOrder: 1, eventDate: '2010-01-01', deedType: 'Mortgage Deed',
        fromParties: [{ name: 'Owner', normalizedName: 'OWNER' }], toParties: [{ name: 'Bank A', normalizedName: 'BANK A' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
        encumbranceStatus: 'active_mortgage',
      },
      {
        id: 'EV_M2', propertyId: 'P1', documentId: 'D2', sequenceOrder: 2, eventDate: '2012-01-01', deedType: 'Mortgage Deed',
        fromParties: [{ name: 'Owner', normalizedName: 'OWNER' }], toParties: [{ name: 'Bank B', normalizedName: 'BANK B' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 500, status: 'verified',
        encumbranceStatus: 'active_mortgage',
      },
      {
        id: 'EV_D1', propertyId: 'P1', documentId: 'D3', sequenceOrder: 3, eventDate: '2015-01-01', deedType: 'Reconveyance Deed',
        fromParties: [{ name: 'Bank A', normalizedName: 'BANK A' }], toParties: [{ name: 'Owner', normalizedName: 'OWNER' }],
        extentSqFt: 1000, extentRaw: '1000', consideration: 100, status: 'verified',
        encumbranceStatus: 'discharged',
      }
    ];
    const gaps = detectTitleGaps(evs).filter(g => g.code === 'TITLE_UNRELEASED_ENCUMBRANCE');
    record(
      'Multi-mortgage discharge isolation (Bank B unreleased)',
      'Encumbrances',
      gaps.length === 1 && gaps[0].sourceEventIds.includes('EV_M2'),
      '1 unreleased mortgage gap for EV_M2',
      `${gaps.length} gaps (BANK B MORTGAGE WRONGFULLY TREATED AS DISCHARGED)`,
      'medium'
    );
  }

  return reports;
}

// Register each adversarial stress test case with node:test
const reports = runAdversarialSuite();
for (const r of reports) {
  test(`[${r.category}] ${r.name}`, () => {
    assert.equal(r.passed, true, `Adversarial stress failure: expected "${r.expected}", got "${r.actual}"`);
  });
}
