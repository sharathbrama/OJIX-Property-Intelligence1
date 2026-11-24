import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';

const highCourtPath = fs.existsSync(path.join(rootDir, 'karnataka-high-court-exact.png'))
  ? path.join(rootDir, 'karnataka-high-court-exact.png')
  : path.join(rootDir, 'apps/web/public/assets/karnataka-high-court-exact.png');

const mapPath = fs.existsSync(path.join(rootDir, 'karnataka-map-clean.png'))
  ? path.join(rootDir, 'karnataka-map-clean.png')
  : path.join(rootDir, 'apps/web/public/assets/karnataka-map-clean.png');

const highCourtBase64 = fs.readFileSync(highCourtPath).toString('base64');
const mapBase64 = fs.readFileSync(mapPath).toString('base64');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJIX Property Intelligence — Frame 440 Architectural Edition</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #030509;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 25px 12px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #FFFFFF;
    }

    /* MASTER BANNER FRAME (1520 x 1060 ARCHITECTURAL TRIPTYCH) */
    .banner-frame {
      width: 1520px;
      height: 1060px;
      display: flex;
      background: #070A12;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 40px 120px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.1);
      position: relative;
    }

    /* Ambient Blueprint Grid */
    .banner-frame::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 38px 38px;
      pointer-events: none;
      z-index: 1;
    }

    /* 3 EQUAL EDITORIAL COLUMNS */
    .col {
      width: 33.3333%;
      padding: 40px 36px 52px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      z-index: 5;
    }
    .col-1 {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(180deg, #090E1A 0%, #060912 100%);
    }
    .col-2 {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(180deg, #0B101E 0%, #070B16 100%);
    }
    .col-3 {
      background: linear-gradient(180deg, #090E1A 0%, #060912 100%);
    }

    /* MICRO HEADERS */
    .micro-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 800;
      color: #94A3B8;
      margin-bottom: 18px;
    }
    .micro-header svg {
      width: 14px;
      height: 14px;
      stroke: #38BDF8;
      stroke-width: 2.4;
    }

    /* MAIN COLUMN HEADLINES */
    .col-headline {
      font-size: 46px;
      line-height: 0.94;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #FFFFFF;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .accent-cyan {
      color: #00E5FF;
      text-shadow: 0 0 24px rgba(0, 229, 255, 0.35);
    }
    .accent-amber {
      color: #F59E0B;
      text-shadow: 0 0 24px rgba(245, 158, 11, 0.35);
    }
    .accent-emerald {
      color: #10B981;
      text-shadow: 0 0 24px rgba(16, 185, 129, 0.35);
    }

    /* ========================================================
       COLUMN 1: THE MATTER / EVIDENCE WORKSPACE CARD
       ======================================================== */
    .workspace-card-wrapper {
      position: relative;
      margin-top: 4px;
      margin-bottom: 20px;
    }
    .workspace-tape-badge {
      position: absolute;
      top: -12px;
      left: 14px;
      background: linear-gradient(135deg, #00E5FF 0%, #0284C7 100%);
      color: #020617;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 3px;
      z-index: 10;
      box-shadow: 0 4px 14px rgba(0, 229, 255, 0.4);
    }
    .workspace-dark-card {
      background: #0F172A;
      border-radius: 8px;
      padding: 22px 18px 18px;
      color: #FFFFFF;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(56, 189, 248, 0.3);
      position: relative;
    }
    .card-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 9px;
    }
    .card-brand-tag {
      font-size: 12.5px;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #FFFFFF;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-brand-tag::before {
      content: '';
      width: 7px;
      height: 7px;
      background: #00E5FF;
      border-radius: 50%;
      box-shadow: 0 0 8px #00E5FF;
    }
    .card-role-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #00E5FF;
      background: rgba(0, 229, 255, 0.12);
      padding: 2.5px 7px;
      border-radius: 3px;
      border: 1px solid rgba(0, 229, 255, 0.35);
      text-transform: uppercase;
    }

    /* Role chips bar */
    .roles-chips-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
    }
    .role-chip {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.06);
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .role-chip.active {
      background: rgba(0, 229, 255, 0.18);
      color: #00E5FF;
      border-color: rgba(0, 229, 255, 0.4);
      font-weight: 800;
    }

    .card-sub-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      letter-spacing: 0.16em;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 3px;
      font-weight: 700;
    }
    .card-big-title {
      font-size: 23px;
      line-height: 1.05;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      margin-bottom: 14px;
    }
    .card-menu-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .card-menu-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6.5px 9px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      font-size: 10.5px;
      font-weight: 600;
      color: #E2E8F0;
      text-decoration: none;
    }
    .card-menu-item span.idx {
      font-family: 'JetBrains Mono', monospace;
      color: #00E5FF;
      font-weight: 800;
      margin-right: 6px;
      font-size: 9px;
    }
    .card-menu-item svg {
      width: 11px;
      height: 11px;
      stroke: #64748B;
    }
    .card-disclaimer {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      letter-spacing: 0.12em;
      color: #64748B;
      text-transform: uppercase;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-weight: 700;
    }

    /* FEATURE LIST ITEMS */
    .feature-blocks {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .feature-item {
      position: relative;
    }
    .feature-title {
      font-size: 14.5px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #FFFFFF;
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 3px;
    }
    .feature-title .tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      color: #00E5FF;
    }
    .feature-title.accent-title {
      color: #38BDF8;
    }
    .feature-body {
      font-size: 11.5px;
      line-height: 1.48;
      color: #94A3B8;
      font-weight: 500;
    }
    .feature-body strong {
      color: #F1F5F9;
    }

    /* ========================================================
       COLUMN 2: CENTRAL ROADMAP TRACK / PIPELINE (GLOWING AMBER)
       ======================================================== */
    .pipeline-track-wrapper {
      position: relative;
      width: 100%;
      height: 220px;
      margin-bottom: 16px;
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
      padding: 5px 9px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-radius: 3px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.15;
    }
    .track-badge span.role {
      font-size: 6.8px;
      color: #F59E0B;
      margin-bottom: 2px;
      font-weight: 800;
    }
    .badge-prepare {
      top: 44px;
      left: 17%;
      background: #161D2E;
      color: #FFFFFF;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .badge-hearing {
      top: 96px;
      left: 44%;
      background: #161D2E;
      color: #FFFFFF;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .badge-followup {
      top: 76px;
      left: 71%;
      background: #161D2E;
      color: #10B981;
      border: 1.5px solid #10B981;
      box-shadow: 0 0 16px rgba(16, 185, 129, 0.3);
    }
    .badge-followup span.role {
      color: #10B981;
    }

    .sub-track-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      letter-spacing: 0.16em;
      color: #94A3B8;
      text-transform: uppercase;
      margin-bottom: 8px;
      font-weight: 800;
    }

    /* ========================================================
       COLUMN 3: DECISION ENGINE, MAP & FATAL REJECTION CRITERIA
       ======================================================== */
    .karnataka-header-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      letter-spacing: 0.16em;
      color: #10B981;
      text-transform: uppercase;
      font-weight: 800;
      margin-top: -14px;
      margin-bottom: 16px;
    }
    .building-photo-card {
      width: 100%;
      height: 140px;
      border-radius: 6px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .building-photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      filter: contrast(1.05) brightness(0.95);
    }
    .photo-overlay-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(16, 185, 129, 0.9);
      color: #020617;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 900;
      padding: 3px 8px;
      border-radius: 3px;
      letter-spacing: 0.08em;
    }
    .photo-caption {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      letter-spacing: 0.14em;
      color: #94A3B8;
      text-transform: uppercase;
      margin-top: 7px;
      font-weight: 800;
    }
    .photo-sub-label {
      font-size: 11px;
      font-weight: 800;
      color: #F8FAFC;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin-top: 2px;
      margin-bottom: 8px;
    }

    /* Karnataka Map Visual Section */
    .karnataka-map-box {
      position: relative;
      width: 100%;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
    }
    .karnataka-map-img {
      height: 190px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 8px 24px rgba(16, 185, 129, 0.45));
    }
    .map-callout {
      position: absolute;
      font-size: 10.5px;
      font-weight: 800;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      z-index: 15;
    }
    .callout-left {
      top: 25px;
      left: 6px;
    }
    .callout-right {
      top: 35px;
      right: 8px;
    }
    .callout-bengaluru {
      bottom: 18px;
      right: 18px;
      border-left: 2px solid #10B981;
      padding-left: 8px;
    }
    .callout-bengaluru strong {
      font-size: 11.5px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #10B981;
    }
    .callout-bengaluru span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      color: #94A3B8;
      font-weight: 700;
    }

    /* Pointer Lines */
    .pointer-line-left {
      position: absolute;
      top: 45px;
      left: 75px;
      width: 55px;
      height: 1px;
      border-top: 1.5px dashed rgba(56, 189, 248, 0.5);
    }
    .pointer-line-right {
      position: absolute;
      top: 55px;
      right: 80px;
      width: 45px;
      height: 1px;
      border-top: 1.5px dashed rgba(16, 185, 129, 0.5);
    }

    /* Rejection Alert Box in Col 3 */
    .rejection-mini-banner {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .rmb-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.8px;
      font-weight: 900;
      color: #EF4444;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .rmb-desc {
      font-size: 8.5px;
      color: #FCA5A5;
      line-height: 1.35;
    }
    .rmb-desc strong {
      color: #FFFFFF;
    }

    /* COLUMN FOOTERS */
    .col-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748B;
      font-weight: 800;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 10px;
      margin-top: 8px;
    }
    .col-footer span.step-tag {
      color: #38BDF8;
    }

    /* BOTTOM GLOBAL COMPANY BAR WITH ROLE BADGES */
    .company-global-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 42px;
      background: #04070E;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 35px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 700;
      z-index: 40;
    }
    .company-global-bar .roles-summary {
      color: #94A3B8;
    }
    .company-global-bar .roles-summary strong {
      color: #00E5FF;
    }
    .company-global-bar a {
      color: #10B981;
      text-decoration: none;
      font-weight: 900;
    }
    .company-global-bar span.sep {
      color: #334155;
      margin: 0 8px;
    }
  </style>
