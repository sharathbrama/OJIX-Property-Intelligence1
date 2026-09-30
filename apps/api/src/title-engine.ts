/**
 * OJIX Property Intelligence - Title Chain & Ownership Graph Engine (R2)
 * Features 5, 6, 7, 8, 9, 10
 */

export interface TitleEventParty {
  name: string;
  normalizedName: string;
}

export interface TitleEvent {
  id: string;
  propertyId: string;
  documentId: string;
  sequenceOrder: number;
  eventDate: string;
  registrationDate?: string;
  deedType: string;
  fromParties: TitleEventParty[];
  toParties: TitleEventParty[];
  extentSqFt: number;
  extentRaw: string;
  consideration: number;
  status: 'verified' | 'unverified' | 'disputed';
  disputeRationale?: string;
  reviewedBy?: string;
  encumbranceStatus?: 'active_mortgage' | 'discharged' | 'none';
}

export interface TitleGap {
  code:
    | 'TITLE_GAP_MISSING_PREDECESSOR'
    | 'TITLE_GAP_CHRONOLOGICAL_INVERSION'
    | 'TITLE_GAP_EXTENT_OVERCONVEYANCE'
    | 'TITLE_UNRELEASED_ENCUMBRANCE'
    | 'TITLE_REGISTRATION_DELAY_EXCEEDED';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  sourceEventIds: string[];
  points: number;
}

export interface TitleDAGResult {
  nodes: Array<{ id: string; name: string }>;
  edges: Array<{ from: string; to: string; eventId: string; extentSqFt: number }>;
  isAcyclic: boolean;
  sortedEvents: TitleEvent[];
}

/**
 * Normalizes South Indian / Karnataka phonetic variations:
 * W -> V, OU -> OW, SH -> S, TH -> T, collapse doubled consonants.
 */
export function phoneticNormalize(s: string): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .toUpperCase()
    .replace(/\b(DR|SRI|SHRI|SMT|SRIMATHI|LATE|MR|MRS|MS|KUM|KUMARI|MASTER)\b\.?/gi, '')
    .replace(/GOUDA/g, 'GOWDA')
    .replace(/OU/g, 'OW')
    .replace(/W/g, 'V')
    .replace(/SH/g, 'S')
    .replace(/TH/g, 'T')
    .replace(/LAXMI/g, 'LAKSHMI')
    .replace(/LAKSHMI/g, 'LAKSMI')
    .replace(/([A-Z])\1+/g, '$1')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes party names, extracting honorifics, initials, parentage/spouse relationships,
 * and canonical tokens.
 */
export function normalizePartyName(rawName: string): {
  canonicalName: string;
  honorificsRemoved: string[];
  parentSpouse?: string;
  relationType?: string;
  initials: string[];
  tokens: string[];
} {
  if (!rawName || typeof rawName !== 'string') {
    return {
      canonicalName: '',
      honorificsRemoved: [],
      initials: [],
      tokens: [],
    };
  }

  let text = rawName.trim().replace(/\s+/g, ' ');
  if (text.length === 0) {
    return {
      canonicalName: '',
      honorificsRemoved: [],
      initials: [],
      tokens: [],
    };
  }

  const honorificsFound: string[] = [];
  const honorificRegex = /^(sri|srimathi|smt|shri|mr|mrs|ms|dr|late|master|kumari)\.?\s+/i;
  let match;
  while ((match = text.match(honorificRegex)) !== null) {
    honorificsFound.push(match[1].toLowerCase());
    text = text.substring(match[0].length).trim();
  }

  let parentSpouse: string | undefined;
  let relationType: string | undefined;
  const relMatch = text.match(/\b(s\/o|w\/o|d\/o|c\/o|son of|wife of|daughter of)\s+([^,)\n;]+)/i);
  if (relMatch) {
    relationType = relMatch[1].toLowerCase();
    parentSpouse = relMatch[2].trim().replace(/\s+/g, ' ');
    text = text.replace(relMatch[0], '').replace(/[()]/g, '').trim();
  }

  const sanitized = text
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = sanitized.split(' ').filter(w => w.length > 0);
  const initials: string[] = [];
  const normalWords: string[] = [];

  for (const w of words) {
    if (w.length === 1) {
      initials.push(w.toUpperCase());
    } else {
      normalWords.push(w.toUpperCase());
    }
  }

  const canonicalName = normalWords.length > 0 
    ? (parentSpouse ? `${normalWords.join(' ')} (S/O ${parentSpouse.toUpperCase()})` : normalWords.join(' '))
    : rawName.toUpperCase().trim();

  return {
    canonicalName,
    honorificsRemoved: honorificsFound,
    parentSpouse,
    relationType,
    initials,
    tokens: normalWords,
  };
}

