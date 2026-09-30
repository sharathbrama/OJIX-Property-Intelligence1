/**
 * OJIX Property Intelligence - Cross-Document Discrepancy & Risk Scoring Engine (R4)
 * Feature 15: Karnataka Land Unit Normalizer (Acres, Guntas, Cents, Sq. Ft., Sq. Metres)
 * Feature 16: Cross-Document Extent Reconciliation with 1% Survey Margin Tolerance
 * Feature 17: Schedule Boundary Conflict Detector (North, South, East, West)
 * Feature 18: Explainable & Capped Risk Scoring Engine (0-100 score, banded categories)
 */

export interface KarnatakaLandExtent {
  rawText: string;
  acres: number;
  guntas: number;
  cents: number;
  sqFt: number;
  sqMeters: number;
  normalizedSqFt: number;
}

export interface DiscrepancyFinding {
  id: string;
  code: string;
  ruleId: string;
  ruleVersion: string;
  statutoryCitation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  points: number;
  field: 'extent' | 'boundary' | 'party' | 'ownership' | 'survey_number';
  docA: { id: string; name: string; type: string; value: string };
  docB: { id: string; name: string; type: string; value: string };
  deltaText: string;
  explanation: string;
  nextAction: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'deferred';
  reviewRationale?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface RiskScoreResult {
  score: number;
  band: 'high_attention' | 'review_required' | 'preliminary';
  findings: any[];
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findingCount: number;
  disclaimer: string;
}

/**
 * Feature 15: Normalizes complex Indian and Karnataka land area units
 * 1 Acre = 40 Guntas = 43,560 sq ft
 * 1 Gunta = 1,089 sq ft
 * 1 Cent = 435.6 sq ft
 * 1 Sq Metre = 10.7639104 sq ft
 */
export function parseKarnatakaLandExtent(rawText: string): KarnatakaLandExtent {
  if (!rawText || typeof rawText !== 'string') {
    return {
      rawText: String(rawText || ''),
      acres: 0,
      guntas: 0,
      cents: 0,
      sqFt: 0,
      sqMeters: 0,
      normalizedSqFt: 0,
    };
  }

  const text = rawText.toLowerCase().replace(/,/g, '').trim();
  let acres = 0;
  let guntas = 0;
  let sqFt = 0;
  let cents = 0;

  // Resolve fractional words and numerals
  const fractionResolved = text
    .replace(/(\d+)\s+1\/2/g, (_, n) => String(Number(n) + 0.5))
    .replace(/1\/2/g, '0.5')
    .replace(/(\d+)\s+1\/4/g, (_, n) => String(Number(n) + 0.25))
    .replace(/1\/4/g, '0.25')
    .replace(/(\d+)\s+3\/4/g, (_, n) => String(Number(n) + 0.75))
    .replace(/3\/4/g, '0.75');

  // Pattern 1: Hyphen format: "0-30 Guntas" or "1-15 Guntas"
  const hyphenMatch = fractionResolved.match(/(\d+)\s*-\s*([0-9.]+)\s*(?:guntas|gunta|gts)/i);
  if (hyphenMatch) {
    acres = parseFloat(hyphenMatch[1]);
    guntas = parseFloat(hyphenMatch[2]);
  } else {
    // Pattern 2: Acres and Guntas: "1 Acre 20 Guntas" or "2 Acres"
    const acreMatch = fractionResolved.match(/([0-9.]+)\s*(?:acres|acre|ac\b)/i);
    const guntaMatch = fractionResolved.match(/([0-9.]+)\s*(?:guntas|gunta|gts\b)/i);
    if (acreMatch) acres = parseFloat(acreMatch[1]);
    if (guntaMatch) guntas = parseFloat(guntaMatch[1]);
  }

  // Pattern 3: Cents (Coastal Karnataka / Dakshina Kannada): "50 Cents"
  const centMatch = fractionResolved.match(/([0-9.]+)\s*(?:cents|cent|cts\b)/i);
  if (centMatch) {
    cents = parseFloat(centMatch[1]);
  }

  // Pattern 4: Direct Sq. Ft. or Dimensions: "2400 sq.ft" or "40 x 60 ft"
  const dimMatch = fractionResolved.match(/(\d+)\s*x\s*(\d+)\s*(?:ft|feet|sq\.?\s*ft)?/i);
  const sqFtMatch = fractionResolved.match(/([0-9.]+)\s*(?:sq\.?\s*ft|square\s*feet|sft)/i);
  const sqMtrMatch = fractionResolved.match(/([0-9.]+)\s*(?:sq\.?\s*m(?:eters?|tr)?|square\s*meters?)/i);

  if (dimMatch) {
    sqFt = parseFloat(dimMatch[1]) * parseFloat(dimMatch[2]);
  } else if (sqFtMatch) {
    sqFt = parseFloat(sqFtMatch[1]);
  } else if (sqMtrMatch) {
    sqFt = parseFloat(sqMtrMatch[1]) * 10.7639104;
  }

  // Calculate total normalized Sq Ft
  let totalSqFt = (acres * 43560) + (guntas * 1089) + (cents * 435.6) + sqFt;
  totalSqFt = Math.round(totalSqFt * 100) / 100;

  return {
    rawText,
    acres,
    guntas,
    cents,
    sqFt: totalSqFt,
    sqMeters: Math.round((totalSqFt / 10.7639104) * 100) / 100,
    normalizedSqFt: totalSqFt,
  };
}

/**
 * Feature 16: Cross-Document Extent Reconciliation with 1% survey margin tolerance
 */
export function compareExtents(
  extentA: number,
  extentB: number,
  docAName: string = 'Document A',
  docBName: string = 'Document B'
): DiscrepancyFinding | null {
  if (extentA <= 0 || extentB <= 0) return null;
  const maxExt = Math.max(extentA, extentB);
  const diff = Math.abs(extentA - extentB);
  const deltaPct = diff / maxExt;

  // Margin of tolerance: <= 1% is considered acceptable survey variation
  if (deltaPct <= 0.01) return null;

  let severity: DiscrepancyFinding['severity'] = 'medium';
  let points = 15;
  if (deltaPct > 0.10) {
    severity = 'critical';
    points = 35;
  } else if (deltaPct > 0.05) {
    severity = 'high';
    points = 25;
  }

  return {
    id: `DISC-EXT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    code: 'DISCREPANCY_EXTENT_MISMATCH',
    ruleId: 'RULE-EXT-001',
    ruleVersion: 'v1.0',
    statutoryCitation: 'Karnataka Land Revenue Act 1964 § 106 & Registration Act 1908 § 21',
    severity,
    points,
    field: 'extent',
    docA: { id: 'docA', name: docAName, type: 'document', value: `${extentA} sq ft` },
    docB: { id: 'docB', name: docBName, type: 'document', value: `${extentB} sq ft` },
    deltaText: `${Math.round(diff)} sq ft (${(deltaPct * 100).toFixed(1)}% divergence)`,
    explanation: `Extent in ${docAName} (${extentA} sq ft) differs from ${docBName} (${extentB} sq ft) by ${(deltaPct * 100).toFixed(1)}%.`,
    nextAction: 'Re-survey by Licensed Taluk Surveyor and 11E sketch verification required.',
  };
}

/**
 * Feature 17: Schedule Boundary Conflict Detector
 */
export function compareBoundaries(
  boundariesA: { north: string; south: string; east: string; west: string },
  boundariesB: { north: string; south: string; east: string; west: string },
  docAName: string = 'Sale Deed',
  docBName: string = 'Prior Deed'
): DiscrepancyFinding[] {
  const directions: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];
  const findings: DiscrepancyFinding[] = [];

  for (const dir of directions) {
    const valA = (boundariesA[dir] || '').trim().toLowerCase();
    const valB = (boundariesB[dir] || '').trim().toLowerCase();

    if (valA && valB && valA !== valB) {
      findings.push({
        id: `DISC-BOUND-${dir}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        code: 'DISCREPANCY_SCHEDULE_BOUNDARY_CONFLICT',
        ruleId: 'RULE-BND-002',
        ruleVersion: 'v1.0',
        statutoryCitation: 'Registration Act 1908 § 21 (Description of property and maps or plans)',
        severity: 'high',
        points: 25,
        field: 'boundary',
        docA: { id: 'docA', name: docAName, type: 'document', value: `${dir}: ${boundariesA[dir]}` },
        docB: { id: 'docB', name: docBName, type: 'document', value: `${dir}: ${boundariesB[dir]}` },
        deltaText: `${dir.toUpperCase()} boundary conflict: '${boundariesA[dir]}' vs '${boundariesB[dir]}'`,
        explanation: `${dir.toUpperCase()} boundary does not match between ${docAName} and ${docBName}.`,
        nextAction: 'Verify adjoining properties and local layout plan approvals.',
      });
    }
  }

  return findings;
}

