import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';

// Read real images as base64
const workspaceImgBase64 = fs.readFileSync(path.join(rootDir, 'apps/web/public/images/ojix-workspace-overview.webp')).toString('base64');
const correctLogoBase64 = fs.readFileSync(path.join(rootDir, 'ojix-logo-correct.png')).toString('base64');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJIX Property Intelligence — Showcase Banner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #060708;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 30px 15px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .banner-container {
      width: 1440px;
      height: 960px;
      display: flex;
      position: relative;
      background: #000;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 40px 100px rgba(0, 0, 0, 0.85);
    }

    /* ========================================================
       PANEL 1: THE DISCONNECTED PRACTICE (LEFT)
       ======================================================== */
    .panel-left {
      width: 32%;
      background: #e2e6e8;
      position: relative;
      padding: 46px 42px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    /* Subtle folded paper / crinkle texture */
    .panel-left::before {
      content: "";
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(circle at 20% 30%, rgba(255,255,255,0.7) 0%, transparent 45%),
        linear-gradient(135deg, rgba(0,0,0,0.06) 0%, transparent 35%, rgba(0,0,0,0.08) 70%, rgba(255,255,255,0.4) 100%),
        repeating-linear-gradient(45deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 2px, transparent 2px, transparent 4px);
      pointer-events: none;
    }

    .micro-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      position: relative;
      z-index: 10;
    }
    .micro-header svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
    }

    /* Floating chaotic cards container */
    .chaos-cards {
      position: relative;
      height: 390px;
      margin-top: 10px;
      z-index: 5;
    }
    .sticker-card {
      position: absolute;
      padding: 16px 22px;
      border-radius: 3px;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.12);
      transform-origin: center center;
    }
    .card-cases {
      top: 15px;
      left: 10px;
      background: #ffffff;
      color: #0f172a;
      transform: rotate(-6deg);
      border: 1px solid rgba(0,0,0,0.06);
    }
    .card-cases h3 {
      font-size: 34px;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .card-cases p {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      letter-spacing: 0.16em;
      color: #64748b;
      margin-top: 8px;
      font-weight: 800;
    }

    .card-hearing {
      top: 80px;
      left: 140px;
      background: #111418;
      color: #ffffff;
      transform: rotate(-10deg);
      padding: 14px 22px;
      box-shadow: 0 18px 36px rgba(0,0,0,0.24);
    }
    .card-hearing h3 {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 0.02em;
      line-height: 1;
    }
    .card-hearing p {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      letter-spacing: 0.18em;
      color: #94a3b8;
      margin-top: 6px;
      font-weight: 800;
    }

    .card-documents {
      top: 180px;
      left: 8px;
      background: #ffffff;
      color: #0f172a;
      transform: rotate(-4deg);
      padding: 18px 24px;
      border: 1px solid rgba(0,0,0,0.06);
    }
    .card-documents h3 {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 0.95;
    }

    /* Orange bridging deadline tape */
    .card-deadline {
      top: 295px;
      left: 135px;
      background: #ff4713;
      color: #111418;
      transform: rotate(8deg);
      padding: 12px 28px;
      font-weight: 900;
      font-size: 18px;
      letter-spacing: 0.06em;
      box-shadow: 0 12px 28px rgba(255, 71, 19, 0.4);
      z-index: 12;
      white-space: nowrap;
    }

    .panel-left-bottom {
      position: relative;
      z-index: 10;
    }
    .title-too-many {
      font-size: 56px;
      line-height: 0.92;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .title-too-many .highlight-white {
      color: #ffffff;
      text-shadow: 0 2px 14px rgba(0,0,0,0.18);
    }
    .panel-left-desc {
      font-size: 13px;
      line-height: 1.55;
      color: #475569;
      font-weight: 600;
      max-width: 95%;
    }

    /* ========================================================
       PANEL 2: BRING IT ALL TOGETHER (MIDDLE - ORANGE)
       ======================================================== */
    .panel-middle {
      width: 33%;
      background: #ff4713;
      position: relative;
      padding: 46px 42px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      z-index: 20;
    }
    .panel-middle .micro-header {
      color: #111418;
    }
    .panel-middle-content {
      position: relative;
      z-index: 10;
      margin-top: 10px;
    }
    .headline-bring {
      font-size: 58px;
      line-height: 0.92;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #111418;
      text-transform: uppercase;
      margin-bottom: 22px;
    }

    /* Custom Curved Arrow SVG */
    .arrow-flow-container {
      position: relative;
      width: 100%;
      height: 110px;
      margin: 5px 0 20px -30px;
      overflow: visible;
    }

    .middle-lead-text {
      font-size: 17px;
      line-height: 1.38;
      font-weight: 700;
      color: #111418;
      margin-bottom: 28px;
    }

    /* CTA Button Box */
    .cta-demo-bar {
      border-top: 2px solid #111418;
      border-bottom: 2px solid #111418;
      padding: 18px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      text-decoration: none;
      color: #111418;
      transition: all 0.2s ease;
    }
    .cta-demo-bar:hover {
      padding-left: 6px;
    }
    .cta-demo-text {
      font-size: 16.5px;
      font-weight: 900;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .cta-demo-bar svg {
      width: 22px;
      height: 22px;
      stroke: #111418;
      stroke-width: 2.8;
    }

    /* QR Code and Web link */
    .qr-contact-section {
      display: flex;
      align-items: center;
      gap: 22px;
      margin-top: 30px;
      margin-bottom: 20px;
    }
    .qr-frame {
      width: 80px;
      height: 80px;
      border: 2px solid #111418;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.15);
      padding: 6px;
    }
    .qr-frame::before, .qr-frame::after {
      content: "";
      position: absolute;
      width: 10px;
      height: 10px;
      border-color: #111418;
    }
    .qr-frame::before {
      top: -2px; left: -2px;
      border-top: 3px solid #111418;
      border-left: 3px solid #111418;
    }
    .qr-frame::after {
      bottom: -2px; right: -2px;
      border-bottom: 3px solid #111418;
      border-right: 3px solid #111418;
    }
    .qr-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7px;
      font-weight: 800;
      text-align: center;
      line-height: 1.1;
      letter-spacing: 0.05em;
      color: #111418;
    }
    .contact-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .contact-info .domain {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #111418;
    }
    .contact-info .email {
      font-size: 13.5px;
      font-weight: 700;
      color: #111418;
    }

    .middle-footer {
      font-size: 11px;
      line-height: 1.4;
      font-weight: 700;
      color: #111418;
      opacity: 0.85;
    }

    /* ========================================================
       PANEL 3: ONE COMMAND CENTRE (RIGHT - OBSIDIAN)
       ======================================================== */
    .panel-right {
      width: 35%;
      background: #0f1115;
      position: relative;
      padding: 46px 46px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    /* Subtle geometric mesh background */
    .panel-right::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        radial-gradient(ellipse at 85% 20%, rgba(255, 71, 19, 0.12) 0%, transparent 60%);
      background-size: 38px 38px, 38px 38px, 100% 100%;
      pointer-events: none;
    }

    /* White cut-out polygon ribbon top right */
    .top-right-badge {
      position: absolute;
      top: 0;
      right: 0;
      width: 185px;
      height: 95px;
      background: #ffffff;
      clip-path: polygon(32% 0, 100% 0, 100% 100%, 0% 100%);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 28px;
      z-index: 30;
      box-shadow: -6px 12px 35px rgba(0,0,0,0.5);
    }
    .top-right-badge img {
      width: 95px;
      height: auto;
      object-fit: contain;
      display: block;
    }

    /* Product Title */
    .product-headline {
      margin-top: 10px;
      position: relative;
      z-index: 10;
    }
    .title-nyaya {
      font-size: 70px;
      line-height: 0.9;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #ffffff;
    }
    .title-nyaya sup {
      font-size: 20px;
      font-weight: 700;
      vertical-align: super;
      margin-left: 2px;
      color: #94a3b8;
    }

    .product-sub-headline {
      margin-top: 16px;
      font-size: 16.5px;
      font-weight: 800;
      line-height: 1.35;
      color: #ff5722;
      letter-spacing: -0.01em;
    }
    .product-desc {
      margin-top: 7px;
      font-size: 12.5px;
      line-height: 1.48;
      color: #94a3b8;
      font-weight: 500;
      max-width: 90%;
    }

    /* Photorealistic Laptop Mockup with Real Workspace UI */
    .laptop-showcase {
      position: relative;
      width: 100%;
      margin: 22px auto 10px;
      z-index: 15;
    }
    .laptop-frame {
      width: 400px;
      margin: 0 auto;
      background: #1e232a;
      border-radius: 14px 14px 2px 2px;
      padding: 10px 10px 8px;
      box-shadow: 
        0 25px 65px rgba(0, 0, 0, 0.85),
        0 0 0 1px rgba(255, 255, 255, 0.12);
      position: relative;
    }
    .laptop-notch {
      width: 58px;
      height: 4px;
      background: #0f1115;
      border-radius: 0 0 4px 4px;
      margin: -10px auto 6px;
    }
    .laptop-screen {
      background: #0b1120;
      border-radius: 6px;
      overflow: hidden;
      aspect-ratio: 16 / 10;
      position: relative;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: inset 0 0 12px rgba(0,0,0,0.6);
    }
    /* Embed actual live UI screenshot */
    .laptop-screen-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }

    /* Laptop Base Chassis */
    .laptop-base {
      width: 460px;
      height: 9px;
      background: #2b313a;
      margin: 0 auto;
      border-radius: 0 0 12px 12px;
      position: relative;
      box-shadow: 0 12px 24px rgba(0,0,0,0.65);
    }
    .laptop-base::after {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 3px;
      background: #111418;
      border-radius: 0 0 3px 3px;
    }

    .panel-right-bottom {
      position: relative;
      z-index: 10;
    }
    .headline-command {
      font-size: 38px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #ffffff;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .desc-command {
      font-size: 13.5px;
      line-height: 1.5;
      color: #94a3b8;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- MASTER BANNER CONTAINER -->
  <div class="banner-container">

    <!-- ========================================================
         COLUMN 1: THE DISCONNECTED PRACTICE (LIGHT GREY)
         ======================================================== -->
    <div class="panel-left">
      <div class="micro-header">
        <span>BEFORE / THE DISCONNECTED PRACTICE</span>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="17" y1="7" x2="7" y2="17"></line>
          <polyline points="17 17 7 17 7 7"></polyline>
        </svg>
      </div>

      <!-- Chaotic Floating Paper Notes / Badges -->
      <div class="chaos-cards">
        <!-- Card 1: Sale Deeds -->
        <div class="sticker-card card-cases">
          <h3>Deeds</h3>
          <p>01 / 40-YEAR TITLE CHAIN</p>
        </div>

        <!-- Card 2: RTC / Pahani -->
        <div class="sticker-card card-hearing">
          <h3>RTC / PAHANI</h3>
          <p>BHOOMI &amp; MUTATION EXTRACTS</p>
        </div>

        <!-- Card 3: Encumbrance -->
        <div class="sticker-card card-documents">
          <h3>ENCUM-<br>BRANCE.</h3>
        </div>

        <!-- Card 4: Bridging Sticker (Orange Tape) -->
        <div class="sticker-card card-deadline">
          BUFFER ZONES
        </div>
      </div>

      <!-- Bottom Headline & Text -->
      <div class="panel-left-bottom">
        <h1 class="title-too-many">
          TOO MANY<br>
          MOVING<br>
          <span class="highlight-white">PARTS?</span>
        </h1>
        <p class="panel-left-desc">
          Title deeds, RTC/Pahani records, 40-year chain reconstructions, EC encumbrances, and statutory spatial buffer violations rarely move in a straight line. OJIX Property brings the work behind your due diligence into one connected workspace.
        </p>
      </div>
    </div>

    <!-- ========================================================
         COLUMN 2: BRING IT ALL TOGETHER (VIBRANT ORANGE)
         ======================================================== -->
    <div class="panel-middle">
      <div class="micro-header">
        <span>LESS FRICTION, MORE SPEED.</span>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"></line>
          <polyline points="7 7 17 7 17 17"></polyline>
        </svg>
      </div>

      <div class="panel-middle-content">
        <h2 class="headline-bring">
          BRING<br>
          IT ALL<br>
          TOGETHER.
        </h2>

        <!-- Custom Flowing Arrow crossing towards column 3 -->
        <div class="arrow-flow-container">
          <svg width="380" height="110" viewBox="0 0 380 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 85 L 140 85 C 220 85 220 28 320 28 L 340 28" stroke="#111418" stroke-width="12" stroke-linecap="round"/>
            <path d="M 315 8 L 350 28 L 315 48" fill="#111418"/>
          </svg>
        </div>

        <p class="middle-lead-text">
          Discover a more connected way to conduct land &amp; property due diligence in Karnataka.
        </p>

        <!-- CTA Action Bar -->
        <a href="#demo" class="cta-demo-bar">
          <span class="cta-demo-text">BOOK A GUIDED PRODUCT DEMO</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </a>

        <!-- QR Code Placeholder & Contact -->
        <div class="qr-contact-section">
          <div class="qr-frame">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <circle cx="6.5" cy="6.5" r="1.5" fill="#111418"></circle>
              <circle cx="17.5" cy="6.5" r="1.5" fill="#111418"></circle>
              <circle cx="6.5" cy="17.5" r="1.5" fill="#111418"></circle>
              <path d="M14 17h3v3m-3-1v-2h2"></path>
            </svg>
            <span class="qr-text">SCAN DEMO</span>
          </div>
          <div class="contact-info">
            <span class="domain">WWW.OJIX.COM</span>
            <span class="email">info@ojix.in</span>
          </div>
        </div>

        <div class="middle-footer">
          OJIX Property Intelligence<br>
          OJIX Engineering &amp; Technology LLP
        </div>
      </div>
    </div>

    <!-- ========================================================
         COLUMN 3: ONE COMMAND CENTRE (OBSIDIAN DARK)
         ======================================================== -->
    <div class="panel-right">
      <!-- White Folded Tag with CORRECT, UN-REVERSED OJIX Logo -->
      <div class="top-right-badge">
        <img src="data:image/png;base64,${correctLogoBase64}" alt="OJIX" />
      </div>

      <!-- Main Product Identity -->
      <div class="product-headline">
        <h1 class="title-nyaya">
          OJIX-<sup>™</sup><br>
          Property
        </h1>
        <h3 class="product-sub-headline">
          AI Property Due Diligence Platform<br>&amp; Legal OS for Indian Law Firms
        </h3>
        <p class="product-desc">
          From deed intake to 40-year chain reconstruction — one intelligent, secure and verified legal operating system.
        </p>
      </div>

      <!-- Centerpiece: Photorealistic Laptop Mockup with REAL OJIX Product Screen -->
      <div class="laptop-showcase">
        <div class="laptop-frame">
          <div class="laptop-notch"></div>
          <div class="laptop-screen">
            <img class="laptop-screen-img" src="data:image/webp;base64,${workspaceImgBase64}" alt="OJIX Property Intelligence Workspace" />
          </div>
        </div>
        <div class="laptop-base"></div>
      </div>

      <!-- Bottom Headline & Subtitle -->
      <div class="panel-right-bottom">
        <h2 class="headline-command">ONE COMMAND CENTRE.</h2>
        <p class="desc-command">
          Your entire property due diligence workflow. Connected. Spatial-aware. In control.
        </p>
      </div>
    </div>

  </div>

</body>
</html>`;

fs.writeFileSync(path.join(rootDir, 'banner-ojix-property.html'), htmlContent);
console.log('banner-ojix-property.html updated with CORRECT, UN-REVERSED OJIX logo!');

async function render() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 1540, height: 1060 },
    deviceScaleFactor: 2
  });
  await page.goto('file://' + path.join(rootDir, 'banner-ojix-property.html'), { waitUntil: 'networkidle' });
  const banner = await page.locator('.banner-container');
  await banner.screenshot({ path: path.join(rootDir, 'OJIX_Property_Showcase_Banner.png') });
  console.log('Re-rendered OJIX_Property_Showcase_Banner.png with correct forward-facing OJIX logo!');
  await browser.close();
}

render().catch(err => {
  console.error(err);
  process.exit(1);
});
