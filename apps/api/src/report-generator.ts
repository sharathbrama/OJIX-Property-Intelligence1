/**
 * OJIX Property Intelligence - Due Diligence Report Generator (R5)
 * Feature 19: Immutable Due-Diligence Snapshotter
 * Feature 20: Client-Ready PDF Report Generator (7 mandatory sections)
 * Feature 21: Itemized Evidence Appendix with SHA-256 Checksums
 */

import crypto from 'node:crypto';
import { screenSpatialBuffers, type SpatialScreeningResult } from './spatial-rules-engine.js';
import { calculateRiskScore, type DiscrepancyFinding, type RiskScoreResult } from './discrepancy-engine.js';
import type { EvidenceAnchor } from './types.js';
import type { TitleEvent, TitleGap } from './title-engine.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] as string);
}

export interface DueDiligenceReportSnapshot {
  reportId: string;
  reportVersion: string;
  snapshotTimestamp: string;
  tenant: { id: string; organizationName: string };
  property: any;
  documents: any[];
  titleTimeline: TitleEvent[];
  titleGaps: TitleGap[];
  discrepancies: DiscrepancyFinding[];
  spatialScreening: SpatialScreeningResult;
  riskSummary: RiskScoreResult;
  evidenceAppendix: EvidenceAnchor[];
  statutoryNotice: string;
  reportTemplate?: { version: number; name: string; configuration: Record<string, unknown> } | null;
}

export interface GeneratedReportOutput {
  html: string;
  sectionsPresent: string[];
  hasNorthArrow: boolean;
  hasEvidenceAppendix: boolean;
}

function emptySpatialScreening(message: string): SpatialScreeningResult {
  return {
    drainClearanceStatus: 'unknown', lakeClearanceStatus: 'unknown', findings: [],
    screeningStatus: 'unavailable', message, cadastralParcelGeoJSON: { type: 'FeatureCollection', features: [] } as any,
    georeferencedSnapshot: { imagePngBase64: '', metadata: { center: null, zoom: 0, scaleText: 'Scale unavailable', hasNorthArrow: false, sources: [], timestamp: new Date().toISOString(), crs: 'Not available' } },
  };
}

/**
 * Feature 19: Freezes all property due-diligence data into an immutable read-only snapshot
 */