/**
 * Feature 18: Explainable & Capped Risk Scoring Engine
 */
export function calculateRiskScore(findings: Array<{
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unverified';
  points?: number;
  code?: string;
}>): RiskScoreResult {
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

/**
 * High-level comparator across multiple extracted documents and subject property
 */
export function detectCrossDocumentDiscrepancies(
  documents: Array<{
    id: string;
    originalFilename: string;
    classification?: { documentType: string };
    extractedFields?: {
      extent?: { rawText: string; normalizedSqFt?: number };
      boundaries?: { north?: string; south?: string; east?: string; west?: string };
      surveyNumber?: { rawText: string };
    };
  }>,
  property?: {
    name?: string;
    extent?: string;
    surveyNumber?: string;
  }
): DiscrepancyFinding[] {
  const discrepancies: DiscrepancyFinding[] = [];

  // Compare each document against property baseline
  if (property?.extent) {
    const propExtentNorm = parseKarnatakaLandExtent(property.extent).normalizedSqFt;
    for (const doc of documents) {
      if (doc.extractedFields?.extent) {
        const docExtentNorm = doc.extractedFields.extent.normalizedSqFt || parseKarnatakaLandExtent(doc.extractedFields.extent.rawText).normalizedSqFt;
        const disc = compareExtents(propExtentNorm, docExtentNorm, `Property Master (${property.name || 'Dossier'})`, doc.originalFilename);
        if (disc) discrepancies.push(disc);
      }
    }
  }

  // Compare documents pairwise
  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const docA = documents[i];
      const docB = documents[j];

      // Extent comparison
      if (docA.extractedFields?.extent && docB.extractedFields?.extent) {
        const extA = docA.extractedFields.extent.normalizedSqFt || parseKarnatakaLandExtent(docA.extractedFields.extent.rawText).normalizedSqFt;
        const extB = docB.extractedFields.extent.normalizedSqFt || parseKarnatakaLandExtent(docB.extractedFields.extent.rawText).normalizedSqFt;
        const disc = compareExtents(extA, extB, docA.originalFilename, docB.originalFilename);
        if (disc) discrepancies.push(disc);
      }

      // Boundary comparison
      if (docA.extractedFields?.boundaries && docB.extractedFields?.boundaries) {
        const bA = {
          north: docA.extractedFields.boundaries.north || '',
          south: docA.extractedFields.boundaries.south || '',
          east: docA.extractedFields.boundaries.east || '',
          west: docA.extractedFields.boundaries.west || '',
        };
        const bB = {
          north: docB.extractedFields.boundaries.north || '',
          south: docB.extractedFields.boundaries.south || '',
          east: docB.extractedFields.boundaries.east || '',
          west: docB.extractedFields.boundaries.west || '',
        };
        const boundDiscs = compareBoundaries(bA, bB, docA.originalFilename, docB.originalFilename);
        discrepancies.push(...boundDiscs);
      }
    }
  }

  return discrepancies;
}

/**
 * Lawyer review action for a discrepancy
 */
export function recordDiscrepancyReview(
  discrepancy: DiscrepancyFinding,
  status: 'accepted' | 'rejected' | 'deferred',
  rationale: string,
  reviewerUid: string
): DiscrepancyFinding {
  if (!rationale || rationale.trim().length === 0) {
    throw new Error('Review rationale is mandatory when recording reviewer disposition on a discrepancy.');
  }

  return {
    ...discrepancy,
    status,
    reviewRationale: rationale.trim(),
    reviewedBy: reviewerUid,
    reviewedAt: new Date().toISOString(),
  };
}
