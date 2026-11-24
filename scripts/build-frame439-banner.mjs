import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';
const htmlOutputPath = path.join(rootDir, 'OJIX_Frame439_Marketing_Banner.html');
const pngOutputPath = path.join(rootDir, 'OJIX_Frame439_Marketing_Banner.png');
const brainPngPath = '/Users/apple/.gemini/antigravity/brain/1b1edc11-6919-489b-9930-57ba842108d0/OJIX_Frame439_Marketing_Banner.png';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nyaya Sethu by OJIX — Frame 439 Marketing Banner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,800&family=JetBrains+Mono:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #14171F;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Figma Frame Canvas Header */
    .frame-tag {
      width: 1440px;
      padding: 0 0 12px 4px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #64748B;
      letter-spacing: 0.04em;
    }

    /* MASTER BANNER CONTAINER (1440 x 960 px - EXACT 3:2 TRIPTYCH) */
    .banner-master {
      width: 1440px;
      height: 960px;
      display: flex;
      position: relative;
      background: #0B0E14;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 32px 100px rgba(0, 0, 0, 0.85);
    }

    /* ==============================================================
       COLUMN 1: THE DISCONNECTED PRACTICE (LIGHT CRUMPLED PAPER)
       ============================================================== */
    .col-disconnected {
      width: 33.3333%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 44px 40px 48px 44px;
      background-color: #DDE2E8;
      overflow: hidden;
      z-index: 2;
    }

    /* Faceted / Crumpled Paper Origami Shading Overlay */
    .paper-creases {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      opacity: 0.85;
    }

    .col-disconnected > * {
      position: relative;
      z-index: 5;
    }

    /* Column 1 Micro-Header */
    .c1-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .c1-header-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #5A6578;
      text-transform: uppercase;
    }
    .c1-header-arrow {
      width: 16px;
      height: 16px;
      color: #5A6578;
    }

    /* Floating Disconnected Cards Section */
    .cards-cloud {
      position: relative;
      height: 380px;
      width: 100%;
      margin-top: 10px;
    }

    /* Card 1: CASES */
    .card-cases {
      position: absolute;
      top: 16px;
      left: 6px;
      background: #FFFFFF;
      padding: 16px 28px 18px 22px;
      border-radius: 2px;
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14), 0 3px 8px rgba(15, 23, 42, 0.08);
      transform: rotate(-9deg);
      border: 1px solid rgba(255, 255, 255, 0.9);
      z-index: 4;
    }
    .card-cases-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 38px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1;
      letter-spacing: -0.03em;
    }
    .card-cases-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      color: #64748B;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-top: 7px;
    }

    /* Card 2: HEARING */
    .card-hearing {
      position: absolute;
      top: 86px;
      right: -24px;
      background: #11141B;
      padding: 16px 26px 18px 24px;
      border-radius: 2px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32), 0 4px 10px rgba(0, 0, 0, 0.2);
      transform: rotate(-11deg);
      z-index: 5;
    }
    .card-hearing-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 34px;
      font-weight: 900;
      color: #FFFFFF;
      line-height: 1;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }
    .card-hearing-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 700;
      color: #94A3B8;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-top: 6px;
    }

    /* Card 3: DOCUMENTS. */
    .card-documents {
      position: absolute;
      top: 172px;
      left: 6px;
      background: #FFFFFF;
      padding: 18px 26px 20px 22px;
      border-radius: 2px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.15), 0 3px 8px rgba(15, 23, 42, 0.08);
      transform: rotate(-5deg);
      border: 1px solid rgba(255, 255, 255, 0.9);
      z-index: 6;
    }
    .card-documents-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 40px;
      font-weight: 900;
      color: #0F172A;
      line-height: 0.96;
      letter-spacing: -0.04em;
      text-transform: uppercase;
    }

    /* Tilted Tape / Badge: DEADLINE */
    .tape-deadline {
      position: absolute;
      top: 260px;
      left: 105px;
      background: #FF5426;
      color: #0B0E14;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 9px 36px 9px 32px;
      border-radius: 1px;
      box-shadow: 0 12px 28px rgba(255, 84, 38, 0.35);
      transform: rotate(-8deg);
      z-index: 7;
      white-space: nowrap;
    }

    /* Bottom Section of Column 1 */
    .c1-bottom {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .c1-headline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 52px;
      font-weight: 900;
      line-height: 0.92;
      letter-spacing: -0.04em;
      text-transform: uppercase;
    }
    .c1-headline .solid-dark {
      color: #0F172A;
      display: block;
    }
    .c1-headline .muted-part {
      color: #8C98A9;
      display: block;
    }
    .c1-desc {
      font-size: 14.5px;
      line-height: 1.52;
      font-weight: 500;
      color: #434E61;
      max-width: 390px;
    }

    /* ==============================================================
       COLUMN 2: BRING IT ALL TOGETHER (VIBRANT ORANGE)
       ============================================================== */
    .col-together {
      width: 33.3333%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 44px 44px 48px 44px;
      background-color: #FF5023;
      overflow: hidden;
      z-index: 3;
    }

    /* Column 2 Micro-Header */
    .c2-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .c2-header-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #11141B;
      text-transform: uppercase;
    }
    .c2-header-arrow {
      width: 16px;
      height: 16px;
      color: #11141B;
    }

    /* Hero Typography: BRING IT ALL TOGETHER. */
    .c2-headline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 64px;
      font-weight: 900;
      line-height: 0.92;
      letter-spacing: -0.04em;
      color: #11141B;
      text-transform: uppercase;
      margin-top: 10px;
    }

    /* Transition Curved Black Arrow */
    .arrow-container {
      position: relative;
      width: 100%;
      height: 150px;
      margin: 10px 0 20px 0;
    }
    .curved-flow-arrow {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* Middle Section: Discovery & Guided Demo */
    .c2-action-block {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .c2-discover-text {
      font-size: 15.5px;
      font-weight: 600;
      line-height: 1.45;
      color: #11141B;
      max-width: 340px;
    }
    .c2-demo-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-top: 1.5px solid #11141B;
      border-bottom: 1.5px solid #11141B;
      color: #11141B;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-decoration: none;
    }
    .c2-demo-btn svg {
      width: 20px;
      height: 20px;
      stroke-width: 2.5;
    }

    /* QR Code and Contact Info Box */
    .c2-contact-grid {
      display: flex;
      align-items: center;
      gap: 22px;
      margin-top: 10px;
    }
    .qr-placeholder-box {
      width: 90px;
      height: 90px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    /* Corner brackets for QR box */
    .qr-corner {
      position: absolute;
      width: 18px;
      height: 18px;
      border: 2px solid #11141B;
    }
    .qr-tl { top: 0; left: 0; border-right: none; border-bottom: none; }
    .qr-tr { top: 0; right: 0; border-left: none; border-bottom: none; }
    .qr-bl { bottom: 0; left: 0; border-right: none; border-top: none; }
    .qr-br { bottom: 0; right: 0; border-left: none; border-top: none; }
    .qr-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #11141B;
      line-height: 1.35;
      text-transform: uppercase;
    }

    .c2-contact-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .contact-url {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #11141B;
      text-transform: uppercase;
    }
    .contact-email {
      font-size: 14px;
      font-weight: 600;
      color: #11141B;
    }

    /* Column 2 Footer */
    .c2-footer {
      font-size: 11.5px;
      font-weight: 600;
      line-height: 1.45;
      color: #2D140C;
    }

    /* ==============================================================
       COLUMN 3: NYAYA SETHU & ONE COMMAND CENTRE (OBSIDIAN DARK)
       ============================================================== */
    .col-command {
      width: 33.3333%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 44px 44px 48px 44px;
      background-color: #0C0F17;
      overflow: hidden;
      z-index: 1;
    }

    /* Geometric wireframe mesh watermark in background */
    .wireframe-mesh {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      opacity: 0.22;
      z-index: 1;
    }

    .col-command > * {
      position: relative;
      z-index: 5;
    }

    /* Top Right White Angled Wedge Badge with OJIX Logo */
    .ojix-brand-wedge {
      position: absolute;
      top: 0;
      right: 0;
      width: 175px;
      height: 72px;
      background: #FFFFFF;
      clip-path: polygon(36px 0, 100% 0, 100% 100%, 0 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-left: 26px;
      z-index: 10;
    }
    .ojix-bar {
      width: 38px;
      height: 4.5px;
      background-color: #FF5426;
      border-radius: 2px;
      margin-bottom: 4px;
    }
    .ojix-text {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0F172A;
      line-height: 1;
    }

    /* Top Content Area */
    .c3-top-block {
      display: flex;
      flex-direction: column;
      margin-top: 10px;
    }
    .c3-product-name {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 64px;
      font-weight: 800;
      line-height: 0.9;
      letter-spacing: -0.03em;
      color: #FFFFFF;
      margin-bottom: 14px;
    }
    .c3-product-name sup {
      font-size: 20px;
      font-weight: 700;
      margin-left: 3px;
      vertical-align: super;
    }
    .c3-product-sub {
      font-size: 16.5px;
      font-weight: 800;
      line-height: 1.35;
      color: #FF5426;
      margin-bottom: 8px;
      max-width: 380px;
    }
    .c3-product-tagline {
      font-size: 12.5px;
      font-weight: 400;
      line-height: 1.45;
      color: #94A3B8;
      max-width: 370px;
    }

    /* Laptop Showcase Centerpiece */
    .laptop-showcase {
      position: relative;
      width: 100%;
      margin: 12px 0 16px 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* Laptop Device Mockup */
    .laptop-wrapper {
      width: 410px;
      position: relative;
      filter: drop-shadow(0 28px 60px rgba(0, 0, 0, 0.95));
    }
    /* Laptop Screen Bezel */
    .laptop-screen-bezel {
      background: #181C26;
      border: 3.5px solid #232938;
      border-radius: 9px 9px 2px 2px;
      padding: 6px;
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    }
    /* Camera Notch / Dot */
    .laptop-camera {
      width: 4px;
      height: 4px;
      background: #334155;
      border-radius: 50%;
      position: absolute;
      top: 3px;
      left: 50%;
      transform: translateX(-50%);
    }
    /* Inner Dashboard Screen */
    .laptop-display {
      background: #0E121D;
      border-radius: 4px;
      height: 228px;
      overflow: hidden;
      display: flex;
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.6);
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    /* Dashboard Sidebar */
    .dash-sidebar {
      width: 64px;
      background: #090C14;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .dash-brand-icon {
      width: 22px;
      height: 22px;
      background: #FF5426;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .dash-nav-item {
      height: 12px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.1);
    }
    .dash-nav-item.active {
      background: #FF5426;
    }

    /* Dashboard Main Stage */
    .dash-main {
      flex: 1;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dash-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 6px;
    }
    .dash-header-title {
      font-size: 8px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: 0.04em;
    }
    .dash-profile {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #38BDF8;
    }

    /* KPI Mini Cards Row */
    .dash-stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .dash-stat-box {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 3px;
      padding: 4px 6px;
    }
    .dash-stat-val {
      font-size: 11px;
      font-weight: 800;
      color: #FFFFFF;
      line-height: 1.1;
    }
    .dash-stat-lbl {
      font-size: 6px;
      font-weight: 600;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Content Split: Mini Table & Bar Chart */
    .dash-content-grid {
      display: flex;
      gap: 8px;
      flex: 1;
    }
    .dash-table {
      flex: 1.2;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 3px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dash-table-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .dash-table-cell {
      font-size: 6.5px;
      font-weight: 600;
      color: #E2E8F0;
    }
    .dash-pill {
      font-size: 5.5px;
      font-weight: 700;
      padding: 1.5px 4px;
      border-radius: 2px;
      background: rgba(16, 185, 129, 0.2);
      color: #10B981;
    }
    .dash-pill.orange {
      background: rgba(255, 84, 38, 0.2);
      color: #FF5426;
    }

    /* Chart Column */
    .dash-chart {
      flex: 0.8;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 3px;
      padding: 6px;
      display: flex;
      align-items: flex-end;
      gap: 3px;
    }
    .dash-bar {
      flex: 1;
      border-radius: 1px 1px 0 0;
      background: #38BDF8;
    }
    .dash-bar.accent {
      background: #FF5426;
    }

    /* Laptop Base / Deck */
    .laptop-base {
      height: 12px;
      background: linear-gradient(180deg, #2D3344 0%, #171A24 100%);
      border-radius: 0 0 10px 10px;
      margin: 0 -18px;
      position: relative;
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.9);
      display: flex;
      justify-content: center;
    }
    .laptop-notch {
      width: 48px;
      height: 4px;
      background: #111319;
      border-radius: 0 0 3px 3px;
    }

    /* Bottom Section of Column 3 */
    .c3-bottom {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .c3-headline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1;
      color: #FFFFFF;
      text-transform: uppercase;
    }
    .c3-subtext {
      font-size: 14.5px;
      font-weight: 500;
      line-height: 1.45;
      color: #CBD5E1;
      max-width: 360px;
    }
  </style>
</head>
<body>

  <!-- Optional Figma Frame Tag -->
  <div class="frame-tag">Frame 439</div>

  <!-- MAIN 3-PANEL BANNER (1440 x 960) -->
  <div class="banner-master">

    <!-- ==========================================
         PANEL 1 (LEFT): THE DISCONNECTED PRACTICE
         ========================================== -->
    <div class="col-disconnected">

      <!-- Origami Crumpled Paper Shading SVG Background -->
      <svg class="paper-creases" viewBox="0 0 480 960" preserveAspectRatio="none">
        <defs>
          <linearGradient id="foldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#BAC2CC" stop-opacity="0.6"/>
          </linearGradient>
          <linearGradient id="foldGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#CAD2DC" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.3"/>
          </linearGradient>
          <linearGradient id="foldGrad3" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stop-color="#B2BAC6" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#E2E7ED" stop-opacity="0.7"/>
          </linearGradient>
        </defs>

        <!-- Subtle geometric paper fold polygons mimicking the photograph folds -->
        <polygon points="0,0 260,0 180,240 0,160" fill="url(#foldGrad1)" opacity="0.6"/>
        <polygon points="260,0 480,0 480,310 180,240" fill="url(#foldGrad2)" opacity="0.5"/>
        <polygon points="0,160 180,240 140,540 0,460" fill="url(#foldGrad3)" opacity="0.55"/>
        <polygon points="180,240 480,310 390,620 140,540" fill="url(#foldGrad1)" opacity="0.65"/>
        <polygon points="0,460 140,540 80,780 0,720" fill="url(#foldGrad2)" opacity="0.45"/>
        <polygon points="140,540 390,620 310,850 80,780" fill="url(#foldGrad3)" opacity="0.6"/>
        <polygon points="390,620 480,310 480,820 310,850" fill="url(#foldGrad1)" opacity="0.5"/>
        <polygon points="0,720 80,780 0,960" fill="url(#foldGrad2)" opacity="0.4"/>
        <polygon points="80,780 310,850 240,960 0,960" fill="url(#foldGrad3)" opacity="0.5"/>
        <polygon points="310,850 480,820 480,960 240,960" fill="url(#foldGrad2)" opacity="0.6"/>

        <!-- Crisp pencil-crease contour lines -->
        <path d="M 0,160 L 180,240 L 480,310" stroke="#9AA5B5" stroke-width="0.8" opacity="0.4" fill="none"/>
        <path d="M 180,240 L 140,540 L 390,620 L 480,310" stroke="#9AA5B5" stroke-width="0.8" opacity="0.4" fill="none"/>
        <path d="M 140,540 L 80,780 L 310,850 L 480,820" stroke="#9AA5B5" stroke-width="0.8" opacity="0.4" fill="none"/>
      </svg>

      <!-- Micro Header -->
      <div class="c1-header">
        <span class="c1-header-title">BEFORE / THE DISCONNECTED PRACTICE</span>
        <svg class="c1-header-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="17" y1="7" x2="7" y2="17"></line>
          <polyline points="17 17 7 17 7 7"></polyline>
        </svg>
      </div>

      <!-- Floating Paper Cards Area -->
      <div class="cards-cloud">
        <!-- Card 1: Cases -->
        <div class="card-cases">
          <div class="card-cases-title">Cases</div>
          <div class="card-cases-sub">01 / CASE REFERENCE</div>
        </div>

        <!-- Card 2: HEARING -->
        <div class="card-hearing">
          <div class="card-hearing-title">HEARING</div>
          <div class="card-hearing-sub">NEXT / PREPARATION</div>
        </div>

        <!-- Card 3: DOCUMENTS. -->
        <div class="card-documents">
          <div class="card-documents-title">DOCU<br>MENTS.</div>
        </div>

        <!-- Orange Tape / Label: DEADLINE -->
        <div class="tape-deadline">DEADLINE</div>
      </div>

      <!-- Bottom Headline & Copy -->
      <div class="c1-bottom">
        <h2 class="c1-headline">
          <span class="solid-dark">TOO MANY</span>
          <span class="muted-part">MOVING</span>
          <span class="muted-part">PARTS?</span>
        </h2>
        <p class="c1-desc">
          Matters, documents, hearings, deadlines and team responsibilities rarely move in a straight line. Nyaya Sethu brings the work behind your legal practice into one connected workspace.
        </p>
      </div>

    </div>


    <!-- ==========================================
         PANEL 2 (CENTER): BRING IT ALL TOGETHER
         ========================================== -->
    <div class="col-together">

      <!-- Micro Header -->
      <div class="c2-header">
        <span class="c2-header-title">LESS FRICTION. MORE FOCUS.</span>
        <svg class="c2-header-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"></line>
          <polyline points="7 7 17 7 17 17"></polyline>
        </svg>
      </div>

      <!-- Main Headline: BRING IT ALL TOGETHER. -->
      <h1 class="c2-headline">
        BRING<br>
        IT ALL<br>
        TOGETHER.
      </h1>

      <!-- The Signature Curved Black Arrow Transition -->
      <div class="arrow-container">
        <svg class="curved-flow-arrow" viewBox="0 0 380 140" fill="none">
          <!-- Arrow shaft with smooth cubic bezier curve -->
          <path d="M 0,38 L 130,38 C 190,38 210,38 250,75 L 340,120" stroke="#11141B" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Arrowhead pointing top-right towards Column 3 -->
          <polygon points="370,135 320,138 348,102" fill="#11141B" />
        </svg>
      </div>

      <!-- Discovery & Book Demo Section -->
      <div class="c2-action-block">
        <p class="c2-discover-text">
          Discover a more connected way to manage your legal practice.
        </p>

        <a href="#demo" class="c2-demo-btn">
          <span>BOOK A GUIDED PRODUCT DEMO</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </a>

        <!-- QR Code Placeholder & Contact Details -->
        <div class="c2-contact-grid">
          <div class="qr-placeholder-box">
            <div class="qr-corner qr-tl"></div>
            <div class="qr-corner qr-tr"></div>
            <div class="qr-corner qr-bl"></div>
            <div class="qr-corner qr-br"></div>
            <div class="qr-text">QR CODE<br>PLACEHOLDER</div>
          </div>
          <div class="c2-contact-details">
            <span class="contact-url">WWW.OJIX.COM</span>
            <span class="contact-email">info@ojix.in</span>
          </div>
        </div>
      </div>

      <!-- Column 2 Footer -->
      <div class="c2-footer">
        <div>Nyaya Sethu by OJIX</div>
        <div>OJIX Engineering & Technology LLP</div>
      </div>

    </div>


    <!-- ==========================================
         PANEL 3 (RIGHT): ONE COMMAND CENTRE
         ========================================== -->
    <div class="col-command">

      <!-- Background Wireframe Polygons / Network Watermark -->
      <svg class="wireframe-mesh" viewBox="0 0 480 960" fill="none">
        <polygon points="120,40 320,90 240,240 60,180" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="320,90 460,160 410,340 240,240" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="60,180 240,240 180,420 30,360" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="240,240 410,340 360,520 180,420" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="180,420 360,520 290,720 110,640" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="360,520 470,580 440,790 290,720" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="110,640 290,720 220,920 40,840" stroke="#FFFFFF" stroke-width="1" />
        <polygon points="290,720 440,790 390,950 220,920" stroke="#FFFFFF" stroke-width="1" />
      </svg>

      <!-- Top-Right Angled Wedge Badge with OJIX Brand Logo -->
      <div class="ojix-brand-wedge">
        <div class="ojix-bar"></div>
        <div class="ojix-text">OJIX</div>
      </div>

      <!-- Top Typography: Nyaya-Sethu Platform -->
      <div class="c3-top-block">
        <h1 class="c3-product-name">
          Nyaya-<br>Sethu<sup>TM</sup>
        </h1>
        <h3 class="c3-product-sub">
          AI Legal Management Platform &amp; Legal OS for Indian Law Firms
        </h3>
        <p class="c3-product-tagline">
          From enquiry to execution — one intelligent, secure and compliant legal operating system.
        </p>
      </div>

      <!-- Centerpiece: Sleek Laptop Mockup with Live Nyaya Sethu Dashboard -->
      <div class="laptop-showcase">
        <div class="laptop-wrapper">
          <div class="laptop-screen-bezel">
            <div class="laptop-camera"></div>
            <div class="laptop-display">
              <!-- Left Mini Navigation -->
              <div class="dash-sidebar">
                <div class="dash-brand-icon"></div>
                <div class="dash-nav-item active"></div>
                <div class="dash-nav-item"></div>
                <div class="dash-nav-item"></div>
                <div class="dash-nav-item"></div>
                <div class="dash-nav-item"></div>
              </div>
              <!-- Main Dashboard Area -->
              <div class="dash-main">
                <div class="dash-header-bar">
                  <span class="dash-header-title">Court Hearing Overview</span>
                  <div class="dash-profile"></div>
                </div>
                <!-- 4 KPI Cards -->
                <div class="dash-stats-row">
                  <div class="dash-stat-box">
                    <div class="dash-stat-val">268</div>
                    <div class="dash-stat-lbl">Cases</div>
                  </div>
                  <div class="dash-stat-box">
                    <div class="dash-stat-val">19</div>
                    <div class="dash-stat-lbl">Hearings</div>
                  </div>
                  <div class="dash-stat-box">
                    <div class="dash-stat-val">87</div>
                    <div class="dash-stat-lbl">Docs</div>
                  </div>
                  <div class="dash-stat-box">
                    <div class="dash-stat-val">12</div>
                    <div class="dash-stat-lbl">Tasks</div>
                  </div>
                </div>
                <!-- Split Data Stage -->
                <div class="dash-content-grid">
                  <div class="dash-table">
                    <div class="dash-table-row">
                      <span class="dash-table-cell">OS 412/2024</span>
                      <span class="dash-pill">LISTED</span>
                    </div>
                    <div class="dash-table-row">
                      <span class="dash-table-cell">WP 18940/23</span>
                      <span class="dash-pill orange">EVIDENCE</span>
                    </div>
                    <div class="dash-table-row">
                      <span class="dash-table-cell">RFA 552/2022</span>
                      <span class="dash-pill">ORDERS</span>
                    </div>
                    <div class="dash-table-row">
                      <span class="dash-table-cell">Bhoomi RTC #14</span>
                      <span class="dash-pill">VERIFIED</span>
                    </div>
                  </div>
                  <!-- Vertical Activity Bars -->
                  <div class="dash-chart">
                    <div class="dash-bar" style="height: 35%;"></div>
                    <div class="dash-bar" style="height: 60%;"></div>
                    <div class="dash-bar accent" style="height: 90%;"></div>
                    <div class="dash-bar" style="height: 45%;"></div>
                    <div class="dash-bar" style="height: 75%;"></div>
                    <div class="dash-bar accent" style="height: 100%;"></div>
                    <div class="dash-bar" style="height: 55%;"></div>
                    <div class="dash-bar" style="height: 80%;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Laptop Base Chasis -->
          <div class="laptop-base">
            <div class="laptop-notch"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Headline & Value Proposition -->
      <div class="c3-bottom">
        <h2 class="c3-headline">ONE COMMAND CENTRE.</h2>
        <p class="c3-subtext">
          Your entire legal practice.<br>
          Connected. Organised. In control.
        </p>
      </div>

    </div>

  </div>

</body>
</html>
`;

fs.writeFileSync(htmlOutputPath, htmlContent);
console.log('Written HTML file to:', htmlOutputPath);

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage({
    viewport: { width: 1540, height: 1080 },
    deviceScaleFactor: 2
  });

  await page.goto(\`file://\${htmlOutputPath}\`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const banner = page.locator('.banner-master');
  await banner.screenshot({ path: pngOutputPath });
  console.log('Saved screenshot to:', pngOutputPath);

  const brainDir = path.dirname(brainPngPath);
  if (!fs.existsSync(brainDir)) fs.mkdirSync(brainDir, { recursive: true });
  await banner.screenshot({ path: brainPngPath });
  console.log('Saved screenshot to brain:', brainPngPath);

  // Also save to apps/web/public/assets
  const webPublicAsset = path.join(rootDir, 'apps/web/public/assets/OJIX_Frame439_Marketing_Banner.png');
  const webDir = path.dirname(webPublicAsset);
  if (fs.existsSync(webDir)) {
    fs.copyFileSync(pngOutputPath, webPublicAsset);
    console.log('Copied to web public assets:', webPublicAsset);
  }

  await browser.close();
}

capture().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
