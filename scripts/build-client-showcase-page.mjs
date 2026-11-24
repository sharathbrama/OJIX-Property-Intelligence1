import fs from 'fs';
import path from 'path';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';

// Assets paths
const logoPath = path.join(rootDir, 'apps/web/public/assets/ojix-wordmark-header.png');
const karnatakaMapPath = path.join(rootDir, 'karnataka-map-clean.png');
const heroSatellitePath = path.join(rootDir, 'apps/web/public/images/ojix-property-hero.webp');
const docReviewPath = path.join(rootDir, 'apps/web/public/images/ojix-document-review.webp');
const recordsPath = path.join(rootDir, 'apps/web/public/images/ojix-property-records.webp');
const riskPath = path.join(rootDir, 'apps/web/public/images/ojix-risk-assessment.webp');
const highCourtPath = path.join(rootDir, 'karnataka-high-court-exact.png');
const bannerPath = path.join(rootDir, 'OJIX_Client_Showcase_Banner.png');

// Base64 helper
const getB64 = (filePath, mime) => {
  if (fs.existsSync(filePath)) {
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  }
  return '';
};

const logoB64 = getB64(logoPath, 'image/png');
const karnatakaMapB64 = getB64(karnatakaMapPath, 'image/png');
const heroSatelliteB64 = getB64(heroSatellitePath, 'image/webp');
const docReviewB64 = getB64(docReviewPath, 'image/webp');
const recordsB64 = getB64(recordsPath, 'image/webp');
const riskB64 = getB64(riskPath, 'image/webp');
const highCourtB64 = getB64(highCourtPath, 'image/png');
const bannerB64 = getB64(bannerPath, 'image/png');