/**
 * Determines whether two party name strings refer to the same individual alias,
 * handling initials transpositions, parentage matches, and phonetic variations.
 */
export function arePartyAliases(nameA: string, nameB: string): boolean {
  const normA = normalizePartyName(nameA);
  const normB = normalizePartyName(nameB);

  // If both names have initials, verify compatibility: must share initials or one set must be a subset of the other.
  if (normA.initials.length > 0 && normB.initials.length > 0) {
    const setA = new Set(normA.initials);
    const setB = new Set(normB.initials);
    const hasShared = normA.initials.some(i => setB.has(i));
    const isSubset = normA.initials.every(i => setB.has(i)) || normB.initials.every(i => setA.has(i));
    if (!hasShared && !isSubset) {
      return false;
    }
  }

  // Exact canonical match
  if (normA.canonicalName === normB.canonicalName) return true;

  // Check token intersection
  const setA = new Set(normA.tokens);
  const setB = new Set(normB.tokens);
  const common = normA.tokens.filter(t => setB.has(t));

  // If parent spouse is present and matches
  if (normA.parentSpouse && normB.parentSpouse) {
    const parentA = phoneticNormalize(normA.parentSpouse);
    const parentB = phoneticNormalize(normB.parentSpouse);
    if (parentA.includes(parentB) || parentB.includes(parentA)) {
      if (common.length >= 1) return true;
    }
  }

  // If one name has parentSpouse matching token in other name (e.g. S/o Kadirappa vs Ramesh Kadirappa Ramaswamy)
  if (normA.parentSpouse && common.length >= 1) {
    const pTokens = normA.parentSpouse.toUpperCase().split(/\s+/);
    if (pTokens.some(p => setB.has(p))) return true;
  }
  if (normB.parentSpouse && common.length >= 1) {
    const pTokens = normB.parentSpouse.toUpperCase().split(/\s+/);
    if (pTokens.some(p => setA.has(p))) return true;
  }

  // Initial transposition and expansion handling: "K. R. Ramesh" vs "Ramesh K R" or "Ramesh Kadirappa Ramaswamy"
  if (common.length >= 1) {
    const extraTokensB = normB.tokens.filter(t => !setA.has(t));
    if (extraTokensB.length > 0 && normA.initials.length > 0) {
      const extraInitialsB = extraTokensB.map(t => t[0]);
      if (normA.initials.every(init => extraInitialsB.includes(init))) return true;
    }
    const extraTokensA = normA.tokens.filter(t => !setB.has(t));
    if (extraTokensA.length > 0 && normB.initials.length > 0) {
      const extraInitialsA = extraTokensA.map(t => t[0]);
      if (normB.initials.every(init => extraInitialsA.includes(init))) return true;
    }
  }

  if (normA.tokens.length === 1 && normB.tokens.length === 1 && normA.tokens[0] === normB.tokens[0]) {
    const initSetA = new Set(normA.initials);
    const initSetB = new Set(normB.initials);
    const sharedInitials = normA.initials.filter(i => initSetB.has(i));
    if (sharedInitials.length === Math.max(normA.initials.length, normB.initials.length)) return true;
    if (normA.initials.length === 0 || normB.initials.length === 0) return true;
  }

  // Phonetic tolerance: Gowda / Gouda, Venkatesh / Wenkatesh
  const phonA = phoneticNormalize(normA.tokens.join(' '));
  const phonB = phoneticNormalize(normB.tokens.join(' '));
  if (phonA === phonB && phonA.length > 0) return true;

  return false;
}

/**
 * Feature 5: Builds directed acyclic graph (DAG) connecting title events chronologically.
 */
