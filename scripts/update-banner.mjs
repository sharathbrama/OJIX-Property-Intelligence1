import fs from 'fs';

const scriptPath = 'scripts/build-client-showcase-banner.mjs';
let code = fs.readFileSync(scriptPath, 'utf8');

// 1. Replace .sec-left CSS
const oldSecLeftCSS = `.sec-left {
      padding: 24px 32px 22px 42px;
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: rgba(255, 255, 255, 0.94);
    }`;

const newSecLeftCSS = `.sec-left {
      padding: 18px 26px 16px 36px;
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      background: rgba(255, 255, 255, 0.94);
    }`;

if (code.includes(oldSecLeftCSS)) {
  code = code.replace(oldSecLeftCSS, newSecLeftCSS);
}

// 2. Add OCR engine card CSS after .feature-pod:hover
const ocrCSS = `
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
`;

if (code.includes('.pod-icon-box {')) {
  code = code.replace('.pod-icon-box {', ocrCSS + '\n    .pod-icon-box {');
}

// 3. Replace .sec-right CSS
const oldSecRightCSS = `.sec-right {
      padding: 24px 38px 22px 32px;
      border-left: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: rgba(255, 255, 255, 0.94);
    }`;

const newSecRightCSS = `.sec-right {
      padding: 16px 28px 14px 24px;
      border-left: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 7px;
      position: relative;
      background: rgba(255, 255, 255, 0.94);
    }`;

if (code.includes(oldSecRightCSS)) {
  code = code.replace(oldSecRightCSS, newSecRightCSS);
}

// 4. Add 10 Roles and Capabilities CSS before .sec-right-footer
const rolesCSS = `
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
`;

if (code.includes('.sec-right-footer {')) {
  code = code.replace('.sec-right-footer {', rolesCSS + '\n    .sec-right-footer {');
}

// 5. Update HTML in .sec-left to include OCR engine card
const targetLeft = '<!-- 4 Structured Feature Pods -->';
const ocrHTML = `<!-- Document Intelligence & Bilingual OCR Engine Card -->
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

        `;

if (code.includes(targetLeft)) {
  code = code.replace(targetLeft, ocrHTML + targetLeft);
}

// 6. Update HTML in .sec-right to include the 10 Roles and Capabilities
const targetRight = '<div class="sec-right-footer">';
const rolesHTML = `<!-- ================================================================
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

        `;

if (code.includes(targetRight)) {
  code = code.replace(targetRight, rolesHTML + targetRight);
}

fs.writeFileSync(scriptPath, code);
console.log('Successfully updated scripts/build-client-showcase-banner.mjs');