export function createDueDiligenceSnapshot(data: {
  reportId?: string;
  tenant?: { id: string; organizationName: string };
  property: any;
  documents?: any[];
  titleTimeline?: TitleEvent[];
  titleGaps?: TitleGap[];
  discrepancies?: DiscrepancyFinding[];
  spatialScreening?: SpatialScreeningResult;
  evidenceAppendix?: EvidenceAnchor[];
}): DueDiligenceReportSnapshot {
  const reportId = data.reportId || `REP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  // Deep clone collections to guarantee snapshot immutability
  const titleTimeline = data.titleTimeline ? JSON.parse(JSON.stringify(data.titleTimeline)) : [];
  const titleGaps = data.titleGaps ? JSON.parse(JSON.stringify(data.titleGaps)) : [];
  const discrepancies = data.discrepancies ? JSON.parse(JSON.stringify(data.discrepancies)) : [];
  const documents = data.documents ? JSON.parse(JSON.stringify(data.documents)) : [];
  const evidenceAppendix = data.evidenceAppendix ? JSON.parse(JSON.stringify(data.evidenceAppendix)) : [];

  const latitude = data.property?.latitude;
  const longitude = data.property?.longitude;
  const spatialScreening = data.spatialScreening || (
    Number.isFinite(Number(latitude)) && latitude !== null && latitude !== undefined &&
    Number.isFinite(Number(longitude)) && longitude !== null && longitude !== undefined
      ? screenSpatialBuffers({ latitude: Number(latitude), longitude: Number(longitude) }, [])
      : emptySpatialScreening('Coordinates are not recorded; spatial screening was not run.')
  );

  // Combine all findings across domains for holistic explainable risk scoring
  const allRiskItems: Array<{ severity: 'critical' | 'high' | 'medium' | 'low' | 'unverified'; points?: number; code?: string }> = [
    ...titleGaps.map((g: TitleGap) => ({ severity: g.severity, points: g.points, code: g.code })),
    ...discrepancies.map((d: DiscrepancyFinding) => ({ severity: d.severity, points: d.points, code: d.code })),
    ...spatialScreening.findings.map((s: any) => ({ severity: s.severity, points: s.points, code: s.code })),
  ];

  const riskSummary = calculateRiskScore(allRiskItems);

  return {
    reportId,
    reportVersion: '1.0.0',
    snapshotTimestamp: new Date().toISOString(),
    tenant: data.tenant ? { ...data.tenant } : { id: String(data.property?.tenant_id || 'not-recorded'), organizationName: 'Not recorded' },
    property: data.property ? JSON.parse(JSON.stringify(data.property)) : {},
    documents,
    titleTimeline,
    titleGaps,
    discrepancies,
    spatialScreening,
    riskSummary,
    evidenceAppendix,
    statutoryNotice: 'Confidential due-diligence report generated for technical verification pursuant to Karnataka Land Administration standards. This report does not constitute a certified government title guarantee.',
  };
}

/**
 * Feature 20 & 21: Client-Ready HTML & PDF Due-Diligence Report with 7 mandatory sections
 */
export function generateDueDiligenceReport(snapshot: DueDiligenceReportSnapshot): GeneratedReportOutput {
  const property = snapshot.property || {};
  const surveyNumber = property.surveyNumber ?? property.survey_number;
  const subdivision = property.subdivision ?? property.subdivision_number;
  const sectionsPresent = [
    'Executive Summary',
    'Property Profile & Identification Matrix',
    'Title Chain & Ownership Progression',
    'Discrepancy Matrix',
    'GIS & Environmental Buffer Screening Analysis',
    'Itemized Evidence Appendix',
    'Statutory Disclaimers & Legal Notice',
  ];

  const hasVerifiedDocument = snapshot.documents.some((document: any) => {
    const fields = typeof document.extracted_fields === 'string'
      ? (() => { try { return JSON.parse(document.extracted_fields); } catch { return {}; } })()
      : (document.extracted_fields || {});
    return fields.reviewState?.isVerified === true;
  });
  const reviewIncomplete = snapshot.titleTimeline.length === 0 ||
    snapshot.spatialScreening?.screeningStatus === 'unavailable' ||
    snapshot.spatialScreening?.drainClearanceStatus === 'unknown' ||
    snapshot.spatialScreening?.lakeClearanceStatus === 'unknown' ||
    snapshot.documents.length === 0 || !hasVerifiedDocument ||
    !snapshot.property?.extent || String(snapshot.property.extent).trim() === '' || String(snapshot.property.extent).toLowerCase() === 'not verified';
  const scoreClass = reviewIncomplete ? 'incomplete' : snapshot.riskSummary.score >= 70 ? 'critical' : (snapshot.riskSummary.score >= 35 ? 'warning' : 'good');
  const scoreLabel = reviewIncomplete
    ? `Score: ${snapshot.riskSummary.score} / 100 (${snapshot.riskSummary.band}) — INCOMPLETE · NOT CLEARED`
    : `Score: ${snapshot.riskSummary.score} / 100 (${snapshot.riskSummary.band})`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OJIX Property Due Diligence Report - ${snapshot.reportId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a202c; line-height: 1.5; padding: 40px; max-width: 960px; margin: 0 auto; }
    h1, h2, h3 { color: #2d3748; }
    section { margin-bottom: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; }
    .score-badge { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-weight: bold; background: #edf2f7; margin-bottom: 16px; }
    .score-badge.critical { background: #fed7d7; color: #9b2c2c; }
    .score-badge.warning { background: #feebc8; color: #9c4221; }
    .score-badge.good { background: #c6f6d5; color: #22543d; }
    .score-badge.incomplete { background: #feebc8; color: #9c4221; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #cbd5e0; padding: 8px 12px; text-align: left; }
    th { background: #f7fafc; }
    .gap, .discrepancy { padding: 8px 12px; margin: 8px 0; background: #fffaf0; border-left: 4px solid #dd6b20; }
    .north-arrow { font-weight: bold; color: #2b6cb0; }
    .scale-bar { font-style: italic; color: #4a5568; }
    .checksum { font-family: monospace; font-size: 11px; color: #718096; }
  </style>
</head>
<body>
  <header>
    <h1>OJIX PROPERTY INTELLIGENCE</h1>
    <p>Comprehensive Legal & Geospatial Due-Diligence Report | Report ID: ${snapshot.reportId}</p>
    <p>Tenant: <strong>${escapeHtml(snapshot.tenant.organizationName)}</strong> | Generated: ${escapeHtml(snapshot.snapshotTimestamp)} (UTC)</p>
  </header>
  ${snapshot.reportTemplate ? `<p class="template-version">Report template: ${escapeHtml(snapshot.reportTemplate.name)} · v${snapshot.reportTemplate.version}</p>` : ''}

  <section id="executive-summary">
    <h2>${escapeHtml((snapshot.reportTemplate?.configuration as any)?.executiveSummaryTitle || 'Executive Summary')}</h2>
    <div class="score-badge ${scoreClass}">${escapeHtml(scoreLabel)}</div>
    ${reviewIncomplete ? '<p><strong>Review status: INCOMPLETE — NOT CLEARED.</strong> Missing or unverified evidence prevents a complete assessment. A low or zero risk score does not mean the property is safe or legally clear.</p>' : ''}
    <p><strong>Property Name:</strong> ${escapeHtml(snapshot.property.name || 'Not recorded')}</p>
    <p>Survey No: ${escapeHtml(surveyNumber || 'Not recorded')}, Village: ${escapeHtml(property.village || 'Not recorded')}, Taluk: ${escapeHtml(property.taluk || 'Not recorded')}</p>
    <p>${escapeHtml(snapshot.riskSummary.disclaimer)}</p>
  </section>

  <section id="property-profile">
    <h2>Property Profile & Identification Matrix</h2>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Survey / Subdivision</td><td>${escapeHtml(surveyNumber || 'Not recorded')} / ${escapeHtml(subdivision || 'Not recorded')}</td></tr>
      <tr><td>Village / Hobli / Taluk</td><td>${escapeHtml(property.village || 'Not recorded')}, ${escapeHtml(property.hobli || 'Not recorded')}, ${escapeHtml(property.taluk || 'Not recorded')}</td></tr>
      <tr><td>District</td><td>${escapeHtml(property.district || 'Not recorded')}</td></tr>
      <tr><td>Extent:</td><td>${escapeHtml(property.extent || 'Not verified')}</td></tr>
      <tr><td>Address</td><td>${escapeHtml(property.address || 'Not recorded')}</td></tr>
      <tr><td>Coordinates (WGS 84)</td><td>${property.latitude != null && property.longitude != null ? `${escapeHtml(Number(property.latitude).toFixed(6))}, ${escapeHtml(Number(property.longitude).toFixed(6))}` : 'Location not recorded'}</td></tr>
    </table>
  </section>

  <section id="title-timeline">
    <h2>Title Chain & Ownership Progression</h2>
    ${snapshot.titleTimeline.length === 0 ? '<p>No title events recorded.</p>' : `
      <ul>
        ${snapshot.titleTimeline.map((t: TitleEvent) => `<li><strong>${escapeHtml(t.eventDate)}</strong>: ${escapeHtml(t.deedType)} (${escapeHtml(t.status)}) — Extent: ${escapeHtml(t.extentRaw || `${t.extentSqFt} sq ft`)}, Parties: ${escapeHtml(t.fromParties.map(p => p.name).join(', '))} &rarr; ${escapeHtml(t.toParties.map(p => p.name).join(', '))}</li>`).join('')}
      </ul>
    `}
    ${snapshot.titleTimeline.length === 0 ? snapshot.titleGaps.length ? snapshot.titleGaps.map((g: TitleGap) => `<div class="gap"><strong>${escapeHtml(g.title)}</strong> (${escapeHtml(g.severity).toUpperCase()} — ${escapeHtml(g.points)} pts)<br/>${escapeHtml(g.description)}</div>`).join('') : '<p><em>No title events were supplied; title-chain review is unavailable.</em></p>' : snapshot.titleGaps.length === 0 ? '<p><em>No title gaps were detected in the recorded events. This is not a verified 30-year chain.</em></p>' : snapshot.titleGaps.map((g: TitleGap) => `
      <div class="gap">
        <strong>${escapeHtml(g.title)}</strong> (${escapeHtml(g.severity).toUpperCase()} — ${escapeHtml(g.points)} pts)<br/>
        ${escapeHtml(g.description)}
      </div>
    `).join('')}
  </section>

  <section id="discrepancy-matrix">
    <h2>Discrepancy Matrix</h2>
    ${snapshot.documents.length === 0 ? '<p><em>No source documents are attached; discrepancy review is unavailable.</em></p>' : snapshot.discrepancies.length === 0 ? '<p><em>No discrepancies were detected in the supplied document values. This does not confirm title or accuracy.</em></p>' : `
      <ul>
        ${snapshot.discrepancies.map((d: DiscrepancyFinding) => `
          <li class="discrepancy">
            <strong>${escapeHtml(d.field).toUpperCase()} MISMATCH</strong>: ${escapeHtml(d.deltaText)} (${escapeHtml(d.severity).toUpperCase()} — ${escapeHtml(d.points)} pts)<br/>
            <span>${escapeHtml(d.explanation)}</span><br/>
            <small><em>Next Action: ${escapeHtml(d.nextAction)} [Statutory ref: ${escapeHtml(d.statutoryCitation)}]</em></small>
          </li>
        `).join('')}
      </ul>
    `}
  </section>

  <section id="gis-screening">
    <h2>GIS & Environmental Buffer Screening Analysis</h2>
    <div class="north-arrow">Map orientation: ${snapshot.spatialScreening?.georeferencedSnapshot?.imagePngBase64 && snapshot.spatialScreening?.georeferencedSnapshot?.metadata?.hasNorthArrow ? 'north arrow shown' : 'not available; no map snapshot was rendered'}</div>
    <div class="scale-bar">${escapeHtml(snapshot.spatialScreening?.georeferencedSnapshot?.metadata?.scaleText || 'Scale unavailable')}</div>
    <p>${escapeHtml(snapshot.spatialScreening?.message || 'Screening status not recorded.')}</p>
    <p>Drain Screening: <strong>${(snapshot.spatialScreening?.drainClearanceStatus || 'unknown').toUpperCase()}</strong> | Lake Screening: <strong>${(snapshot.spatialScreening?.lakeClearanceStatus || 'unknown').toUpperCase()}</strong></p>
    ${snapshot.spatialScreening?.findings?.length > 0 ? `
      <table>
        <tr><th>Layer</th><th>Distance</th><th>Statutory Buffer</th><th>Severity</th></tr>
        ${snapshot.spatialScreening.findings.map((f: any) => `
          <tr>
            <td>${escapeHtml(f.layerType).toUpperCase()}</td>
            <td>${escapeHtml(f.distanceM)} m</td>
            <td>${escapeHtml(f.bufferM)} m</td>
            <td><strong>${escapeHtml(f.severity).toUpperCase()}</strong></td>
          </tr>
        `).join('')}
      </table>
    ` : '<p>No spatial findings are available. This must not be interpreted as clearance.</p>'}
  </section>

  <section id="evidence-appendix">
    <h2>Itemized Evidence Appendix</h2>
    ${snapshot.evidenceAppendix.length === 0 ? '<p>No document evidence anchors indexed.</p>' : `
      <div>
        ${snapshot.evidenceAppendix.map((a: any) => `<div>Doc: ${escapeHtml(a.documentId)} Pg ${escapeHtml(a.pageNumber)}: ${escapeHtml(a.extractedSnippet || a.snippet || '')}</div>`).join('')}
      </div>
    `}
    ${snapshot.documents?.length > 0 ? `
      <h3>Source Document Checksums</h3>
      <ul>
        ${snapshot.documents.map((d: any) => `<li>${escapeHtml(d.originalFilename || d.original_filename)}: <span class="checksum">${escapeHtml(d.sha256 || 'SHA-256 not recorded')}</span></li>`).join('')}
      </ul>
    ` : ''}
  </section>

  <section id="statutory-notice">
    <h2>Statutory Disclaimers & Legal Notice</h2>
    <p>${escapeHtml(snapshot.statutoryNotice)}</p>
  </section>
</body>
</html>`;

  return {
    html,
    sectionsPresent,
    hasNorthArrow: Boolean(snapshot.spatialScreening?.georeferencedSnapshot?.imagePngBase64 && snapshot.spatialScreening?.georeferencedSnapshot?.metadata?.hasNorthArrow),
    hasEvidenceAppendix: true,
  };
}

/**
 * Computes standard SHA-256 hash for document evidence provenance
 */
export function computeSha256Checksum(content: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  if (typeof content === 'string') {
    hash.update(content, 'utf8');
  } else {
    hash.update(content);
  }
  return hash.digest('hex');
}
