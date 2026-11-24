import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';

const highCourtBase64 = fs.readFileSync(path.join(rootDir, 'karnataka-high-court-exact.png')).toString('base64');
const mapBase64 = fs.readFileSync(path.join(rootDir, 'karnataka-map-clean.png')).toString('base64');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJIX Property Intelligence — Capabilities & Multi-Role Architecture</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #08090c;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 25px 12px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .banner-frame {
      width: 1440px;
      height: 1040px;
      display: flex;
      background: #f8fafc;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 35px 90px rgba(0, 0, 0, 0.85);
      position: relative;
    }

    /* 3 EQUAL COLUMNS */
    .col {
      width: 33.3333%;
      padding: 42px 38px 50px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .col-1 {
      border-right: 1px solid #e2e8f0;
      background: #fafaf9;
    }
    .col-2 {
      border-right: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .col-3 {
      background: #fafaf9;
    }

    /* MICRO HEADERS */
    .micro-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 20px;
    }
    .micro-header svg {
      width: 14px;
      height: 14px;
      stroke: #64748b;
      stroke-width: 2.2;
    }

    /* MAIN COLUMN HEADLINES */
    .col-headline {
      font-size: 48px;
      line-height: 0.94;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 22px;
    }
    .col-headline .accent-orange {
      color: #ff4713;
    }

    /* ========================================================
       COLUMN 1: THE MATTER / EVIDENCE WORKSPACE CARD
       ======================================================== */
    .workspace-card-wrapper {
      position: relative;
      margin-top: 5px;
      margin-bottom: 22px;
    }
    .workspace-tape-badge {
      position: absolute;
      top: -12px;
      left: 12px;
      background: #ff4713;
      color: #111418;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 2px;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(255, 71, 19, 0.35);
    }
    .workspace-dark-card {
      background: #111418;
      border-radius: 4px;
      padding: 24px 20px 20px;
      color: #ffffff;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255,255,255,0.08);
      position: relative;
    }
    .card-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 10px;
    }
    .card-brand-tag {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #ffffff;
      text-transform: uppercase;
    }
    .card-role-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #ff4713;
      background: rgba(255, 71, 19, 0.15);
      padding: 3px 8px;
      border-radius: 2px;
      border: 1px solid rgba(255, 71, 19, 0.3);
      text-transform: uppercase;
    }

    /* Role chips bar */
    .roles-chips-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 14px;
    }
    .role-chip {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .role-chip.active {
      background: #ff4713;
      color: #111418;
      font-weight: 800;
    }

    .card-sub-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      letter-spacing: 0.18em;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .card-big-title {
      font-size: 25px;
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 16px;
    }
    .card-menu-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card-menu-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 10px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 3px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
      font-weight: 600;
      color: #cbd5e1;
      text-decoration: none;
    }
    .card-menu-item span.idx {
      font-family: 'JetBrains Mono', monospace;
      color: #ff4713;
      font-weight: 800;
      margin-right: 6px;
      font-size: 9.5px;
    }
    .card-menu-item svg {
      width: 11px;
      height: 11px;
      stroke: #64748b;
    }
    .card-disclaimer {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      letter-spacing: 0.12em;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-weight: 600;
    }

    /* FEATURE LIST ITEMS */
    .feature-blocks {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .feature-item {
      position: relative;
    }
    .feature-title {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #0f172a;
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 4px;
    }
    .feature-title .tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
    }
    .feature-title.accent-title {
      color: #ff4713;
    }
    .feature-title.accent-title .tag {
      color: #ff4713;
    }
    .feature-body {
      font-size: 12px;
      line-height: 1.5;
      color: #475569;
      font-weight: 500;
    }

    /* ========================================================
       COLUMN 2: CENTRAL ROADMAP TRACK / PIPELINE
       ======================================================== */
    .pipeline-track-wrapper {
      position: relative;
      width: 100%;
      height: 220px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pipeline-track-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .track-badge {
      position: absolute;
      padding: 5px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-radius: 2px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.1;
    }
    .track-badge span.role {
      font-size: 7px;
      color: #ff4713;
      margin-bottom: 2px;
    }
    .badge-prepare {
      top: 48px;
      left: 20%;
      background: #111418;
      color: #ffffff;
    }
    .badge-hearing {
      top: 100px;
      left: 45%;
      background: #ffffff;
      color: #111418;
      border: 1px solid #cbd5e1;
    }
    .badge-hearing span.role {
      color: #0f172a;
    }
    .badge-followup {
      top: 80px;
      left: 72%;
      background: #111418;
      color: #ffffff;
    }
    .sub-track-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      letter-spacing: 0.16em;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
      font-weight: 700;
    }

    /* ========================================================
       COLUMN 3: KARNATAKA LANDSCAPE & MAP
       ======================================================== */
    .karnataka-header-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.16em;
      color: #0f172a;
      text-transform: uppercase;
      font-weight: 800;
      margin-top: -16px;
      margin-bottom: 18px;
    }
    .building-photo-card {
      width: 100%;
      height: 150px;
      border-radius: 3px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 10px 25px rgba(0,0,0,0.14);
    }
    .building-photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-caption {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      letter-spacing: 0.15em;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 8px;
      font-weight: 800;
    }
    .photo-sub-label {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin-top: 3px;
      margin-bottom: 10px;
    }

    /* Karnataka Map Visual Section */
    .karnataka-map-box {
      position: relative;
      width: 100%;
      height: 240px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }
    .karnataka-map-img {
      height: 225px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 8px 18px rgba(255, 71, 19, 0.3));
    }
    .map-callout {
      position: absolute;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      z-index: 15;
    }
    .callout-left {
      top: 35px;
      left: 10px;
    }
    .callout-right {
      top: 45px;
      right: 15px;
    }
    .callout-bengaluru {
      bottom: 25px;
      right: 25px;
      border-left: 2px solid #0f172a;
      padding-left: 8px;
    }
    .callout-bengaluru strong {
      font-size: 12.5px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }
    .callout-bengaluru span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      color: #64748b;
      font-weight: 700;
    }

    /* Pointer Lines */
    .pointer-line-left {
      position: absolute;
      top: 55px;
      left: 80px;
      width: 60px;
      height: 1px;
      border-top: 1.5px dashed #94a3b8;
    }
    .pointer-line-right {
      position: absolute;
      top: 65px;
      right: 85px;
      width: 50px;
      height: 1px;
      border-top: 1.5px dashed #94a3b8;
    }

    /* COLUMN FOOTERS */
    .col-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #94a3b8;
      font-weight: 700;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 8px;
    }

    /* BOTTOM GLOBAL COMPANY BAR WITH ROLE BADGES */
    .company-global-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: #0f172a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 35px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 700;
      z-index: 40;
    }
    .company-global-bar .roles-summary {
      color: #94a3b8;
    }
    .company-global-bar .roles-summary strong {
      color: #ff4713;
    }
    .company-global-bar a {
      color: #ff4713;
      text-decoration: none;
      font-weight: 800;
    }
    .company-global-bar span.sep {
      color: #334155;
      margin: 0 8px;
    }
  </style>