</head>
<body>

  <!-- MASTER BANNER FRAME (FRAME 440 ARCHITECTURAL TRIPTYCH) -->
  <div class="banner-frame">

    <!-- ========================================================
         COLUMN 1: 01 / BUYER INTAKE & 4-GOVERNMENT REGISTRY COCKPIT
         ======================================================== -->
    <div class="col col-1">
      <div>
        <div class="micro-header">
          <span>01 / UNIFIED PROPERTY INGESTION</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>

        <h1 class="col-headline">
          EVERY DEED.<br>
          IN ITS <span class="accent-cyan">DOSSIER.</span>
        </h1>

        <!-- The Matter Workspace Card with Role Badges -->
        <div class="workspace-card-wrapper">
          <div class="workspace-tape-badge">KAVERI 2.0 · BHOOMI · MOJINI · NADAKACHERI</div>
          <div class="workspace-dark-card">
            <div class="card-top-row">
              <span class="card-brand-tag">OJIX PROPERTY</span>
              <span class="card-role-pill">BUYER &amp; OPS INTAKE</span>
            </div>

            <!-- Role Chips Indicators -->
            <div class="roles-chips-bar">
              <span class="role-chip active">BUYER</span>
              <span class="role-chip active">OPS</span>
              <span class="role-chip active">DATA STEWARD</span>
              <span class="role-chip">ANALYST</span>
              <span class="role-chip">LAWYER</span>
              <span class="role-chip">GIS</span>
            </div>

            <div class="card-sub-label">4 LIVE REGISTRIES · INSTANT PROVENANCE</div>
            <h2 class="card-big-title">
              The property.<br>
              The whole truth.
            </h2>

            <div class="card-menu-list">
              <a href="#kaveri" class="card-menu-item">
                <span><span class="idx">01</span> Kaveri 2.0 — Registered Deed #4582 &amp; 30-Yr EC</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
              <a href="#bhoomi" class="card-menu-item">
                <span><span class="idx">02</span> Bhoomi Portal — RTC Pahani Sy 45/3A &amp; M.R. T14</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
              <a href="#mojini" class="card-menu-item">
                <span><span class="idx">03</span> Mojini 3.0 — Cadastral Map #12 &amp; FMB Tippani</span>
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
            </div>
          </div>
          <div class="card-disclaimer">DETERMINISTIC VERIFICATION · ZERO MANUAL PAPERWORK</div>
        </div>

        <!-- Numbered Feature Descriptions -->
        <div class="feature-blocks">
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">01.A</span> Buyer Property Intake &amp; Portal Sync</h3>
            <p class="feature-body">Outside buyer provides Survey No. 45/3A and deed copies. Operations queries live Kaveri 2.0, Bhoomi, and Mojini with <strong>zero manual legwork</strong>.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">01.B</span> Bilingual AI OCR &amp; Normalization</h3>
            <p class="feature-body">Converts raw Kannada script (<em>ಕಾಲಂ 9/10, ವಿಸ್ತೀರ್ಣ 2A 14G</em>) into structured English legal records with <strong>99.8% precision</strong>.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title accent-title"><span class="tag">01.C</span> Provenance Hash &amp; Audit Trail</h3>
            <p class="feature-body">Every extracted line is cryptographically anchored to original government scan coordinates under strict <strong>tamper-proof custody</strong>.</p>
          </div>
        </div>
      </div>

      <div class="col-footer">
        <span>ZERO MANUAL BLINDSPOTS. INSTANT INGESTION.</span>
        <span class="step-tag">01 ➔</span>
      </div>
    </div>

    <!-- ========================================================
         COLUMN 2: 02 / THE 10-ROLE CONSENSUS ROADMAP TRACK (AMBER)
         ======================================================== -->
    <div class="col col-2">
      <div>
        <div class="micro-header">
          <span>02 / 10-ROLE VERIFICATION LIFECYCLE</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>

        <!-- Looping Pipeline Roadmap Track with Roles in Amber -->
        <div class="pipeline-track-wrapper">
          <svg class="pipeline-track-svg" viewBox="0 0 380 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Road Track Base (Solar Amber) -->
            <path d="M 0 160 C 60 160 80 25 140 25 C 190 25 200 160 250 160 C 300 160 320 110 380 110" 
                  stroke="#F59E0B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Centerline Dashes (White) -->
            <path d="M 0 160 C 60 160 80 25 140 25 C 190 25 200 160 250 160 C 300 160 320 110 380 110" 
                  stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="8 8" stroke-linecap="round"/>
          </svg>

          <!-- Checkpoint Badges with Role Ownership -->
          <div class="track-badge badge-prepare">
            <span class="role">OPS &amp; DATA</span>
            INTAKE &amp; OCR
          </div>
          <div class="track-badge badge-hearing">
            <span class="role">TITLE ANALYST</span>
            30-YR DAG CHAIN
          </div>
          <div class="track-badge badge-followup">
            <span class="role">LAWYER &amp; GIS</span>
            50M BUFFER &amp; PTCL
          </div>
        </div>

        <div class="sub-track-label">FROM RAW DEED INJECTION TO COURT-ADMISSIBLE VERDICT.</div>

        <h1 class="col-headline">
          EVERY ROLE.<br>
          IN <span class="accent-amber">CONSENSUS.</span>
        </h1>

        <!-- Numbered Feature Descriptions Highlighting Role Workflows -->
        <div class="feature-blocks">
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">02.A</span> 30-Year Title DAG Lineage Engine</h3>
            <p class="feature-body">Directed Acyclic Graph links <strong>1994 Govt Grant ➔ 2003 Sale ➔ 2014 Hissa Podi ➔ 2024 Present Title</strong> with zero missing links or unrecorded splits.</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title"><span class="tag">02.B</span> Sub-Meter PostGIS Cadastral Screener</h3>
            <p class="feature-body">Real-time vector buffer screening verifies parcel coordinates against <strong>50m Rajakaluve SWD drains</strong> and 30m lake boundaries (Pass: 72.4m setback).</p>
          </div>
          <div class="feature-item">
            <h3 class="feature-title accent-title" style="color:#F59E0B;"><span class="tag" style="color:#F59E0B;">02.C</span> 10-Role Multi-Disciplinary Consensus</h3>
            <p class="feature-body">Lawyers, surveyors, analysts, and super admins co-sign the cryptographic audit trail, ensuring <strong>strict separation of duties</strong>.</p>
          </div>
        </div>
      </div>

      <div class="col-footer">
        <span>48-HOUR TURNAROUND. ALL 10 ROLES SIGNED.</span>
        <span class="step-tag" style="color:#F59E0B;">02 ➔</span>
      </div>
    </div>

    <!-- ========================================================
         COLUMN 3: 03 / SAFE TO BUY & CRITICAL REJECTION CRITERIA
         ======================================================== -->
    <div class="col col-3">
      <div>
        <div class="micro-header">
          <span>03 / DECISION ENGINE &amp; RISK AUDIT</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </div>

        <h1 class="col-headline">
          SAFE TO BUY.<br>
          BACKED BY <span class="accent-emerald">LAW.</span>
        </h1>
        <div class="karnataka-header-sub">BUILT FOR KARNATAKA REAL ESTATE TRANSACTIONS.</div>

        <!-- High Court Building Card with Exact Image -->
        <div class="building-photo-card">
          <div class="photo-overlay-badge">GRADE A+ · TRUST SCORE 98/100</div>
          <img src="data:image/png;base64,${highCourtBase64}" alt="Karnataka High Court Bengaluru" />
        </div>

        <div class="photo-caption">KARNATAKA HIGH COURT &amp; REVENUE STANDARDS · BENGALURU</div>
        <div class="photo-sub-label">GOVERNMENT-CERTIFIED TITLE CLEARANCE DOSSIER.</div>

        <!-- Karnataka Map with Exact Silhouette Image & Annotations in Emerald -->
        <div class="karnataka-map-box">
          <div class="map-callout callout-left">
            <span style="color:#38BDF8;">72.4m Setback</span>
            <span style="font-size:9px;color:#94A3B8;">50m SWD Clear</span>
          </div>
          <div class="pointer-line-left"></div>

          <div class="map-callout callout-right">
            <span style="color:#10B981;">Nil Encumbrance</span>
            <span style="font-size:9px;color:#94A3B8;">30-Yr Form 15 Clean</span>
          </div>
          <div class="pointer-line-right"></div>

          <!-- Exact Silhouette Map of Karnataka -->
          <img class="karnataka-map-img" src="data:image/png;base64,${mapBase64}" alt="State of Karnataka Map" />

          <div class="map-callout callout-bengaluru">
            <strong>KADUGODI SY 45/3A</strong>
            <span>2A 14G Clear Title</span>
          </div>
        </div>

        <!-- Feature 03.A: The Cleared Deliverable -->
        <div class="feature-item" style="margin-top: -2px;">
          <h3 class="feature-title"><span class="tag" style="color:#10B981;">03.A</span> Court-Admissible 52-Page Dossier</h3>
          <p class="feature-body">Complete legal opinion pre-approved for <strong>SBI, HDFC &amp; ICICI mortgages</strong> with dynamic QR code live live on-chain authentication.</p>
        </div>

        <!-- Feature 03.B: FATAL REJECTION CRITERIA (Why we say NO) -->
        <div class="rejection-mini-banner">
          <div class="rmb-title">
            <span>⚠ FATAL REJECTION ERRORS (WHY WE CANNOT TAKE A PROPERTY):</span>
          </div>
          <div class="rmb-desc">
            • <strong>Broken Title Lineage:</strong> Missing parent deed ➔ <em>Defective &amp; void title!</em><br>
            • <strong>SWD Buffer Encroachment:</strong> Inside 50m Rajakaluve ➔ <em>Demolition risk!</em><br>
            • <strong>PTCL Act Violation:</strong> SC/ST land sold without DC order ➔ <em>Govt repossession!</em><br>
            • <strong>Active Court Injunction:</strong> Undisclosed civil suit ➔ <em>Litigation &amp; financial loss!</em><br>
            <span style="color:#10B981; font-weight:800;">✓ Sy 45/3A passed all 4 fatal checks with ZERO red flags.</span>
          </div>
        </div>

      </div>

      <div class="col-footer">
        <span>DETERMINISTIC VERIFICATION · ZERO RED FLAGS</span>
        <span class="step-tag" style="color:#10B981;">03 ➔</span>
      </div>
    </div>

    <!-- ========================================================
         BOTTOM GLOBAL COMPANY BAR WITH ROLE BADGES
         ======================================================== -->
    <div class="company-global-bar">
      <div class="roles-summary">
        <span><strong>10 ROLES:</strong> CLIENT · ADMIN · OWNER · OPS · DATA STEWARD · ANALYST · LAWYER · GIS SPECIALIST · SUPPORT · SUPER ADMIN</span>
        <span class="sep">|</span>
        <span><strong>VERDICT:</strong> SAFE TO PURCHASE &amp; FINANCE (GRADE A+ / 98%)</span>
      </div>
      <div>
        <a href="https://www.ojix.com">WWW.OJIX.COM</a>
        <span class="sep">|</span>
        <span style="color:#94A3B8;">INFO@OJIX.IN</span>
      </div>
    </div>

  </div>

