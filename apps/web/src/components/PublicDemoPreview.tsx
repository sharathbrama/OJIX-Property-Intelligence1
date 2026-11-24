import { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardList,
  FileText,
  MapPinned,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Scale,
  GitMerge,
  Eye,
  X,
  Layers,
  ChevronRight,
  ExternalLink,
  Crown,
  FileCheck2,
  Calendar,
  MapPin,
  Clock,
  Compass,
  Briefcase
} from 'lucide-react';
import './public-demo-preview.css';

type DemoSection = 'overview' | 'property' | 'documents' | 'findings' | 'map' | 'chain';

interface DemoDocument {
  id: string;
  title: string;
  category: string;
  source: string;
  date: string;
  status: 'verified' | 'needs_review' | 'clear';
  stampDuty?: string;
  parties: { role: string; name: string }[];
  summary: string;
}

const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: 'doc-sale-deed-2021',
    title: 'Registered Absolute Sale Deed (Doc No. 4521/2021)',
    category: 'Title Deed · Kaveri 2.0 Registered',
    source: 'Sub-Registrar Office Bommanahalli, Bengaluru',
    date: '14 Oct 2021',
    status: 'verified',
    stampDuty: '₹14,50,000 paid · Registered Volume 112',
    parties: [
      { role: 'Vendor', name: 'M. R. Narayana Swamy & Family' },
      { role: 'Purchaser', name: 'Karnataka Prime Assets Pvt. Ltd.' }
    ],
    summary: 'Absolute conveyance of Sy. No. 42/7A, measuring 1 Acre 20 Guntas, situated at Arakere Village, Begur Hobli, Bengaluru South.'
  },
  {
    id: 'doc-rtc-pahani-2023',
    title: 'Bhoomi RTC / Pahani Extract (Form No. 16)',
    category: 'Revenue Record · Bhoomi Live Sync',
    source: 'Revenue Department Karnataka (Bhoomi)',
    date: '18 Jul 2023',
    status: 'verified',
    stampDuty: 'Digital Watermark verified (KLR Act 1964)',
    parties: [
      { role: 'Kabzedar (Owner)', name: 'Karnataka Prime Assets Pvt. Ltd.' },
      { role: 'Tenant / Cultivator', name: 'Self (Nija)' }
    ],
    summary: 'Column 9 reflects undisputed ownership. Column 11 & 12 record no liabilities, mortgages, or court attachments.'
  },
  {
    id: 'doc-survey-tippan',
    title: 'Certified Survey Sketch (Tippan & Akarband)',
    category: 'Cadastral Record · Survey Dept',
    source: 'Department of Survey Settlement and Land Records (SSLR)',
    date: '05 Mar 2022',
    status: 'verified',
    stampDuty: 'Surveyor Seal & Hissa Atlas Verified',
    parties: [
      { role: 'Survey Officer', name: 'ADLR Bengaluru South' }
    ],
    summary: 'Survey parcel geometry defines clean polygon with zero A-Kharab or B-Kharab deductions. Boundary lengths conform to Deed Schedule.'
  },
  {
    id: 'doc-encumbrance-cert',
    title: 'Nil Encumbrance Certificate (Form 15 · 30 Years)',
    category: 'Encumbrance Record · Kaveri 2.0',
    source: 'Kaveri Online Services (Inspector General of Registration)',
    date: '02 Aug 2024',
    status: 'clear',
    stampDuty: 'Search period: 01-04-1994 to 01-08-2024',
    parties: [
      { role: 'Search Range', name: '30 Years Search across Sy No. 42/7A' }
    ],
    summary: 'Prior 2018 bank loan charge stands cancelled via registered Discharge Deed No. 1822/2021. Property is free from registered encumbrances.'
  }
];

const navigation: { id: DemoSection; label: string; icon: typeof Building2; badge?: string }[] = [
  { id: 'overview', label: 'Executive Overview', icon: ClipboardList },
  { id: 'property', label: 'Property & Parcel', icon: Building2 },
  { id: 'documents', label: 'Title Documents', icon: FileText, badge: '4' },
  { id: 'findings', label: 'Risk & Findings', icon: BadgeCheck, badge: '3' },
  { id: 'map', label: 'Location & Buffers', icon: MapPinned },
  { id: 'chain', label: 'Title Chain (30 Yrs)', icon: GitMerge },
];