</head>
<body>

  <!-- MASTER BANNER FRAME (FRAME 440 WITH MULTI-ROLE GOVERNANCE) -->
  <div class="banner-frame">

    <!-- ========================================================
         COLUMN 1: 01 / ROLE-BASED PROPERTY DUE DILIGENCE WORKSPACE
         ======================================================== -->
    <div class="col col-1">
      <div>
        <div class="micro-header">
          <span>01 / 8-ROLE DUE DILIGENCE WORKSPACE</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>

        <h1 class="col-headline">
          EVERYTHING<br>
          IN ITS <span class="accent-orange">PLACE.</span>
        </h1>

        <!-- The Matter Workspace Card with Role Badges -->
        <div class="workspace-card-wrapper">
          <div class="workspace-tape-badge">TITLE / RTC / SPATIAL EVIDENCE</div>
          <div class="workspace-dark-card">
            <div class="card-top-row">
              <span class="card-brand-tag">OJIX PROPERTY</span>
              <span class="card-role-pill">LEAD ADVOCATE</span>
            </div>

            <!-- Role Chips Indicators -->
            <div class="roles-chips-bar">
              <span class="role-chip active">PARTNER</span>
              <span class="role-chip active">ADVOCATE</span>
              <span class="role-chip active">ANALYST</span>
              <span class="role-chip">OPS</span>
              <span class="role-chip">CONSULTANT</span>
              <span class="role-chip">CLIENT</span>
            </div>

            <div class="card-sub-label">CONNECTED ROLES · TAMPER-PROOF EVIDENCE</div>
            <h2 class="card-big-title">
              The property.<br>
              The whole chain.
            </h2>

            <div class="card-menu-list">
              <a href="#advocate" class="card-menu-item">
                <span><span class="idx">01</span> Lead Advocate — 40-Yr Chain &amp; Sign-off</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
              <a href="#analyst" class="card-menu-item">
                <span><span class="idx">02</span> Evidence Analyst — Deed Extraction &amp; RTC</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
              <a href="#client" class="card-menu-item">
                <span><span class="idx">03</span> Bank &amp; Client — Verified Title Report</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
            </div>
          </div>
          <div class="card-disclaimer">PRODUCTION MVP · ROLE-BASED ACCESS CONTROL (RBAC)</div>
        </div>

        <!-- Numbered Feature Descriptions Highlighting Roles -->
        <div class="feature-blocks">
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">01.A</span> 40-Year Title Chain Reconstruction</h3>
            <p class="feature-body">Automatically extract and chronologically link parent deeds, sale deeds, gift deeds, and partition deeds across 40 years of ownership history.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">01.B</span> Bilingual Document &amp; OCR Intake</h3>
            <p class="feature-body">Operations teams process Kannada (kan) and English (eng) revenue records with bounding-box OCR verification anchored to source PDF pages.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title accent-title"><span class="tag">01.C</span> 8 Dedicated Role Workbenches</h3>
            <p class="feature-body">Dedicated portals for Workspace Owners, Lead Advocates, Analysts, Paralegals, Surveyors, and Bank Auditors with strict RBAC segregation.</p>
          </div>
        </div>
      </div>

      <div class="col-footer">
        <span>LESS SEARCHING. FASTER DUE DILIGENCE.</span>
        <span>01 -</span>
      </div>
    </div>

    <!-- ========================================================
         COLUMN 2: 02 / REVENUE TO TITLE WORKFLOW WITH ROLE STAGES
         ======================================================== -->
    <div class="col col-2">
      <div>
        <div class="micro-header">
          <span>02 / ROLE-GOVERNED REVENUE WORKFLOW</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>

        <!-- Looping Pipeline Roadmap Track with Roles -->
        <div class="pipeline-track-wrapper">
          <svg class="pipeline-track-svg" viewBox="0 0 380 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Road Track Base (Safety Orange) -->
            <path d="M 0 160 C 60 160 80 25 140 25 C 190 25 200 160 250 160 C 300 160 320 110 380 110" 
                  stroke="#ff4713" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Centerline Dashes (White) -->
            <path d="M 0 160 C 60 160 80 25 140 25 C 190 25 200 160 250 160 C 300 160 320 110 380 110" 
                  stroke="#ffffff" stroke-width="2.5" stroke-dasharray="8 8" stroke-linecap="round"/>
          </svg>

          <!-- Checkpoint Badges with Role Ownership -->
          <div class="track-badge badge-prepare">
            <span class="role">PARALEGAL</span>
            INTAKE &amp; OCR
          </div>
          <div class="track-badge badge-hearing">
            <span class="role">ANALYST</span>
            CHAIN AUDIT
          </div>
          <div class="track-badge badge-followup">
            <span class="role">ADVOCATE</span>
            SIGN-OFF
          </div>
        </div>

        <div class="sub-track-label">FROM SOURCE DEED TO LAWYER-VERIFIED REPORT.</div>

        <h1 class="col-headline">
          EVERYTHING<br>
          IN <span class="accent-orange">SYNC.</span>
        </h1>

        <!-- Numbered Feature Descriptions Highlighting Role Workflows -->
        <div class="feature-blocks">
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">02.A</span> Operations: Intake &amp; RTC Verification</h3>
            <p class="feature-body">Paralegals intake deeds and cross-verify Bhoomi Pahani (RTC) ownership records and mutation registers (MR) against registered deeds.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">02.B</span> Analysts: Kaveri EC &amp; Chain Synthesis</h3>
            <p class="feature-body">Analysts parse Form 15 and Form 16 Nil Encumbrance Certificates to surface mortgages, charges, and reconstruct the 40-year chronology.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title accent-title"><span class="tag">02.C</span> Advocates: Spatial &amp; Title Sign-off</h3>
            <p class="feature-body">Senior advocates inspect BDA Master Plan 2031 overlays, 30m lake and 50m drain buffers, resolve discrepancies, and issue verified title opinions.</p>
          </div>
        </div>
      </div>

      <div class="col-footer">
        <span>THE RIGHT EVIDENCE. AT THE RIGHT MOMENT.</span>
        <span>02 +</span>
      </div>
    </div>

    <!-- ========================================================
         COLUMN 3: 03 / ROOTED IN KARNATAKA
         ======================================================== -->
    <div class="col col-3">
      <div>
        <div class="micro-header">
          <span>03 / THE KARNATAKA LEGAL LANDSCAPE</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>

        <h1 class="col-headline">
          ROOTED IN<br>
          <span class="accent-orange">KARNATAKA.</span>
        </h1>
        <div class="karnataka-header-sub">BUILT FOR BENGALURU &amp; STATE TITLE LAW.</div>

        <!-- High Court Building Card with Exact Image -->
        <div class="building-photo-card">
          <img src="data:image/png;base64,${highCourtBase64}" alt="Karnataka High Court Bengaluru" />
        </div>

        <div class="photo-caption">KARNATAKA HIGH COURT · BENGALURU</div>
        <div class="photo-sub-label">BUILT WITH KARNATAKA'S PROPERTY STATUTES IN MIND.</div>

        <!-- Karnataka Map with Exact Silhouette Image & Annotations -->
        <div class="karnataka-map-box">
          <div class="map-callout callout-left">
            <span>Property &amp;</span>
            <span style="font-size:10px;color:#64748b;">land records</span>
          </div>
          <div class="pointer-line-left"></div>

          <div class="map-callout callout-right">
            <span>Kannada-</span>
            <span>English</span>
            <span style="font-size:9.5px;color:#64748b;">documents</span>
          </div>
          <div class="pointer-line-right"></div>

          <!-- Exact Silhouette Map of Karnataka in Safety Orange -->
          <img class="karnataka-map-img" src="data:image/png;base64,${mapBase64}" alt="State of Karnataka Map" />

          <div class="map-callout callout-bengaluru">
            <strong>BENGALURU</strong>
            <span>City reference</span>
          </div>
        </div>

        <!-- Feature 03.A -->
        <div class="feature-item" style="margin-top: -4px;">
          <h3 class="feature-title"><span class="tag">03.A</span> Automated Chromium Title Reports</h3>
          <p class="feature-body">Generate court-grade, multi-page PDF title search reports complete with running headers, title chain tables, discrepancy matrices, and advocate sign-offs.</p>
        </div>
      </div>

      <div class="col-footer">
        <span>Photo: Moheen Reeyad · CC BY-SA 4.0 | Map: DataMeet</span>
        <span>03 /</span>
      </div>
    </div>

    <!-- ========================================================
         BOTTOM GLOBAL COMPANY BAR WITH ROLE BADGES
         ======================================================== -->
    <div class="company-global-bar">
      <div class="roles-summary">
        <span><strong>ROLES:</strong> PARTNER · ADVOCATE · ANALYST · PARALEGAL · CONSULTANT · AUDITOR</span>
      </div>
      <div>
        <span>OFFICIAL URL: </span>
        <a href="https://www.ojix.com" target="_blank">WWW.OJIX.COM</a>
        <span class="sep">|</span>
        <span>CONTACT: </span>
        <a href="mailto:info@ojix.in">INFO@OJIX.IN</a>
      </div>
    </div>

  </div>

</body>
</html>`;

fs.writeFileSync(path.join(rootDir, 'banner-frame440-ojix.html'), htmlContent);
console.log('banner-frame440-ojix.html updated with explicit role workflows!');

async function render() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 1540, height: 1140 },
    deviceScaleFactor: 2
  });
  await page.goto('file://' + path.join(rootDir, 'banner-frame440-ojix.html'), { waitUntil: 'networkidle' });
  const banner = await page.locator('.banner-frame');
  await banner.screenshot({ path: path.join(rootDir, 'OJIX_Frame440_Capabilities_Banner.png') });
  console.log('Re-rendered OJIX_Frame440_Capabilities_Banner.png with explicit role workflows!');
  await browser.close();
}

render().catch(err => {
  console.error(err);
  process.exit(1);
});