export function buildTitleDAG(events: TitleEvent[]): TitleDAGResult {
  const sorted = [...events].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  const nodes = new Map<string, { id: string; name: string }>();
  const edges: Array<{ from: string; to: string; eventId: string; extentSqFt: number }> = [];

  for (const ev of sorted) {
    for (const fp of ev.fromParties) {
      if (!nodes.has(fp.normalizedName)) {
        nodes.set(fp.normalizedName, { id: fp.normalizedName, name: fp.name });
      }
    }
    for (const tp of ev.toParties) {
      if (!nodes.has(tp.normalizedName)) {
        nodes.set(tp.normalizedName, { id: tp.normalizedName, name: tp.name });
      }
    }
    for (const fp of ev.fromParties) {
      for (const tp of ev.toParties) {
        edges.push({
          from: fp.normalizedName,
          to: tp.normalizedName,
          eventId: ev.id,
          extentSqFt: ev.extentSqFt,
        });
      }
    }
  }

  // Cycle detection via DFS with recursion stack tracking
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }

  let hasCycle = false;
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of adj.get(node) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        hasCycle = true;
      }
    }
    recStack.delete(node);
  }

  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    isAcyclic: !hasCycle,
    sortedEvents: sorted,
  };
}

/**
 * Determines whether a title event is a sovereign or government root grant.
 * Sovereign grants (e.g. Grant Order, Inam Abolition, KIADB Allotment, Auction, or having no transferor)
 * establish original root title without requiring private prior registered predecessor deeds.
 */
export function isSovereignRootGrant(ev: TitleEvent): boolean {
  if (!ev.fromParties || ev.fromParties.length === 0) return true;
  const deedTypeUpper = (ev.deedType || '').toUpperCase();
  const sovereignKeywords = ['GRANT', 'ALLOTMENT', 'INAM', 'AUCTION', 'SOVEREIGN', 'GOVERNMENT', 'GOVT', 'STATE'];
  if (sovereignKeywords.some(kw => deedTypeUpper.includes(kw))) {
    return true;
  }
  const sovereignParties = [
    'GOVERNMENT',
    'GOVT',
    'STATE OF KARNATAKA',
    'STATE',
    'KIADB',
    'BDA',
    'TOWNSHIP',
    'KHUDA',
    'PRESIDENT OF INDIA',
    'TAHSILDAR',
    'DEPUTY COMMISSIONER',
    'SPECIAL DEPUTY COMMISSIONER',
    'ASSISTANT COMMISSIONER',
  ];
  for (const fp of ev.fromParties) {
    const norm = (fp.normalizedName || fp.name || '').toUpperCase();
    if (sovereignParties.some(sp => norm.includes(sp))) {
      return true;
    }
  }
  return false;
}

/**
 * Feature 7, 8, 9: Detects title gaps in chain of ownership:
 * - Missing preceding acquisition deeds in 30-year search window
 * - Chronological inversions (registration preceding execution)
 * - Registration delays exceeding 120-day statutory window (Section 25)
 * - Unreleased active mortgages / charges
 * - Extent over-conveyance (>1% excess)
 */
