import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJIX Property Intelligence — 10-Phase Property Lifecycle & Workflow Guide</title>
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
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 30px 15px;
    }

    /* MASTER BANNER CONTAINER (1600 x 1060 for 16:10 or landscape A4) */
    .workflow-banner {
      width: 1600px;
      height: 1060px;
      background: #f8fafc;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 36px 44px 28px;
      position: relative;
      box-shadow: 0 40px 100px rgba(0, 0, 0, 0.9);
    }

    /* TOP HEADER SECTION */
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .header-left .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #ff4713;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-left .eyebrow .dot {
      width: 8px;
      height: 8px;
      background: #ff4713;
      border-radius: 50%;
    }
    .header-title {
      font-size: 38px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #0f172a;
      text-transform: uppercase;
    }
    .header-title span.accent {
      color: #ff4713;
    }
    .header-sub {
      font-size: 13px;
      color: #475569;
      font-weight: 600;
      margin-top: 6px;
      max-width: 900px;
      line-height: 1.4;
    }

    .header-brand {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }
    .brand-logo-text {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: #0f172a;
      line-height: 1;
      border-top: 4px solid #ff4713;
      padding-top: 4px;
    }
    .brand-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 4px;
    }

    /* 10 PHASES GRID (2 ROWS OF 5 PHASES) */
    .phases-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    /* INDIVIDUAL PHASE CARD */
    .phase-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 14px 14px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
      min-height: 310px;
    }
    .phase-card.active-phase {
      border-top: 4px solid #ff4713;
      background: #ffffff;
    }
    .phase-card.review-phase {
      border-top: 4px solid #0f172a;
      background: #fafaf9;
    }
    .phase-card.final-phase {
      border-top: 4px solid #16a34a;
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .phase-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .phase-num span.num-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 10px;
    }
    .phase-card.active-phase .phase-num span.num-badge {
      background: #ff4713;
    }
    .phase-card.final-phase .phase-num span.num-badge {
      background: #16a34a;
    }

    .role-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2.5px 6px;
      border-radius: 2px;
      background: #f1f5f9;
      color: #475569;
    }
    .role-badge.owner { background: #fee2e2; color: #991b1b; }
    .role-badge.ops { background: #fef3c7; color: #92400e; }
    .role-badge.analyst { background: #e0e7ff; color: #3730a3; }
    .role-badge.gis { background: #dcfce7; color: #166534; }
    .role-badge.advocate { background: #ffedd5; color: #c2410c; }
    .role-badge.client { background: #d1fae5; color: #065f46; font-weight: 900; }

    .phase-title {
      font-size: 14.5px;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }
    .phase-desc {
      font-size: 11px;
      line-height: 1.48;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 10px;
    }

    /* ACTION & NEXT PHASE BOXES */
    .phase-box-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 7px 8px;
      margin-top: 6px;
    }
    .phase-box-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .phase-box-label.next-label {
      color: #ff4713;
    }
    .phase-box-text {
      font-size: 10px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.35;
    }

    /* CONNECTING FORWARD ARROW */
    .flow-arrow-icon {
      position: absolute;
      right: -10px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 900;
      z-index: 20;
      border: 2px solid #f8fafc;
    }

    /* BOTTOM CONTROLS & OWNER MATRIX */
    .bottom-section {
      background: #0f172a;
      color: #ffffff;
      border-radius: 4px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .bottom-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .bottom-pill {
      background: rgba(255, 71, 19, 0.2);
      border: 1px solid #ff4713;
      color: #ff4713;
      padding: 4px 10px;
      border-radius: 2px;
      font-weight: 800;
    }
    .bottom-right {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .bottom-right a {
      color: #ff4713;
      text-decoration: none;
      font-weight: 800;
    }
  </style>
</head>
<body>

  <!-- MASTER WORKFLOW BANNER (10 PHASES) -->
  <div class="workflow-banner">

    <!-- TOP TITLE HEADER -->
    <header class="header-top">
      <div class="header-left">
        <div class="eyebrow">
          <span class="dot"></span>
          OJIX PROPERTY INTELLIGENCE · COMPLETE 10-PHASE LIFECYCLE WORKFLOW
        </div>
        <h1 class="header-title">
          THE 10 PHASES OF <span class="accent">PROPERTY DUE DILIGENCE</span>
        </h1>
        <p class="header-sub">
          From intake to certified court-grade title report. Exact clarity on who holds the property at each phase, what tasks are performed, and what triggers the next phase on the Owner Dashboard.
        </p>
      </div>

      <div class="header-brand">
        <div class="brand-logo-text">OJIX</div>
        <div class="brand-sub">LEGAL OS &amp; PROPERTY INTELLIGENCE</div>
      </div>
    </header>

    <!-- 10 PHASES PIPELINE GRID -->
    <main class="phases-grid">

      <!-- ==================== PHASE 01 ==================== -->
      <div class="phase-card active-phase">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">01</span> INTAKE</div>
            <span class="role-badge owner">WORKSPACE OWNER</span>
          </div>
          <h2 class="phase-title">Property Onboarding</h2>
          <p class="phase-desc">Capture survey number, hissa, village, taluk, district, coordinates, and diligence purpose.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Partner / Client Relationship Team</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Assign deed gathering to Operations/Paralegal queue.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 02 ==================== -->
      <div class="phase-card active-phase">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">02</span> DOSSIER</div>
            <span class="role-badge ops">OPERATIONS / PARALEGAL</span>
          </div>
          <h2 class="phase-title">Document Collection</h2>
          <p class="phase-desc">Collect 40-year registered sale deeds, Bhoomi RTC/Pahani, Kaveri EC (Form 15/16), and village maps.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Document Ops / Scanning Queue</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Upload scans and trigger automated OCR extraction.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 03 ==================== -->
      <div class="phase-card">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">03</span> OCR</div>
            <span class="role-badge ops">AI OCR ENGINE</span>
          </div>
          <h2 class="phase-title">Bilingual Extraction</h2>
          <p class="phase-desc">Tesseract bilingual engine processes Kannada (kan) and English (eng) with bounding-box evidence anchors.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Automated OCR &amp; Processing Workers</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Handoff low-confidence text to Analyst for review.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 04 ==================== -->
      <div class="phase-card">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">04</span> NORMALIZE</div>
            <span class="role-badge analyst">EVIDENCE ANALYST</span>
          </div>
          <h2 class="phase-title">Data Normalization</h2>
          <p class="phase-desc">Standardize land extent units (Guntas, Acres, Sq.ft), survey aliases, party names, and registration numbers.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Evidence Analyst Workbench</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Map deeds into chronological ownership sequence.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 05 ==================== -->
      <div class="phase-card active-phase">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">05</span> CHAIN</div>
            <span class="role-badge analyst">EVIDENCE ANALYST</span>
          </div>
          <h2 class="phase-title">40-Year Title Chain</h2>
          <p class="phase-desc">Reconstruct unbroken title chain linking parent deeds, partition deeds, gift deeds, and inheritance lineage.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Title Synthesis Engine &amp; Analyst</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Cross-audit chain against revenue and EC records.</div>
          </div>
        </div>
      </div>

      <!-- ==================== PHASE 06 ==================== -->
      <div class="phase-card">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">06</span> REVENUE</div>
            <span class="role-badge analyst">EVIDENCE ANALYST</span>
          </div>
          <h2 class="phase-title">Revenue &amp; EC Cross-Audit</h2>
          <p class="phase-desc">Cross-check Bhoomi RTC khata &amp; Mutation Registers against Kaveri EC Form 15/16 to spot unrecorded charges.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Revenue Discrepancy Matrix</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Send survey boundary for GIS spatial screening.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 07 ==================== -->
      <div class="phase-card">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">07</span> SPATIAL</div>
            <span class="role-badge gis">DATA STEWARD / GIS</span>
          </div>
          <h2 class="phase-title">Spatial &amp; NGT Buffers</h2>
          <p class="phase-desc">MapLibre overlay on BDA Master Plan 2031. Calculate NGT 30m lake and 50m Rajakaluve drain buffer compliance.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">GIS Spatial Intelligence Module</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Assign on-site verification to Field Consultant.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 08 ==================== -->
      <div class="phase-card">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">08</span> GROUND</div>
            <span class="role-badge ops">FIELD CONSULTANT</span>
          </div>
          <h2 class="phase-title">Ground Verification</h2>
          <p class="phase-desc">Inspect physical survey stones, access road width, actual boundary possession, and verify absence of local disputes.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">External Surveyor / Field Valuer Portal</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Handoff complete dossier to Lead Advocate.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 09 ==================== -->
      <div class="phase-card review-phase">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">09</span> LEGAL</div>
            <span class="role-badge advocate">LEAD ADVOCATE</span>
          </div>
          <h2 class="phase-title">Lawyer Review &amp; Sign-off</h2>
          <p class="phase-desc">Senior Advocate inspects chain, resolves open findings, documents legal title opinion, and digitally approves.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Lead Advocate Workbench (Sign-off)</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label">NEXT PHASE ACTION ➔</div>
            <div class="phase-box-text">Trigger Chromium rendering of certified PDF report.</div>
          </div>
        </div>
        <div class="flow-arrow-icon">➔</div>
      </div>

      <!-- ==================== PHASE 10 ==================== -->
      <div class="phase-card final-phase">
        <div>
          <div class="card-top">
            <div class="phase-num"><span class="num-badge">10</span> RELEASE</div>
            <span class="role-badge client">BUYER / BANK AUDITOR</span>
          </div>
          <h2 class="phase-title">Certified Title Report</h2>
          <p class="phase-desc">Court-grade multi-page PDF title search report with verification certificate delivered to Client &amp; Lenders.</p>
        </div>
        <div>
          <div class="phase-box-section">
            <div class="phase-box-label">WHO HOLDS PROPERTY:</div>
            <div class="phase-box-text">Client Portal / Bank Audit Locker</div>
          </div>
          <div class="phase-box-section">
            <div class="phase-box-label next-label" style="color:#16a34a;">STATUS: COMPLETED ✓</div>
            <div class="phase-box-text">Property cleared for purchase / loan sanction.</div>
          </div>
        </div>
      </div>

    </main>

    <!-- FOOTER OWNER & GOVERNANCE BAR -->
    <footer class="bottom-section">
      <div class="bottom-left">
        <span class="bottom-pill">OWNER DASHBOARD CONTROLS</span>
        <span>EACH PHASE TRACKS RESPONSIBLE PERSON · SLA DUE DATES · AUDIT LOGGING</span>
      </div>
      <div class="bottom-right">
        <span>OJIX ENGINEERING &amp; TECHNOLOGY LLP</span>
        <span>|</span>
        <a href="https://www.ojix.com" target="_blank">WWW.OJIX.COM</a>
        <span>|</span>
        <a href="mailto:info@ojix.in">INFO@OJIX.IN</a>
      </div>
    </footer>

  </div>

</body>
</html>`;

fs.writeFileSync(path.join(rootDir, 'workflow-10-phases.html'), htmlContent);
console.log('workflow-10-phases.html generated successfully!');

async function render() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 1680, height: 1140 },
    deviceScaleFactor: 2
  });
  await page.goto('file://' + path.join(rootDir, 'workflow-10-phases.html'), { waitUntil: 'networkidle' });
  const banner = await page.locator('.workflow-banner');
  await banner.screenshot({ path: path.join(rootDir, 'OJIX_10_Phases_Workflow_Banner.png') });
  console.log('Rendered OJIX_10_Phases_Workflow_Banner.png!');

  // Also print official PDF version for clients/sales!
  await page.pdf({
    path: path.join(rootDir, 'OJIX_10_Phases_Workflow_Guide.pdf'),
    format: 'A3',
    landscape: true,
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
  });
  console.log('Rendered official PDF at OJIX_10_Phases_Workflow_Guide.pdf!');

  await browser.close();
}

render().catch(err => {
  console.error(err);
  process.exit(1);
});