const roleLabels: Record<string, { label: string; desc: string; icon: any }> = {
  owner: { label: 'Workspace Owner', desc: 'Full diligence portfolio & executive sign-off authority', icon: Crown },
  lawyer: { label: 'Legal Reviewer', desc: 'Title examination, discrepancy verification & opinion drafting', icon: Scale },
  admin: { label: 'Organization Admin', desc: 'Access governance, reviewer assignment & pipeline management', icon: Building2 },
  analyst: { label: 'Evidence Analyst', desc: 'Document verification & government portal cross-checks', icon: BadgeCheck },
  operations: { label: 'Document Operations', desc: 'Intake, classification and OCR structured extraction', icon: FileCheck2 },
  consultant: { label: 'Property Consultant', desc: 'Client dossiers, buyer advisory and executive summaries', icon: Briefcase },
  'super-admin': { label: 'Super Admin', desc: 'Multi-tenant controls, system telemetry and audit logs', icon: ShieldCheck },
  viewer: { label: 'Client Reviewer', desc: 'Approved read-only buyer/investor due diligence inspection', icon: Eye },
};

const findings = [
  {
    title: 'Title Continuity: Unbroken 30-Year Devolution',
    detail: 'Complete sequence of registered deeds verified from 1994 Allotment, 2005 Conveyance, to 2021 Purchase. No missing title link.',
    severity: 'clear',
    category: 'Title Chain',
    tag: 'Verified Clear'
  },
  {
    title: 'Survey Boundary & Akarband Matching',
    detail: 'Survey Tippan sketch dimensions align with the Sale deed schedule boundaries. Boundary variance is within permissible standard deviation (+/- 0.4%).',
    severity: 'clear',
    category: 'Cadastral Boundaries',
    tag: 'Verified Match'
  },
  {
    title: 'Prior Mortgage Discharge Registered',
    detail: 'Earlier hypothecation in favor of Canara Bank was discharged in 2021 via registered deed. Certified copy of Form 15 confirms Nil balance encumbrance.',
    severity: 'medium',
    category: 'Encumbrance Record',
    tag: 'Discharged'
  },
  {
    title: 'Kharab & Environmental Buffer Review',
    detail: 'Parcel is 420m away from nearest surveyed Rajakaluve (primary drain) and 850m from Begur Lake, safely exceeding 50m and 75m NGT buffer limits.',
    severity: 'clear',
    category: 'Regulatory Buffers',
    tag: 'Buffer Safe'
  }
];