// Role definitions
const rolesData = [
  {
    id: 'owner',
    title: 'Workspace Owner',
    icon: '👑',
    category: 'Executive & Governance',
    themeColor: '#6D28D9',
    bgColor: '#FAF5FF',
    borderColor: '#C4B5FD',
    accentBg: '#EDE9FE',
    scope: 'Matters, Billing & Portfolio Governance',
    mission: 'Oversees all high-value property due diligence matters, client mandates, legal assignments, and authorizes final delivery to institutional committees.',
    stages: [
      { step: '01', title: 'Matter Creation & Scope Definition', desc: 'Sets up the property due diligence matter, inputs survey targets (e.g. Sy. No. 142/3A, Devanahalli), defines client deadlines, and allocates legal review teams.' },
      { step: '02', title: 'Milestone & Turnaround Monitoring', desc: 'Tracks real-time intake progress, OCR confidence scores, and government reconciliation milestones across analyst queues to ensure 48-hour delivery.' },
      { step: '03', title: 'Executive Title Risk Review', desc: 'Examines overall title integrity score (98.4%), reviews critical red-flag alerts, and assesses commercial viability before advocate sign-off.' },
      { step: '04', title: 'Board Delivery Authorization', desc: 'Authorizes cryptographic release of certified Legal Search Report (LSR) and evidence audit dossier to client developers, banks, and investment funds.' }
    ],
    inputs: 'Client mandate, land acquisition briefs, survey parcel lists, commercial agreements.',
    tools: 'Executive Portfolio Dashboard, Matter Assignment Engine, Billing & Retainer Controls.',
    outputs: 'Authorized Due Diligence Mandate, Final Board-Ready Release Approval.',
    permissions: ['Full Workspace Control', 'Billing & Retainer Management', 'Matter Authorization', 'Audit Log Inspection', 'User Seat Allocation']
  },
  {
    id: 'super_admin',
    title: 'Super Admin',
    icon: '🛡️',
    category: 'Platform Security & Compliance',
    themeColor: '#1E40AF',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    accentBg: '#DBEAFE',
    scope: 'Platform Security, Encryption & Compliance',
    mission: 'Enforces ISO/SOC-2 security governance, manages multi-tenant isolation, KMS encryption keys, and audits tamper-proof evidence logs.',
    stages: [
      { step: '01', title: 'Zero-Trust Security & Identity Governance', desc: 'Configures enterprise SSO/OIDC authentication, role-based access control (RBAC), and multi-factor session policies.' },
      { step: '02', title: 'KMS Key & Document Encryption', desc: 'Manages cryptographic key rotation and ensures all uploaded land deeds and extracts are encrypted with AES-256 and SHA-256 hash locks.' },
      { step: '03', title: 'Government API Connector Oversight', desc: 'Monitors uptime, rate limits, and secure TLS handshakes for official Bhoomi, Kaveri 2.0, and Mojini API connectors.' },
      { step: '04', title: 'Immutable Security Audit Logs', desc: 'Reviews tamper-proof access logs to ensure zero unauthorized record inspections or data boundary breaches across workspaces.' }
    ],
    inputs: 'Security event logs, API telemetry, encryption keys, identity federation tokens.',
    tools: 'Platform Security Center, KMS Key Vault, Audit Trail Inspector, Tenancy Manager.',
    outputs: 'SOC-2 Compliance Attestation, Cryptographic Audit Logs, Platform Health Telemetry.',
    permissions: ['Platform Configuration', 'KMS Key Management', 'Immutable Audit Trails', 'Tenancy Boundary Control', 'API Rate & Security Policies']
  },
  {
    id: 'admin',
    title: 'Organization Admin',
    icon: '⚙️',
    category: 'Team & Organization Management',
    themeColor: '#0369A1',
    bgColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    accentBg: '#E0F2FE',
    scope: 'Members, Workflow Rules & Pipelines',
    mission: 'Manages organization team members, assigns roles, configures dual-advocate review policies, and ensures adherence to 48-hour SLAs.',
    stages: [
      { step: '01', title: 'Team Onboarding & Seat Allocation', desc: 'Invites corporate advocates, title analysts, and document operations staff, provisioning role-specific permission scopes.' },
      { step: '02', title: 'Review SLA & Dual-Signoff Policies', desc: 'Configures matter workflow rules, requiring senior partner sign-off on parcels with agricultural conversion or litigation flags.' },
      { step: '03', title: 'Operational Queue Balancing', desc: 'Monitors matter queues across Devanahalli, Whitefield, and North Bangalore zones, routing workloads to prevent analyst bottlenecks.' },
      { step: '04', title: 'Quality Assurance & Delivery Auditing', desc: 'Reviews matter turnaround times and verifies all required document checklist items are complete before legal sign-off.' }
    ],
    inputs: 'Team rosters, organization SLA targets, pipeline metrics, matter intake queues.',
    tools: 'Organization Admin Panel, Workflow Policy Builder, Queue Balancer, Member Directory.',
    outputs: 'Active Workflow Policies, Balanced Team Queues, Operational Performance Reports.',
    permissions: ['Team & Role Management', 'Workflow Rule Configuration', 'Matter Queue Routing', 'SLA Policy Enforcement', 'Organization Settings']
  },
  {
    id: 'lawyer',
    title: 'Legal Reviewer',
    icon: '⚖️',
    category: 'Legal Due Diligence & Certification',
    themeColor: '#3730A3',
    bgColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    accentBg: '#E0E7FF',
    scope: 'Title Opinions, Chain Audit & LSR Certification',
    mission: 'Evaluates evidentiary documents, verifies unbroken 30-year historical title lineage, adjudicates discrepancies, and digitally certifies bank-grade Legal Search Reports.',
    stages: [
      { step: '01', title: 'Evidentiary Binder Ingestion Review', desc: 'Inspects high-resolution scanned deeds, bilingual OCR extractions, and Nil Encumbrance Certificates (Form 15).' },
      { step: '02', title: '30-Year Chain of Title Audit', desc: 'Reconstructs historical ownership from 1994 ancestral partition deed through 2004 mutation and 2014 registered sale deed to current titleholders.' },
      { step: '03', title: 'Discrepancy & Injunction Adjudication', desc: 'Reviews High Court litigation searches, verifies civil suit clearances, and evaluates genealogical succession claims or minor rights.' },
      { step: '04', title: 'Digital Title Opinion Certification', desc: 'Drafts legally defensible title opinion backed by professional indemnity and digitally signs the official board-ready LSR Dossier.' }
    ],
    inputs: 'Reconciled government records, OCR extracts, genealogical charts, High Court search results.',
    tools: 'Title Chain Timeline Viewer, Legal Discrepancy Matrix, Title Opinion Editor, Digital Signature Sign-Off.',
    outputs: 'Advocate-Certified Legal Search Report (LSR), Defensible Title Clearance Opinion.',
    permissions: ['Title Opinion Certification', 'Legal Discrepancy Adjudication', 'LSR Generation', 'Evidence Annotation', 'Legal Sign-Off Authority']
  },
  {
    id: 'analyst',
    title: 'Evidence Analyst',
    icon: '🔍',
    category: 'Verification & Data Analysis',
    themeColor: '#047857',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    accentBg: '#D1FAE5',
    scope: 'Multi-Source Reconciliation & Cadastral Verification',
    mission: 'Cross-verifies land records against official Karnataka government portals, resolves extent/khathadar discrepancies, and executes GIS buffer audits.',
    stages: [
      { step: '01', title: 'Four-Way Government Registry Cross-Match', desc: 'Queries Bhoomi RTC Form-16, Kaveri registered deed #4821, and Mojini 11E survey sketch to verify matching extent and boundaries.' },
      { step: '02', title: 'Extent & Discrepancy Reconciliation', desc: 'Compares deed boundary extent (2A 14G) against village revenue records, logging zero variances in the Discrepancy Matrix.' },
      { step: '03', title: 'GIS Spatial Buffer & Zoning Validation', desc: 'Audits parcel polygon against Rajakaluve 50m buffers, lake 30m NGT setbacks, and BDA/BMRDA 45m road corridors.' },
      { step: '04', title: 'Evidentiary Binder Compilation', desc: 'Synthesizes verified records, boundary coordinates, and court citations into a structured evidence audit binder for legal counsel.' }
    ],
    inputs: 'Uploaded deed scans, government portal records, GIS vector cadastral layers.',
    tools: 'Multi-Source Reconciler, Discrepancy Matrix Builder, Spatial Buffer Inspector, Evidence Binder Assembler.',
    outputs: 'Discrepancy Audit Matrix, Spatial Clearance Report, Reconciled Evidence Binder.',
    permissions: ['Record Reconciliation', 'Discrepancy Flagging', 'GIS Buffer Analysis', 'Genealogical Tree Building', 'Evidence Assembly']
  },
  {
    id: 'operations',
    title: 'Doc Operations',
    icon: '📁',
    category: 'Ingestion & Document Processing',
    themeColor: '#C2410C',
    bgColor: '#FFF7ED',
    borderColor: '#FED7AA',
    accentBg: '#FFEDD5',
    scope: 'Deed Ingestion, Scanning & OCR Validation',
    mission: 'Ingests raw physical deeds, scans historical sale agreements, triggers bilingual Kannada/English OCR extraction, and verifies bounding box accuracy.',
    stages: [
      { step: '01', title: 'Batch Document Intake & Digitization', desc: 'Uploads multi-page deed bundles, Tippani sketches, and revenue receipts in high-resolution PDF/TIFF formats.' },
      { step: '02', title: 'Cryptographic SHA-256 Indexing', desc: 'Generates immutable cryptographic checksums for every uploaded file to guarantee strict evidentiary chain-of-custody.' },
      { step: '03', title: 'Bilingual OCR Processing', desc: 'Executes specialized AI OCR engine trained on historical Kannada scripts, printed RTC extracts, and English deed formats.' },
      { step: '04', title: 'Bounding Box Quality Assurance', desc: 'Verifies extracted Survey Numbers, Hissa, Acreage, and SRO registration numbers against source document bounding boxes.' }
    ],
    inputs: 'Physical title deeds, scanned PDFs, certified copies, land survey sketches.',
    tools: 'Document Ingestion Queue, Bilingual OCR Engine, Bounding Box Editor, Hash Lock Vault.',
    outputs: 'Structured OCR Metadata, Cryptographically Indexed Document Assets.',
    permissions: ['Document Upload & Scanning', 'OCR Processing Trigger', 'Metadata Correction', 'Batch Ingestion', 'Chain-of-Custody Locking']
  },
  {
    id: 'consultant',
    title: 'Consultant',
    icon: '💼',
    category: 'Real Estate & Commercial Advisory',
    themeColor: '#0F766E',
    bgColor: '#F0FDFA',
    borderColor: '#99F6E4',
    accentBg: '#CCFBF1',
    scope: 'Land Advisory, Zoning & Feasibility Review',
    mission: 'Evaluates Master Plan zoning, infrastructure corridors, and development feasibility to provide strategic land intelligence to corporate developers.',
    stages: [
      { step: '01', title: 'Assigned Matter Review', desc: 'Accesses approved property case files, cadastral maps, and preliminary verification findings for assigned developer matters.' },
      { step: '02', title: 'CDP Master Plan Zoning Audit', desc: 'Verifies BMRDA/BDA zoning classification (e.g. Hi-Tech Industrial / Commercial) and permitted floor area ratios (FAR).' },
      { step: '03', title: 'Infrastructure & Road ROW Evaluation', desc: 'Audits access to proposed 45m Master Plan road corridors, highway connectivity, and high-tension line setbacks.' },
      { step: '04', title: 'Strategic Advisory Addendum', desc: 'Authors commercial land intelligence notes, developer risk-mitigation advice, and appends them to the client dossier.' }
    ],
    inputs: 'Approved property dossier, Master Plan zoning bylaws, infrastructure maps, client brief.',
    tools: 'Zoning & Master Plan Viewer, Land Feasibility Workspace, Advisory Note Editor.',
    outputs: 'Development Feasibility Memo, Commercial Land Intelligence Addendum.',
    permissions: ['Assigned Dossier Access', 'Zoning Assessment', 'Advisory Note Authoring', 'View Verified Evidence', 'Export Advisory Memos']
  },
  {
    id: 'support',
    title: 'Support',
    icon: '🎧',
    category: 'Technical Operations & Diagnostics',
    themeColor: '#7C3AED',
    bgColor: '#FAF5FF',
    borderColor: '#DDD6FE',
    accentBg: '#F5F3FF',
    scope: 'Diagnostics, Job Queues & System Health',
    mission: 'Monitors background OCR worker queues, troubleshoots failed uploads or document ambiguities, and assists users with authentication.',
    stages: [
      { step: '01', title: 'System Health & Pipeline Telemetry', desc: 'Monitors real-time processing latency across background OCR workers, PDF render engines, and database read replicas.' },
      { step: '02', title: 'Ingestion Queue Troubleshooting', desc: 'Diagnoses corrupted scans, unreadable deed uploads, or low-resolution survey maps, notifying operations of required re-scans.' },
      { step: '03', title: 'User Session & Access Assistance', desc: 'Assists advocates and analysts with 2FA/OTP resets, credential verification, and workspace navigation guidance.' },
      { step: '04', title: 'Anomaly Escalation & Logging', desc: 'Catalogs edge-case document structures and coordinates with core engineering to update OCR pattern recognizers.' }
    ],
    inputs: 'System performance logs, worker queue states, error traces, client support tickets.',
    tools: 'Diagnostics Console, Queue Manager, Audit Log Viewer, User Session Assistant.',
    outputs: 'System Incident Logs, Re-queued Processing Jobs, User Resolution Receipts.',
    permissions: ['System Diagnostics Access', 'Job Queue Re-run', 'Session Troubleshooting', 'Audit Log Viewing', 'No Access to Legal Findings']
  },
  {
    id: 'data_steward',
    title: 'Data Steward',
    icon: '🗄️',
    category: 'Master Data & Registry Reference',
    themeColor: '#0E7490',
    bgColor: '#ECFEFF',
    borderColor: '#A5F3FC',
    accentBg: '#CFFAFE',
    scope: 'Land Records Cache & Cadastral Datasets',
    mission: 'Maintains authoritative village cadastral reference maps, survey stone benchmarks, and refreshes government revenue registry codebooks.',
    stages: [
      { step: '01', title: 'Village Cadastral Benchmark Calibration', desc: 'Maintains digital Mojini SSLR village maps, geo-referencing boundary stones and GPS survey control monuments.' },
      { step: '02', title: 'Government Source Cache Maintenance', desc: 'Refreshes state revenue registry codebooks, Sub-Registrar Office (SRO) jurisdiction boundaries, and hobli lists.' },
      { step: '03', title: 'Environmental Buffer Gazette Updates', desc: 'Calibrates official Karnataka Lake Conservation and NGT environmental buffer gazette notifications across taluks.' },
      { step: '04', title: 'Dataset Quality Assurance', desc: 'Executes automated data integrity checks across cached revenue tables to guarantee zero outdated citations in client reports.' }
    ],
    inputs: 'Government revenue gazettes, SSLR survey maps, BDA zonal plans, district revenue lists.',
    tools: 'Cadastral Dataset Editor, SRO Reference Registry, Gazette Calibrator, Data Quality Inspector.',
    outputs: 'Authoritative GIS Reference Datasets, SRO Codebooks, Calibrated Buffer Reference Layers.',
    permissions: ['Reference Dataset Management', 'Cadastral Benchmark Calibration', 'Gazette Rule Updates', 'Data Integrity Auditing', 'Cache Refresh Authority']
  },
  {
    id: 'viewer',
    title: 'Viewer (Client / Investor / Bank)',
    icon: '👁️',
    category: 'Stakeholder & Executive Consumption',
    themeColor: '#475569',
    bgColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    accentBg: '#F1F5F9',
    scope: 'Approved Read-Only Records & Dossier Export',
    mission: 'Institutional property developers, real estate investment committees, and bank credit officers consuming certified due diligence findings.',
    stages: [
      { step: '01', title: 'Secure Executive Portal Access', desc: 'Accesses authenticated, encrypted client portal with read-only permissions for authorized property matters.' },
      { step: '02', title: 'Interactive Due Diligence Exploration', desc: 'Explores high-resolution satellite cadastre, clicks through 30-year title chain timeline, and inspects verified boundaries.' },
      { step: '03', title: 'Government Citation & Provenance Audit', desc: 'Reviews attached official Bhoomi RTC, Kaveri registered deed, and High Court dispute-free clearance citations.' },
      { step: '04', title: 'Certified LSR Dossier Export', desc: 'Downloads advocate-certified, court-admissible Legal Search Report (LSR) with cryptographic QR verification for committee sanction.' }
    ],
    inputs: 'Authorized client access link, authenticated session token, matter ID.',
    tools: 'Interactive Client Portal, GIS Cadastre Viewer, 30-Year Chain Explorer, PDF Dossier Downloader.',
    outputs: 'Downloaded Bank-Grade Legal Search Report (LSR), Committee Due Diligence Brief.',
    permissions: ['Read-Only Record Viewing', 'Interactive Map Exploration', 'Certified PDF Export', 'Citation Provenance Inspection', 'QR Verification']
  }
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OJIX Property Intelligence — Enterprise Client Showcase &amp; 10-Role Working Flow</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --bg-page: #F8FAFC;
      --bg-surface: #FFFFFF;
      --bg-surface-alt: #F1F5F9;
      --blue-primary: #2563EB;
      --blue-dark: #1D4ED8;
      --blue-deep: #1E40AF;
      --blue-light: #EFF6FF;
      --blue-border: #BFDBFE;
      --navy-dark: #0F172A;
      --navy-card: #1E293B;
      --text-main: #0F172A;
      --text-muted: #475569;
      --text-light: #64748B;
      --teal-accent: #059669;
      --teal-light: #ECFDF5;
      --teal-border: #A7F3D0;
      --amber-accent: #D97706;
      --amber-light: #FFFBEB;
      --amber-border: #FDE68A;
      --crimson-accent: #BE123C;
      --crimson-light: #FFF1F2;
      --crimson-border: #FECDD3;
      --border-subtle: #E2E8F0;
      --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05);
      --shadow-md: 0 4px 14px rgba(15, 23, 42, 0.06);
      --shadow-lg: 0 10px 28px rgba(15, 23, 42, 0.09);
      --shadow-xl: 0 20px 45px rgba(15, 23, 42, 0.12);
    }

    body {
      background-color: var(--bg-page);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* Top Sticky Enterprise Navigation */
    .top-navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 12px 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-sm);
    }

    .nav-brand-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .nav-logo {
      height: 34px;
      width: auto;
      object-fit: contain;
    }

    .nav-divider {
      height: 22px;
      width: 1px;
      background: var(--border-subtle);
    }

    .nav-badge-client {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--blue-primary);
      background: var(--blue-light);
      border: 1px solid var(--blue-border);
      padding: 3px 9px;
      border-radius: 5px;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .nav-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: color 0.15s ease;
      cursor: pointer;
    }

    .nav-link:hover, .nav-link.active {
      color: var(--blue-primary);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-action-secondary {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-main);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      padding: 7px 14px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-action-secondary:hover {
      background: var(--bg-surface-alt);
      border-color: #CBD5E1;
    }

    .btn-action-primary {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #FFFFFF;
      background: var(--blue-primary);
      border: 1px solid var(--blue-dark);
      padding: 7px 16px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-action-primary:hover {
      background: var(--blue-dark);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }

    /* Container */
    .container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 32px 36px 64px 36px;
    }

    /* Hero Presentation Intro */
    .showcase-hero-header {
      text-align: center;
      max-width: 860px;
      margin: 0 auto 32px auto;
    }

    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blue-primary);
      background: var(--blue-light);
      border: 1px solid var(--blue-border);
      padding: 4px 14px;
      border-radius: 20px;
      margin-bottom: 12px;
    }

    .showcase-hero-header h1 {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: var(--navy-dark);
      margin-bottom: 12px;
    }

    .showcase-hero-header p {
      font-size: 16px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 720px;
      margin: 0 auto;
    }

    /* Flagship Marketing Banner Viewport */
    .banner-preview-card {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      margin-bottom: 48px;
      position: relative;
    }

    .banner-card-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid var(--border-subtle);
    }

    .topbar-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
    }

    .banner-card-viewport {
      background: #0F172A;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .banner-card-viewport img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s ease;
    }

    /* Key Metrics & ROI Bar */
    .metrics-bar-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 48px;
    }

    .metric-kpi-card {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 20px 22px;
      box-shadow: var(--shadow-sm);
    }

    .kpi-num {
      font-size: 32px;
      font-weight: 900;
      color: var(--blue-primary);
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 6px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .kpi-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--navy-dark);
      margin-bottom: 4px;
    }

    .kpi-desc {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Section Title Block */
    .section-title-block {
      margin-bottom: 24px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }

    .section-title-left h2 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--navy-dark);
      margin-bottom: 4px;
    }

    .section-title-left p {
      font-size: 14px;
      color: var(--text-muted);
    }

    /* 5-Step Workflow Nav */
    .workflow-steps-nav {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .step-tab-btn {
      background: #FFFFFF;
      border: 1.5px solid var(--border-subtle);
      border-radius: 10px;
      padding: 12px 14px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
      overflow: hidden;
    }

    .step-tab-btn:hover {
      border-color: var(--blue-primary);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .step-tab-btn.active {
      border-color: var(--blue-primary);
      background: #FFFFFF;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
    }

    .step-tab-btn.active::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--blue-primary);
    }

    .step-num-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: var(--blue-primary);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .step-tab-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.2;
    }

    .step-tab-sub {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.2;
    }

    /* Step Showcase Box */
    .step-showcase-box {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: var(--shadow-md);
      margin-bottom: 48px;
    }

    .step-content-grid {
      display: grid;
      grid-template-columns: 460px 1fr;
      min-height: 480px;
    }

    .step-media-col {
      background: #F8FAFC;
      border-right: 1px solid var(--border-subtle);
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
    }

    .step-main-image {
      width: 100%;
      max-width: 380px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-md);
      object-fit: cover;
    }

    .step-image-caption {
      margin-top: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .step-details-col {
      padding: 32px 36px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .step-badge-large {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .step-details-header h3 {
      font-size: 24px;
      font-weight: 800;
      color: var(--navy-dark);
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }

    .step-details-header p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 20px;
    }

    .step-feature-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }

    .step-feature-item {
      background: #F8FAFC;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .step-feature-item h5 {
      font-size: 12px;
      font-weight: 800;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .step-feature-item p {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .step-footer-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 18px;
      border-top: 1px solid var(--border-subtle);
    }

    /* 4 Government Portals Section */
    .govt-portals-section {
      margin-bottom: 48px;
    }

    .govt-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 20px;
    }

    .govt-client-card {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
      position: relative;
    }

    .govt-client-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }

    .govt-client-card.bhoomi {
      border: 1.5px solid var(--amber-border);
      background: #FFFDF7;
    }
    .govt-client-card.kaveri {
      border: 1.5px solid var(--blue-border);
      background: #F8FAFF;
    }
    .govt-client-card.mojini {
      border: 1.5px solid #BAE6FD;
      background: #F7FBFE;
    }
    .govt-client-card.highcourt {
      border: 1.5px solid var(--crimson-border);
      background: #FFF9FA;
    }

    .govt-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .govt-card-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .govt-avatar-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 800;
    }

    .court-thumb-avatar {
      width: 44px;
      height: 32px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--crimson-border);
    }

    .govt-name-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--navy-dark);
    }

    .govt-portal-type-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .govt-domain-box {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid var(--border-subtle);
      padding: 5px 8px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .govt-extract-data {
      font-size: 12px;
      font-weight: 700;
      color: var(--navy-dark);
      line-height: 1.4;
    }

    .govt-audit-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* =====================================================================
       10 ROLE-BASED ACCESS CONTROL (RBAC) WORKFLOW EXPLORER
       ===================================================================== */
    .role-workflow-section {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 32px;
      box-shadow: var(--shadow-md);
      margin-bottom: 48px;
    }

    .role-explorer-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 24px;
      margin-top: 20px;
    }

    /* Left: Role Selection List */
    .role-list-pane {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 640px;
      overflow-y: auto;
      padding-right: 6px;
    }

    .role-select-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1.5px solid var(--border-subtle);
      background: #FFFFFF;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    .role-select-item:hover {
      border-color: var(--blue-primary);
      transform: translateX(2px);
      box-shadow: var(--shadow-sm);
    }

    .role-select-item.active {
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
    }

    .role-select-icon {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }

    .role-select-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .role-select-title {
      font-size: 12.5px;
      font-weight: 800;
      line-height: 1.2;
    }

    .role-select-scope {
      font-size: 10.5px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
      margin-top: 1px;
    }

    /* Right: Dynamic Role Flow Console */
    .role-console-pane {
      background: #F8FAFC;
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .console-header-card {
      background: #FFFFFF;
      border-radius: 10px;
      padding: 18px 20px;
      border: 1.5px solid;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      box-shadow: var(--shadow-sm);
    }

    .console-role-title-block {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .console-role-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    .console-role-headings h3 {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin-bottom: 2px;
    }

    .console-role-headings p {
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .console-mission-box {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px 16px;
    }

    .console-mission-box h5 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .console-mission-box p {
      font-size: 13.5px;
      color: var(--navy-dark);
      font-weight: 600;
      line-height: 1.5;
    }

    /* 4-Stage Role Flow Timeline */
    .role-flow-stages-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .flow-stages-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--navy-dark);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .flow-stages-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .flow-stage-card {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    }

    .stage-num-badge {
      width: 24px;
      height: 24px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .stage-card-body h6 {
      font-size: 12px;
      font-weight: 800;
      color: var(--navy-dark);
      margin-bottom: 3px;
    }

    .stage-card-body p {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Inputs, Tools & Outputs Matrix */
    .role-triad-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .triad-box {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .triad-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }

    .triad-desc {
      font-size: 11px;
      color: var(--navy-dark);
      font-weight: 600;
      line-height: 1.4;
    }

    /* Permission Scope Tags Row */
    .permissions-tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .perm-chip {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      background: #F1F5F9;
      color: var(--text-main);
      border: 1px solid #CBD5E1;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Footer */
    .showcase-footer {
      border-top: 1px solid var(--border-subtle);
      padding: 32px 0 16px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .gis-controls-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .gis-layer-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 5px;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
      background: #FFFFFF;
      color: var(--text-muted);
      transition: all 0.15s ease;
    }

    .gis-layer-btn.active {
      background: var(--blue-primary);
      color: #FFFFFF;
      border-color: var(--blue-dark);
    }
  </style>
</head>
<body>

  <!-- Top Sticky Enterprise Navigation -->
  <header class="top-navbar">
    <div class="nav-brand-group">
      <img class="nav-logo" src="${logoB64 || '/assets/ojix-wordmark-header.png'}" alt="OJIX Property Intelligence" />
      <div class="nav-divider"></div>
      <span class="nav-badge-client">CLIENT SHOWCASE EDITION</span>
    </div>

    <nav class="nav-links">
      <a class="nav-link" href="#hero-banner">Banner Showcase</a>
      <a class="nav-link" href="#workflow">5-Step Workflow</a>
      <a class="nav-link" href="#govt-portals">Govt Records</a>
      <a class="nav-link" href="#rbac-flow">10-Role Flow</a>
      <a class="nav-link" href="#metrics">ROI &amp; Metrics</a>
    </nav>

    <div class="nav-actions">
      <button class="btn-action-secondary" onclick="window.print()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Export PDF
      </button>
      <a class="btn-action-primary" href="/demo" target="_blank">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Launch Interactive Demo
      </a>
    </div>
  </header>

  <!-- Main Container -->
  <main class="container">

    <!-- Hero Introduction Header -->
    <section class="showcase-hero-header">
      <div class="hero-eyebrow">
        <span>ENTERPRISE CLIENT PRESENTATION</span>
        <span>&bull;</span>
        <span>KARNATAKA LAND INTELLIGENCE</span>
      </div>
      <h1>OJIX Property Intelligence Showcase</h1>
      <p>A unified intelligence platform for property verification, legal due diligence, government record references, GIS spatial analysis, and evidence-based decision-making.</p>
    </section>

    <!-- Flagship Marketing Banner Viewport -->
    <section id="hero-banner" class="banner-preview-card">
      <div class="banner-card-topbar">
        <div class="topbar-meta">
          <span style="color:var(--blue-primary); font-weight:800;">● PRESENTATION BANNER</span>
          <span>&bull;</span>
          <span>3200 &times; 2000 RETINA ASSET</span>
          <span>&bull;</span>
          <span>WHITE &amp; ROYAL BLUE EDITION</span>
        </div>
        <div style="display:flex; gap:8px;">
          <a class="btn-action-secondary" href="OJIX_Client_Showcase_Banner.png" download="OJIX_Client_Showcase_Banner.png">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download High-Res PNG
          </a>
          <a class="btn-action-secondary" href="OJIX_Client_Showcase_Banner.html" target="_blank">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            Open Standalone Banner
          </a>
        </div>
      </div>
      <div class="banner-card-viewport">
        <img src="${bannerB64 || 'OJIX_Client_Showcase_Banner.png'}" alt="OJIX Property Intelligence Enterprise Client Showcase Banner" />
      </div>
    </section>

    <!-- Key Metrics & ROI Bar -->
    <section id="metrics" class="metrics-bar-section">
      <div class="metric-kpi-card">
        <div class="kpi-num">48h</div>
        <div class="kpi-label">Due Diligence Turnaround</div>
        <div class="kpi-desc">Accelerated from traditional 3-4 week manual advocate and revenue inspection cycles.</div>
      </div>
      <div class="metric-kpi-card">
        <div class="kpi-num">100%</div>
        <div class="kpi-label">Government Citation Traceability</div>
        <div class="kpi-desc">Cryptographic provenance matching Bhoomi, Kaveri 2.0, Mojini SSLR &amp; High Court.</div>
      </div>
      <div class="metric-kpi-card">
        <div class="kpi-num">0m</div>
        <div class="kpi-label">Spatial Buffer Conflicts</div>
        <div class="kpi-desc">Automated clearance on Rajakaluve drains, lake setbacks, and CDP master plan road ROWs.</div>
      </div>
      <div class="metric-kpi-card">
        <div class="kpi-num">10</div>
        <div class="kpi-label">Role-Based Access Levels</div>
        <div class="kpi-desc">Enterprise governance aligning lawyers, analysts, consultants, and corporate developers.</div>
      </div>
    </section>

    <!-- Section 2: Interactive 5-Step Due Diligence Workflow -->
    <section id="workflow">
      <div class="section-title-block">
        <div class="section-title-left">
          <h2>End-to-End Due Diligence Working Flow</h2>
          <p>Click on any step below to explore how OJIX automates land verification from physical deed intake to certified legal sign-off.</p>
        </div>
        <span style="font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:800; color:var(--teal-accent);">● LIVE WORKING PIPELINE</span>
      </div>

      <!-- 5 Step Selector Nav -->
      <div class="workflow-steps-nav">
        <button class="step-tab-btn active" onclick="switchStep(1)">
          <span class="step-num-pill">STEP 01</span>
          <span class="step-tab-title">Property Intake &amp; OCR</span>
          <span class="step-tab-sub">Deed Ingestion &amp; Bilingual OCR</span>
        </button>

        <button class="step-tab-btn" onclick="switchStep(2)">
          <span class="step-num-pill">STEP 02</span>
          <span class="step-tab-title">Record Verification</span>
          <span class="step-tab-sub">Bhoomi, Kaveri &amp; Mojini Match</span>
        </button>

        <button class="step-tab-btn" onclick="switchStep(3)">
          <span class="step-num-pill">STEP 03</span>
          <span class="step-tab-title">GIS Spatial Analysis</span>
          <span class="step-tab-sub">Cadastre &amp; Buffer Zoning</span>
        </button>

        <button class="step-tab-btn" onclick="switchStep(4)">
          <span class="step-num-pill">STEP 04</span>
          <span class="step-tab-title">Title Chain Review</span>
          <span class="step-tab-sub">30-Year Historical Lineage</span>
        </button>

        <button class="step-tab-btn" onclick="switchStep(5)">
          <span class="step-num-pill">STEP 05</span>
          <span class="step-tab-title">Certified Final Dossier</span>
          <span class="step-tab-sub">Advocate Sign-Off &amp; LSR</span>
        </button>
      </div>

      <!-- Step Content Display Box -->
      <div class="step-showcase-box">
        
        <!-- STEP 1 CONTENT -->
        <div id="step-pane-1" class="step-content-grid" style="display:grid;">
          <div class="step-media-col">
            <img class="step-main-image" src="${docReviewB64 || '/images/ojix-document-review.webp'}" alt="Property Deed Intake &amp; OCR Review" />
            <div class="step-image-caption">
              <span>📷 3D Digital Asset Ingestion &bull; Sy. No. 142/3A</span>
            </div>
          </div>
          <div class="step-details-col">
            <div>
              <div class="step-badge-large" style="background:var(--blue-light); color:var(--blue-primary); border:1px solid var(--blue-border);">
                STEP 01 &bull; PROPERTY INTAKE &amp; BILINGUAL OCR
              </div>
              <div class="step-details-header">
                <h3>Physical Deed Ingestion &amp; OCR Intelligence</h3>
                <p>Physical deeds, sale agreements, and revenue extracts are scanned and processed through OJIX’s bilingual OCR engine, trained specifically on historical Kannada and English land records.</p>
              </div>

              <div class="step-feature-cards">
                <div class="step-feature-item">
                  <h5>⚡ 99.4% Bilingual OCR Accuracy</h5>
                  <p>Accurately transcribes Kannada RTC Form 16, Tippani, MR-21 extracts, and English deeds.</p>
                </div>
                <div class="step-feature-item">
                  <h5>🔒 Cryptographic Hash Lock</h5>
                  <p>Every uploaded document is indexed with SHA-256 fingerprinting to guarantee evidence chain-of-custody.</p>
                </div>
                <div class="step-feature-item">
                  <h5>📑 Automated Entity Extraction</h5>
                  <p>Extracts Survey Number, Hissa, Extent (Acres/Guntas), Khathadar Name, and Registration SRO.</p>
                </div>
                <div class="step-feature-item">
                  <h5>⚠️ Red-Flag Discrepancy Alert</h5>
                  <p>Instantly flags extent mismatches between registered deeds and revenue registers.</p>
                </div>
              </div>
            </div>

            <div class="step-footer-actions">
              <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--text-muted);">Intake Target: Sy. No. 142/3A, Devanahalli Taluk</span>
              <button class="btn-action-primary" onclick="switchStep(2)">Proceed to Step 02 &rarr;</button>
            </div>
          </div>
        </div>

        <!-- STEP 2 CONTENT -->
        <div id="step-pane-2" class="step-content-grid" style="display:none;">
          <div class="step-media-col">
            <img class="step-main-image" src="${recordsB64 || '/images/ojix-property-records.webp'}" alt="Karnataka Government Record Reconciliation" />
            <div class="step-image-caption">
              <span>🏛️ Multi-Registry Cross-Verification &bull; 4 Official Portals</span>
            </div>
          </div>
          <div class="step-details-col">
            <div>
              <div class="step-badge-large" style="background:var(--amber-light); color:var(--amber-accent); border:1px solid var(--amber-border);">
                STEP 02 &bull; GOVERNMENT RECORD CITATIONS
              </div>
              <div class="step-details-header">
                <h3>Four-Way Government Portal Reconciliation</h3>
                <p>OJIX cross-references the property identifier against official Karnataka government portals, fetching official revenue records, registered deeds, pre-mutation sketches, and High Court litigation status.</p>
              </div>

              <div class="step-feature-cards">
                <div class="step-feature-item" style="border-left:3px solid var(--amber-accent);">
                  <h5>🌾 Bhoomi Portal (Land Records)</h5>
                  <p>RTC Form 16 &amp; MR-21 Mutation Extract verified under Sy. No. 142/3A. Total extent 2A 14G.</p>
                </div>
                <div class="step-feature-item" style="border-left:3px solid var(--blue-primary);">
                  <h5>📜 Kaveri 2.0 (Registration)</h5>
                  <p>Registered Sale Deed #4821 and 30-Year Nil Encumbrance Certificate (Form 15) confirmed clear.</p>
                </div>
                <div class="step-feature-item" style="border-left:3px solid #0284C7;">
                  <h5>📐 Mojini SSLR (Survey)</h5>
                  <p>11E Pre-Mutation Cadastral Sketch &amp; boundary Tippani stone lock matched to field survey.</p>
                </div>
                <div class="step-feature-item" style="border-left:3px solid var(--crimson-accent);">
                  <h5>⚖️ Karnataka High Court</h5>
                  <p>Attara Kacheri judicial database scanned for pending OS civil suits, stay orders, or writ petitions: 0 Disputes.</p>
                </div>
              </div>
            </div>

            <div class="step-footer-actions">
              <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--teal-accent); font-weight:800;">● 4/4 CITATIONS ATTACHED &bull; 100% PROVENANCE</span>
              <button class="btn-action-primary" onclick="switchStep(3)">Proceed to Step 03 &rarr;</button>
            </div>
          </div>
        </div>

        <!-- STEP 3 CONTENT -->
        <div id="step-pane-3" class="step-content-grid" style="display:none;">
          <div class="step-media-col">
            <img class="step-main-image" src="${heroSatelliteB64 || '/images/ojix-property-hero.webp'}" alt="GIS &amp; Cadastral Spatial Risk Analysis" />
            <div class="step-image-caption">
              <span>🛰️ Satellite Cadastre &bull; LAT 13.2437&deg; N, LNG 77.7126&deg; E</span>
            </div>
          </div>
          <div class="step-details-col">
            <div>
              <div class="step-badge-large" style="background:#F0FDF4; color:var(--teal-accent); border:1px solid var(--teal-border);">
                STEP 03 &bull; GIS &amp; SPATIAL RISK ANALYSIS
              </div>
              <div class="step-details-header">
                <h3>Cadastral Geometry Lock &amp; Environmental Buffer Audit</h3>
                <p>The parcel boundary is locked to high-resolution satellite imagery and audited against BDA/BMRDA Master Plans, NGT buffer mandates, Rajakaluve storm drains, and lake setbacks.</p>
              </div>

              <div class="step-feature-cards">
                <div class="step-feature-item">
                  <h5>🌊 Rajakaluve 50m Buffer</h5>
                  <p><strong style="color:var(--teal-accent);">&#10003; 0m Conflict:</strong> Parcel boundary sits safely beyond the natural storm drain buffer line.</p>
                </div>
                <div class="step-feature-item">
                  <h5>🏞️ Lake 30m NGT Setback</h5>
                  <p><strong style="color:var(--teal-accent);">&#10003; 110m Clearance:</strong> Fully compliant with National Green Tribunal environmental setbacks.</p>
                </div>
                <div class="step-feature-item">
                  <h5>🛣️ 45m CDP Master Plan Road</h5>
                  <p><strong style="color:var(--blue-primary);">&#10003; Road ROW Conforming:</strong> Direct access to planned 45m Zonal Master Plan road corridor.</p>
                </div>
                <div class="step-feature-item">
                  <h5>🏗️ CDP Zoning Verification</h5>
                  <p><strong style="color:var(--blue-primary);">&#10003; Hi-Tech Industrial:</strong> Permitted for commercial, logistics, and tech park development.</p>
                </div>
              </div>

              <div class="gis-controls-row">
                <span class="gis-layer-btn active">&#10003; Cadastre Polygon</span>
                <span class="gis-layer-btn active">&#10003; Rajakaluve 50m</span>
                <span class="gis-layer-btn active">&#10003; Lake Setback 30m</span>
                <span class="gis-layer-btn active">&#10003; 45m Road Corridor</span>
              </div>
            </div>

            <div class="step-footer-actions">
              <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--text-muted);">Spatial Status: Boundary Locked &bull; 0 Conflicts</span>
              <button class="btn-action-primary" onclick="switchStep(4)">Proceed to Step 04 &rarr;</button>
            </div>
          </div>
        </div>

        <!-- STEP 4 CONTENT -->
        <div id="step-pane-4" class="step-content-grid" style="display:none;">
          <div class="step-media-col">
            <img class="step-main-image" src="${recordsB64 || '/images/ojix-property-records.webp'}" alt="30-Year Title Chain of Custody" />
            <div class="step-image-caption">
              <span>📜 30-Year Unbroken Chain of Title &bull; 1994 - 2024</span>
            </div>
          </div>
          <div class="step-details-col">
            <div>
              <div class="step-badge-large" style="background:#EEF2FF; color:var(--blue-deep); border:1px solid #C7D2FE;">
                STEP 04 &bull; TITLE CHAIN &amp; LINEAGE REVIEW
              </div>
              <div class="step-details-header">
                <h3>30-Year Unbroken Historical Chain of Title</h3>
                <p>OJIX reconstructs the historical title lineage across ancestral partition deeds, revenue mutations, and registered transfers, checking for minor rights, succession claims, and mortgage charges.</p>
              </div>

              <div class="step-feature-cards">
                <div class="step-feature-item">
                  <h5>1994 &bull; Ancestral Partition Deed</h5>
                  <p>Family partition registered under Doc #1204/1994, granting clear title to branch lineage.</p>
                </div>
                <div class="step-feature-item">
                  <h5>2004 &bull; Revenue Mutation Extract</h5>
                  <p>MR-21/2004-05 officially sanctioned by Village Accountant and Tahsildar with public notice.</p>
                </div>
                <div class="step-feature-item">
                  <h5>2014 &bull; Registered Sale Deed</h5>
                  <p>Doc #3120/2014 registered at Devanahalli SRO with full consideration and stamp receipt.</p>
                </div>
                <div class="step-feature-item">
                  <h5>2024 &bull; 30-Yr Nil Encumbrance</h5>
                  <p>Form 15 issued with zero outstanding bank mortgages, attachments, or tax liens.</p>
                </div>
              </div>
            </div>

            <div class="step-footer-actions">
              <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--teal-accent); font-weight:800;">● TITLE INTEGRITY: 98.4% (MARKETABLE &amp; CLEAR)</span>
              <button class="btn-action-primary" onclick="switchStep(5)">Proceed to Step 05 &rarr;</button>
            </div>
          </div>
        </div>

        <!-- STEP 5 CONTENT -->
        <div id="step-pane-5" class="step-content-grid" style="display:none;">
          <div class="step-media-col">
            <img class="step-main-image" src="${riskPath ? riskB64 : '/images/ojix-risk-assessment.webp'}" alt="Final Certified Legal Search Report Dossier" />
            <div class="step-image-caption">
              <span>🛡️ Certified Legal Search Report (LSR) &bull; Bank Ready</span>
            </div>
          </div>
          <div class="step-details-col">
            <div>
              <div class="step-badge-large" style="background:#ECFDF5; color:var(--teal-accent); border:1px solid var(--teal-border);">
                STEP 05 &bull; CERTIFIED LSR DOSSIER &amp; SIGN-OFF
              </div>
              <div class="step-details-header">
                <h3>Board-Ready Legal Search Report (LSR) Dossier</h3>
                <p>The final due diligence output is synthesized into an executive, court-admissible audit dossier with advocate digital signature, title certificates, and complete government citations.</p>
              </div>

              <div class="step-feature-cards">
                <div class="step-feature-item">
                  <h5>⚖️ Advocate Certified Title Opinion</h5>
                  <p>Defensible, professional indemnity-backed legal opinion ready for bank sanction and funding.</p>
                </div>
                <div class="step-feature-item">
                  <h5>📊 Comprehensive Evidence Binder</h5>
                  <p>Includes high-res RTC copies, Tippani sketches, Encumbrance Certificates, and mutation extracts.</p>
                </div>
                <div class="step-feature-item">
                  <h5>🏢 Institutional Investor Grade</h5>
                  <p>Formatted specifically for corporate investment committees, private equity funds, and REITs.</p>
                </div>
                <div class="step-feature-item">
                  <h5>🔒 Cryptographic QR Verification</h5>
                  <p>QR code verification allows third-party auditors to verify authenticity directly against the OJIX vault.</p>
                </div>
              </div>
            </div>

            <div class="step-footer-actions">
              <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--teal-accent); font-weight:800;">● STATUS: DUE DILIGENCE COMPLETED &amp; CERTIFIED</span>
              <button class="btn-action-primary" onclick="switchStep(1)">Restart Workflow Tour &olarr;</button>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- Section 3: 4 Karnataka Government Portals Command Center -->
    <section id="govt-portals" class="govt-portals-section">
      <div class="section-title-block">
        <div class="section-title-left">
          <h2>Official Karnataka Government Portals Reconciled</h2>
          <p>Every finding in an OJIX report is cryptographically traced to authentic state government databases.</p>
        </div>
        <span style="font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:800; color:var(--blue-primary);">● 100% TRACEABLE CITATIONS</span>
      </div>

      <div class="govt-cards-grid">
        
        <!-- Bhoomi Portal -->
        <article class="govt-client-card bhoomi">
          <div class="govt-card-head">
            <div class="govt-card-title-group">
              <div class="govt-avatar-icon" style="background:#FEF3C7; color:#B45309;">🌾</div>
              <div>
                <div class="govt-name-title">Bhoomi Portal</div>
                <div style="font-size:11px; color:var(--text-muted);">Revenue Department</div>
              </div>
            </div>
            <span class="govt-portal-type-pill" style="color:#B45309; background:#FEF3C7; border:1px solid rgba(217,119,6,0.3);">LAND RECORDS</span>
          </div>
          <div class="govt-domain-box">🔒 landrecords.karnataka.gov.in</div>
          <div class="govt-extract-data">RTC Form-16 &amp; MR-21 Mutation Register Extract</div>
          <div class="govt-audit-status" style="color:var(--teal-accent);">
            <span>&#10003; 2A 14G EXTENT MATCHED</span>
          </div>
        </article>

        <!-- Kaveri 2.0 -->
        <article class="govt-client-card kaveri">
          <div class="govt-card-head">
            <div class="govt-card-title-group">
              <div class="govt-avatar-icon" style="background:#DBEAFE; color:#1D4ED8;">📜</div>
              <div>
                <div class="govt-name-title">Kaveri 2.0</div>
                <div style="font-size:11px; color:var(--text-muted);">Stamps &amp; Registration</div>
              </div>
            </div>
            <span class="govt-portal-type-pill" style="color:#1D4ED8; background:#EFF6FF; border:1px solid rgba(37,99,235,0.3);">REGISTRATION</span>
          </div>
          <div class="govt-domain-box">🔒 kaveri.karnataka.gov.in</div>
          <div class="govt-extract-data">Registered Sale Deed #4821 &amp; 30-Yr Nil EC (Form 15)</div>
          <div class="govt-audit-status" style="color:var(--teal-accent);">
            <span>&#10003; ZERO ENCUMBRANCE CONFIRMED</span>
          </div>
        </article>

        <!-- Mojini SSLR -->
        <article class="govt-client-card mojini">
          <div class="govt-card-head">
            <div class="govt-card-title-group">
              <div class="govt-avatar-icon" style="background:#E0F2FE; color:#0284C7;">📐</div>
              <div>
                <div class="govt-name-title">Mojini SSLR</div>
                <div style="font-size:11px; color:var(--text-muted);">Survey Settlement &amp; Records</div>
              </div>
            </div>
            <span class="govt-portal-type-pill" style="color:#0284C7; background:#F0F9FF; border:1px solid rgba(2,132,199,0.3);">CADASTRAL</span>
          </div>
          <div class="govt-domain-box">🔒 mojini.karnataka.gov.in</div>
          <div class="govt-extract-data">11E Pre-Mutation Sketch &amp; Tippani Stone Boundary</div>
          <div class="govt-audit-status" style="color:var(--teal-accent);">
            <span>&#10003; BOUNDARY LOCKED TO GPS</span>
          </div>
        </article>

        <!-- Karnataka High Court -->
        <article class="govt-client-card highcourt">
          <div class="govt-card-head">
            <div class="govt-card-title-group">
              <img class="court-thumb-avatar" src="${highCourtB64 || '/karnataka-high-court-exact.png'}" alt="High Court of Karnataka" />
              <div>
                <div class="govt-name-title">Karnataka High Court</div>
                <div style="font-size:11px; color:var(--text-muted);">Attara Kacheri Registry</div>
              </div>
            </div>
            <span class="govt-portal-type-pill" style="color:#BE123C; background:#FFF1F2; border:1px solid rgba(190,18,60,0.3);">LITIGATION</span>
          </div>
          <div class="govt-domain-box">🔒 karnatakahiighcourt.kar.nic.in</div>
          <div class="govt-extract-data">Civil Suit, Writ &amp; Injunction Search across Karnataka</div>
          <div class="govt-audit-status" style="color:var(--teal-accent);">
            <span>&#10003; 0 PENDING DISPUTES / CLEAN</span>
          </div>
        </article>

      </div>
    </section>

    <!-- =====================================================================
         Section 4: 10 ROLE-BASED ACCESS CONTROL (RBAC) WORKFLOW EXPLORER
         ===================================================================== -->
    <section id="rbac-flow" class="role-workflow-section">
      <div class="section-title-block" style="margin-bottom:12px;">
        <div class="section-title-left">
          <h2>10-Role Due Diligence Workflow Explorer</h2>
          <p>Select any role below to explore their dedicated execution path, inputs, tools, deliverables, and permission scope in OJIX.</p>
        </div>
        <span class="nav-badge-client" style="color:#6D28D9; background:#FAF5FF; border-color:#C4B5FD;">ISO / SOC-2 ENTERPRISE RBAC</span>
      </div>

      <div class="role-explorer-layout">
        
        <!-- Role Selector List Pane (Left) -->
        <div class="role-list-pane">
          ${rolesData.map((role, idx) => `
            <button class="role-select-item ${idx === 0 ? 'active' : ''}" 
                    id="role-btn-${role.id}"
                    onclick="selectRole('${role.id}')"
                    style="border-color: ${idx === 0 ? role.themeColor : 'var(--border-subtle)'}; background: ${idx === 0 ? role.bgColor : '#FFFFFF'};">
              <div class="role-select-icon" style="background:${role.accentBg}; color:${role.themeColor};">
                ${role.icon}
              </div>
              <div class="role-select-info">
                <span class="role-select-title" style="color:${role.themeColor};">${role.title}</span>
                <span class="role-select-scope">${role.scope}</span>
              </div>
            </button>
          `).join('')}
        </div>

        <!-- Dynamic Role Flow Console (Right) -->
        <div class="role-console-pane" id="role-console-display">
          <!-- Content dynamically rendered via selectRole(roleId) -->
        </div>

      </div>
    </section>

    <!-- Footer -->
    <footer class="showcase-footer">
      <div class="footer-brand">
        <strong style="color:var(--navy-dark); font-size:13px;">OJIX Property Intelligence</strong>
        <span>&bull;</span>
        <span>Enterprise Due Diligence Platform for Developers, Funds &amp; Banks</span>
      </div>
      <div>
        <span>&copy; 2026 OJIX Engineering &amp; Technology LLP. All rights reserved.</span>
      </div>
    </footer>

  </main>

  <script>
    const rolesData = ${JSON.stringify(rolesData)};

    function switchStep(stepNum) {
      const buttons = document.querySelectorAll('.step-tab-btn');
      buttons.forEach((btn, idx) => {
        if (idx === stepNum - 1) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      for (let i = 1; i <= 5; i++) {
        const pane = document.getElementById('step-pane-' + i);
        if (pane) {
          pane.style.display = (i === stepNum) ? 'grid' : 'none';
        }
      }
    }

    function selectRole(roleId) {
      const role = rolesData.find(r => r.id === roleId);
      if (!role) return;

      // Update button active state
      rolesData.forEach(r => {
        const btn = document.getElementById('role-btn-' + r.id);
        if (btn) {
          if (r.id === roleId) {
            btn.classList.add('active');
            btn.style.borderColor = role.themeColor;
            btn.style.background = role.bgColor;
          } else {
            btn.classList.remove('active');
            btn.style.borderColor = 'var(--border-subtle)';
            btn.style.background = '#FFFFFF';
          }
        }
      });

      // Render console display
      const consolePane = document.getElementById('role-console-display');
      consolePane.innerHTML = \`
        <!-- Role Header Card -->
        <div class="console-header-card" style="border-color:\${role.borderColor}; background:\${role.bgColor};">
          <div class="console-role-title-block">
            <div class="console-role-icon" style="background:\${role.accentBg}; color:\${role.themeColor};">
              \${role.icon}
            </div>
            <div class="console-role-headings">
              <h3 style="color:\${role.themeColor};">\${role.title}</h3>
              <p>SCOPE: \${role.scope.toUpperCase()}</p>
            </div>
          </div>
          <span class="nav-badge-client" style="color:\${role.themeColor}; background:\${role.accentBg}; border-color:\${role.borderColor};">
            \${role.category.toUpperCase()}
          </span>
        </div>

        <!-- Mission Statement -->
        <div class="console-mission-box">
          <h5>Core Mission &amp; Responsibility in OJIX</h5>
          <p>\${role.mission}</p>
        </div>

        <!-- 4-Stage Role Flow -->
        <div class="role-flow-stages-box">
          <div class="flow-stages-title">
            <span>⚡ 4-STAGE OPERATIONAL FLOW FOR \${role.title.toUpperCase()}</span>
          </div>

          <div class="flow-stages-grid">
            \${role.stages.map(s => \`
              <div class="flow-stage-card">
                <div class="stage-num-badge" style="background:\${role.accentBg}; color:\${role.themeColor};">
                  \${s.step}
                </div>
                <div class="stage-card-body">
                  <h6>\${s.title}</h6>
                  <p>\${s.desc}</p>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>

        <!-- Inputs, Tools & Outputs Matrix -->
        <div class="role-triad-grid">
          <div class="triad-box">
            <span class="triad-title">📥 Inputs &amp; Dependencies</span>
            <span class="triad-desc">\${role.inputs}</span>
          </div>

          <div class="triad-box">
            <span class="triad-title">🛠️ Tools &amp; Modules Used</span>
            <span class="triad-desc">\${role.tools}</span>
          </div>

          <div class="triad-box">
            <span class="triad-title">📤 Key Deliverables</span>
            <span class="triad-desc">\${role.outputs}</span>
          </div>
        </div>

        <!-- Permission Scopes -->
        <div style="background:#FFFFFF; border:1px solid var(--border-subtle); border-radius:8px; padding:12px 14px;">
          <span style="font-family:'JetBrains Mono', monospace; font-size:9.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">
            🔒 ENFORCED PERMISSIONS &amp; AUTHORIZATION SCOPES:
          </span>
          <div class="permissions-tags-row">
            \${role.permissions.map(p => \`
              <span class="perm-chip">
                <span style="color:\${role.themeColor}; font-weight:900;">&#10003;</span> \${p}
              </span>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    // Initialize with first role (Workspace Owner)
    selectRole('owner');
  </script>
</body>
</html>`;

const outputPath = path.join(rootDir, 'OJIX_Client_Showcase_Page.html');
fs.writeFileSync(outputPath, html);
console.log('Created:', outputPath);

// Copy to apps/web public assets
const webAssetPath = path.join(rootDir, 'apps/web/public/assets/OJIX_Client_Showcase_Page.html');
fs.writeFileSync(webAssetPath, html);
console.log('Copied to web assets:', webAssetPath);

// Copy to apps/web dist assets if exists
const distAssetPath = path.join(rootDir, 'apps/web/dist/assets/OJIX_Client_Showcase_Page.html');
if (fs.existsSync(path.dirname(distAssetPath))) {
  fs.writeFileSync(distAssetPath, html);
  console.log('Copied to web dist assets');
}