export function detectTitleGaps(events: TitleEvent[], lookbackYears: number = 30): TitleGap[] {
  const gaps: TitleGap[] = [];
  const sorted = [...events].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  // Track party acquisitions
  const partyAcquisitions = new Map<string, { event: TitleEvent; extentSqFt: number }[]>();
  for (const ev of sorted) {
    for (const tp of ev.toParties) {
      if (!partyAcquisitions.has(tp.normalizedName)) {
        partyAcquisitions.set(tp.normalizedName, []);
      }
      partyAcquisitions.get(tp.normalizedName)!.push({ event: ev, extentSqFt: ev.extentSqFt });
    }
  }

  const earliestDate = sorted.length > 0 ? new Date(sorted[0].eventDate) : new Date();
  const latestDate = sorted.length > 0 ? new Date(sorted[sorted.length - 1].eventDate) : new Date();
  const spanYears = sorted.length <= 1
    ? (new Date().getTime() - earliestDate.getTime()) / (365.25 * 24 * 3600 * 1000)
    : (latestDate.getTime() - earliestDate.getTime()) / (365.25 * 24 * 3600 * 1000);

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (i === 0 && spanYears >= lookbackYears) {
      // First root document is accepted if outside lookback
      continue;
    }

    // 1. Missing Predecessor Detection (Unbroken Chain Lookback)
    for (const fp of ev.fromParties) {
      const directAcquisitions = partyAcquisitions.get(fp.normalizedName) || [];
      let validAcquisition = directAcquisitions.some(acq => new Date(acq.event.eventDate).getTime() < new Date(ev.eventDate).getTime());

      if (!validAcquisition) {
        // Also check if any acquisition exists under an alias
        for (const [acqPartyName, acqs] of partyAcquisitions.entries()) {
          if (arePartyAliases(acqPartyName, fp.normalizedName) || arePartyAliases(acqPartyName, fp.name)) {
            if (acqs.some(acq => new Date(acq.event.eventDate).getTime() < new Date(ev.eventDate).getTime())) {
              validAcquisition = true;
              break;
            }
          }
        }
      }

      if (!validAcquisition) {
        // For root deed (i === 0), sovereign/government root grants establish original root title
        if (i === 0 && isSovereignRootGrant(ev)) {
          continue;
        }

        gaps.push({
          code: 'TITLE_GAP_MISSING_PREDECESSOR',
          severity: 'high',
          title: 'Missing Registered Preceding Title Deed',
          description: i === 0
            ? `Root deed on ${ev.eventDate} by transferor '${fp.name}' lacks registered prior acquisition within ${lookbackYears}-year search window.`
            : `Transferor '${fp.name}' conveys property on ${ev.eventDate} without registered prior acquisition document in ${lookbackYears}-year search window.`,
          sourceEventIds: [ev.id],
          points: 25,
        });
      }
    }

    // 2. Chronological Inversion & Statutory Registration Delay Detection
    if (ev.registrationDate && ev.eventDate) {
      const execTime = new Date(ev.eventDate).getTime();
      const regTime = new Date(ev.registrationDate).getTime();
      if (regTime < execTime) {
        gaps.push({
          code: 'TITLE_GAP_CHRONOLOGICAL_INVERSION',
          severity: 'critical',
          title: 'Chronological Inversion: Registration Precedes Execution',
          description: `Instrument ${ev.id} registration date ${ev.registrationDate} precedes execution date ${ev.eventDate}.`,
          sourceEventIds: [ev.id],
          points: 35,
        });
      }

      // Check Registration Delay > 120 days (4 months Section 25)
      const diffDays = (regTime - execTime) / (1000 * 3600 * 24);
      if (diffDays > 120) {
        gaps.push({
          code: 'TITLE_REGISTRATION_DELAY_EXCEEDED',
          severity: 'medium',
          title: 'Statutory Registration Window Exceeded (>120 Days)',
          description: `Registration delayed by ${Math.round(diffDays)} days from execution without condonation order under Section 25.`,
          sourceEventIds: [ev.id],
          points: 15,
        });
      }
    }

    // 3. Unreleased Encumbrance Detection (with Mortgagee/Document Isolation)
    if (ev.encumbranceStatus === 'active_mortgage') {
      const hasDischarge = sorted.some(subEv => {
        if (subEv.encumbranceStatus !== 'discharged') return false;
        if (new Date(subEv.eventDate).getTime() <= new Date(ev.eventDate).getTime()) return false;

        // Ensure discharge deed matches the active mortgage mortgagee/lender or parties
        const mortgageLenders = ev.toParties;
        const dischargeParties = [...subEv.fromParties, ...subEv.toParties];
        const lenderMatched = mortgageLenders.some(lender =>
          dischargeParties.some(dp =>
            dp.normalizedName === lender.normalizedName ||
            arePartyAliases(dp.normalizedName, lender.normalizedName) ||
            arePartyAliases(dp.name, lender.name)
          )
        );
        if (lenderMatched) return true;

        if (subEv.documentId && ev.documentId && subEv.documentId === ev.documentId) {
          return true;
        }

        return false;
      });

      if (!hasDischarge) {
        gaps.push({
          code: 'TITLE_UNRELEASED_ENCUMBRANCE',
          severity: 'critical',
          title: 'Unreleased Bank Mortgage / Charge Recorded',
          description: `Active mortgage registered on ${ev.eventDate} has no registered discharge deed or release satisfaction in Kaveri EC.`,
          sourceEventIds: [ev.id],
          points: 35,
        });
      }
    }
  }

  // 4. Extent Over-Conveyance Detection
  // Cluster party names using arePartyAliases to aggregate acquired and conveyed extents across aliases
  interface PartyCluster {
    entityId: string;
    displayName: string;
    parties: Array<{ name: string; normalizedName: string }>;
  }

  const clusters: PartyCluster[] = [];

  function getPartyCluster(party: { name: string; normalizedName: string }): PartyCluster {
    for (const cluster of clusters) {
      const match = cluster.parties.some(member =>
        member.normalizedName === party.normalizedName ||
        arePartyAliases(member.normalizedName, party.normalizedName) ||
        arePartyAliases(member.name, party.name) ||
        arePartyAliases(member.normalizedName, party.name) ||
        arePartyAliases(member.name, party.normalizedName)
      );
      if (match) {
        cluster.parties.push(party);
        return cluster;
      }
    }

    const newCluster: PartyCluster = {
      entityId: party.normalizedName || party.name,
      displayName: party.name || party.normalizedName,
      parties: [party],
    };
    clusters.push(newCluster);
    return newCluster;
  }

  const clusterMap = new Map<string, PartyCluster>();
  for (const ev of sorted) {
    for (const p of [...ev.fromParties, ...ev.toParties]) {
      const c = getPartyCluster(p);
      clusterMap.set(p.normalizedName, c);
    }
  }

  const clusterExtentAcquired = new Map<string, number>();
  const clusterExtentConveyed = new Map<string, number>();

  for (const ev of sorted) {
    for (const tp of ev.toParties) {
      const cluster = clusterMap.get(tp.normalizedName) || getPartyCluster(tp);
      const current = clusterExtentAcquired.get(cluster.entityId) || 0;
      clusterExtentAcquired.set(cluster.entityId, current + ev.extentSqFt);
    }
    for (const fp of ev.fromParties) {
      const cluster = clusterMap.get(fp.normalizedName) || getPartyCluster(fp);
      const current = clusterExtentConveyed.get(cluster.entityId) || 0;
      clusterExtentConveyed.set(cluster.entityId, current + ev.extentSqFt);
    }
  }

  for (const [entityId, conveyed] of clusterExtentConveyed.entries()) {
    const acquired = clusterExtentAcquired.get(entityId) || 0;
    const cluster = clusters.find(c => c.entityId === entityId);
    const displayName = cluster ? cluster.displayName : entityId;

    // Allow 1% margin
    if (acquired > 0 && conveyed > acquired * 1.01) {
      const sourceEvents = sorted.filter(e =>
        e.fromParties.some(fp => {
          const c = clusterMap.get(fp.normalizedName);
          return c && c.entityId === entityId;
        })
      );

      gaps.push({
        code: 'TITLE_GAP_EXTENT_OVERCONVEYANCE',
        severity: 'critical',
        title: 'Title Extent Over-Conveyance Detected',
        description: `Party '${displayName}' conveyed ${conveyed.toLocaleString()} sq ft exceeding acquired extent of ${acquired.toLocaleString()} sq ft by ${(conveyed - acquired).toLocaleString()} sq ft.`,
        sourceEventIds: sourceEvents.map(e => e.id),
        points: 35,
      });
    }
  }

  return gaps;
}

