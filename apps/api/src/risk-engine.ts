export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical' | 'unverified';
export interface RiskFinding {
  code: string;
  title: string;
  severity: RiskSeverity;
  points: number;
  explanation: string;
  evidenceStatus: 'demo' | 'verified' | 'missing' | 'unverified';
  nextAction: string;
}

const severityWeight: Record<RiskSeverity, number> = { low: 5, medium: 15, high: 25, critical: 35, unverified: 0 };

/** Explainable, deterministic starter rules. This is triage support, not a legal conclusion. */
export function calculateRisk(findings: RiskFinding[]) {
  const scored = findings.reduce((sum, f) => sum + Math.max(f.points, severityWeight[f.severity]), 0);
  const score = Math.min(100, scored);
  const verifiedCount = findings.filter(f => f.evidenceStatus === 'verified').length;
  const unverifiedCount = findings.filter(f => f.evidenceStatus !== 'verified').length;
  const band = score >= 70 ? 'high_attention' : score >= 35 ? 'review_required' : 'preliminary';
  return {
    score,
    band,
    findingCount: findings.length,
    verifiedCount,
    unverifiedCount,
    disclaimer: 'Preliminary screening only. This score is not a legal opinion, ownership determination, government certification, or a substitute for a qualified professional review.'
  };
}

export function buildBaselineFindings(input: { hasSurveyNumber: boolean; documentCount: number; coordinatesPresent: boolean }): RiskFinding[] {
  const findings: RiskFinding[] = [];
  if (!input.hasSurveyNumber) findings.push({
    code: 'IDENTITY_SURVEY_MISSING', title: 'Survey number not recorded', severity: 'medium', points: 15,
    explanation: 'A survey number has not been entered for this property workspace.', evidenceStatus: 'missing',
    nextAction: 'Confirm village, hobli, taluk, survey number and subdivision from source documents.'
  });
  if (input.documentCount === 0) findings.push({
    code: 'DOCUMENTS_NOT_UPLOADED', title: 'No source documents uploaded', severity: 'medium', points: 15,
    explanation: 'No title, RTC, mutation, khata, encumbrance certificate or survey document is available for comparison.', evidenceStatus: 'missing',
    nextAction: 'Upload available documents and record issuing authority, date and reference number.'
  });
  if (!input.coordinatesPresent) findings.push({
    code: 'SPATIAL_LOCATION_MISSING', title: 'Map location not established', severity: 'low', points: 5,
    explanation: 'No property coordinate or verified parcel geometry is associated with this workspace.', evidenceStatus: 'missing',
    nextAction: 'Add coordinates or attach a survey-approved parcel geometry. Do not infer a legal boundary from a pin.'
  });
  return findings;
}
