/**
 * OJIX Property Intelligence - Due Diligence Report Generator (R5)
 * Feature 19: Immutable Due-Diligence Snapshotter
 * Feature 20: Client-Ready PDF Report Generator (7 mandatory sections)
 * Feature 21: Itemized Evidence Appendix with SHA-256 Checksums
 * Task 11: Headless Browser PDF Print Rendering with PDFKit Fallback
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import PDFDocument from 'pdfkit';
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
  templateVersion?: string;
  templateId?: string;
  snapshotTimestamp: string;
  legalSignOff?: {
    isLegalApproved: boolean;
    approvedByUid?: string;
    approvedAt?: string;
  };
  tenant: {
    id: string;
    organizationName: string;
    llpin?: string;
    officeAddress?: string;
    firmLogoUrl?: string;
    firmEmail?: string;
    defaultReportTemplate?: string;
    legalDisclaimer?: string;
  };
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

export interface GeneratePdfOptions {
  renderer?: 'auto' | 'headless' | 'pdfkit';
  timeoutMs?: number;
}

function emptySpatialScreening(message: string): SpatialScreeningResult {
  return {
    drainClearanceStatus: 'unknown',
    lakeClearanceStatus: 'unknown',
    findings: [],
    screeningStatus: 'unavailable',
    message,
    cadastralParcelGeoJSON: { type: 'FeatureCollection', features: [] } as any,
    georeferencedSnapshot: {
      imagePngBase64: '',
      metadata: {
        center: null,
        zoom: 0,
        scaleText: 'Scale unavailable',
        hasNorthArrow: false,
        sources: [],
        timestamp: new Date().toISOString(),
        crs: 'Not available',
      },
    },
  };
}

/**
 * Feature 19: Freezes all property due-diligence data into an immutable read-only snapshot
 */