/**
 * Feature 10: Records reviewer verification or dispute on title events.
 * Enforces mandatory non-empty rationale when disputing an event.
 */
export function recordReviewerDispute(
  event: TitleEvent,
  status: 'verified' | 'disputed' | 'unverified',
  rationale?: string,
  reviewerUid?: string
): TitleEvent {
  if (status === 'disputed' && (!rationale || rationale.trim().length === 0)) {
    throw new Error('Dispute rationale is mandatory when disputing a title event');
  }
  return {
    ...event,
    status,
    disputeRationale: rationale,
    reviewedBy: reviewerUid || 'legal_reviewer_1',
  };
}

/**
 * Risk scoring calculation helper compatible with Title Gaps and Risk finding matrices.
 */
export function calculateRiskScore(findings: Array<{
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unverified';
  points?: number;
  code?: string;
}>): {
  score: number;
  band: 'preliminary' | 'review_required' | 'high_attention';
  findings: Array<any>;
  severityCounts: { critical: number; high: number; medium: number; low: number };
  findingCount: number;
  disclaimer: string;
} {
  const severityWeight = {
    critical: 35,
    high: 25,
    medium: 15,
    low: 5,
    unverified: 0,
  };

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  let rawScore = 0;

  for (const f of findings) {
    if (f.severity !== 'unverified') {
      severityCounts[f.severity]++;
    }
    const pts = f.points !== undefined ? f.points : severityWeight[f.severity];
    rawScore += Math.max(pts, severityWeight[f.severity]);
  }

  const cappedScore = Math.min(100, rawScore);
  const band = cappedScore >= 70 ? 'high_attention' : cappedScore >= 35 ? 'review_required' : 'preliminary';

  return {
    score: cappedScore,
    band,
    findings,
    severityCounts,
    findingCount: findings.length,
    disclaimer: 'This risk analysis is an algorithmic due-diligence screening aid and does not constitute a certified legal opinion or title guarantee under Karnataka law.',
  };
}
