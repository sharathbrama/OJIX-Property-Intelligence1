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
  <title>OJIX Property Intelligence — Enterprise Marketing Infographic</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      /* Palette: White and Blue Multi-tone Enterprise System */
      --canvas-bg: #EDF3F9;
      --col-left-bg: #F4F8FC;
      --col-centre-bg: #FFFFFF;
      --col-right-bg: #F4F8FC;
      
      --card-white: #FFFFFF;
      --navy-deep: #0C1E34;
      --navy-header: #10243A;
      --navy-card: #132A45;
      --navy-text: #0E1F33;
      --navy-muted: #4B637D;
      
      --blue-accent: #0284C7;
      --blue-soft: #F0F7FF;
      --blue-border: #BAE6FD;
      
      --teal: #087E8B;
      --teal-soft: #E6F6F8;
      --teal-border: #A5E3E9;
      
      --emerald: #15966B;
      --emerald-soft: #ECFDF5;
      --emerald-border: #A7F3D0;
      
      --amber: #D97706;
      --amber-soft: #FFFBEB;
      --amber-border: #FDE68A;
      
      --orange: #FF5426;
      --orange-soft: #FFF1EE;
      --orange-border: #FFCCBF;
      
      --crimson: #DC2626;
      --crimson-soft: #FEF2F2;
      --crimson-border: #FECACA;
      
      --border-subtle: #D8E4EE;
      --border-card: #CBDDE9;
      --shadow-sm: 0 1px 3px rgba(16, 36, 58, 0.05);
      --shadow-card: 0 2px 6px rgba(16, 36, 58, 0.06), 0 1px 2px rgba(16, 36, 58, 0.04);
      --shadow-float: 0 6px 18px rgba(16, 36, 58, 0.08);
    }

    body {
      background-color: #DDE7F0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 12px;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: var(--navy-text);
    }

    /* MASTER INFOGRAPHIC CANVAS (1860 x 1140 PRESENTATION BROCHURE) */
    .infographic-canvas {
      width: 1860px;
      height: 1140px;
      background: var(--canvas-bg);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 80px rgba(16, 36, 58, 0.25), 0 0 0 1px rgba(16, 36, 58, 0.12);
      position: relative;
    }

    /* TOP GLOBAL HEADER (Deep Navy Executive Bar) */
    .global-header {
      height: 56px;
      background: var(--navy-deep);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      border-bottom: 2px solid var(--teal);
      color: #FFFFFF;
      z-index: 20;
    }

    .brand-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon-box {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, var(--orange) 0%, #D83B10 100%);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(255, 84, 38, 0.4);
    }
    .brand-icon-box svg { width: 18px; height: 18px; fill: #FFFFFF; }

    .brand-text h1 {
      font-size: 15.5px;
      font-weight: 900;
      letter-spacing: 0.02em;
      line-height: 1.1;
      display: flex;
      align-items: center;
      gap: 7px;
      color: #FFFFFF;
    }
    .brand-text h1 span.pill-tag {
      font-size: 7.5px;
      font-weight: 800;
      background: rgba(255, 84, 38, 0.25);
      color: #FFA588;
      border: 1px solid rgba(255, 84, 38, 0.5);
      padding: 1.5px 5px;
      border-radius: 3px;
      letter-spacing: 0.08em;
    }
    .brand-text p {
      font-size: 8.5px;
      color: #93B4D2;
      font-weight: 500;
      margin-top: 1px;
    }

    .header-center-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 700;
    }
    .h-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      padding: 3px 8px;
      border-radius: 14px;
      color: #E2EEF8;
    }
    .h-badge.live { color: #5EEAD4; border-color: rgba(94, 234, 212, 0.4); }
    .h-badge.amber { color: #FCD34D; border-color: rgba(252, 211, 77, 0.4); }

    .header-right-meta {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
    }
    .header-right-meta .v { font-size: 11.5px; font-weight: 800; color: #FFFFFF; }
    .header-right-meta .l { font-size: 7.5px; color: #93B4D2; text-transform: uppercase; letter-spacing: 0.08em; }

    /* ═══ 3-COLUMN EDITORIAL GRID ═══ */
    .infographic-body {
      flex: 1;
      display: grid;
      grid-template-columns: 460px 920px 480px;
      overflow: hidden;
      position: relative;
      z-index: 5;
    }

    .editorial-col {
      padding: 10px 14px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .col-left {
      background: var(--col-left-bg);
      border-right: 1.5px solid var(--border-subtle);
    }
    .col-centre {
      background: var(--col-centre-bg);
      border-right: 1.5px solid var(--border-subtle);
      padding: 9px 15px 8px;
    }
    .col-right {
      background: var(--col-right-bg);
    }

    /* COLUMN HEADER SECTION */
    .col-eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--blue-accent);
      margin-bottom: 1.5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .col-title {
      font-size: 18px;
      font-weight: 900;
      color: var(--navy-deep);
      letter-spacing: -0.02em;
      line-height: 1.05;
      text-transform: uppercase;
      margin-bottom: 1.5px;
    }
    .col-tagline {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      color: var(--orange);
      letter-spacing: 0.04em;
      margin-bottom: 2px;
    }
    .col-desc {
      font-size: 8.5px;
      line-height: 1.25;
      color: var(--navy-muted);
      margin-bottom: 6px;
    }

    /* ─── LEFT COLUMN COMPONENTS (White & Blue) ─── */
    .section-mini-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--teal);
      background: var(--teal-soft);
      border-left: 2.5px solid var(--teal);
      padding: 2px 6px;
      margin-bottom: 4px;
      border-radius: 0 3px 3px 0;
    }

    /* Hero Frame 440 Preview Dark Contrast Card */
    .hero-matter-card {
      background: linear-gradient(135deg, var(--navy-card) 0%, #0C1E34 100%);
      border: 1px solid rgba(8, 126, 139, 0.4);
      border-radius: 6px;
      padding: 7px 9px;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(16, 36, 58, 0.15);
      margin-bottom: 6px;
      position: relative;
    }
    .hm-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8px;
      font-weight: 800;
      color: var(--orange);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: flex;
      justify-content: space-between;
    }
    .hm-title {
      font-size: 11.5px;
      font-weight: 900;
      color: #FFFFFF;
      margin-top: 2px;
      line-height: 1.2;
    }
    .hm-items {
      display: flex;
      gap: 10px;
      margin-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 4px;
    }
    .hm-item {
      font-size: 7px;
      color: #B4CEE5;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .hm-item strong { color: #FFFFFF; }

    /* 10 Capabilities 2-Column Grid (Pure White Cards with Soft Slate Borders) */
    .capabilities-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5px;
      margin-bottom: 6px;
    }
    .cap-card {
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      padding: 4px 6px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      box-shadow: var(--shadow-sm);
    }
    .cap-card-top {
      display: flex;
      align-items: center;
      gap: 3.5px;
    }
    .cap-icon { font-size: 9px; line-height: 1; }
    .cap-name {
      font-size: 7.8px;
      font-weight: 800;
      color: var(--navy-deep);
      line-height: 1.15;
    }
    .cap-desc {
      font-size: 6.6px;
      color: var(--navy-muted);
      line-height: 1.2;
    }

    /* Business Value: Why OJIX */
    .why-ojix-card {
      background: var(--card-white);
      color: var(--navy-deep);
      border: 1px solid var(--teal-border);
      border-left: 3px solid var(--teal);
      border-radius: 5px;
      padding: 6px 8px;
      margin-bottom: 6px;
      box-shadow: var(--shadow-sm);
    }
    .why-ojix-header {
      font-size: 8.8px;
      font-weight: 900;
      color: var(--teal);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 3px;
    }
    .why-ojix-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.5px 5px;
    }
    .why-item {
      font-size: 7.2px;
      color: var(--navy-text);
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .why-bullet {
      color: var(--teal);
      font-weight: 900;
      font-size: 7.5px;
    }

    /* Target Clients */
    .clients-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3.5px;
    }
    .client-chip {
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      padding: 4px 2px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5px;
      box-shadow: var(--shadow-sm);
    }
    .client-icon { font-size: 10px; }
    .client-title {
      font-size: 6.5px;
      font-weight: 800;
      color: var(--navy-deep);
      line-height: 1.15;
    }

    /* ─── CENTRE COLUMN: COMPLETE 5-STAGE WORKFLOW (White & High Contrast Multi-Tone) ─── */
    .workflow-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex: 1;
    }

    .workflow-stage-card {
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      padding: 5px 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      box-shadow: var(--shadow-sm);
      position: relative;
    }
    .stage-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .stage-pill-box {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .stage-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8px;
      font-weight: 800;
      padding: 1.5px 4.5px;
      border-radius: 2px;
      color: #FFFFFF;
    }
    .bg-blue { background: var(--blue-accent); }
    .bg-amber { background: var(--amber); }
    .bg-orange { background: var(--orange); }
    .bg-navy { background: var(--navy-deep); }
    .bg-emerald { background: var(--emerald); }

    .stage-title-text {
      font-size: 8.8px;
      font-weight: 900;
      color: var(--navy-deep);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .stage-status-indicator {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8px;
      font-weight: 800;
      color: var(--blue-accent);
    }

    /* Stage 01: Intake Flow Items */
    .intake-pills-row {
      display: flex;
      align-items: center;
      gap: 3.5px;
    }
    .intake-pill {
      background: var(--amber-soft);
      border: 1px solid var(--amber-border);
      border-radius: 3px;
      padding: 2.5px 5px;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 3.5px;
      font-size: 7.2px;
      font-weight: 700;
      color: #78350F;
    }
    .intake-pill .dot { width: 4px; height: 4px; border-radius: 50%; background: var(--orange); }

    /* Stage 02: Govt Sources Row */
    .govt-mini-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3.5px;
    }
    .g-mini-card {
      background: var(--blue-soft);
      border: 1px solid var(--blue-border);
      border-radius: 3.5px;
      padding: 3.5px 4.5px;
    }
    .g-mini-name {
      font-size: 7.8px;
      font-weight: 900;
      color: var(--navy-deep);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .g-mini-desc {
      font-size: 6.5px;
      color: var(--navy-muted);
      line-height: 1.2;
      margin-top: 1px;
    }

    /* Stage 03: 10 Roles Grid (2 Rows x 5 Columns) - Multi-Color Cards! */
    .roles-10-wrapper {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 3px;
    }
    .role-card-spec {
      border-radius: 4px;
      padding: 3px 4px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      border: 1px solid transparent;
    }
    
    /* 10 Different Colors for 10 Roles! */
    .role-c1 { background: #EEF2FF; border-color: #C7D2FE; } /* Super Admin: Indigo */
    .role-c1 .rcs-name { color: #3730A3; }
    
    .role-c2 { background: #F1F5F9; border-color: #CBD5E1; } /* Owner: Slate/Navy */
    .role-c2 .rcs-name { color: #0F172A; }
    
    .role-c3 { background: #F0FDFA; border-color: #99F6E4; } /* Admin: Teal */
    .role-c3 .rcs-name { color: #0F766E; }
    
    .role-c4 { background: #FFF1F2; border-color: #FECDD3; } /* Lawyer: Rose/Crimson */
    .role-c4 .rcs-name { color: #BE123C; }
    
    .role-c5 { background: #F0F9FF; border-color: #BAE6FD; } /* Analyst: Sky Blue */
    .role-c5 .rcs-name { color: #0369A1; }
    
    .role-c6 { background: #FFFBEB; border-color: #FDE68A; } /* Operations: Amber */
    .role-c6 .rcs-name { color: #B45309; }
    
    .role-c7 { background: #F5F3FF; border-color: #DDD6FE; } /* Consultant: Violet */
    .role-c7 .rcs-name { color: #6D28D9; }
    
    .role-c8 { background: #ECFDF5; border-color: #A7F3D0; } /* Support: Emerald */
    .role-c8 .rcs-name { color: #047857; }
    
    .role-c9 { background: #EFF6FF; border-color: #BFDBFE; } /* Data Steward: Blue */
    .role-c9 .rcs-name { color: #1D4ED8; }
    
    .role-c10 { background: #F8FAFC; border-color: #E2E8F0; } /* Viewer: Grey */
    .role-c10 .rcs-name { color: #475569; }

    .rcs-top {
      display: flex;
      align-items: center;
      gap: 2.5px;
    }
    .rcs-icon { font-size: 7.5px; }
    .rcs-name {
      font-size: 7.2px;
      font-weight: 900;
      line-height: 1.1;
    }
    .rcs-desc {
      font-size: 6.2px;
      color: #475569;
      line-height: 1.2;
    }

    /* RBAC Access Matrix Table */
    .rbac-table-container {
      background: var(--blue-soft);
      border: 1px solid var(--blue-border);
      border-radius: 4px;
      padding: 2.5px 4.5px;
      margin-top: 1px;
    }
    .rbac-table-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.2px;
      font-weight: 800;
      color: var(--blue-accent);
      margin-bottom: 1.5px;
      display: flex;
      justify-content: space-between;
    }
    .rbac-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 5.8px;
      font-family: 'JetBrains Mono', monospace;
    }
    .rbac-table th, .rbac-table td {
      padding: 1px 1.5px;
      text-align: center;
      border: 0.5px solid #CBDDE9;
    }
    .rbac-table th {
      background: #D9EAF7;
      color: var(--navy-deep);
      font-weight: 800;
    }
    .rbac-table td.row-lbl {
      text-align: left;
      font-weight: 700;
      color: var(--navy-text);
      background: #FFFFFF;
      padding-left: 3px;
    }
    .rbac-table td.ok { color: #047857; font-weight: 900; background: #E6F8F0; }
    .rbac-table td.no { color: #94A3B8; }

    /* Stage 04: Analysis & Risk Grid */
    .analysis-checks-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3.5px;
    }
    .check-box {
      background: #F8FAFC;
      border: 1px solid var(--border-subtle);
      border-radius: 3.5px;
      padding: 3px 4.5px;
      font-size: 6.8px;
      color: var(--navy-deep);
      display: flex;
      align-items: center;
      gap: 3.5px;
      font-weight: 600;
    }
    .check-box .tick { color: var(--emerald); font-weight: 900; font-size: 7.5px; }

    /* Stage 05: Final Deliverable & 4 States */
    .stage5-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 5px;
    }
    .stage5-card-left {
      flex: 1;
      font-size: 7.2px;
      color: var(--navy-muted);
      line-height: 1.25;
    }
    .stage5-card-left strong { color: var(--navy-deep); }
    .status-states-group {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .state-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6px;
      font-weight: 800;
      padding: 1.5px 4px;
      border-radius: 2px;
      text-transform: uppercase;
    }
    .state-verified { background: var(--emerald-soft); color: #065F46; border: 1px solid var(--emerald); }
    .state-pending { background: var(--amber-soft); color: #92400E; border: 1px solid var(--amber); }
    .state-rejected { background: var(--crimson-soft); color: #991B1B; border: 1px solid var(--crimson); }
    .state-risk { background: #7F1D1D; color: #FEE2E2; border: 1px solid #991B1B; }

    /* ─── DEDICATED SECTION 4: GOVERNMENT WEBSITES WITH BROWSER SCREENSHOTS ─── */
    .govt-section-box {
      background: #FFFFFF;
      border: 1px solid var(--border-card);
      border-radius: 5px;
      padding: 5px 7px;
      box-shadow: var(--shadow-sm);
    }
    .govt-section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 800;
      color: var(--navy-deep);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    /* 8 Miniature Browser Screenshots Grid (4 cols x 2 rows) */
    .portal-screenshots-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 3.5px;
    }
    
    .browser-mockup-card {
      background: #FFFFFF;
      border: 1px solid #CBDDE9;
      border-radius: 3.5px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(16, 36, 58, 0.08);
    }
    
    .browser-titlebar {
      height: 14px;
      background: #EAF0F6;
      border-bottom: 0.5px solid #CBDDE9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4.5px;
    }
    .b-dots { display: flex; gap: 2px; }
    .b-dot { width: 4px; height: 4px; border-radius: 50%; }
    .b-dot.r { background: #EF4444; } .b-dot.y { background: #F59E0B; } .b-dot.g { background: #10B981; }
    
    .b-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.2px;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 1.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 110px;
    }
    .b-url .lock { color: #059669; font-size: 5px; }
    
    .b-status-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.2px;
      font-weight: 800;
      padding: 0.5px 2.5px;
      border-radius: 2px;
      text-transform: uppercase;
    }
    .b-live { background: #ECFDF5; color: #065F46; border: 0.5px solid #10B981; }
    .b-manual { background: #FFFBEB; color: #92400E; border: 0.5px solid #F59E0B; }
    .b-planned { background: #EEF2FF; color: #3730A3; border: 0.5px solid #6366F1; }

    /* Portal Screen Inside Browser */
    .portal-screen-content {
      padding: 3.5px 4.5px;
      display: flex;
      flex-direction: column;
      gap: 1.5px;
      background: #F8FAFD;
      min-height: 44px;
      justify-content: space-between;
    }
    .psc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .psc-title {
      font-size: 6.8px;
      font-weight: 800;
      color: var(--navy-deep);
    }
    .psc-badge {
      font-size: 5.5px;
      font-family: 'JetBrains Mono', monospace;
      color: #0369A1;
      background: #E0F2FE;
      padding: 0.5px 2px;
      border-radius: 2px;
    }
    .psc-desc {
      font-size: 5.8px;
      color: var(--navy-muted);
      line-height: 1.2;
    }
    
    /* Authentic Data Mock Table Inside Screenshot */
    .psc-mock-table {
      background: #FFFFFF;
      border: 0.5px solid #D8E4EE;
      border-radius: 2px;
      padding: 1.5px 2.5px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.2px;
      color: #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .psc-mock-table strong { color: var(--navy-deep); }
    .psc-mock-table .val-ok { color: #047857; font-weight: 800; }
    .psc-mock-table .val-warn { color: #B45309; font-weight: 800; }

    /* ─── RIGHT COLUMN: ROOTED IN KARNATAKA & ECOSYSTEM (White & Blue) ─── */
    .hc-photo-card {
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 6px;
      box-shadow: var(--shadow-sm);
    }
    .hc-photo-wrap {
      width: 100%;
      height: 95px;
      position: relative;
      overflow: hidden;
      background: #E2E8F0;
    }
    .hc-photo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .hc-photo-caption {
      padding: 4px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #FFFFFF;
    }
    .hc-caption-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8px;
      font-weight: 800;
      color: var(--navy-deep);
    }
    .hc-caption-sub {
      font-size: 6.2px;
      color: var(--navy-muted);
    }

    /* Karnataka Map Card */
    .map-presentation-box {
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      margin-bottom: 6px;
      box-shadow: var(--shadow-sm);
    }
    .map-img-frame {
      width: 140px;
      height: 145px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .map-img-frame img {
      height: 140px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 4px 10px rgba(16, 36, 58, 0.15));
    }
    .map-details-side {
      flex: 1;
      padding-left: 8px;
      display: flex;
      flex-direction: column;
      gap: 3.5px;
    }
    .map-geo-callout {
      background: #F8FAFD;
      border: 1px solid var(--border-subtle);
      border-radius: 3.5px;
      padding: 2.5px 5px;
    }
    .mgc-title {
      font-size: 7.2px;
      font-weight: 800;
      color: var(--blue-accent);
      display: flex;
      align-items: center;
      gap: 2.5px;
    }
    .mgc-desc {
      font-size: 6.5px;
      color: var(--navy-muted);
      line-height: 1.2;
    }

    /* Karnataka Property Record Ecosystem & Coverage */
    .coverage-card {
      background: var(--card-white);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      padding: 5px 7px;
      margin-bottom: 6px;
      display: flex;
      flex-direction: column;
      gap: 2.5px;
      box-shadow: var(--shadow-sm);
    }
    .coverage-title {
      font-size: 7.8px;
      font-weight: 800;
      color: var(--teal);
      display: flex;
      align-items: center;
      gap: 3.5px;
    }
    .coverage-body {
      font-size: 6.8px;
      color: var(--navy-text);
      line-height: 1.3;
    }
    .coverage-body strong { color: var(--navy-deep); }

    /* Final CTA Section */
    .cta-container {
      background: linear-gradient(135deg, var(--navy-deep) 0%, #17375E 100%);
      border: 1px solid rgba(8, 126, 139, 0.4);
      border-radius: 5px;
      padding: 8px 10px;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      gap: 3px;
      box-shadow: 0 4px 14px rgba(16, 36, 58, 0.2);
      margin-top: auto;
    }
    .cta-eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #5EEAD4;
      text-transform: uppercase;
    }
    .cta-headline {
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #FFFFFF;
      line-height: 1.15;
    }
    .cta-subtext {
      font-size: 6.8px;
      color: #B4CEE5;
      line-height: 1.25;
    }
    .cta-button-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 3px;
    }
    .cta-btn {
      background: linear-gradient(135deg, var(--orange) 0%, #E04015 100%);
      color: #FFFFFF;
      font-weight: 800;
      font-size: 7.5px;
      padding: 3.5px 10px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 4px;
      text-decoration: none;
      box-shadow: 0 2px 6px rgba(255, 84, 38, 0.4);
    }
    .cta-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.2px;
      color: #E2EEF8;
      font-weight: 700;
    }

    /* ═══ MASTER BOTTOM FOOTER ═══ */
    .global-footer {
      height: 38px;
      background: var(--navy-deep);
      border-top: 1.5px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.2px;
      color: #93B4D2;
      z-index: 20;
    }
    .footer-left { display: flex; align-items: center; gap: 6px; }
    .footer-left strong { color: #FFFFFF; }
    .footer-center { color: #B4CEE5; }
    .footer-right { color: #E2EEF8; }
  </style>
</head>
<body>

  <div class="infographic-canvas">
    
    <!-- TOP HEADER -->
    <header class="global-header">
      <div class="brand-cluster">
        <div class="brand-icon-box">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div class="brand-text">
          <h1>OJIX PROPERTY INTELLIGENCE <span class="pill-tag">KARNATAKA</span></h1>
          <p>Deterministic Property Due-Diligence & Legal Assurance Platform</p>
        </div>
      </div>

      <div class="header-center-badges">
        <div class="h-badge"><span style="color:#FF5426;">●</span> 100% EVIDENCE-FIRST AUDIT</div>
        <div class="h-badge live"><span>⚡</span> 4 STATE REGISTRIES CONNECTED</div>
        <div class="h-badge amber"><span>⚖</span> 10-ROLE CONSENSUS PROTOCOL</div>
      </div>

      <div class="header-right-meta">
        <div class="v">48-HOUR SLA</div>
        <div class="l">COURT-ADMISSIBLE DOSSIER</div>
      </div>
    </header>

    <!-- 3-COLUMN EDITORIAL BODY -->
    <main class="infographic-body">

      <!-- ═════════ COLUMN 1: PRODUCT OVERVIEW & CAPABILITIES ═════════ -->
      <section class="editorial-col col-left">
        <div>
          <div class="col-eyebrow">01 / PLATFORM CAPABILITIES</div>
          <h2 class="col-title">PROPERTY DUE-DILIGENCE INTELLIGENCE</h2>
          <div class="col-tagline">Verify. Analyse. De-Risk. Decide.</div>
          <p class="col-desc">OJIX is Karnataka's premier enterprise workspace for land scrutiny, legal title verification, and statutory property due-diligence.</p>
        </div>

        <!-- Hero Dark Contrast Card (Frame 440 NYAYA SETHU style) -->
        <div class="hero-matter-card">
          <div class="hm-tag">
            <span>MATTER WORKSPACE • LIVE</span>
            <span style="color:#5EEAD4;">#KA-BLR-2024-8841</span>
          </div>
          <div class="hm-title">The matter. The whole picture.</div>
          <div class="hm-items">
            <div class="hm-item"><span>📁</span> <strong>42</strong> Deeds</div>
            <div class="hm-item"><span>⚡</span> <strong>4</strong> Portals Live</div>
            <div class="hm-item"><span>👥</span> <strong>10</strong> Sign-offs</div>
            <div class="hm-item"><span>🛡</span> <strong>Grade A+</strong> Title</div>
          </div>
        </div>

        <div>
          <div class="section-mini-label">CORE PRODUCT WORKSPACES & MODULES</div>
          <div class="capabilities-grid">
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">📁</span><span class="cap-name">Case & Matter Mgmt</span></div>
              <div class="cap-desc">Centralised matter dossier with automated timeline & ownership tracker.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">📄</span><span class="cap-name">Document & Evidence</span></div>
              <div class="cap-desc">Cryptographic SHA-256 chain-of-custody for parent deeds & extracts.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">👁</span><span class="cap-name">OCR & Intelligence</span></div>
              <div class="cap-desc">Bilingual Kannada-English extraction of RTC, Tippani, & mutation data.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">🔍</span><span class="cap-name">Risk & Encumbrance</span></div>
              <div class="cap-desc">Automated Form 15 EC deep-scan across 30-year sub-registrar books.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">🗺</span><span class="cap-name">GIS & Location Screener</span></div>
              <div class="cap-desc">PostGIS cadastral overlay matching FMB survey sketch with buffer zones.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">🏛</span><span class="cap-name">Govt Records Verification</span></div>
              <div class="cap-desc">Real-time matching against Kaveri, Bhoomi, Mojini, & Revenue registries.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">⛓</span><span class="cap-name">Title History Analysis</span></div>
              <div class="cap-desc">DAG graph solver resolving breaks in unbroken 30-year grant lineage.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">⚖</span><span class="cap-name">Legal Review & Approval</span></div>
              <div class="cap-desc">Structured advocate review protocol enforcing PTCL & Section 79A/B vetting.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">⏱</span><span class="cap-name">Audit Trail & Tracking</span></div>
              <div class="cap-desc">Immutable append-only activity log for every document touchpoint.</div>
            </div>
            <div class="cap-card">
              <div class="cap-card-top"><span class="cap-icon">📑</span><span class="cap-name">Due-Diligence Reports</span></div>
              <div class="cap-desc">Court-admissible 52-page certified executive title search dossier.</div>
            </div>
          </div>
        </div>

        <!-- Business Value: Why OJIX -->
        <div class="why-ojix-card">
          <div class="why-ojix-header"><span>★</span> WHY ENTERPRISE CHOOSES OJIX</div>
          <div class="why-ojix-grid">
            <div class="why-item"><span class="why-bullet">✔</span> Evidence-first verification</div>
            <div class="why-item"><span class="why-bullet">✔</span> Structured 10-role review</div>
            <div class="why-item"><span class="why-bullet">✔</span> Bilingual Kannada-English OCR</div>
            <div class="why-item"><span class="why-bullet">✔</span> Transparent risk assessment</div>
            <div class="why-item"><span class="why-bullet">✔</span> Traceable review history</div>
            <div class="why-item"><span class="why-bullet">✔</span> Centralised property intelligence</div>
          </div>
        </div>

        <!-- Target Clients -->
        <div>
          <div class="section-mini-label">SERVING PROPERTY STAKEHOLDERS</div>
          <div class="clients-row">
            <div class="client-chip"><span class="client-icon">🏢</span><span class="client-title">Buyers & Investors</span></div>
            <div class="client-chip"><span class="client-icon">🏗</span><span class="client-title">RE Developers</span></div>
            <div class="client-chip"><span class="client-icon">⚖</span><span class="client-title">Law Firms</span></div>
            <div class="client-chip"><span class="client-icon">🏦</span><span class="client-title">Banks & NBFCs</span></div>
            <div class="client-chip"><span class="client-icon">🏛</span><span class="client-title">Family Offices</span></div>
          </div>
        </div>
      </section>

      <!-- ═════════ COLUMN 2: COMPLETE 5-STAGE WORKFLOW & GOVT PORTALS ═════════ -->
      <section class="editorial-col col-centre">
        <div>
          <div class="col-eyebrow">02 / END-TO-END VERIFICATION PIPELINE</div>
          <h2 class="col-title" style="color:#0C1E34;">THE PROPERTY INTELLIGENCE WORKFLOW</h2>
          <div class="col-tagline" style="color:var(--teal);">From Intake to State Portals, 10-Role Vetting, and Final Dossier</div>
        </div>

        <div class="workflow-container">
          
          <!-- STAGE 01: BUYER INTAKE -->
          <div class="workflow-stage-card" style="border-left: 3px solid var(--orange);">
            <div class="stage-hdr">
              <div class="stage-pill-box">
                <span class="stage-tag bg-orange">STAGE 01</span>
                <span class="stage-title-text">BUYER INTAKE & CASE INITIALISATION</span>
              </div>
              <span class="stage-status-indicator" style="color:var(--orange);">CLIENT SUBMISSION</span>
            </div>
            <div class="intake-pills-row">
              <div class="intake-pill"><span class="dot"></span>Property Identification (Sy No. 45/3A, Kadugodi)</div>
              <div class="intake-pill"><span class="dot"></span>Buyer KYC & Mandate Dossier</div>
              <div class="intake-pill"><span class="dot"></span>Parent Deeds & RTC Extracts</div>
              <div class="intake-pill"><span class="dot"></span>Case Created (#KA-BLR-8841)</div>
            </div>
          </div>

          <!-- STAGE 02: LIVE GOVERNMENT VERIFICATION -->
          <div class="workflow-stage-card" style="border-left: 3px solid var(--blue-accent);">
            <div class="stage-hdr">
              <div class="stage-pill-box">
                <span class="stage-tag bg-blue">STAGE 02</span>
                <span class="stage-title-text">GOVERNMENT RECORDS CROSS-VERIFICATION</span>
              </div>
              <span class="stage-status-indicator">OFFICIAL REPOSITORIES</span>
            </div>
            <div class="govt-mini-cards">
              <div class="g-mini-card">
                <div class="g-mini-name"><span>Kaveri Online</span><span style="color:#059669;">● LIVE</span></div>
                <div class="g-mini-desc">Sub-Registrar Deeds, Index-II, Form 15 Encumbrance Certificate.</div>
              </div>
              <div class="g-mini-card">
                <div class="g-mini-name"><span>Bhoomi Portal</span><span style="color:#059669;">● LIVE</span></div>
                <div class="g-mini-desc">Record of Rights (RTC Pahani), Mutation Register, Khata status.</div>
              </div>
              <div class="g-mini-card">
                <div class="g-mini-name"><span>Mojini Cadastral</span><span style="color:#059669;">● LIVE</span></div>
                <div class="g-mini-desc">Survey & Settlement 11E sketch, Tippani, Village Map boundaries.</div>
              </div>
              <div class="g-mini-card">
                <div class="g-mini-name"><span>Revenue Dept</span><span style="color:#D97706;">● MANUAL</span></div>
                <div class="g-mini-desc">PTCL Act verification, Inam grants, Section 79A/B clearance records.</div>
              </div>
            </div>
          </div>

          <!-- STAGE 03: 10-ROLE CROSS-VERIFICATION -->
          <div class="workflow-stage-card" style="border-left: 3px solid var(--navy-deep);">
            <div class="stage-hdr">
              <div class="stage-pill-box">
                <span class="stage-tag bg-navy">STAGE 03</span>
                <span class="stage-title-text">10-ROLE MULTI-DISCIPLINARY CONSENSUS PROTOCOL</span>
              </div>
              <span class="stage-status-indicator" style="color:var(--navy-deep);">10/10 AUDITED SIGN-OFF</span>
            </div>
            <div class="roles-10-wrapper">
              <div class="role-card-spec role-c1">
                <div class="rcs-top"><span class="rcs-icon">🛡</span><span class="rcs-name">Super Admin</span></div>
                <div class="rcs-desc">Platform security & governance</div>
              </div>
              <div class="role-card-spec role-c2">
                <div class="rcs-top"><span class="rcs-icon">👑</span><span class="rcs-name">Owner</span></div>
                <div class="rcs-desc">Workspace control & legal releases</div>
              </div>
              <div class="role-card-spec role-c3">
                <div class="rcs-top"><span class="rcs-icon">⚙</span><span class="rcs-name">Admin</span></div>
                <div class="rcs-desc">Team roles & audit compliance</div>
              </div>
              <div class="role-card-spec role-c4">
                <div class="rcs-top"><span class="rcs-icon">⚖</span><span class="rcs-name">Lawyer</span></div>
                <div class="rcs-desc">Title scrutiny & statutory vetting</div>
              </div>
              <div class="role-card-spec role-c5">
                <div class="rcs-top"><span class="rcs-icon">📊</span><span class="rcs-name">Analyst</span></div>
                <div class="rcs-desc">OCR entity parsing & DAG link</div>
              </div>
              <div class="role-card-spec role-c6">
                <div class="rcs-top"><span class="rcs-icon">🔄</span><span class="rcs-name">Operations</span></div>
                <div class="rcs-desc">Case dispatch & registry pull</div>
              </div>
              <div class="role-card-spec role-c7">
                <div class="rcs-top"><span class="rcs-icon">💡</span><span class="rcs-name">Consultant</span></div>
                <div class="rcs-desc">Zoning, Master Plan & RERA check</div>
              </div>
              <div class="role-card-spec role-c8">
                <div class="rcs-top"><span class="rcs-icon">🎧</span><span class="rcs-name">Support</span></div>
                <div class="rcs-desc">Client queries & missing doc SLA</div>
              </div>
              <div class="role-card-spec role-c9">
                <div class="rcs-top"><span class="rcs-icon">🗺</span><span class="rcs-name">Data Steward</span></div>
                <div class="rcs-desc">GIS vector layer & boundary QA</div>
              </div>
              <div class="role-card-spec role-c10">
                <div class="rcs-top"><span class="rcs-icon">👁</span><span class="rcs-name">Viewer</span></div>
                <div class="rcs-desc">Read-only buyer dossier access</div>
              </div>
            </div>

            <!-- Real RBAC Access Matrix Table -->
            <div class="rbac-table-container">
              <div class="rbac-table-title">
                <span>PRODUCTION ROLE-BASED ACCESS CONTROL (RBAC) MATRIX — apps/api/src/rbac.ts</span>
                <span>AUTHENTIC SYSTEM PRIVILEGES</span>
              </div>
              <table class="rbac-table">
                <thead>
                  <tr>
                    <th style="width:22%;">Permission Key</th>
                    <th>Super Admin</th>
                    <th>Owner</th>
                    <th>Admin</th>
                    <th>Lawyer</th>
                    <th>Analyst</th>
                    <th>Ops</th>
                    <th>Consult</th>
                    <th>Support</th>
                    <th>Steward</th>
                    <th>Viewer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="row-lbl">cases:read / docs:view</td>
                    <td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td>
                  </tr>
                  <tr>
                    <td class="row-lbl">cases:create / docs:upload</td>
                    <td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="no">―</td><td class="ok">✓</td><td class="ok">✓</td><td class="no">―</td>
                  </tr>
                  <tr>
                    <td class="row-lbl">gov:fetch (Kaveri/Bhoomi)</td>
                    <td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="no">―</td><td class="no">―</td><td class="ok">✓</td><td class="no">―</td>
                  </tr>
                  <tr>
                    <td class="row-lbl">legal:review / title:approve</td>
                    <td class="ok">✓</td><td class="ok">✓</td><td class="no">―</td><td class="ok">✓</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td>
                  </tr>
                  <tr>
                    <td class="row-lbl">admin:workspace / billing</td>
                    <td class="ok">✓</td><td class="ok">✓</td><td class="ok">✓</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td><td class="no">―</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- STAGE 04: ANALYSIS & RISK ASSESSMENT -->
          <div class="workflow-stage-card" style="border-left: 3px solid var(--amber);">
            <div class="stage-hdr">
              <div class="stage-pill-box">
                <span class="stage-tag bg-amber">STAGE 04</span>
                <span class="stage-title-text">MULTI-FACTOR RISK & COMPLIANCE ASSESSMENT</span>
              </div>
              <span class="stage-status-indicator" style="color:var(--amber);">DE-RISK ENGINE</span>
            </div>
            <div class="analysis-checks-grid">
              <div class="check-box"><span class="tick">✔</span> 30-Year Unbroken Title DAG Lineage</div>
              <div class="check-box"><span class="tick">✔</span> Nil Encumbrance Form 15 Verified</div>
              <div class="check-box"><span class="tick">✔</span> High Court & District Litigation Scrubbed</div>
              <div class="check-box"><span class="tick">✔</span> Rajakaluve / Lake 50m SWD Buffer Clear</div>
              <div class="check-box"><span class="tick">✔</span> PTCL Act & Sec 79A/B Land Re-grant Safe</div>
              <div class="check-box"><span class="tick">✔</span> Mojini 11E Cadastral Boundary Matched</div>
            </div>
          </div>

          <!-- STAGE 05: FINAL RESULT & CERTIFIED REPORT -->
          <div class="workflow-stage-card" style="border-left: 3px solid var(--emerald); background: #FAFDFB;">
            <div class="stage-hdr">
              <div class="stage-pill-box">
                <span class="stage-tag bg-emerald">STAGE 05</span>
                <span class="stage-title-text">FINAL RESULT & CERTIFIED DUE-DILIGENCE DOSSIER</span>
              </div>
              <div class="status-states-group">
                <span class="state-badge state-verified">✓ VERIFIED (98/100)</span>
                <span class="state-badge state-pending">⏳ PENDING</span>
                <span class="state-badge state-rejected">✕ REJECTED</span>
                <span class="state-badge state-risk">⚠ CRITICAL RISK</span>
              </div>
            </div>
            <div class="stage5-row">
              <div class="stage5-card-left">
                <strong>Executive Clearance:</strong> Sy No. 45/3A Kadugodi is declared <strong>SAFE TO PURCHASE</strong> with full statutory lineage, bank-admissible encumbrance clearance, and clean GIS coordinates.
              </div>
              <div style="font-family:'JetBrains Mono',monospace; font-size:6.5px; color:#047857; font-weight:800; background:#E6F8F0; border:1px solid #A7F3D0; padding:2px 6px; border-radius:3px;">
                SHA-256: d9e8f17a...38ac | 52-PAGE DOSSIER READY
              </div>
            </div>
          </div>

          <!-- DEDICATED SECTION 4: GOVERNMENT WEBSITES (8 MINIATURE BROWSER WINDOW SCREENSHOTS) -->
          <div class="govt-section-box">
            <div class="govt-section-title">
              <span>GOVERNMENT WEBSITES & DATA SOURCES — KARNATAKA REPOSITORIES</span>
              <span style="font-size:6.5px; color:var(--teal);">ACTUAL INTEGRATION & VERIFICATION CHROME</span>
            </div>
            
            <div class="portal-screenshots-grid">
              
              <!-- 1. Kaveri -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> kaveri.karnataka.gov.in</div>
                  <div class="b-status-tag b-live">LIVE API</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">Kaveri Online Services</span><span class="psc-badge">Deed Registry</span></div>
                  <div class="psc-desc">Sub-Registrar deed indexation, certified sale deeds, and Form 15 Encumbrance Certificate.</div>
                  <div class="psc-mock-table"><span>EC #4582/2024</span><span class="val-ok">● NIL ENCUMBRANCE</span></div>
                </div>
              </div>

              <!-- 2. Bhoomi -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> landrecords.karnataka.gov.in/bhoomi</div>
                  <div class="b-status-tag b-live">LIVE API</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">Bhoomi RTC & Mutation</span><span class="psc-badge">Land Records</span></div>
                  <div class="psc-desc">RTC Pahani, tenancy, soil classification, mutation extracts, and computerized RTC.</div>
                  <div class="psc-mock-table"><span>Khata: Ramesh Rao</span><span class="val-ok">● RTC 2A: 14G (0.37)</span></div>
                </div>
              </div>

              <!-- 3. Mojini -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> mojini.karnataka.gov.in</div>
                  <div class="b-status-tag b-live">LIVE API</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">Mojini Survey & Settlement</span><span class="psc-badge">Cadastral Maps</span></div>
                  <div class="psc-desc">Pre-mutation sketch (11E), Village map boundaries, Tippani, and FMB vector records.</div>
                  <div class="psc-mock-table"><span>Sketch 11E #714/23</span><span class="val-ok">● BOUNDARIES MATCH</span></div>
                </div>
              </div>

              <!-- 4. Revenue Dept -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> revenue.karnataka.gov.in</div>
                  <div class="b-status-tag b-manual">MANUAL VETTING</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">Karnataka Revenue Dept</span><span class="psc-badge">Statutory Books</span></div>
                  <div class="psc-desc">Tahsildar orders, PTCL Act restriction lists, Inam grant validation, and Section 79A/B.</div>
                  <div class="psc-mock-table"><span>PTCL Grant Registry</span><span class="val-ok">● NO ENCROACHMENT</span></div>
                </div>
              </div>

              <!-- 5. High Court -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> karnatakahiqh.gov.in/casestatus</div>
                  <div class="b-status-tag b-manual">MANUAL VETTING</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">Karnataka High Court</span><span class="psc-badge">Litigation Search</span></div>
                  <div class="psc-desc">Scrutiny of principal bench (Bengaluru), Dharwad, and Kalaburagi bench writ petitions.</div>
                  <div class="psc-mock-table"><span>Writ Registry Search</span><span class="val-ok">● ZERO ACTIVE STAYS</span></div>
                </div>
              </div>

              <!-- 6. e-Sampada -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> esampada.karnataka.gov.in</div>
                  <div class="b-status-tag b-planned">PLANNED Q1</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">e-Sampada</span><span class="psc-badge">Public Estates</span></div>
                  <div class="psc-desc">Government estates registry, public land allotment, and institutional lease clearance.</div>
                  <div class="psc-mock-table"><span>Allotment Check</span><span class="val-ok">● PRIVATE FREEHOLD</span></div>
                </div>
              </div>

              <!-- 7. e-Courts -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> services.ecourts.gov.in/ecourtindia</div>
                  <div class="b-status-tag b-planned">PLANNED Q1</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">e-Courts National Portal</span><span class="psc-badge">District Courts</span></div>
                  <div class="psc-desc">CNR number-based civil suits, original suits (O.S.), execution petitions across taluks.</div>
                  <div class="psc-mock-table"><span>Bengaluru Rural Dist</span><span class="val-ok">● NO LIS PENDENS</span></div>
                </div>
              </div>

              <!-- 8. KSRSAC / GIS -->
              <div class="browser-mockup-card">
                <div class="browser-titlebar">
                  <div class="b-dots"><span class="b-dot r"></span><span class="b-dot y"></span><span class="b-dot g"></span></div>
                  <div class="b-url"><span class="lock">🔒</span> ksrsac.karnataka.gov.in/gis</div>
                  <div class="b-status-tag b-planned">PLANNED Q2</div>
                </div>
                <div class="portal-screen-content">
                  <div class="psc-header"><span class="psc-title">KSRSAC Remote Sensing</span><span class="psc-badge">Spatial Geodata</span></div>
                  <div class="psc-desc">State remote sensing satellite layers, forest buffers, water body, and SWD nalas.</div>
                  <div class="psc-mock-table"><span>SWD Buffer (Rajakaluve)</span><span class="val-ok">● CLEAR (&gt;50m)</span></div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      <!-- ═════════ COLUMN 3: ROOTED IN KARNATAKA & ECOSYSTEM ═════════ -->
      <section class="editorial-col col-right">
        <div>
          <div class="col-eyebrow">03 / THE LEGAL LANDSCAPE</div>
          <h2 class="col-title">ROOTED IN KARNATAKA.</h2>
          <div class="col-tagline">Built for Karnataka's Legal & Property Ecosystem</div>
          <p class="col-desc">Engineered specifically for Karnataka's complex land administration, sub-registrar circles, revenue taluks, and state high court precedents.</p>
        </div>

        <!-- High Court Architectural Photo Card -->
        <div class="hc-photo-card">
          <div class="hc-photo-wrap">
            <img src="data:image/png;base64,${highCourtBase64}" alt="Karnataka High Court - Bengaluru" />
          </div>
          <div class="hc-photo-caption">
            <div>
              <div class="hc-caption-text">KARNATAKA HIGH COURT • ATTARA KACHERI</div>
              <div class="hc-caption-sub">Bengaluru Principal Bench • Statutory Jurisprudence</div>
            </div>
            <span style="font-size:7px; color:#047857; font-weight:800; background:#ECFDF5; padding:1.5px 5px; border-radius:3px;">HC VERIFIED</span>
          </div>
        </div>

        <!-- Karnataka Map Illustration Presentation Box -->
        <div class="map-presentation-box">
          <div class="map-img-frame">
            <img src="data:image/png;base64,${mapBase64}" alt="Karnataka State Map" />
          </div>
          <div class="map-details-side">
            <div class="map-geo-callout">
              <div class="mgc-title"><span>📍</span> BENGALURU URBAN & RURAL</div>
              <div class="mgc-desc">K.R. Puram, Bengaluru South, Anekal, Devanahalli, Yelahanka sub-registrar taluks.</div>
            </div>
            <div class="map-geo-callout">
              <div class="mgc-title"><span>📍</span> MYSURU METROPOLITAN</div>
              <div class="mgc-desc">Mysuru Urban, Nanjangud, Hunsur, MUDA layout title scrutiny & revenue verification.</div>
            </div>
            <div class="map-geo-callout">
              <div class="mgc-title"><span>📍</span> MANDYA & OLD MYSORE</div>
              <div class="mgc-desc">Srirangapatna, Maddur, Pandavapura agricultural & converted commercial parcels.</div>
            </div>
          </div>
        </div>

        <!-- Karnataka Property Record Ecosystem & Coverage -->
        <div class="coverage-card">
          <div class="coverage-title"><span>🌐</span> KARNATAKA ADMINISTRATIVE DATA COVERAGE</div>
          <div class="coverage-body">
            <strong>Tier 1 Coverage (Full Automation):</strong> Bengaluru Urban, Bengaluru Rural, Ramanagara, Mysuru. Live Kaveri & Bhoomi scraping.<br>
            <strong>Tier 2 Coverage (Hybrid Scrutiny):</strong> Mandya, Tumakuru, Kolar, Chikkaballapura, Hassan, Mangaluru.<br>
            <strong>Bilingual Language AI:</strong> Scans Kannada Modi script, archaic revenue Kannada, and English deeds seamlessly.
          </div>
        </div>

        <!-- Final Call to Action -->
        <div class="cta-container">
          <div class="cta-eyebrow">ENTERPRISE PROPERTY ASSURANCE</div>
          <div class="cta-headline">DISCOVER PROPERTY INTELLIGENCE WITH OJIX</div>
          <div class="cta-subtext">Eliminate land disputes, encumbrances, and litigation risks with Karnataka's deterministic due-diligence workspace.</div>
          <div class="cta-button-row">
            <a href="https://www.ojix.com" class="cta-btn">
              <span>Request a Demo</span>
              <span style="font-size:8px;">➔</span>
            </a>
            <div class="cta-url">www.ojix.com • contact@ojix.com</div>
          </div>
        </div>
      </section>

    </main>

    <!-- MASTER BOTTOM FOOTER -->
    <footer class="global-footer">
      <div class="footer-left">
        <strong>OJIX INTELLIGENCE</strong> | 10-Role Multi-Disciplinary Consensus • Sub-Meter PostGIS Cadastral Screener
      </div>
      <div class="footer-center">
        Karnataka-First • Bilingual Kannada-English AI • 4 Govt Registries Connected • Court-Admissible Guarantee
      </div>
      <div class="footer-right">
        www.ojix.com • info@ojix.com
      </div>
    </footer>

  </div>

</body>
</html>`;

const htmlFilePath = path.join(rootDir, 'OJIX_Marketing_Infographic_Triptych.html');
fs.writeFileSync(htmlFilePath, htmlContent);
console.log('HTML written to ' + htmlFilePath);

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2,
  });

  await page.goto('file://' + htmlFilePath, { waitUntil: 'networkidle' });

  const canvas = await page.$('.infographic-canvas');
  if (canvas) {
    const pngBuffer = await canvas.screenshot();

    const outPath1 = path.join(rootDir, 'OJIX_Marketing_Infographic_Triptych.png');
    const outPath2 = path.join(rootDir, 'apps/web/public/assets/OJIX_Marketing_Infographic_Triptych.png');
    const outPath3 = '/Users/apple/.gemini/antigravity/brain/91df0320-217d-4e1b-a88a-779242cbdc49/OJIX_Marketing_Infographic_Triptych.png';

    fs.writeFileSync(outPath1, pngBuffer);
    console.log('Saved: ' + outPath1);

    if (fs.existsSync(path.dirname(outPath2))) {
      fs.writeFileSync(outPath2, pngBuffer);
      console.log('Saved: ' + outPath2);
    }

    fs.writeFileSync(outPath3, pngBuffer);
    console.log('Saved: ' + outPath3);
  } else {
    console.error('Canvas element not found!');
  }

  await browser.close();
  console.log('SUCCESS: Marketing infographic captured!');
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