export function createDueDiligenceSnapshot(data: {
  reportId?: string;
  tenant?: {
    id: string;
    organizationName: string;
    llpin?: string;
    officeAddress?: string;
    firmLogoUrl?: string;
    firmEmail?: string;
    defaultReportTemplate?: string;
    legalDisclaimer?: string;
  };
  property: any;
  documents?: any[];
  titleTimeline?: TitleEvent[];
  titleGaps?: TitleGap[];
  discrepancies?: DiscrepancyFinding[];
  spatialScreening?: SpatialScreeningResult;
  evidenceAppendix?: EvidenceAnchor[];
  statutoryNotice?: string;
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
  // Workflow status alone is not legal sign-off. Require explicit reviewer data.
  const approvedByUid = typeof data.property?.legal_approved_by_uid === 'string' && data.property.legal_approved_by_uid.trim()
    ? data.property.legal_approved_by_uid.trim()
    : undefined;
  const approvedAtValue = data.property?.legal_approved_at;
  const approvedAt = approvedAtValue
    ? (approvedAtValue instanceof Date ? approvedAtValue.toISOString() : String(approvedAtValue))
    : undefined;
  const templateId = data.tenant?.defaultReportTemplate || 'detailed_due_diligence';
  const legalSignOff = {
    isLegalApproved: Boolean(approvedByUid && approvedAt),
    approvedByUid,
    approvedAt,
  };

  return {
    reportId,
    reportVersion: '1.0.0',
    templateVersion: '1.0.0',
    templateId,
    snapshotTimestamp: new Date().toISOString(),
    legalSignOff,
    tenant: data.tenant ? { ...data.tenant } : { id: String(data.property?.tenant_id || 'not-recorded'), organizationName: 'Not recorded' },
    property: data.property ? JSON.parse(JSON.stringify(data.property)) : {},
    documents,
    titleTimeline,
    titleGaps,
    discrepancies,
    spatialScreening,
    riskSummary,
    evidenceAppendix,
    statutoryNotice: data.statutoryNotice || (data.tenant?.legalDisclaimer) || 'Confidential due-diligence report generated for technical verification pursuant to Karnataka Land Administration standards. This report does not constitute a certified government title guarantee.',
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

  const mapSnapshotBase64 = snapshot.spatialScreening?.georeferencedSnapshot?.imagePngBase64;
  const hasNorthArrow = Boolean(mapSnapshotBase64 && snapshot.spatialScreening?.georeferencedSnapshot?.metadata?.hasNorthArrow);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OJIX Property Due Diligence Report - ${escapeHtml(snapshot.reportId)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      padding: 36px 44px;
      max-width: 980px;
      margin: 0 auto;
      background-color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4 { color: #0f172a; margin-top: 0; font-weight: 700; }
    h2 {
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e3a8a;
      margin-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
    }
    h3 { font-size: 13px; color: #334155; margin-bottom: 8px; margin-top: 14px; }
    p { margin: 0 0 10px; font-size: 12.5px; color: #334155; }
    strong { color: #0f172a; }

    section {
      margin-bottom: 26px;
      padding-bottom: 18px;
      border-bottom: 1px solid #f1f5f9;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Score Badges */
    .score-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 12px;
      border: 1px solid transparent;
    }
    .score-badge.critical { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    .score-badge.warning { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .score-badge.good { background: #dcfce7; color: #166534; border-color: #86efac; }
    .score-badge.incomplete { background: #ffedd5; color: #9a3412; border-color: #fdba74; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    tr:nth-child(even) td { background: #fafbfc; }

    /* Callout & Alert Blocks */
    .gap, .discrepancy {
      padding: 10px 14px;
      margin: 8px 0;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #d97706;
      border-radius: 4px;
      font-size: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .gap.critical, .discrepancy.critical {
      background: #fef2f2;
      border-color: #fecaca;
      border-left-color: #dc2626;
    }
    .north-arrow { font-weight: 600; color: #2563eb; font-size: 12px; }
    .scale-bar { font-style: italic; color: #64748b; font-size: 11.5px; margin-bottom: 6px; }
    .checksum { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #475569; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }

    /* Header Letterhead */
    .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      flex-wrap: wrap;
    }
    .badge-template {
      display: inline-block;
      padding: 3px 8px;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Print Formatting Rules */
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
        max-width: none;
        font-size: 11.5px;
        line-height: 1.4;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
      .report-header { page-break-after: avoid; }
      section { page-break-inside: avoid; break-inside: avoid; margin-bottom: 20px; padding-bottom: 14px; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      .score-badge, .gap, .discrepancy { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="report-header">
    <div class="header-content">
      <div>
        <h1 style="margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(snapshot.tenant.organizationName || 'OJIX Property Intelligence')}</h1>
        <p style="margin: 4px 0 0; color: #475569; font-size: 12px; font-weight: 500;">
          ${snapshot.tenant.llpin ? `<strong>LLPIN:</strong> ${escapeHtml(snapshot.tenant.llpin)} &nbsp;|&nbsp; ` : ''}
          ${snapshot.tenant.officeAddress ? `${escapeHtml(snapshot.tenant.officeAddress)} &nbsp;|&nbsp; ` : ''}
          ${snapshot.tenant.firmEmail ? `<strong>Email:</strong> ${escapeHtml(snapshot.tenant.firmEmail)}` : ''}
        </p>
      </div>
      <div style="text-align: right; min-width: 220px;">
        <span class="badge-template">
          ${escapeHtml(snapshot.tenant.defaultReportTemplate === 'client_decision_pack' ? 'Client Decision Pack' : (snapshot.tenant.defaultReportTemplate === 'preliminary_screening' ? 'Preliminary Screening' : 'Detailed Due Diligence'))}
        </span>
        <p style="margin: 6px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #64748b;">Report ID: ${escapeHtml(snapshot.reportId)}</p>
        <p style="margin: 2px 0 0; font-size: 11px; color: #94a3b8;">Generated: ${escapeHtml(snapshot.snapshotTimestamp.slice(0, 10))}</p>
      </div>
    </div>
  </header>
  ${snapshot.reportTemplate ? `<p class="template-version">Report template: ${escapeHtml(snapshot.reportTemplate.name)} · v${snapshot.reportTemplate.version}</p>` : ''}

  <section id="executive-summary">
    <h2>${escapeHtml((snapshot.reportTemplate?.configuration as any)?.executiveSummaryTitle || 'Executive Summary')}</h2>
    <div class="score-badge ${scoreClass}">${escapeHtml(scoreLabel)}</div>
    ${reviewIncomplete ? '<p style="color: #c2410c; background: #fff7ed; padding: 8px 12px; border-radius: 4px; border: 1px solid #ffedd5;"><strong>Review status: INCOMPLETE — NOT CLEARED.</strong> Missing or unverified evidence prevents a complete assessment. A low or zero risk score does not mean the property is safe or legally clear.</p>' : ''}
    <p><strong>Property Name:</strong> ${escapeHtml(snapshot.property.name || 'Not recorded')}</p>
    <p>Survey No: ${escapeHtml(surveyNumber || 'Not recorded')}, Village: ${escapeHtml(property.village || 'Not recorded')}, Taluk: ${escapeHtml(property.taluk || 'Not recorded')}</p>
    <p style="color: #64748b; font-size: 12px;">${escapeHtml(snapshot.riskSummary.disclaimer)}</p>
  </section>

  <section id="property-profile">
    <h2>Property Profile & Identification Matrix</h2>
    <table>
      <tr><th style="width: 32%;">Field</th><th>Value</th></tr>
      <tr><td>Survey / Subdivision</td><td>${escapeHtml(surveyNumber || 'Not recorded')} / ${escapeHtml(subdivision || 'Not recorded')}</td></tr>
      <tr><td>Village / Hobli / Taluk</td><td>${escapeHtml(property.village || 'Not recorded')}, ${escapeHtml(property.hobli || 'Not recorded')}, ${escapeHtml(property.taluk || 'Not recorded')}</td></tr>
      <tr><td>District</td><td>${escapeHtml(property.district || 'Not recorded')}</td></tr>
      <tr><td>Extent:</td><td>${escapeHtml(property.extent || 'Not verified')}</td></tr>
      <tr><td>Boundaries</td><td>North: ${escapeHtml(property.boundary_north || 'Not recorded')} | South: ${escapeHtml(property.boundary_south || 'Not recorded')} | East: ${escapeHtml(property.boundary_east || 'Not recorded')} | West: ${escapeHtml(property.boundary_west || 'Not recorded')}</td></tr>
      <tr><td>Address</td><td>${escapeHtml(property.address || 'Not recorded')}</td></tr>
      <tr><td>Coordinates (WGS 84)</td><td>${property.latitude != null && property.longitude != null ? `${escapeHtml(Number(property.latitude).toFixed(6))}, ${escapeHtml(Number(property.longitude).toFixed(6))}` : 'Location not recorded'}</td></tr>
    </table>
  </section>

  <section id="title-timeline">
    <h2>Title Chain & Ownership Progression</h2>
    ${snapshot.titleTimeline.length === 0 ? '<p>No title events recorded.</p>' : `
      <ul style="padding-left: 20px; margin: 8px 0;">
        ${snapshot.titleTimeline.map((t: TitleEvent) => `
          <li style="margin-bottom: 6px;">
            <strong>${escapeHtml(t.eventDate)}</strong>: ${escapeHtml(t.deedType)} (${escapeHtml(t.status)}) — Extent: ${escapeHtml(t.extentRaw || `${t.extentSqFt} sq ft`)}<br/>
            <span style="color: #475569; font-size: 11.5px;">Parties: ${escapeHtml(t.fromParties.map(p => p.name).join(', '))} &rarr; ${escapeHtml(t.toParties.map(p => p.name).join(', '))}</span>
          </li>
        `).join('')}
      </ul>
    `}
    ${snapshot.titleTimeline.length === 0 ? (snapshot.titleGaps.length ? snapshot.titleGaps.map((g: TitleGap) => `<div class="gap ${g.severity}"><strong>${escapeHtml(g.title)}</strong> (${escapeHtml(g.severity).toUpperCase()} — ${escapeHtml(g.points)} pts)<br/>${escapeHtml(g.description)}</div>`).join('') : '<p><em>No title events were supplied; title-chain review is unavailable.</em></p>') : snapshot.titleGaps.length === 0 ? '<p><em>No title gaps were detected in the recorded events. This is not a verified 30-year chain.</em></p>' : snapshot.titleGaps.map((g: TitleGap) => `
      <div class="gap ${g.severity}">
        <strong>${escapeHtml(g.title)}</strong> (${escapeHtml(g.severity).toUpperCase()} — ${escapeHtml(g.points)} pts)<br/>
        <span>${escapeHtml(g.description)}</span>
      </div>
    `).join('')}
  </section>

  <section id="discrepancy-matrix">
    <h2>Discrepancy Matrix</h2>
    ${snapshot.documents.length === 0 ? '<p><em>No source documents are attached; discrepancy review is unavailable.</em></p>' : snapshot.discrepancies.length === 0 ? '<p><em>No discrepancies were detected in the supplied document values. This does not confirm title or accuracy.</em></p>' : `
      <div style="margin-top: 8px;">
        ${snapshot.discrepancies.map((d: DiscrepancyFinding) => `
          <div class="discrepancy ${d.severity}">
            <strong>${escapeHtml(d.field).toUpperCase()} MISMATCH</strong>: ${escapeHtml(d.deltaText)} (${escapeHtml(d.severity).toUpperCase()} — ${escapeHtml(d.points)} pts)<br/>
            <span style="color: #334155;">${escapeHtml(d.explanation)}</span><br/>
            <small style="color: #475569;"><em>Next Action: ${escapeHtml(d.nextAction)} [Statutory ref: ${escapeHtml(d.statutoryCitation)}]</em></small>
          </div>
        `).join('')}
      </div>
    `}
  </section>

  <section id="gis-screening">
    <h2>GIS & Environmental Buffer Screening Analysis</h2>
    <div class="north-arrow">Map orientation: ${hasNorthArrow ? 'north arrow shown' : 'not available; no map snapshot was rendered'}</div>
    <div class="scale-bar">${escapeHtml(snapshot.spatialScreening?.georeferencedSnapshot?.metadata?.scaleText || 'Scale unavailable')}</div>
    <p>${escapeHtml(snapshot.spatialScreening?.message || 'Screening status not recorded.')}</p>
    <p>Drain Screening: <strong>${(snapshot.spatialScreening?.drainClearanceStatus || 'unknown').toUpperCase()}</strong> | Lake Screening: <strong>${(snapshot.spatialScreening?.lakeClearanceStatus || 'unknown').toUpperCase()}</strong></p>
    ${mapSnapshotBase64 ? `
      <div style="margin: 12px 0;">
        <img src="data:image/png;base64,${mapSnapshotBase64}" alt="GIS Buffer Analysis Snapshot" style="max-width: 100%; border: 1px solid #cbd5e1; border-radius: 4px;" />
      </div>
    ` : ''}
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
      <div style="margin-bottom: 12px;">
        ${snapshot.evidenceAppendix.map((a: any) => `<div style="font-size: 11.5px; margin-bottom: 4px; color: #475569;">Doc: ${escapeHtml(a.documentId)} Pg ${escapeHtml(a.pageNumber)}: ${escapeHtml(a.extractedSnippet || a.snippet || '')}</div>`).join('')}
      </div>
    `}
    ${snapshot.documents?.length > 0 ? `
      <h3>Source Document Checksums</h3>
      <table>
        <tr><th>Document Filename</th><th>SHA-256 Provenance Checksum</th></tr>
        ${snapshot.documents.map((d: any) => `
          <tr>
            <td>${escapeHtml(d.originalFilename || d.original_filename || 'Document')}</td>
            <td><span class="checksum">${escapeHtml(d.sha256 || 'SHA-256 not recorded')}</span></td>
          </tr>
        `).join('')}
      </table>
    ` : ''}
  </section>

  <section id="statutory-notice">
    <h2>Statutory Disclaimers & Legal Notice</h2>
    <div style="font-size: 12px; line-height: 1.55; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 4px;">
      ${escapeHtml(snapshot.statutoryNotice)}
    </div>
    <div style="margin-top: 16px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fafbfc;">
      <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase;">
        LEGAL REVIEW STATUS: ${escapeHtml(snapshot.tenant.organizationName || 'OJIX')}
      </div>
      ${snapshot.legalSignOff?.isLegalApproved ? `
        <div style="margin-top: 6px; font-size: 11.5px; color: #047857;">
          <strong>Reviewer sign-off recorded:</strong> ${escapeHtml(snapshot.legalSignOff.approvedByUid || 'Reviewer')}<br/>
          <strong>Sign-off timestamp:</strong> ${escapeHtml(snapshot.legalSignOff.approvedAt || 'Not recorded')}
        </div>
      ` : `
        <div style="margin-top: 6px; font-size: 11.5px; color: #b45309; font-style: italic;">
          Notice: This report is an evidence compilation. No qualified legal sign-off is recorded.
        </div>
      `}
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
        <span>Prepared under legal authority of: <strong>${escapeHtml(snapshot.tenant.organizationName)}</strong></span>
        <span>${snapshot.tenant.llpin ? `Registration / LLPIN: <strong>${escapeHtml(snapshot.tenant.llpin)}</strong>` : ''}</span>
      </div>
    </div>
  </section>
</body>
</html>`;

  return {
    html,
    sectionsPresent,
    hasNorthArrow,
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

/**
 * Locates the Chromium or Chrome executable across Windows, Linux, and macOS.
 */
export function getChromiumExecutablePath(): string | null {
  const envPath = process.env.CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_BIN || process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates: string[] = [
    // Windows common locations
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ...(process.env.LOCALAPPDATA ? [
      path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe'),
    ] : []),
    // Linux / Containers
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Manages reusable headless browser instances safely.
 */
class HeadlessBrowserManager {
  private browser: Browser | null = null;
  private launchingPromise: Promise<Browser> | null = null;
  private profileDir: string;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.profileDir = path.resolve(os.tmpdir(), `ojix-chrome-headless-${process.pid}`);
  }

  resetIdleTimer(delayMs = 2000): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.close();
    }, delayMs);
    try {
      this.idleTimer.unref();
    } catch {}
  }

  async getBrowser(): Promise<Browser> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.launchingPromise) {
      return this.launchingPromise;
    }

    this.launchingPromise = (async () => {
      const exe = getChromiumExecutablePath();
      if (!exe) {
        throw new Error('Chromium/Chrome binary not found on host environment');
      }

      if (!fs.existsSync(this.profileDir)) {
        try {
          fs.mkdirSync(this.profileDir, { recursive: true });
        } catch {}
      }

      const browser = await puppeteer.launch({
        executablePath: exe,
        headless: true,
        pipe: true,
        userDataDir: this.profileDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
        ],
      });

      browser.on('disconnected', () => {
        this.browser = null;
      });

      // Allow node process to exit cleanly if browser is idle
      try {
        browser.process()?.unref();
      } catch {}

      this.browser = browser;
      this.launchingPromise = null;
      return browser;
    })();

    try {
      return await this.launchingPromise;
    } catch (err) {
      this.launchingPromise = null;
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
      try {
        if (fs.existsSync(this.profileDir)) {
          fs.rmSync(this.profileDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }
}

const browserManager = new HeadlessBrowserManager();

export async function closeBrowserManager(): Promise<void> {
  await browserManager.close();
}

// Ensure clean exit on process shutdown
process.on('SIGTERM', () => { void browserManager.close(); });
process.on('SIGINT', () => { void browserManager.close(); });

/**
 * Renders an HTML string into an A4 PDF using Chromium Headless with running headers and footers.
 */
export async function renderHtmlToPdf(
  html: string,
  options?: {
    reportId?: string;
    organizationName?: string;
    timeoutMs?: number;
  }
): Promise<Buffer> {
  const browser = await browserManager.getBrowser();
  const page = await browser.newPage();
  const timeoutMs = options?.timeoutMs ?? 25000;

  try {
    if (Buffer.byteLength(html, 'utf8') > 5 * 1024 * 1024) throw new Error('Report HTML exceeds the 5 MB rendering limit.');
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', request => {
      const protocol = new URL(request.url()).protocol;
      if (protocol === 'data:' || protocol === 'about:') void request.continue();
      else void request.abort();
    });
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: timeoutMs,
    });

    const reportIdEscaped = escapeHtml(options?.reportId || 'OJIX-REPORT');
    const orgNameEscaped = escapeHtml(options?.organizationName || 'OJIX Property Intelligence');

    const headerTemplate = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm;">
        <span style="font-weight: 600; text-transform: uppercase;">OJIX Property Intelligence &bull; Due Diligence Dossier</span>
        <span>Report ID: ${reportIdEscaped}</span>
      </div>
    `;

    const footerTemplate = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm;">
        <span>Confidential &bull; Prepared for ${orgNameEscaped}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;

    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: {
        top: '16mm',
        bottom: '16mm',
        left: '14mm',
        right: '14mm',
      },
      timeout: timeoutMs,
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    try {
      await page.close();
    } catch {}
    browserManager.resetIdleTimer();
  }
}

/**
 * Headless Browser PDF Generator: Renders complete client-ready Due Diligence Report via Chromium.
 */
export async function generateDueDiligenceHeadlessPdf(
  snapshot: DueDiligenceReportSnapshot,
  options?: { timeoutMs?: number }
): Promise<Buffer> {
  const report = generateDueDiligenceReport(snapshot);
  return renderHtmlToPdf(report.html, {
    reportId: snapshot.reportId,
    organizationName: snapshot.tenant?.organizationName,
    timeoutMs: options?.timeoutMs,
  });
}

/**
 * Feature 20 (Fallback Engine): Original PDFKit Generator with 7 mandatory sections, firm branding,
 * template snapshot versioning, and Lead Advocate legal sign-off block.
 */
export async function generateDueDiligencePdfKit(snapshot: DueDiligenceReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        info: {
          Title: `OJIX Property Due Diligence Report - ${snapshot.reportId}`,
          Author: snapshot.tenant.organizationName || 'OJIX Property Intelligence',
          Subject: 'Comprehensive Legal Due-Diligence & Technical Title Verification Report',
          Keywords: 'property, due-diligence, title-search, encumbrance, spatial-screening, karnataka',
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const tenant = snapshot.tenant;
      const property = snapshot.property || {};
      const surveyNumber = property.surveyNumber ?? property.survey_number ?? 'Not recorded';
      const village = property.village ?? 'Not recorded';
      const taluk = property.taluk ?? 'Not recorded';
      const district = property.district ?? 'Not recorded';

      // --- LETTERHEAD & HEADER ---
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text((tenant.organizationName || 'OJIX PROPERTY INTELLIGENCE').toUpperCase());
      doc.moveDown(0.2);

      const subHeaderParts = [
        tenant.llpin ? `LLPIN: ${tenant.llpin}` : 'LLPIN: ADA-1604',
        tenant.officeAddress || 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
        tenant.firmEmail ? `Email: ${tenant.firmEmail}` : 'info@ojix.in',
      ].filter(Boolean).join(' | ');

      doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(subHeaderParts);
      doc.moveDown(0.5);

      // Metadata Banner
      const bannerTop = doc.y;
      doc.rect(40, bannerTop, 515, 38).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold');
      doc.text(`REPORT ID: ${snapshot.reportId}`, 50, bannerTop + 6);
      doc.font('Helvetica').text(`DATE: ${snapshot.snapshotTimestamp.slice(0, 10)}`, 230, bannerTop + 6);
      doc.text(`TEMPLATE: ${(snapshot.templateId || tenant.defaultReportTemplate || 'detailed_due_diligence').toUpperCase()} (v${snapshot.templateVersion || '1.0.0'})`, 360, bannerTop + 6);

      doc.font('Helvetica-Bold');
      if (snapshot.legalSignOff?.isLegalApproved) {
        doc.fillColor('#047857').text(`REVIEWER SIGN-OFF RECORDED: ${snapshot.legalSignOff.approvedByUid || 'Reviewer'}`, 50, bannerTop + 20);
      } else {
        doc.fillColor('#b45309').text('STATUS: DRAFT DOSSIER — PENDING QUALIFIED LEAD ADVOCATE SIGN-OFF', 50, bannerTop + 20);
      }

      doc.y = bannerTop + 48;

      // --- SECTION 1: EXECUTIVE SUMMARY ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('1. EXECUTIVE SUMMARY & RISK SCORE');
      doc.moveDown(0.2);
      const riskColor = snapshot.riskSummary.score >= 70 ? '#b91c1c' : snapshot.riskSummary.score >= 35 ? '#c2410c' : '#047857';
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(riskColor);
      doc.text(`Overall Risk Score: ${snapshot.riskSummary.score} / 100 (${snapshot.riskSummary.band.toUpperCase()})`);
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
      doc.text(`Property Name: ${property.name || 'Not recorded'}`);
      doc.text(`Location: Survey No. ${surveyNumber}, Village: ${village}, Taluk: ${taluk}, District: ${district}`);
      doc.moveDown(0.2);
      doc.fillColor('#64748b').text(snapshot.riskSummary.disclaimer, { width: 515 });
      doc.moveDown(0.6);

      // --- SECTION 2: PROPERTY PROFILE & IDENTIFICATION MATRIX ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('2. PROPERTY PROFILE & IDENTIFICATION MATRIX');
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
      doc.text(`* Survey / Subdivision: ${surveyNumber} / ${property.subdivision ?? property.subdivision_number ?? 'Not recorded'}`);
      doc.text(`* Village / Hobli / Taluk: ${village}, ${property.hobli || 'Not recorded'}, ${taluk}`);
      doc.text(`* District: ${district}`);
      doc.text(`* Recorded Extent: ${property.extent || 'Not verified'}`);
      doc.text(`* Boundaries: North: ${property.boundary_north || 'Not recorded'} | South: ${property.boundary_south || 'Not recorded'} | East: ${property.boundary_east || 'Not recorded'} | West: ${property.boundary_west || 'Not recorded'}`);
      const coords = property.latitude && property.longitude ? `${Number(property.latitude).toFixed(6)}, ${Number(property.longitude).toFixed(6)} (WGS 84)` : 'Coordinates not recorded';
      doc.text(`* Coordinates: ${coords}`);
      doc.moveDown(0.6);

      // --- SECTION 3: TITLE CHAIN & OWNERSHIP PROGRESSION ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('3. TITLE CHAIN & OWNERSHIP PROGRESSION');
      doc.moveDown(0.2);
      if (snapshot.titleTimeline.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748b').text('No chronological title events recorded in case file.');
      } else {
        doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
        snapshot.titleTimeline.forEach((t, i) => {
          const fromNames = t.fromParties.map(p => p.name).join(', ') || 'None';
          const toNames = t.toParties.map(p => p.name).join(', ') || 'None';
          doc.text(`${i + 1}. [${t.eventDate}] ${t.deedType.toUpperCase()} (${t.status.toUpperCase()}) — Extent: ${t.extentRaw || `${t.extentSqFt} sq ft`}`);
          doc.fillColor('#475569').text(`   Transfer: ${fromNames} -> ${toNames}`);
          doc.fillColor('#1e293b');
        });
      }
      if (snapshot.titleGaps.length > 0) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#b91c1c').text('Identified Title Gaps:');
        snapshot.titleGaps.forEach(g => {
          doc.font('Helvetica').fontSize(8).fillColor('#7f1d1d').text(`* [${g.severity.toUpperCase()}] ${g.title}: ${g.description} (${g.points} pts)`);
        });
      }
      doc.moveDown(0.6);

      if (doc.y > 640) doc.addPage();

      // --- SECTION 4: DISCREPANCY MATRIX ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('4. CROSS-DOCUMENT DISCREPANCY MATRIX');
      doc.moveDown(0.2);
      if (snapshot.discrepancies.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#047857').text('No cross-document discrepancies detected between indexed source records.');
      } else {
        snapshot.discrepancies.forEach(d => {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#b91c1c').text(`* ${d.field.toUpperCase()} MISMATCH (${d.severity.toUpperCase()} - ${d.points} pts): ${d.deltaText}`);
          doc.font('Helvetica').fontSize(8).fillColor('#334155').text(`  ${d.explanation}`);
          doc.fillColor('#475569').text(`  Action: ${d.nextAction} [Statutory Ref: ${d.statutoryCitation}]`);
          doc.moveDown(0.2);
        });
      }
      doc.moveDown(0.6);

      if (doc.y > 640) doc.addPage();

      // --- SECTION 5: GIS & ENVIRONMENTAL BUFFER SCREENING ANALYSIS ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('5. GIS & ENVIRONMENTAL BUFFER SCREENING ANALYSIS');
      doc.moveDown(0.2);
      const spatial = snapshot.spatialScreening;
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
      doc.text(`* Rajakaluve / Primary Drain Clearance: ${(spatial?.drainClearanceStatus || 'UNKNOWN').toUpperCase()}`);
      doc.text(`* Lake / Waterbody Buffer Clearance: ${(spatial?.lakeClearanceStatus || 'UNKNOWN').toUpperCase()}`);
      doc.text(`* Screening Result: ${spatial?.message || 'Screening complete.'}`);
      if (spatial?.findings && spatial.findings.length > 0) {
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#b91c1c').text('Proximity Alerts:');
        spatial.findings.forEach(f => {
          doc.font('Helvetica').fontSize(8).fillColor('#475569').text(`  - ${f.layerType.toUpperCase()}: Distance ${f.distanceM}m (Mandatory Buffer: ${f.bufferM}m) -> ${f.severity.toUpperCase()}`);
        });
      }
      doc.moveDown(0.6);

      // --- SECTION 6: ITEMIZED EVIDENCE APPENDIX ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('6. ITEMIZED EVIDENCE APPENDIX & PROVENANCE CHECKSUMS');
      doc.moveDown(0.2);
      if (snapshot.documents.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748b').text('No digital source deeds or certificates attached.');
      } else {
        snapshot.documents.forEach((d, idx) => {
          const fn = d.originalFilename || d.original_filename || `Document-${idx + 1}`;
          const hash = d.sha256 || 'SHA-256 not recorded';
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b').text(`${idx + 1}. ${fn}`);
          doc.font('Courier').fontSize(7).fillColor('#475569').text(`   SHA-256: ${hash}`);
        });
      }
      doc.moveDown(0.6);

      if (doc.y > 620) doc.addPage();

      // --- SECTION 7: STATUTORY DISCLAIMERS & LEGAL NOTICE ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('7. STATUTORY DISCLAIMERS & LEGAL SIGN-OFF');
      doc.moveDown(0.2);
      const disclaimTop = doc.y;
      doc.rect(40, disclaimTop, 515, 52).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(
        snapshot.statutoryNotice,
        48,
        disclaimTop + 6,
        { width: 499, lineGap: 1 }
      );

      doc.y = disclaimTop + 60;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text(`LEGAL REVIEW STATUS: ${(tenant.organizationName || 'OJIX').toUpperCase()}`);
      doc.moveDown(0.2);
      if (snapshot.legalSignOff?.isLegalApproved) {
        doc.font('Helvetica').fontSize(8).fillColor('#047857');
        doc.text(`Reviewer sign-off recorded: ${snapshot.legalSignOff.approvedByUid || 'Reviewer'}`);
        doc.text(`Sign-off timestamp: ${snapshot.legalSignOff.approvedAt || 'Not recorded'}`);
      } else {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#b45309');
        doc.text('Notice: This report is an evidence compilation. No qualified legal sign-off is recorded.');
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Main PDF Generation Entry Point:
 * Uses Chromium headless rendering by default for high visual fidelity with the web report,
 * and seamlessly falls back to PDFKit if headless rendering is unavailable.
 */
export async function generateDueDiligencePdf(
  snapshot: DueDiligenceReportSnapshot,
  options?: GeneratePdfOptions
): Promise<Buffer> {
  const mode = options?.renderer || 'auto';

  if (mode === 'pdfkit') {
    return generateDueDiligencePdfKit(snapshot);
  }

  if (mode === 'headless') {
    return generateDueDiligenceHeadlessPdf(snapshot, options);
  }

  // 'auto' mode: attempt Headless Chromium first for visual parity, fallback to PDFKit
  try {
    const exe = getChromiumExecutablePath();
    if (!exe) {
      return await generateDueDiligencePdfKit(snapshot);
    }
    return await generateDueDiligenceHeadlessPdf(snapshot, options);
  } catch (err: any) {
    console.warn(`[ReportGenerator] Headless PDF generation failed (${err.message}). Falling back to PDFKit.`);
    return await generateDueDiligencePdfKit(snapshot);
  }
}
