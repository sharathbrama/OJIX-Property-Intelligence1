import fs from 'fs';
import path from 'path';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';

// Assets
const logoPath = path.join(rootDir, 'apps/web/public/assets/ojix-wordmark-header.png');
const karnatakaMapPath = path.join(rootDir, 'karnataka-map-clean.png');
const heroSatellitePath = path.join(rootDir, 'apps/web/public/images/ojix-property-hero.webp');
const docReviewPath = path.join(rootDir, 'apps/web/public/images/ojix-document-review.webp');
const recordsPath = path.join(rootDir, 'apps/web/public/images/ojix-property-records.webp');
const riskPath = path.join(rootDir, 'apps/web/public/images/ojix-risk-assessment.webp');
const highCourtPath = path.join(rootDir, 'karnataka-high-court-exact.png');

const logoB64 = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}` : '';
const karnatakaMapB64 = fs.existsSync(karnatakaMapPath) ? `data:image/png;base64,${fs.readFileSync(karnatakaMapPath).toString('base64')}` : '';
const heroSatelliteB64 = fs.existsSync(heroSatellitePath) ? `data:image/webp;base64,${fs.readFileSync(heroSatellitePath).toString('base64')}` : '';
const docReviewB64 = fs.existsSync(docReviewPath) ? `data:image/webp;base64,${fs.readFileSync(docReviewPath).toString('base64')}` : '';
const recordsB64 = fs.existsSync(recordsPath) ? `data:image/webp;base64,${fs.readFileSync(recordsPath).toString('base64')}` : '';
const riskB64 = fs.existsSync(riskPath) ? `data:image/webp;base64,${fs.readFileSync(riskPath).toString('base64')}` : '';
const highCourtB64 = fs.existsSync(highCourtPath) ? `data:image/png;base64,${fs.readFileSync(highCourtPath).toString('base64')}` : '';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJIX Property Intelligence — Enterprise Sales & Product Showcase Banner (White-Blue Edition)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --canvas-bg: #EDF2F7;
      --master-bg: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 45%, #F1F5F9 100%);
      --grid-line: rgba(37, 99, 235, 0.04);
      --ambient-blue-1: radial-gradient(circle at 18% 10%, rgba(37, 99, 235, 0.08) 0%, transparent 55%);
      --ambient-blue-2: radial-gradient(circle at 82% 15%, rgba(2, 132, 199, 0.08) 0%, transparent 55%);
      
      --panel-bg: rgba(255, 255, 255, 0.94);
      --card-bg: #FFFFFF;
      --card-bg-subtle: #F8FAFC;
      --border-subtle: rgba(203, 213, 225, 0.85);
      --border-blue: rgba(37, 99, 235, 0.28);
      
      --blue-primary: #2563EB;
      --blue-dark: #1D4ED8;
      --blue-navy: #0F172A;
      --blue-cobalt: #1E40AF;
      --blue-cyan: #0284C7;
      
      --teal-accent: #059669;
      --teal-light: #10B981;
      --gold-accent: #D97706;
      --crimson-accent: #BE123C;
      
      --text-main: #0F172A;
      --text-body: #334155;
      --text-muted: #64748B;
      --text-faint: #94A3B8;
      
      --strip-bg: rgba(255, 255, 255, 0.96);
      --bottom-bg: #FFFFFF;
      --master-shadow: 0 35px 100px -15px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(37, 99, 235, 0.15);
    }

    body {
      background-color: var(--canvas-bg);
      color: var(--text-body);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 15px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: auto;
    }

    /* Presentation Control Bar */
    .presentation-controls {
      width: 1600px;
      max-width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding: 0 6px;
    }

    .badge-pres {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blue-primary);
      background: #FFFFFF;
      border: 1px solid var(--border-blue);
      padding: 7px 16px;
      border-radius: 9999px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
    }

    .badge-pres .pulse-dot {
      width: 8px;
      height: 8px;
      background: var(--blue-primary);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--blue-primary);
      animation: pulseAnim 2s infinite ease-in-out;
    }

    @keyframes pulseAnim {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }

    .flow-indicator-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #FFFFFF;
      border: 1px solid var(--border-blue);
      padding: 6px 18px;
      border-radius: 30px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
    }

    .flow-step-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .flow-step-tag.start { color: var(--blue-primary); }
    .flow-step-tag.mid { color: var(--blue-cyan); }
    .flow-step-tag.end { color: var(--teal-accent); }
    .flow-arr { color: var(--text-faint); font-weight: 800; }

    .btn-group {
      display: flex;
      gap: 10px;
    }

    .pres-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #FFFFFF;
      border: 1px solid rgba(203, 213, 225, 0.9);
      color: var(--text-main);
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .pres-btn:hover {
      background: #F0F7FF;
      border-color: var(--blue-primary);
      color: var(--blue-primary);
      transform: translateY(-1px);
    }

    .pres-btn.primary {
      background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%);
      color: #FFFFFF;
      border: none;
      font-weight: 800;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }

    .pres-btn.primary:hover {
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
      background: linear-gradient(135deg, #1E40AF 0%, #1D4ED8 100%);
    }

    /* =====================================================================
       MASTER BANNER CANVAS (1600 x 1000 px - PRESENTATION FORMAT)
       ===================================================================== */
    .banner-master {
      width: 1600px;
      height: 1000px;
      min-width: 1600px;
      min-height: 1000px;
      position: relative;
      background: var(--master-bg);
      border: 1px solid var(--border-blue);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--master-shadow);
    }

    /* Precision Blueprint Grid */
    .banner-master::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(var(--grid-line) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
      background-size: 38px 38px;
      pointer-events: none;
      z-index: 1;
    }

    .ambient-glow-1 {
      position: absolute;
      top: -120px;
      left: 10%;
      width: 600px;
      height: 450px;
      background: var(--ambient-blue-1);
      pointer-events: none;
      z-index: 1;
      filter: blur(50px);
    }

    .ambient-glow-2 {
      position: absolute;
      bottom: -100px;
      right: 15%;
      width: 550px;
      height: 400px;
      background: var(--ambient-blue-2);
      pointer-events: none;
      z-index: 1;
      filter: blur(50px);
    }

    /* SVG Global Pipeline / Connection Stream Weaving Across All 3 Columns */
    .global-flow-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 4;
    }

    /* =====================================================================
       TOP STATUS STRIP
       ===================================================================== */
    .top-status-strip {
      position: relative;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 44px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--strip-bg);
      backdrop-filter: blur(12px);
    }

    .top-strip-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .client-tagline {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .client-tagline span.dot {
      width: 8px;
      height: 8px;
      background: var(--blue-primary);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--blue-primary);
    }

    .top-strip-center {
      font-family: 'Inter', sans-serif;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--blue-cobalt);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #F0F7FF;
      padding: 5px 18px;
      border-radius: 20px;
      border: 1px solid var(--border-blue);
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.06);
    }

    .top-strip-center svg {
      color: var(--blue-primary);
    }

    .top-strip-right {
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .live-compliance-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(5, 150, 105, 0.09);
      border: 1px solid rgba(5, 150, 105, 0.3);
      color: var(--teal-accent);
      padding: 3px 12px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 800;
    }

    /* =====================================================================
       MAIN THREE-COLUMN EDITORIAL SHOWCASE BODY
       ===================================================================== */
    .showcase-body {
      position: relative;
      z-index: 5;
      display: grid;
      grid-template-columns: 450px 680px 470px;
      height: 744px;
      border-bottom: 1px solid var(--border-subtle);
    }

    /* =====================================================================
       SECTION 1: LEFT SECTION – WHERE WE START (INTAKE & PHYSICAL ASSETS)
       ===================================================================== */
    .sec-left {
      padding: 18px 26px 16px 36px;
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      background: rgba(255, 255, 255, 0.94);
    }

    .stage-badge-flow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(90deg, #1D4ED8 0%, #2563EB 100%);
      color: #FFFFFF;
      padding: 4.5px 13px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      margin-bottom: 6px;
      width: fit-content;
    }

    .brand-hero-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-img {
      height: 38px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08));
    }

    .enterprise-edition-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blue-primary);
      background: #EFF6FF;
      border: 1px solid var(--border-blue);
      padding: 2.5px 8px;
      border-radius: 4px;
    }

    .main-title-block {
      margin-top: 2px;
    }

    .headline-eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--blue-primary);
      display: block;
      margin-bottom: 3px;
    }

    .main-headline {
      font-size: 30px;
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: var(--text-main);
      text-transform: uppercase;
    }

    .main-headline .reimagined {
      display: block;
      background: linear-gradient(90deg, #1D4ED8 0%, #2563EB 50%, #0284C7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-top: 2px;
    }

    .subheading-copy {
      font-size: 12px;
      line-height: 1.45;
      color: var(--text-body);
      font-weight: 500;
      margin-top: 5px;
    }

    /* Clear 3D Realistic Image Card for Stage 1 (Intake) */
    .hero-image-card-intake {
      background: #FFFFFF;
      border: 1px solid var(--border-blue);
      border-radius: 9px;
      padding: 10px 12px;
      box-shadow: 0 8px 22px rgba(37, 99, 235, 0.07);
      margin: 8px 0 6px 0;
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
    }

    .hero-image-card-intake img.doc-preview-thumb {
      width: 105px;
      height: 105px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      box-shadow: 0 5px 14px rgba(15, 23, 42, 0.08);
      flex-shrink: 0;
    }

    .intake-card-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .intake-card-info h5 {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .intake-card-info p {
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .intake-tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }

    .doc-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
      color: var(--blue-cobalt);
      background: #EFF6FF;
      border: 1px solid var(--border-blue);
      padding: 2px 6px;
      border-radius: 3px;
    }

    /* Feature Pods below the intake image */
    .feature-pods-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin-top: 3px;
    }

    .feature-pod {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 8px 10px;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 7px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.03);
    }

    .feature-pod:hover {
      background: #F8FAFC;
      border-color: var(--blue-primary);
      transform: translateY(-2px);
      box-shadow: 0 5px 12px rgba(37, 99, 235, 0.09);
    }

    .pod-top {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    
    /* Document Intelligence & OCR Engine Card */
    .ocr-engine-card {
      background: #FFFFFF;
      border: 1px solid #DBEAFE;
      border-radius: 8px;
      padding: 8px 11px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      box-shadow: 0 2px 7px rgba(37, 99, 235, 0.05);
      position: relative;
    }

    .ocr-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ocr-title-block {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ocr-icon-badge {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background: #EFF6FF;
      color: var(--blue-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }

    .ocr-title-text {
      font-size: 11px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .ocr-acc-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 800;
      color: var(--teal-accent);
      background: #ECFDF5;
      border: 1px solid rgba(5, 150, 105, 0.3);
      padding: 1px 5px;
      border-radius: 3px;
    }

    .ocr-desc-text {
      font-size: 9.5px;
      color: var(--text-muted);
      line-height: 1.3;
    }

    .ocr-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 1px;
    }

    .ocr-chip {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 700;
      color: #1E40AF;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      padding: 1.5px 5px;
      border-radius: 3px;
    }

    .pod-icon-box {
      width: 24px;
      height: 24px;
      border-radius: 5px;
      background: #EFF6FF;
      border: 1px solid rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--blue-primary);
    }

    .pod-icon-box svg {
      width: 13px;
      height: 13px;
      stroke-width: 2.2;
    }

    .pod-title {
      font-size: 11px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .pod-desc {
      font-size: 9.5px;
      color: var(--text-muted);
      line-height: 1.25;
    }

    /* Outgoing Connection Pipeline Banner */
    .outgoing-flow-pill {
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #F0F7FF;
      border: 1.5px solid var(--border-blue);
      padding: 7px 12px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      color: var(--blue-dark);
    }

    .outgoing-flow-pill span.flow-arrow {
      color: var(--blue-primary);
      font-size: 12px;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* =====================================================================
       SECTION 2: CENTRE SECTION – MAIN HERO VISUAL (SATELLITE & CADASTRE)
       ===================================================================== */
    .sec-center {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 22px 24px;
      overflow: hidden;
      background: #F8FAFC;
    }

    /* Background Aerial Satellite Parcel Image with Clean White-Blue Vignette */
    .center-map-viewport {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
    }

    .satellite-hero-bg {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      filter: brightness(0.94) contrast(1.1) saturate(1.1);
      transform: scale(1.02);
    }

    .satellite-overlay-gradient {
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(circle at 50% 50%, rgba(248, 250, 252, 0.1) 0%, rgba(241, 245, 249, 0.7) 80%, #F1F5F9 100%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, transparent 18%, transparent 82%, rgba(248, 250, 252, 0.95) 100%);
    }

    /* Cadastral Vector Polygon Overlay on Satellite Map */
    .cadastral-svg-layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    }

    /* Center Content Layer */
    .center-content-layer {
      position: relative;
      z-index: 5;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Center Top: Location Header & Coordinates */
    .center-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-blue);
      border-radius: 8px;
      padding: 8px 14px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.08);
    }

    .karnataka-location-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .karnataka-state-thumb {
      width: 32px;
      height: 36px;
      object-fit: contain;
      filter: drop-shadow(0 0 6px rgba(37, 99, 235, 0.4));
    }

    .loc-details h4 {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .loc-details h4 svg {
      color: var(--blue-primary);
    }

    .loc-details p {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      color: var(--blue-dark);
      font-weight: 700;
    }

    .parcel-coordinates-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-main);
      background: #EFF6FF;
      border: 1px solid var(--border-blue);
      padding: 4px 10px;
      border-radius: 6px;
      text-align: right;
    }

    .parcel-coordinates-pill span {
      display: block;
      color: var(--blue-primary);
      font-weight: 800;
    }

    /* Cadastral Center Stage with Floating White Miniature Cards */
    .cadastral-hero-stage {
      position: relative;
      height: 380px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 6px 0;
    }

    /* Boundary Coordinates Callout Pills */
    .cardinal-pill {
      position: absolute;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      padding: 3.5px 9px;
      border-radius: 4px;
      background: #FFFFFF;
      border: 1px solid var(--border-blue);
      color: var(--text-main);
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(8px);
      z-index: 6;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .cardinal-pill.north { top: 6px; left: 56%; transform: translateX(-50%); }
    .cardinal-pill.south { bottom: 6px; left: 50%; transform: translateX(-50%); }
    .cardinal-pill.west { left: 14px; top: 72%; transform: translateY(-50%); }
    .cardinal-pill.east { right: 14px; top: 38%; transform: translateY(-50%); }

    .cardinal-pill strong { color: var(--blue-primary); }

    /* Floating Miniature Card 1: Survey & Land Record Card */
    .mini-card-survey {
      position: absolute;
      top: 24px;
      left: 14px;
      width: 236px;
      background: #FFFFFF;
      backdrop-filter: blur(14px);
      border: 1.5px solid var(--border-blue);
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
      z-index: 7;
      animation: floatA 6s ease-in-out infinite;
    }

    @keyframes floatA {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-4px); }
    }

    .mini-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .mini-card-header span.tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      color: var(--blue-primary);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .mini-card-header span.doc-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      color: var(--text-muted);
    }

    .survey-number-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.02em;
      margin-bottom: 3px;
    }

    .survey-extent-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      margin-top: 4px;
      background: #F8FAFC;
      border: 1px solid var(--border-subtle);
      padding: 4px 6px;
      border-radius: 4px;
    }

    .extent-item span.label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      color: var(--text-muted);
      display: block;
      text-transform: uppercase;
    }

    .extent-item span.val {
      font-size: 10px;
      font-weight: 800;
      color: var(--text-main);
    }

    /* Floating Miniature Card 2: 3D Clear Cadastre Map Image Card */
    .mini-card-cadastre-visual {
      position: absolute;
      bottom: 30px;
      right: 14px;
      width: 248px;
      background: #FFFFFF;
      backdrop-filter: blur(14px);
      border: 1.5px solid var(--border-blue);
      border-radius: 8px;
      padding: 9px 11px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
      z-index: 7;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: floatB 7s ease-in-out infinite;
    }

    @keyframes floatB {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(5px); }
    }

    .mini-card-cadastre-visual img.cadastre-thumb {
      width: 66px;
      height: 66px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .cadastre-meta-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cadastre-meta-group strong {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--text-main);
    }

    .cadastre-meta-group span {
      font-size: 9.5px;
      color: var(--text-muted);
    }

    .cadastre-meta-group .badge-live {
      margin-top: 3px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
      color: var(--teal-accent);
      background: #ECFDF5;
      border: 1px solid rgba(5, 150, 105, 0.3);
      padding: 1.5px 5px;
      border-radius: 3px;
      width: fit-content;
    }

    /* Floating GIS Risk Markers */
    .gis-risk-markers-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
      margin-top: 5px;
    }

    .gis-marker-chip {
      background: #FFFFFF;
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 7px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
      transition: all 0.2s ease;
    }

    .gis-marker-chip.success { border-color: rgba(5, 150, 105, 0.4); }
    .gis-marker-chip.teal { border-color: rgba(2, 132, 199, 0.4); }
    .gis-marker-chip.purple { border-color: rgba(37, 99, 235, 0.4); }
    .gis-marker-chip.amber { border-color: rgba(217, 119, 6, 0.4); }

    .gis-marker-chip .marker-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 800;
      color: var(--text-main);
    }

    .gis-marker-chip .marker-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
    }

    .gis-marker-chip.success .marker-status { color: var(--teal-accent); }
    .gis-marker-chip.teal .marker-status { color: var(--blue-cyan); }
    .gis-marker-chip.purple .marker-status { color: var(--blue-primary); }
    .gis-marker-chip.amber .marker-status { color: var(--gold-accent); }

    .gis-marker-chip .marker-sub {
      font-size: 8.5px;
      color: var(--text-muted);
      line-height: 1.2;
    }

    /* Center Bottom: Verification Status Bar */
    .verification-status-panel {
      background: #FFFFFF;
      backdrop-filter: blur(14px);
      border: 1.5px solid var(--border-blue);
      border-radius: 8px;
      padding: 9px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.1);
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .shield-badge-gold {
      width: 36px;
      height: 36px;
      border-radius: 7px;
      background: #EFF6FF;
      border: 1.5px solid var(--blue-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--blue-primary);
      box-shadow: 0 0 12px rgba(37, 99, 235, 0.2);
    }

    .status-text-block h5 {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .status-text-block h5 span.verified-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      color: #FFFFFF;
      background: var(--blue-primary);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .status-text-block p {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .status-right-metrics {
      display: flex;
      align-items: center;
      gap: 14px;
      text-align: right;
    }

    .metric-pod {
      display: flex;
      flex-direction: column;
    }

    .metric-pod span.number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14.5px;
      font-weight: 800;
      color: var(--blue-primary);
    }

    .metric-pod:nth-child(2) span.number {
      color: var(--teal-accent);
    }

    .metric-pod span.caption {
      font-size: 8.5px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* =====================================================================
       SECTION 3: RIGHT SECTION – GOVT PORTAL INTELLIGENCE & FINAL OUTCOME
       ===================================================================== */
    .sec-right {
      padding: 16px 28px 14px 24px;
      border-left: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 7px;
      position: relative;
      background: rgba(255, 255, 255, 0.94);
    }

    .stage-badge-outcome {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(90deg, #059669 0%, #10B981 100%);
      color: #FFFFFF;
      padding: 4.5px 13px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
      margin-bottom: 6px;
      width: fit-content;
    }

    .sec-right-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 6px;
    }

    .sec-right-header .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--teal-accent);
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .sec-right-header h3 {
      font-size: 19px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }

    /* Featured 3D Clear Generated Illustration for Final Certified Dossier */
    .hero-image-card-outcome {
      background: #FFFFFF;
      border: 1.5px solid rgba(5, 150, 105, 0.35);
      border-radius: 9px;
      padding: 10px 12px;
      box-shadow: 0 8px 22px rgba(5, 150, 105, 0.08);
      margin: 4px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
    }

    .hero-image-card-outcome img.risk-thumb {
      width: 95px;
      height: 95px;
      object-fit: cover;
      border-radius: 7px;
      border: 1px solid var(--border-subtle);
      box-shadow: 0 5px 14px rgba(5, 150, 105, 0.12);
      flex-shrink: 0;
    }

    .outcome-card-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .outcome-card-info h5 {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .outcome-card-info p {
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .outcome-tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 3px;
    }

    .outcome-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
      color: var(--teal-accent);
      background: #ECFDF5;
      border: 1px solid rgba(5, 150, 105, 0.3);
      padding: 1.5px 6px;
      border-radius: 3px;
    }

    /* =====================================================================
       4 COLOR-DIFFERENTIATED GOVERNMENT PORTAL RECONCILIATION CARDS
       ===================================================================== */
    .govt-portals-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 6px 0 4px 0;
      padding-bottom: 2px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .govt-portals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    /* Common Portal Card */
    .govt-portal-card {
      border-radius: 7px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
      position: relative;
      overflow: hidden;
    }

    .govt-portal-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
    }

    /* 1. BHOOMI (Amber Gold) */
    .govt-portal-card.bhoomi {
      background: #FFFBEB;
      border: 1.5px solid rgba(217, 119, 6, 0.35);
    }
    .govt-portal-card.bhoomi .portal-badge {
      color: #B45309;
      background: #FEF3C7;
      border: 1px solid rgba(217, 119, 6, 0.3);
    }

    /* 2. KAVERI 2.0 (Royal Blue) */
    .govt-portal-card.kaveri {
      background: #EFF6FF;
      border: 1.5px solid rgba(37, 99, 235, 0.35);
    }
    .govt-portal-card.kaveri .portal-badge {
      color: #1D4ED8;
      background: #DBEAFE;
      border: 1px solid rgba(37, 99, 235, 0.3);
    }

    /* 3. MOJINI 11E (Cyan Teal) */
    .govt-portal-card.mojini {
      background: #F0F9FF;
      border: 1.5px solid rgba(2, 132, 199, 0.35);
    }
    .govt-portal-card.mojini .portal-badge {
      color: #0284C7;
      background: #E0F2FE;
      border: 1px solid rgba(2, 132, 199, 0.3);
    }

    /* 4. HIGH COURT OF KARNATAKA (Crimson with Real Photo) */
    .govt-portal-card.highcourt {
      background: #FFF1F2;
      border: 1.5px solid rgba(190, 18, 60, 0.35);
    }
    .govt-portal-card.highcourt .portal-badge {
      color: #BE123C;
      background: #FFE4E6;
      border: 1px solid rgba(190, 18, 60, 0.3);
    }

    .portal-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .portal-brand-block {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .portal-crest-icon {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .portal-crest-icon.bhoomi { background: #FEF3C7; color: #B45309; }
    .portal-crest-icon.kaveri { background: #DBEAFE; color: #1D4ED8; }
    .portal-crest-icon.mojini { background: #E0F2FE; color: #0284C7; }

    .portal-court-img {
      width: 32px;
      height: 20px;
      object-fit: cover;
      border-radius: 3px;
      border: 1px solid rgba(190, 18, 60, 0.25);
    }

    .portal-title-text {
      font-size: 11px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
      line-height: 1.1;
    }

    .portal-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 800;
      padding: 1.5px 5px;
      border-radius: 3px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .portal-url-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .portal-data-val {
      font-size: 9.5px;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.25;
    }

    /* Provenance Footer Bar */
    
    /* =====================================================================
       10 ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
       ===================================================================== */
    .roles-matrix-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 2px;
    }

    .roles-matrix-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 2px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .roles-matrix-title .rbac-tag {
      font-size: 7.5px;
      color: var(--blue-primary);
      background: #EFF6FF;
      border: 1px solid var(--border-blue);
      padding: 1px 5px;
      border-radius: 3px;
    }

    .roles-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }

    .role-badge-card {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 7px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: #FFFFFF;
      transition: all 0.15s ease;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    }

    .role-badge-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(15, 23, 42, 0.06);
    }

    .role-badge-icon {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      flex-shrink: 0;
    }

    .role-badge-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .role-badge-name {
      font-size: 9.5px;
      font-weight: 800;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.15;
    }

    .role-badge-desc {
      font-size: 7.5px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: 'Inter', sans-serif;
      line-height: 1.15;
    }

    /* Capabilities & Title Review Strip */
    .capabilities-mini-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 2px;
    }

    .cap-pod {
      background: #F8FAFC;
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      padding: 4px 7px;
      display: flex;
      flex-direction: column;
      gap: 1.5px;
    }

    .cap-pod-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      font-weight: 800;
      color: var(--blue-cobalt);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .cap-pod-desc {
      font-size: 8.5px;
      color: var(--text-main);
      font-weight: 600;
      line-height: 1.2;
    }

    .sec-right-footer {
      padding-top: 6px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .source-logos-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .src-chip {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      color: var(--blue-cobalt);
      background: #EFF6FF;
      border: 1px solid var(--border-blue);
      padding: 2.5px 7px;
      border-radius: 4px;
    }

    /* =====================================================================
       SECTION 4: BOTTOM SECTION – PRODUCT JOURNEY PIPELINE (NEAT FLOW)
       ===================================================================== */
    .sec-bottom {
      position: relative;
      z-index: 10;
      height: 196px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 14px 44px 16px 44px;
      background: #FFFFFF;
      box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.03);
    }

    .journey-header-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .journey-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--blue-primary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .journey-sub {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* 5-Step Visual Journey Pipeline */
    .five-step-flow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      margin: 6px 0;
    }

    .step-node {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 8px 14px;
      position: relative;
      z-index: 3;
      flex: 1;
      max-width: 260px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
    }

    .step-node:hover {
      background: #F0F7FF;
      border-color: var(--blue-primary);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.12);
    }

    .step-number-ring {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #EFF6FF;
      border: 1.5px solid var(--blue-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 900;
      color: var(--blue-primary);
      flex-shrink: 0;
    }

    .step-node:nth-child(3) .step-number-ring {
      border-color: var(--blue-cyan);
      color: var(--blue-cyan);
      background: #F0F9FF;
    }

    .step-node:nth-child(5) .step-number-ring {
      border-color: var(--blue-primary);
      color: var(--blue-primary);
      background: #EFF6FF;
    }

    .step-node:nth-child(7) .step-number-ring {
      border-color: var(--blue-cobalt);
      color: var(--blue-cobalt);
      background: #EEF2FF;
    }

    .step-node:nth-child(9) {
      border-color: rgba(5, 150, 105, 0.5);
      background: #ECFDF5;
    }

    .step-node:nth-child(9) .step-number-ring {
      background: var(--teal-accent);
      border-color: var(--teal-accent);
      color: #FFFFFF;
    }

    .step-copy {
      display: flex;
      flex-direction: column;
    }

    .step-title {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .step-subtitle {
      font-size: 9.5px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .flow-arrow-separator {
      color: var(--blue-primary);
      padding: 0 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .flow-arrow-separator svg {
      width: 17px;
      height: 17px;
      stroke: var(--blue-primary);
      stroke-width: 2.8;
      opacity: 0.8;
    }

    /* Final Brand Message Banner Strip */
    .brand-closing-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
    }

    .final-brand-quote {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .final-quote-text {
      font-size: 14.5px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }

    .final-quote-text span.brand-ojix {
      color: var(--blue-primary);
    }

    .final-quote-sub {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
      border-left: 2px solid var(--border-blue);
      padding-left: 12px;
    }

    .enterprise-signature {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      color: var(--text-muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .enterprise-signature strong {
      color: var(--text-main);
      font-weight: 800;
    }

    @media (max-width: 1650px) {
      body { padding: 15px 5px; }
      .presentation-controls { width: 100%; }
      .banner-master { transform-origin: top center; }
    }
  </style>
</head>
<body data-theme="white-blue">

  <!-- Presentation Control Bar with Connection Flow Summary -->
  <aside class="presentation-controls" aria-label="Presentation bar">
    <div style="display: flex; align-items: center; gap: 14px;">
      <div class="badge-pres">
        <span class="pulse-dot"></span>
        OJIX Property Intelligence &middot; Govt Records &amp; Visual Flow Edition
      </div>

      <!-- Visible Connection Flow Breadcrumb: Where We Start to Final Report -->
      <div class="flow-indicator-banner" aria-label="Process Flow">
        <span class="flow-step-tag start">&#9679; START: Deed &amp; Document Intake</span>
        <span class="flow-arr">&rarr;</span>
        <span class="flow-step-tag mid">&#9679; Satellite Cadastre &amp; GIS Rules</span>
        <span class="flow-arr">&rarr;</span>
        <span class="flow-step-tag end">&#9679; OUTCOME: Govt Verified &amp; Advocate Certified</span>
      </div>
    </div>

    <div class="btn-group">
      <button type="button" class="pres-btn" onclick="toggleFullScreen()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        Fullscreen
      </button>
      <button type="button" class="pres-btn" onclick="window.print()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print / PDF
      </button>
      <a href="OJIX_Client_Showcase_Banner.png" download="OJIX_Client_Showcase_Banner.png" class="pres-btn primary">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Banner PNG
      </a>
    </div>
  </aside>

  <!-- =====================================================================
       MASTER MARKETING BANNER (WHITE & BLUE ARCHITECTURAL EDITION)
       ===================================================================== -->
  <main class="banner-master" id="bannerMaster" role="region" aria-label="OJIX Property Intelligence Marketing Banner">
    
    <div class="ambient-glow-1" aria-hidden="true"></div>
    <div class="ambient-glow-2" aria-hidden="true"></div>

    <!-- Global Connection Flow Cable Connecting the 3 Main Sections -->
    <svg class="global-flow-svg" viewBox="0 0 1600 1000" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Connection Flow Cable 1: From Left Section (Where We Start) to Center Cadastre -->
      <path d="M 430,440 C 490,440 480,260 550,260" stroke="#2563EB" stroke-width="2.8" stroke-dasharray="6 4" opacity="0.7"/>
      <circle cx="430" cy="440" r="5" fill="#2563EB" stroke="#FFFFFF" stroke-width="2"/>
      <polygon points="550,260 540,255 540,265" fill="#2563EB"/>

      <!-- Connection Flow Cable 2: From Center Cadastre to Right Outcome -->
      <path d="M 1120,530 C 1150,530 1140,360 1180,360" stroke="#2563EB" stroke-width="2.8" stroke-dasharray="6 4" opacity="0.7"/>
      <circle cx="1120" cy="530" r="5" fill="#2563EB" stroke="#FFFFFF" stroke-width="2"/>
      <polygon points="1180,360 1170,355 1170,365" fill="#2563EB"/>
    </svg>

    <!-- TOP STATUS STRIP -->
    <header class="top-status-strip">
      <div class="top-strip-left">
        <div class="client-tagline">
          <span class="dot"></span>
          Enterprise Land &amp; Property Due Diligence
        </div>
      </div>
      <div class="top-strip-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Built for Developers &middot; Real Estate Funds &middot; Legal Counsels &middot; Banks
      </div>
      <div class="top-strip-right">
        <span>Karnataka State Focus</span>
        <span class="live-compliance-chip">&#10003; 100% Traceable Citations</span>
      </div>
    </header>

    <!-- MAIN THREE-COLUMN SHOWCASE BODY -->
    <div class="showcase-body">

      <!-- ================================================================
           SECTION 1: LEFT SECTION – WHERE WE START (INTAKE & DIGITAL ASSETS)
           ================================================================ -->
      <section class="sec-left">
        
        <div>
          <!-- "WHERE WE START" Pipeline Indicator Badge -->
          <div class="stage-badge-flow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            WHERE WE START &middot; STEP 01
          </div>

          <div class="brand-hero-block">
            <div class="logo-container">
              <img class="logo-img" src="${logoB64 || '/assets/ojix-wordmark-header.png'}" alt="OJIX Logo" />
              <span class="enterprise-edition-pill">ENTERPRISE SAAS</span>
            </div>

            <div class="main-title-block">
              <span class="headline-eyebrow">OJIX PROPERTY INTELLIGENCE</span>
              <h1 class="main-headline">
                Property Due Diligence.
                <span class="reimagined">Reimagined.</span>
              </h1>
              <p class="subheading-copy">
                A unified intelligence platform for property verification, legal due diligence, government record references, GIS analysis and evidence-based decision-making.
              </p>
            </div>
          </div>
        </div>

        <!-- Featured 3D Clear Generated Illustration for Document Intake -->
        <div class="hero-image-card-intake">
          <img class="doc-preview-thumb" src="${docReviewB64 || '/images/ojix-document-review.webp'}" alt="Digital & Physical Document Intake" />
          <div class="intake-card-info">
            <h5>Deed &amp; Title Ingestion</h5>
            <p>Physical deeds, sale agreements, and revenue extracts scanned into cryptographic verified assets.</p>
            <div class="intake-tags-row">
              <span class="doc-pill">SALE DEED</span>
              <span class="doc-pill">RTC FORM-16</span>
              <span class="doc-pill">30-YR EC</span>
              <span class="doc-pill">MUTATION</span>
            </div>
          </div>
        </div>

        <!-- Document Intelligence & Bilingual OCR Engine Card -->
        <div class="ocr-engine-card">
          <div class="ocr-header-row">
            <div class="ocr-title-block">
              <div class="ocr-icon-badge">⚡</div>
              <span class="ocr-title-text">Document Intelligence &amp; Bilingual OCR</span>
            </div>
            <span class="ocr-acc-badge">99.4% KAN/ENG</span>
          </div>
          <p class="ocr-desc-text">Automated entity extraction across handwritten &amp; printed Kannada RTC Pahanis, registered deeds, and survey notes.</p>
          <div class="ocr-chips-row">
            <span class="ocr-chip">SURVEY PARCEL #</span>
            <span class="ocr-chip">EXTENT MATCH</span>
            <span class="ocr-chip">KHATHA OWNER</span>
            <span class="ocr-chip">ENCUMBRANCE CHECK</span>
          </div>
        </div>

        <!-- 4 Structured Feature Pods -->
        <div class="feature-pods-grid">
          
          <article class="feature-pod">
            <div class="pod-top">
              <div class="pod-icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <span class="pod-title">Digital Verification</span>
            </div>
            <p class="pod-desc">Authenticates deeds &amp; historical title transfers.</p>
          </article>

          <article class="feature-pod">
            <div class="pod-icon-box" style="background:#F0F9FF; color:var(--blue-cyan); border-color:rgba(2,132,199,0.3);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
            <span class="pod-title">Govt Records</span>
            <p class="pod-desc">Bhoomi RTC, Kaveri 2.0 &amp; Court cross-match.</p>
          </article>

          <article class="feature-pod">
            <div class="pod-top">
              <div class="pod-icon-box" style="background:#ECFDF5; color:var(--teal-accent); border-color:rgba(5,150,105,0.3);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/></svg>
              </div>
              <span class="pod-title">Spatial Risk</span>
            </div>
            <p class="pod-desc">Automated Rajakaluve &amp; lake buffer checks.</p>
          </article>

          <article class="feature-pod">
            <div class="pod-top">
              <div class="pod-icon-box" style="background:#EEF2FF; color:var(--blue-cobalt); border-color:rgba(30,64,175,0.3);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              </div>
              <span class="pod-title">Legal Due Diligence</span>
            </div>
            <p class="pod-desc">Defensible title opinion &amp; audit reports.</p>
          </article>

        </div>

        <!-- Outgoing Connection Pipeline Flow -->
        <div class="outgoing-flow-pill">
          <span>Flows to Satellite Cadastre &amp; GIS</span>
          <span class="flow-arrow">STEP 02 ➔</span>
        </div>
      </section>

      <!-- ================================================================
           SECTION 2: CENTRE SECTION – MAIN HERO VISUAL (SATELLITE & CADASTRE)
           ================================================================ -->
      <section class="sec-center">
        
        <!-- Background Satellite Imagery Viewport -->
        <div class="center-map-viewport" aria-hidden="true">
          <img class="satellite-hero-bg" src="${heroSatelliteB64 || '/images/ojix-property-hero.webp'}" alt="Karnataka Cadastral Satellite Imagery" />
          <div class="satellite-overlay-gradient"></div>
        </div>

        <!-- Cadastral Vector Polygon Overlay on Satellite Map -->
        <svg class="cadastral-svg-layer" viewBox="0 0 680 740" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Property Polygon Survey Boundary Highlight (Vivid Royal Blue Cadastral Outline) -->
          <polygon points="180,180 470,140 520,390 240,430" fill="rgba(37, 99, 235, 0.16)" stroke="#2563EB" stroke-width="3.2" stroke-dasharray="6 3" filter="drop-shadow(0 0 12px rgba(37, 99, 235, 0.5))"/>
          
          <!-- Inner Survey Subdivision Boundary -->
          <line x1="330" y1="160" x2="380" y2="410" stroke="#2563EB" stroke-width="2" stroke-dasharray="3 3" opacity="0.8"/>

          <!-- Rajakaluve / Drain Buffer Line Outside Boundary (Emerald Safe Buffer) -->
          <path d="M80,240 Q130,290 120,470" stroke="#059669" stroke-width="2.5" stroke-dasharray="4 4" opacity="0.9"/>
          <text x="75" y="360" fill="#059669" font-family="JetBrains Mono" font-size="9" font-weight="800" transform="rotate(-75 75 360)">RAJAKALUVE 50M BUFFER (NO CONFLICT)</text>

          <!-- Master Plan Road Boundary -->
          <path d="M150,140 L530,95" stroke="#1D4ED8" stroke-width="2.2" stroke-dasharray="5 3" opacity="0.9"/>
          <text x="270" y="112" fill="#1D4ED8" font-family="JetBrains Mono" font-size="9" font-weight="800">45M CDP MASTER PLAN ROAD ROW</text>

          <!-- Vertex Coordinate Pins with Royal Blue Rings -->
          <circle cx="180" cy="180" r="5" fill="#FFFFFF" stroke="#2563EB" stroke-width="2.8"/>
          <circle cx="470" cy="140" r="5" fill="#FFFFFF" stroke="#2563EB" stroke-width="2.8"/>
          <circle cx="520" cy="390" r="5" fill="#FFFFFF" stroke="#2563EB" stroke-width="2.8"/>
          <circle cx="240" cy="430" r="5" fill="#FFFFFF" stroke="#2563EB" stroke-width="2.8"/>
        </svg>

        <!-- Center Content Elements -->
        <div class="center-content-layer">

          <!-- Center Top Bar -->
          <div class="center-top-bar">
            <div class="karnataka-location-info">
              <img class="karnataka-state-thumb" src="${karnatakaMapB64 || '/assets/karnataka-map-clean.png'}" alt="Karnataka State Map" />
              <div class="loc-details">
                <h4>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Karnataka Cadastral Spatial Frame
                </h4>
                <p>BANGALORE RURAL &middot; DEVANAHALLI TALUK &middot; VIJAYAPURA HOBLI</p>
              </div>
            </div>

            <div class="parcel-coordinates-pill">
              <span>LAT: 13.2437&deg; N &middot; LNG: 77.7126&deg; E</span>
              GPS Calibrated &middot; Survey Cadastre Verified
            </div>
          </div>

          <!-- Cadastral Center Stage with Floating White Miniature Cards -->
          <div class="cadastral-hero-stage">

            <!-- Cardinal Boundaries -->
            <div class="cardinal-pill north">
              <strong>N:</strong> 45m Zonal Master Plan Road Corridor
            </div>
            <div class="cardinal-pill south">
              <strong>S:</strong> Sy. No. 143 (Private Clear Agricultural Parcel)
            </div>
            <div class="cardinal-pill west">
              <strong>W:</strong> Sy. No. 141 (Govt Canal Buffer Maintained)
            </div>
            <div class="cardinal-pill east">
              <strong>E:</strong> Sy. No. 142/3B (Recorded Boundary Stone)
            </div>

            <!-- Floating Miniature Card 1: Survey & Land Record Card -->
            <div class="mini-card-survey">
              <div class="mini-card-header">
                <span class="tag">BHOOMI RECORD MATCH</span>
                <span class="doc-num">FORM-16 RTC</span>
              </div>
              <div class="survey-number-title">Survey No. 142/3A</div>
              <div class="extent-item" style="margin-bottom: 3px;">
                <span class="label">Primary Landholder</span>
                <span class="val">R. Venkatesh Murthy &amp; Co-holders</span>
              </div>
              <div class="survey-extent-grid">
                <div class="extent-item">
                  <span class="label">Total Extent</span>
                  <span class="val">2 Acres 14 Guntas</span>
                </div>
                <div class="extent-item">
                  <span class="label">Podi Status</span>
                  <span class="val" style="color: var(--teal-accent);">11E Sketch Valid</span>
                </div>
              </div>
            </div>

            <!-- Floating Miniature Card 2: 3D Clear Cadastre Map Image Card -->
            <div class="mini-card-cadastre-visual">
              <img class="cadastre-thumb" src="${recordsB64 || '/images/ojix-property-records.webp'}" alt="Karnataka Cadastre Parcel Illustration" />
              <div class="cadastre-meta-group">
                <strong>Devanahalli Cadastre</strong>
                <span>Spatial Parcel Polygon</span>
                <span class="badge-live">&#10003; BOUNDARY LOCKED</span>
              </div>
            </div>

          </div>

          <!-- Bottom Visual Pods: GIS Risk Markers & Verification Status Panel -->
          <div style="display: flex; flex-direction: column; gap: 7px;">
            
            <!-- 4 GIS Risk Markers -->
            <div class="gis-risk-markers-row">
              <div class="gis-marker-chip success">
                <div class="marker-top">
                  <span>Rajakaluve Drain</span>
                  <span class="marker-status">0m Conflict</span>
                </div>
                <div class="marker-sub">50m buffer clear of parcel</div>
              </div>

              <div class="gis-marker-chip teal">
                <div class="marker-top">
                  <span>Lake 30m Buffer</span>
                  <span class="marker-status">110m Clearance</span>
                </div>
                <div class="marker-sub">No NGT setback infringement</div>
              </div>

              <div class="gis-marker-chip purple">
                <div class="marker-top">
                  <span>CDP Zoning</span>
                  <span class="marker-status">Hi-Tech Industrial</span>
                </div>
                <div class="marker-sub">Conforms to master plan</div>
              </div>

              <div class="gis-marker-chip amber">
                <div class="marker-top">
                  <span>Litigation Search</span>
                  <span class="marker-status">Dispute-Free</span>
                </div>
                <div class="marker-sub">High Court &amp; Civil Court clear</div>
              </div>
            </div>

            <!-- Verification Status Panel -->
            <div class="verification-status-panel">
              <div class="status-left">
                <div class="shield-badge-gold">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                </div>
                <div class="status-text-block">
                  <h5>
                    Due Diligence Verification Status
                    <span class="verified-pill">CLEARED &middot; EVIDENCE BACKED</span>
                  </h5>
                  <p>Advocate Certified &middot; 14 Evidentiary Source Records Attached &middot; Audit-Proof</p>
                </div>
              </div>

              <div class="status-right-metrics">
                <div class="metric-pod">
                  <span class="number">98.4%</span>
                  <span class="caption">Title Integrity</span>
                </div>
                <div class="metric-pod">
                  <span class="number">0</span>
                  <span class="caption">Spatial Conflicts</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </section>

      <!-- ================================================================
           SECTION 3: RIGHT SECTION – GOVT WEBSITES & FINAL OUTCOME
           ================================================================ -->
      <section class="sec-right">
        
        <div>
          <!-- Final Outcome Banner -->
          <div class="stage-badge-outcome">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            FINAL OUTCOME &middot; STEP 05
          </div>

          <div class="sec-right-header">
            <span class="eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              GOVERNMENT REGISTRY INTELLIGENCE
            </span>
            <h3>Govt Sources &amp; Certified Dossier</h3>
          </div>
        </div>

        <!-- Featured 3D Clear Generated Illustration for Final Certified Dossier -->
        <div class="hero-image-card-outcome">
          <img class="risk-thumb" src="${riskB64 || '/images/ojix-risk-assessment.webp'}" alt="Advocate Certified LSR Dossier" />
          <div class="outcome-card-info">
            <h5>Certified LSR Dossier</h5>
            <p>Advocate sign-off, bank-ready legal search report, and complete evidence audit dossier.</p>
            <div class="outcome-tags-row">
              <span class="outcome-pill">&#10003; 30-YR UNBROKEN CHAIN</span>
              <span class="outcome-pill">&#10003; BOARD READY</span>
            </div>
          </div>
        </div>

        <!-- ================================================================
             4 COLOR-DIFFERENTIATED GOVERNMENT PORTAL RECONCILIATION CARDS
             ================================================================ -->
        <div>
          <div class="govt-portals-title">
            <span>OFFICIAL GOVT PORTALS RECONCILED</span>
            <span style="color:var(--teal-accent); font-size:8px;">● 4/4 CITATIONS ATTACHED</span>
          </div>

          <div class="govt-portals-grid">
            
            <!-- 1. BHOOMI (Amber Gold) -->
            <article class="govt-portal-card bhoomi">
              <div class="portal-header-row">
                <div class="portal-brand-block">
                  <div class="portal-crest-icon bhoomi">🌾</div>
                  <span class="portal-title-text">Bhoomi Portal</span>
                </div>
                <span class="portal-badge">LAND RECORDS</span>
              </div>
              <div class="portal-url-tag">🔒 landrecords.karnataka.gov.in</div>
              <div class="portal-data-val">RTC Form-16 &amp; MR-21 Mutation Extract</div>
            </article>

            <!-- 2. KAVERI 2.0 (Royal Blue) -->
            <article class="govt-portal-card kaveri">
              <div class="portal-header-row">
                <div class="portal-brand-block">
                  <div class="portal-crest-icon kaveri">📜</div>
                  <span class="portal-title-text">Kaveri 2.0</span>
                </div>
                <span class="portal-badge">REGISTRATION</span>
              </div>
              <div class="portal-url-tag">🔒 kaveri.karnataka.gov.in</div>
              <div class="portal-data-val">Doc #4821 Deed &amp; 30-Yr Nil EC (Form 15)</div>
            </article>

            <!-- 3. MOJINI 11E (Cyan Teal) -->
            <article class="govt-portal-card mojini">
              <div class="portal-header-row">
                <div class="portal-brand-block">
                  <div class="portal-crest-icon mojini">📐</div>
                  <span class="portal-title-text">Mojini SSLR</span>
                </div>
                <span class="portal-badge">CADASTRAL</span>
              </div>
              <div class="portal-url-tag">🔒 mojini.karnataka.gov.in</div>
              <div class="portal-data-val">11E Pre-Mutation Sketch &amp; Tippani Stone</div>
            </article>

            <!-- 4. HIGH COURT OF KARNATAKA (Crimson with Real Photo) -->
            <article class="govt-portal-card highcourt">
              <div class="portal-header-row">
                <div class="portal-brand-block">
                  <img class="portal-court-img" src="${highCourtB64 || '/karnataka-high-court-exact.png'}" alt="High Court of Karnataka Attara Kacheri" />
                  <span class="portal-title-text">Karnataka High Court</span>
                </div>
                <span class="portal-badge">LITIGATION</span>
              </div>
              <div class="portal-url-tag">🔒 karnatakahiighcourt.kar.nic.in</div>
              <div class="portal-data-val">Civil Suit / Injunction Search: 0 Disputes</div>
            </article>

          </div>
        </div>

        <!-- ================================================================
             10 ROLE-BASED ACCESS CONTROL (RBAC) LEVELS MATRIX
             ================================================================ -->
        <div class="roles-matrix-section">
          <div class="roles-matrix-title">
            <span>10 ROLE-BASED ACCESS CONTROL (RBAC) LEVELS</span>
            <span class="rbac-tag">ISO / SOC-2 GOVERNANCE</span>
          </div>

          <div class="roles-grid">
            <!-- 1. Workspace Owner -->
            <div class="role-badge-card" style="border-color: #C4B5FD; background: #FAF5FF;">
              <div class="role-badge-icon" style="background: #EDE9FE; color: #6D28D9;">👑</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #6D28D9;">Workspace Owner</span>
                <span class="role-badge-desc">Matters &amp; Operations</span>
              </div>
            </div>

            <!-- 2. Super Admin -->
            <div class="role-badge-card" style="border-color: #BFDBFE; background: #EFF6FF;">
              <div class="role-badge-icon" style="background: #DBEAFE; color: #1E40AF;">🛡️</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #1E40AF;">Super Admin</span>
                <span class="role-badge-desc">Platform Governance</span>
              </div>
            </div>

            <!-- 3. Org Admin -->
            <div class="role-badge-card" style="border-color: #BAE6FD; background: #F0F9FF;">
              <div class="role-badge-icon" style="background: #E0F2FE; color: #0369A1;">⚙️</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #0369A1;">Org Admin</span>
                <span class="role-badge-desc">Members &amp; Workflows</span>
              </div>
            </div>

            <!-- 4. Legal Reviewer -->
            <div class="role-badge-card" style="border-color: #C7D2FE; background: #EEF2FF;">
              <div class="role-badge-icon" style="background: #E0E7FF; color: #3730A3;">⚖️</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #3730A3;">Legal Reviewer</span>
                <span class="role-badge-desc">Title Opinion Sign-Off</span>
              </div>
            </div>

            <!-- 5. Evidence Analyst -->
            <div class="role-badge-card" style="border-color: #A7F3D0; background: #ECFDF5;">
              <div class="role-badge-icon" style="background: #D1FAE5; color: #047857;">🔍</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #047857;">Evidence Analyst</span>
                <span class="role-badge-desc">Record Chain Analysis</span>
              </div>
            </div>

            <!-- 6. Doc Operations -->
            <div class="role-badge-card" style="border-color: #FED7AA; background: #FFF7ED;">
              <div class="role-badge-icon" style="background: #FFEDD5; color: #C2410C;">📁</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #C2410C;">Doc Operations</span>
                <span class="role-badge-desc">Intake &amp; OCR Queues</span>
              </div>
            </div>

            <!-- 7. Consultant -->
            <div class="role-badge-card" style="border-color: #99F6E4; background: #F0FDFA;">
              <div class="role-badge-icon" style="background: #CCFBF1; color: #0F766E;">💼</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #0F766E;">Consultant</span>
                <span class="role-badge-desc">Client Dossier Review</span>
              </div>
            </div>

            <!-- 8. Support -->
            <div class="role-badge-card" style="border-color: #DDD6FE; background: #FAF5FF;">
              <div class="role-badge-icon" style="background: #F5F3FF; color: #7C3AED;">🎧</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #7C3AED;">Support</span>
                <span class="role-badge-desc">System Diagnostics</span>
              </div>
            </div>

            <!-- 9. Data Steward -->
            <div class="role-badge-card" style="border-color: #A5F3FC; background: #ECFEFF;">
              <div class="role-badge-icon" style="background: #CFFAFE; color: #0E7490;">🗄️</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #0E7490;">Data Steward</span>
                <span class="role-badge-desc">Land Reference Records</span>
              </div>
            </div>

            <!-- 10. Viewer -->
            <div class="role-badge-card" style="border-color: #CBD5E1; background: #F8FAFC;">
              <div class="role-badge-icon" style="background: #F1F5F9; color: #475569;">👁️</div>
              <div class="role-badge-content">
                <span class="role-badge-name" style="color: #475569;">Viewer</span>
                <span class="role-badge-desc">Approved Read-Only</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Key Capabilities & Title Review Strip -->
        <div class="capabilities-mini-strip">
          <div class="cap-pod">
            <span class="cap-pod-title">Title &amp; Ownership Review</span>
            <span class="cap-pod-desc">30-Yr Unbroken Chain &amp; Nil Encumbrance</span>
          </div>
          <div class="cap-pod">
            <span class="cap-pod-title">Evidence-Based Reporting</span>
            <span class="cap-pod-desc">Court-Admissible Dossier &amp; Citations</span>
          </div>
        </div>

        <div class="sec-right-footer">
          <div class="source-logos-row">
            <span class="src-chip" style="color:#B45309; background:#FEF3C7; border-color:rgba(217,119,6,0.3);">BHOOMI</span>
            <span class="src-chip" style="color:#1D4ED8; background:#EFF6FF; border-color:rgba(37,99,235,0.3);">KAVERI 2.0</span>
            <span class="src-chip" style="color:#0284C7; background:#F0F9FF; border-color:rgba(2,132,199,0.3);">MOJINI 11E</span>
            <span class="src-chip" style="color:#BE123C; background:#FFF1F2; border-color:rgba(190,18,60,0.3);">HIGH COURT</span>
          </div>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--teal-accent); font-weight: 800;">PROVENANCE 100%</span>
        </div>
      </section>

    </div>

    <!-- =====================================================================
       SECTION 4 & 5: BOTTOM SECTION – PRODUCT JOURNEY (NEAT FLOW PIPELINE)
       ===================================================================== */
    <footer class="sec-bottom">
      
      <!-- Journey Header -->
      <div class="journey-header-strip">
        <div class="journey-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Connected Due Diligence Workflow Pipeline &middot; End-to-End Traceability
        </div>
        <div class="journey-sub">Where We Start (Intake) &rarr; Verification &rarr; GIS Analysis &rarr; Advocate Sign-Off (Dossier)</div>
      </div>

      <!-- 5-Step Visual Journey with Connected Flow Pipeline -->
      <nav class="five-step-flow" aria-label="Due diligence process stages">

        <!-- Step 1 (Where We Start) -->
        <div class="step-node" style="border-color: var(--blue-primary); background: #EFF6FF;">
          <div class="step-number-ring" style="background: var(--blue-primary); color: #FFFFFF;">01</div>
          <div class="step-copy">
            <span class="step-title" style="color: var(--blue-dark);">START: Property Intake</span>
            <span class="step-subtitle">Deed upload &amp; survey indexing</span>
          </div>
        </div>

        <div class="flow-arrow-separator" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <!-- Step 2 -->
        <div class="step-node">
          <div class="step-number-ring">02</div>
          <div class="step-copy">
            <span class="step-title">Record Verification</span>
            <span class="step-subtitle">RTC, EC &amp; mutation matching</span>
          </div>
        </div>

        <div class="flow-arrow-separator" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <!-- Step 3 -->
        <div class="step-node">
          <div class="step-number-ring">03</div>
          <div class="step-copy">
            <span class="step-title">GIS Analysis</span>
            <span class="step-subtitle">Cadastre &amp; buffer risk zoning</span>
          </div>
        </div>

        <div class="flow-arrow-separator" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <!-- Step 4 -->
        <div class="step-node">
          <div class="step-number-ring">04</div>
          <div class="step-copy">
            <span class="step-title">Legal Review</span>
            <span class="step-subtitle">Title flow &amp; dispute clearance</span>
          </div>
        </div>

        <div class="flow-arrow-separator" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <!-- Step 5 (Final Result) -->
        <div class="step-node" style="border-color: rgba(5, 150, 105, 0.5); background: #ECFDF5;">
          <div class="step-number-ring" style="background: var(--teal-accent); color: #FFFFFF; border-color: var(--teal-accent);">05</div>
          <div class="step-copy">
            <span class="step-title" style="color: var(--teal-accent);">RESULT: Final Report</span>
            <span class="step-subtitle">Certified legal title dossier</span>
          </div>
        </div>

      </nav>

      <!-- Final Brand Message & Corporate Signature -->
      <div class="brand-closing-bar">
        <div class="final-brand-quote">
          <div class="final-quote-text">
            <span class="brand-ojix">OJIX</span> &ndash; Bringing Property Intelligence Into One Workspace.
          </div>
          <div class="final-quote-sub">
            Unified due diligence infrastructure for high-value land transactions &amp; developments.
          </div>
        </div>

        <div class="enterprise-signature">
          <span>Enterprise SaaS Edition</span>
          &middot;
          <strong>OJIX Engineering &amp; Technology LLP</strong>
        </div>
      </div>

    </footer>

  </main>

  <script>
    function toggleFullScreen() {
      const banner = document.getElementById('bannerMaster');
      if (!document.fullscreenElement) {
        if (banner.requestFullscreen) {
          banner.requestFullscreen();
        } else if (banner.webkitRequestFullscreen) {
          banner.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }
  </script>

</body>
</html>
`;

// Write standalone banner file
const outHtml = path.join(rootDir, 'OJIX_Client_Showcase_Banner.html');
fs.writeFileSync(outHtml, htmlContent, 'utf-8');
console.log('Created:', outHtml);

// Also copy to apps/web/public/assets
const webAssetsDir = path.join(rootDir, 'apps/web/public/assets');
if (!fs.existsSync(webAssetsDir)) {
  fs.mkdirSync(webAssetsDir, { recursive: true });
}
const webHtml = path.join(webAssetsDir, 'OJIX_Client_Showcase_Banner.html');
fs.writeFileSync(webHtml, htmlContent, 'utf-8');
console.log('Copied to web assets:', webHtml);

const webDistAssetsDir = path.join(rootDir, 'apps/web/dist/assets');
if (fs.existsSync(webDistAssetsDir)) {
  fs.writeFileSync(path.join(webDistAssetsDir, 'OJIX_Client_Showcase_Banner.html'), htmlContent, 'utf-8');
  console.log('Copied to web dist assets');
}