</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'OJIX_Frame440_Capabilities_Banner.html'), htmlContent);
console.log('HTML written to OJIX_Frame440_Capabilities_Banner.html');

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  }).catch(() => null);

  const finalBrowser = browser || await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }).catch(() => null);

  if (!finalBrowser) {
    console.error('Failed to launch browser');
    process.exit(1);
  }

  const page = await finalBrowser.newPage({
    viewport: { width: 1520, height: 1060 },
    deviceScaleFactor: 2
  });

  const htmlPath = path.join(rootDir, 'OJIX_Frame440_Capabilities_Banner.html');
  const fileUrl = 'file://' + htmlPath;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const locator = page.locator('.banner-frame');

  const targets = [
    path.join(rootDir, 'OJIX_Frame440_Capabilities_Banner.png'),
    path.join(rootDir, 'apps/web/public/assets/OJIX_Frame440_Capabilities_Banner.png'),
    '/Users/apple/.gemini/antigravity/brain/91df0320-217d-4e1b-a88a-779242cbdc49/OJIX_Frame440_Capabilities_Banner.png'
  ];

  for (const t of targets) {
    const dir = path.dirname(t);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await locator.screenshot({ path: t });
    console.log('Saved: ' + t);
  }

  console.log('SUCCESS: Frame 440 banner captured!');
  await finalBrowser.close();
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