export function PublicDemoPreview({ role, onExit }: { role: string; onExit: () => void }) {
  const [section, setSection] = useState<DemoSection>('overview');
  const [activeRole, setActiveRole] = useState(role || 'owner');
  const [selectedDoc, setSelectedDoc] = useState<DemoDocument | null>(null);
  const [satelliteView, setSatelliteView] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const current = navigation.find(item => item.id === section) || navigation[0];
  const CurrentIcon = current.icon;
  const currentRoleInfo = roleLabels[activeRole] || roleLabels.owner;
  const RoleIcon = currentRoleInfo.icon;

  return (
    <main className="public-demo-shell">
      {/* Top Header */}
      <header className="public-demo-topbar">
        <div className="public-demo-topbar-left">
          <a className="public-demo-brand" href="#demo" onClick={(e) => { e.preventDefault(); setSection('overview'); }} aria-label="OJIX demo home">
            <img src="/assets/ojix-wordmark-header.png" alt="OJIX" className="public-demo-logo" />
            <div className="public-demo-brand-text">
              <strong>Non-Litigation Law Intelligence</strong>
              <small>Karnataka Property Due Diligence</small>
            </div>
          </a>
        </div>

        <div className="public-demo-top-actions">
          {/* Role selector dropdown */}
          <div className="public-demo-role-pill-wrap">
            <button
              type="button"
              className="public-demo-role-btn"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              aria-label="Switch Demo Perspective"
            >
              <RoleIcon size={14} className="role-icon" />
              <span className="role-btn-text">
                <small>Viewing as</small>
                <strong>{currentRoleInfo.label}</strong>
              </span>
              <ChevronRight size={14} className={`role-chevron ${showRoleMenu ? 'rotate' : ''}`} />
            </button>

            {showRoleMenu && (
              <div className="public-demo-role-dropdown" role="menu">
                <div className="role-dropdown-header">
                  <span>Switch Role Perspective</span>
                  <small>Test the workspace from different stakeholder views</small>
                </div>
                {Object.entries(roleLabels).map(([key, info]) => {
                  const ItemIcon = info.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`role-option ${activeRole === key ? 'active' : ''}`}
                      onClick={() => {
                        setActiveRole(key);
                        setShowRoleMenu(false);
                      }}
                    >
                      <ItemIcon size={16} />
                      <div>
                        <strong>{info.label}</strong>
                        <p>{info.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="button" className="public-demo-exit-btn" onClick={onExit}>
            <ArrowLeft size={15} />
            <span>Exit Demo</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="public-demo-body">
        {/* Desktop Sidebar Navigation */}
        <aside className="public-demo-sidebar">
          <div className="public-demo-workspace-badge">
            <span className="public-demo-workspace-icon">
              <Building2 size={18} />
            </span>
            <div className="public-demo-workspace-meta">
              <small>SAMPLE DOSSIER</small>
              <strong>Arakere Sy 42/7A</strong>
              <span>OJIX-DEMO-0001</span>
            </div>
          </div>

          <nav className="public-demo-nav" aria-label="Sample workspace sections">
            {navigation.map(({ id, label, icon: Icon, badge }) => (
              <button
                type="button"
                key={id}
                className={`public-demo-nav-item ${section === id ? 'active' : ''}`}
                onClick={() => setSection(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {badge && <span className="nav-badge">{badge}</span>}
              </button>
            ))}
          </nav>

          <div className="public-demo-sidebar-trust-box">
            <ShieldCheck size={18} className="trust-icon" />
            <div>
              <strong>Synthetic Law Intelligence</strong>
              <p>Demonstrating Karnataka Kaveri 2.0 & Bhoomi automated checks without live server credentials.</p>
            </div>
          </div>
        </aside>

        {/* Mobile Horizontal Pill Tab Navigation */}
        <div className="public-demo-mobile-tabs" role="tablist">
          {navigation.map(({ id, label, icon: Icon, badge }) => (
            <button
              type="button"
              key={id}
              role="tab"
              aria-selected={section === id}
              className={`mobile-tab-btn ${section === id ? 'active' : ''}`}
              onClick={() => setSection(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {badge && <span className="mobile-badge">{badge}</span>}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <section className="public-demo-content" aria-live="polite">
          {/* Page Banner / Header */}
          <div className="public-demo-header-card">
            <div className="header-meta-group">
              <span className="public-demo-status-chip">
                <span className="chip-dot" />
                <span>{currentRoleInfo.label.toUpperCase()} DEMO DOSSIER</span>
              </span>
              <h1>
                <CurrentIcon size={24} className="heading-icon" />
                {section === 'overview' ? 'Property Intelligence Overview' : current.label}
              </h1>
              <p>
                Arakere Village, Begur Hobli, Bengaluru South · Sy. No. 42/7A · Extent 1A 20G
              </p>
            </div>

            <div className="header-badge-group">
              <span className="legal-score-badge">
                <small>TITLE SCORE</small>
                <strong>96 / 100</strong>
                <span>LOW RISK</span>
              </span>
            </div>
          </div>

          {/* Section 1: Overview */}
          {section === 'overview' && (
            <div className="public-demo-section-body">
              {/* Stat Grid */}
              <div className="public-demo-stat-grid">
                <article className="stat-card">
                  <div className="stat-card-top">
                    <span className="stat-label">Land Parcel Extent</span>
                    <Building2 size={18} className="stat-icon orange" />
                  </div>
                  <strong className="stat-number">1A 20G</strong>
                  <span className="stat-sub">65,340 sq.ft · Converted</span>
                </article>

                <article className="stat-card">
                  <div className="stat-card-top">
                    <span className="stat-label">Title Chain Span</span>
                    <GitMerge size={18} className="stat-icon emerald" />
                  </div>
                  <strong className="stat-number">30 Yrs</strong>
                  <span className="stat-sub">1994 to 2024 · Unbroken</span>
                </article>

                <article className="stat-card">
                  <div className="stat-card-top">
                    <span className="stat-label">Verified Documents</span>
                    <FileCheck2 size={18} className="stat-icon blue" />
                  </div>
                  <strong className="stat-number">4 Files</strong>
                  <span className="stat-sub">Deeds, RTC, Survey, EC</span>
                </article>

                <article className="stat-card">
                  <div className="stat-card-top">
                    <span className="stat-label">Kaveri EC Status</span>
                    <BadgeCheck size={18} className="stat-icon purple" />
                  </div>
                  <strong className="stat-number">Nil Charge</strong>
                  <span className="stat-sub">Registered Discharge 2021</span>
                </article>
              </div>

              {/* Highlight Row */}
              <div className="public-demo-card-grid">
                {/* Parcel Summary Card */}
                <article className="public-demo-card">
                  <div className="card-top-bar">
                    <div>
                      <span className="section-eyebrow">CADASTRAL SUMMARY</span>
                      <h2>Karnataka Land Verification</h2>
                    </div>
                    <span className="tag-pill emerald">GOVERNMENT SYNC READY</span>
                  </div>

                  <div className="facts-grid">
                    <div className="fact-item">
                      <small>Survey Number</small>
                      <strong>Sy. No. 42/7A</strong>
                    </div>
                    <div className="fact-item">
                      <small>Village & Hobli</small>
                      <strong>Arakere · Begur Hobli</strong>
                    </div>
                    <div className="fact-item">
                      <small>Taluk & District</small>
                      <strong>Bengaluru South · Urban</strong>
                    </div>
                    <div className="fact-item">
                      <small>Land Classification</small>
                      <strong>Dry Agricultural (Converted)</strong>
                    </div>
                    <div className="fact-item">
                      <small>Kharab Land</small>
                      <strong>0A 00G (Nil Kharab)</strong>
                    </div>
                    <div className="fact-item">
                      <small>Recorded Owner (RTC)</small>
                      <strong>Karnataka Prime Assets Pvt Ltd</strong>
                    </div>
                  </div>

                  <div className="card-actions-bar">
                    <button type="button" className="demo-action-btn primary" onClick={() => setSection('property')}>
                      <span>Examine Parcel Record</span>
                      <ChevronRight size={15} />
                    </button>
                    <button type="button" className="demo-action-btn secondary" onClick={() => setSection('map')}>
                      <span>View Cadastral Map</span>
                      <MapPinned size={15} />
                    </button>
                  </div>
                </article>

                {/* Key Risk Assessment Callout */}
                <article className="public-demo-card highlight-card">
                  <div className="callout-header">
                    <span className="callout-icon-wrap">
                      <ShieldCheck size={22} />
                    </span>
                    <div>
                      <span className="section-eyebrow">LEGAL OPINION PREVIEW</span>
                      <h2>Clear & Marketable Title</h2>
                    </div>
                  </div>
                  <p className="callout-text">
                    The title scrutiny of Sy. No. 42/7A reveals valid devolution from the root allotment. No court stays, pending litigation, or Land Acquisition Act notices have been recorded.
                  </p>
                  <ul className="callout-points">
                    <li><CheckCircle2 size={15} className="point-icon green" /> <span>30-year Encumbrance Certificate verified Nil</span></li>
                    <li><CheckCircle2 size={15} className="point-icon green" /> <span>Mutation Entry (M.R. No. 14/2021-22) certified</span></li>
                    <li><CheckCircle2 size={15} className="point-icon green" /> <span>Buffer zone compliant with NGT and BBMP guidelines</span></li>
                  </ul>
                  <button type="button" className="demo-link-btn" onClick={() => setSection('findings')}>
                    <span>Review detailed risk matrix</span>
                    <ChevronRight size={14} />
                  </button>
                </article>
              </div>

              {/* Sample Documents Row */}
              <article className="public-demo-card">
                <div className="card-top-bar">
                  <div>
                    <span className="section-eyebrow">TITLE VAULT</span>
                    <h2>Key Title Evidence Documents</h2>
                  </div>
                  <button type="button" className="demo-link-btn" onClick={() => setSection('documents')}>
                    <span>View All (4)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="demo-doc-cards-grid">
                  {DEMO_DOCUMENTS.map((doc) => (
                    <div key={doc.id} className="doc-tile" onClick={() => setSelectedDoc(doc)}>
                      <div className="doc-tile-icon">
                        <FileText size={20} />
                      </div>
                      <div className="doc-tile-info">
                        <strong>{doc.title}</strong>
                        <span>{doc.category}</span>
                        <small>{doc.date} · {doc.source}</small>
                      </div>
                      <span className="doc-status-tag verified">
                        <CheckCircle2 size={13} />
                        <span>Inspect</span>
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}

          {/* Section 2: Property & Parcel Record */}
          {section === 'property' && (
            <div className="public-demo-section-body">
              <article className="public-demo-card">
                <div className="card-top-bar">
                  <div>
                    <span className="section-eyebrow">CADASTRAL DOSSIER</span>
                    <h2>Parcel Details & Schedule</h2>
                  </div>
                  <span className="tag-pill blue">GOVT RECORD MATCH</span>
                </div>

                <div className="facts-grid expanded-grid">
                  <div className="fact-item">
                    <small>Official Application ID</small>
                    <strong>OJIX-DEMO-0001</strong>
                  </div>
                  <div className="fact-item">
                    <small>Survey / Hissa</small>
                    <strong>Sy No. 42 / Hissa 7A</strong>
                  </div>
                  <div className="fact-item">
                    <small>Total Extent</small>
                    <strong>1 Acre 20 Guntas (65,340 Sq.Ft)</strong>
                  </div>
                  <div className="fact-item">
                    <small>Village & Hobli</small>
                    <strong>Arakere · Begur Hobli</strong>
                  </div>
                  <div className="fact-item">
                    <small>Taluk & District</small>
                    <strong>Bengaluru South · Bengaluru Urban</strong>
                  </div>
                  <div className="fact-item">
                    <small>Kaveri Sub-Registrar Office</small>
                    <strong>Bommanahalli (SRO Code 112)</strong>
                  </div>
                  <div className="fact-item">
                    <small>Bhoomi Mutation Register No.</small>
                    <strong>M.R. No. 14/2021-22</strong>
                  </div>
                  <div className="fact-item">
                    <small>Conversion Order No.</small>
                    <strong>ALN(S)/SR/94/2020-21 (DC Bengaluru)</strong>
                  </div>
                  <div className="fact-item">
                    <small>Kharab A (Uncultivable)</small>
                    <strong>00 Guntas</strong>
                  </div>
                  <div className="fact-item">
                    <small>Kharab B (Govt / Public)</small>
                    <strong>00 Guntas</strong>
                  </div>
                </div>

                <div className="schedule-boundaries-box">
                  <h3>Schedule Property Boundaries (As per Sale Deed & Tippan)</h3>
                  <div className="boundaries-compass-grid">
                    <div className="boundary-card north">
                      <span className="compass-tag">NORTH</span>
                      <strong>Survey No. 42/6 (Private Property)</strong>
                    </div>
                    <div className="boundary-card south">
                      <span className="compass-tag">SOUTH</span>
                      <strong>60 Ft Master Plan Road & Sy No. 43</strong>
                    </div>
                    <div className="boundary-card east">
                      <span className="compass-tag">EAST</span>
                      <strong>Survey No. 42/7B (Subdivided Portion)</strong>
                    </div>
                    <div className="boundary-card west">
                      <span className="compass-tag">WEST</span>
                      <strong>Village Gramatana Access Road</strong>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* Section 3: Title Documents */}
          {section === 'documents' && (
            <div className="public-demo-section-body">
              <article className="public-demo-card">
                <div className="card-top-bar">
                  <div>
                    <span className="section-eyebrow">LEGAL EVIDENCE VAULT</span>
                    <h2>Title Deeds & Revenue Records</h2>
                  </div>
                  <span className="tag-pill emerald">4 DOCUMENTS VERIFIED</span>
                </div>
                <p className="section-description">
                  Click any document to inspect OCR extraction fields, stamp duty records, and verified government parties.
                </p>

                <div className="document-inspection-list">
                  {DEMO_DOCUMENTS.map((doc) => (
                    <div key={doc.id} className="doc-inspect-card" onClick={() => setSelectedDoc(doc)}>
                      <div className="doc-inspect-icon">
                        <FileText size={24} />
                      </div>
                      <div className="doc-inspect-main">
                        <div className="doc-inspect-header">
                          <strong>{doc.title}</strong>
                          <span className="status-badge verified">Verified Record</span>
                        </div>
                        <span className="doc-meta-sub">{doc.category} · {doc.source}</span>
                        <p className="doc-summary-snippet">{doc.summary}</p>
                        <div className="doc-parties-pills">
                          {doc.parties.map((p, idx) => (
                            <span key={idx} className="party-pill">
                              <small>{p.role}:</small> <strong>{p.name}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                      <button type="button" className="inspect-button">
                        <Eye size={15} />
                        <span>Inspect OCR</span>
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}

          {/* Section 4: Risk Findings & Discrepancies */}
          {section === 'findings' && (
            <div className="public-demo-section-body">
              <article className="public-demo-card">
                <div className="card-top-bar">
                  <div>
                    <span className="section-eyebrow">DUE DILIGENCE AUDIT</span>
                    <h2>Legal Review & Discrepancy Matrix</h2>
                  </div>
                  <span className="tag-pill emerald">ALL CHECKS PASSED</span>
                </div>

                <div className="findings-matrix-list">
                  {findings.map((item, idx) => (
                    <div key={idx} className={`finding-card ${item.severity}`}>
                      <div className="finding-header">
                        <div className="finding-title-group">
                          <CheckCircle2 size={18} className="finding-icon-check" />
                          <div>
                            <strong>{item.title}</strong>
                            <small className="finding-cat">{item.category}</small>
                          </div>
                        </div>
                        <span className={`finding-tag-pill ${item.severity}`}>{item.tag}</span>
                      </div>
                      <p className="finding-detail-text">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}

          {/* Section 5: Location & Cadastral Map */}
          {section === 'map' && (
            <div className="public-demo-section-body">
              <article className="public-demo-card">
                <div className="card-top-bar">
                  <div>
                    <span className="section-eyebrow">SPATIAL INTELLIGENCE</span>
                    <h2>Cadastral & Regulatory Overlay</h2>
                  </div>
                  <div className="map-view-toggles">
                    <button
                      type="button"
                      className={`map-toggle-btn ${!satelliteView ? 'active' : ''}`}
                      onClick={() => setSatelliteView(false)}
                    >
                      Cadastral
                    </button>
                    <button
                      type="button"
                      className={`map-toggle-btn ${satelliteView ? 'active' : ''}`}
                      onClick={() => setSatelliteView(true)}
                    >
                      Satellite
                    </button>
                  </div>
                </div>

                {/* Simulated Interactive Parcel Canvas */}
                <div className={`interactive-parcel-viewport ${satelliteView ? 'satellite-mode' : 'vector-mode'}`}>
                  <div className="parcel-hud-top">
                    <span className="hud-coord">12.8870° N · 77.5960° E</span>
                    <span className="hud-label">Sy No. 42/7A · Arakere</span>
                  </div>

                  <div className="parcel-drawing-scene">
                    {/* Visual Land Shape */}
                    <div className="survey-polygon-visual">
                      <span className="polygon-pin">
                        <MapPin size={22} />
                      </span>
                      <span className="polygon-label">Sy 42/7A<br/><small>1A 20G</small></span>
                      <div className="polygon-boundary-ring" />
                    </div>

                    {/* Buffer indicators */}
                    <div className="buffer-line drain-buffer">
                      <span>Nearest Rajakaluve: 420m (Safe from 50m buffer)</span>
                    </div>
                  </div>

                  <div className="parcel-hud-bottom">
                    <div className="hud-legend-item">
                      <span className="hud-color orange" />
                      <span>Survey Polygon Boundary</span>
                    </div>
                    <div className="hud-legend-item">
                      <span className="hud-color blue" />
                      <span>NGT Lake Buffer (850m Clear)</span>
                    </div>
                    <div className="hud-legend-item">
                      <span className="hud-color green" />
                      <span>Zero Encroachment</span>
                    </div>
                  </div>
                </div>

                <div className="spatial-metrics-bar">
                  <div>
                    <small>Bhoomi Geo-ref</small>
                    <strong>Kaveri-Bhoomi Synchronized</strong>
                  </div>
                  <div>
                    <small>SWD / Rajakaluve Buffer</small>
                    <strong>Clear (420m away)</strong>
                  </div>
                  <div>
                    <small>Wetland / NGT Lake Zone</small>
                    <strong>Compliant (&gt; 75m)</strong>
                  </div>
                </div>
              </article>
            </div>
          )}

          {/* Section 6: Title Chain (30 Years) */}
          {section === 'chain' && (
            <div className="public-demo-section-body">
              <article className="public-demo-card">
                <div className="card-top-bar">
                  <div>
                    <span className="section-eyebrow">TITLE FLOW AUDIT</span>
                    <h2>30-Year Devolution Chain</h2>
                  </div>
                  <span className="tag-pill emerald">NO TITLE GAP</span>
                </div>

                <div className="title-chain-timeline">
                  <div className="chain-step-item">
                    <div className="chain-node-marker">1994</div>
                    <div className="chain-step-content">
                      <span className="chain-step-date">12 May 1994 · Original Root Title</span>
                      <strong>Government Allotment & Land Grant</strong>
                      <p>Sanctioned under Karnataka Land Revenue Rules in favor of Late Ramaiah.</p>
                      <span className="chain-doc-badge">Grant Certificate No. 412/1994</span>
                    </div>
                  </div>

                  <div className="chain-step-item">
                    <div className="chain-node-marker">2005</div>
                    <div className="chain-step-content">
                      <span className="chain-step-date">28 Jan 2005 · Registered Conveyance</span>
                      <strong>Absolute Sale Deed to M. R. Narayana Swamy</strong>
                      <p>Purchased by M. R. Narayana Swamy for valuable consideration. Khata mutated in M.R. 09/2004-05.</p>
                      <span className="chain-doc-badge">Registered Sale Deed No. 892/2005</span>
                    </div>
                  </div>

                  <div className="chain-step-item">
                    <div className="chain-node-marker">2021</div>
                    <div className="chain-step-content">
                      <span className="chain-step-date">14 Oct 2021 · Present Owner Acquisition</span>
                      <strong>Sale Deed to Karnataka Prime Assets Pvt Ltd</strong>
                      <p>Executed by all legal heirs of Narayana Swamy. Consideration fully settled via banking channels.</p>
                      <span className="chain-doc-badge">Registered Sale Deed No. 4521/2021</span>
                    </div>
                  </div>

                  <div className="chain-step-item current">
                    <div className="chain-node-marker active">2024</div>
                    <div className="chain-step-content">
                      <span className="chain-step-date">August 2024 · Current Due Diligence</span>
                      <strong>OJIX Non-Litigation Verification Complete</strong>
                      <p>Nil Encumbrance Certificate confirmed for 30 years. Clean title opinion issued.</p>
                      <span className="chain-doc-badge emerald">Verified Marketable Title</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}
        </section>
      </div>

      {/* Simulated Document Inspection Modal */}
      {selectedDoc && (
        <div className="public-demo-modal-backdrop" onClick={() => setSelectedDoc(null)}>
          <div className="public-demo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-title-wrap">
                <FileText size={22} className="modal-doc-icon" />
                <div>
                  <h3>{selectedDoc.title}</h3>
                  <small>{selectedDoc.category} · {selectedDoc.source}</small>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedDoc(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scroll">
              <div className="modal-document-preview">
                <div className="stamp-paper-watermark">
                  <div className="govt-seal">GOVERNMENT OF KARNATAKA</div>
                  <div className="stamp-details">KAVERI 2.0 REGISTRATION DEPARTMENT</div>
                  <div className="doc-date-stamp">DATED: {selectedDoc.date}</div>
                </div>

                <div className="modal-facts-box">
                  <div className="modal-fact">
                    <small>Official Registration ID</small>
                    <strong>{selectedDoc.id}</strong>
                  </div>
                  <div className="modal-fact">
                    <small>Registered Date</small>
                    <strong>{selectedDoc.date}</strong>
                  </div>
                  <div className="modal-fact">
                    <small>Stamp Duty & Fee</small>
                    <strong>{selectedDoc.stampDuty || 'Officially Verified'}</strong>
                  </div>
                  <div className="modal-fact">
                    <small>Scrutiny Status</small>
                    <strong style={{ color: '#059669' }}>Verified · No Anomalies</strong>
                  </div>
                </div>

                <div className="modal-parties-table">
                  <h4>Recorded Parties & Execution</h4>
                  {selectedDoc.parties.map((p, idx) => (
                    <div key={idx} className="party-row">
                      <span className="party-role-tag">{p.role}</span>
                      <strong className="party-name-val">{p.name}</strong>
                    </div>
                  ))}
                </div>

                <div className="modal-summary-box">
                  <h4>Extracted Schedule & Legal Recital</h4>
                  <p>{selectedDoc.summary}</p>
                </div>
              </div>
            </div>

            <div className="modal-bottom-actions">
              <span className="read-only-notice">
                <ShieldCheck size={14} /> Read-only demonstration document inspection
              </span>
              <button type="button" className="modal-btn-done" onClick={() => setSelectedDoc(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
