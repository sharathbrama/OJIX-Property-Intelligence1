import { useState } from 'react';
import { 
  Building2, MapPin, CheckCircle2, AlertTriangle, ShieldCheck, 
  FileText, ArrowRight, Sparkles, Scale, Layers3, Clock, 
  Check, Download, ChevronRight, UserCheck, Search, Database, 
  BookOpen, Eye, ArrowUpRight
} from 'lucide-react';

interface PropertyWorkspaceLandingProps {
  onLogin: () => void;
  onRegister: () => void;
  onExploreDemo: () => void;
}

interface DemoPropertyCard {
  id: string;
  name: string;
  appNo: string;
  surveyHissa: string;
  village: string;
  taluk: string;
  district: string;
  extent: string;
  type: string;
  status: 'in_review' | 'verified' | 'ready_for_review';
  statusLabel: string;
  boundaries: { north: string; south: string; east: string; west: string };
  coordinates: string;
  swdBufferStatus: 'clear' | 'warning' | 'safe';
  swdBufferDistance: string;
  lakeBufferStatus: 'clear' | 'safe';
  docsCount: number;
  titleFlowYears: number;
  healthScore: number;
  titleChain: Array<{ year: number; type: string; title: string; docRef: string; parties: string }>;
  checklistItems: Array<{ code: string; label: string; status: 'completed' | 'in_progress' }>;
}

const DEMO_PROPERTIES: DemoPropertyCard[] = [
  {
    id: 'prop-blr-001',
    name: 'Whitefield Residential Site (Sy 45/3A)',
    appNo: 'OJ-2026-BLR-001',
    surveyHissa: 'Sy 45 / 3A',
    village: 'Whitefield',
    taluk: 'Bengaluru East',
    district: 'Bengaluru Urban',
    extent: '2,400 sq ft',
    type: 'Non-Agricultural (Converted)',
    status: 'in_review',
    statusLabel: 'In Review',
    boundaries: {
      north: 'Site No. 44 — K. Ramesh',
      south: '30 ft Municipal Road',
      east: 'Site No. 46 — M. Suresh',
      west: 'BDA Designated Park / Common Area'
    },
    coordinates: '12.9698° N, 77.7500° E',
    swdBufferStatus: 'clear',
    swdBufferDistance: '142m from primary SWD (Clear > 50m)',
    lakeBufferStatus: 'clear',
    docsCount: 5,
    titleFlowYears: 28,
    healthScore: 94,
    titleChain: [
      { year: 1998, type: 'Grant', title: 'Revenue Land Grant Order', docRef: 'Order LND/45/1998', parties: 'Tahsildar to Original Grantee' },
      { year: 2012, type: 'Mutation', title: 'Pouthi Khata Succession Extract', docRef: 'M.R. No. 12/2012', parties: 'Legal Heirs Partition' },
      { year: 2018, type: 'Partition', title: 'Registered Partition Deed', docRef: 'Doc No. 1892/2018', parties: 'Family Settlement' },
      { year: 2024, type: 'Sale Deed', title: 'Absolute Registered Conveyance', docRef: 'Doc No. 4521/2024 (SRO Jayanagar)', parties: 'K. Ramesh to S. Suresh' }
    ],
    checklistItems: [
      { code: 'DOC-01', label: 'Primary Registered Title Deeds (30-year flow)', status: 'completed' },
      { code: 'DOC-02', label: 'Bhoomi RTC / Pahani Extracts (Current & Historic)', status: 'completed' },
      { code: 'DOC-03', label: 'Kaveri 2.0 Encumbrance Certificate (Form 15)', status: 'completed' },
      { code: 'DOC-04', label: 'Mojini Cadastral 11E Survey Sketch', status: 'completed' },
      { code: 'DOC-05', label: 'PTCL Act 1978 Non-Alienation Clearance', status: 'completed' },
      { code: 'DOC-06', label: 'Land Reforms 1961 Section 79A/B Verification', status: 'completed' }
    ]
  },
  {
    id: 'prop-blr-002',
    name: 'Arakere Village Land Parcel (Sy 34)',
    appNo: 'OJ-2026-BLR-002',
    surveyHissa: 'Sy 34 / P1',
    village: 'Arakere',
    taluk: 'Bengaluru South',
    district: 'Bengaluru Urban',
    extent: '1 Acre 12 Guntas',
    type: 'Agricultural / Converted DC Order',
    status: 'ready_for_review',
    statusLabel: 'Ready for Review',
    boundaries: {
      north: 'Survey No. 33 — Grama Tana Boundary',
      south: 'Arakere Main Access Road',
      east: 'Survey No. 35 — Government Kharab',
      west: 'Hulimavu Lake Secondary Buffer (42m)'
    },
    coordinates: '12.8856° N, 77.5982° E',
    swdBufferStatus: 'warning',
    swdBufferDistance: 'Secondary SWD buffer boundary at 48m',
    lakeBufferStatus: 'safe',
    docsCount: 6,
    titleFlowYears: 32,
    healthScore: 88,
    titleChain: [
      { year: 1994, type: 'Inam Grant', title: 'Devadaya Inam Abolition Grant', docRef: 'Inam Case 45/1994', parties: 'Special Deputy Commissioner' },
      { year: 2004, type: 'Conversion', title: 'DC Land Conversion Order (Sec 95)', docRef: 'ALN.SR(S) 102/2004', parties: 'Deputy Commissioner BLR' },
      { year: 2016, type: 'Sale Deed', title: 'Registered Sale Deed', docRef: 'Doc No. 3201/2016', parties: 'Anand Kumar to V. Narayan' }
    ],
    checklistItems: [
      { code: 'DOC-01', label: 'Primary Registered Title Deeds (30-year flow)', status: 'completed' },
      { code: 'DOC-02', label: 'Bhoomi RTC / Pahani Extracts (Current & Historic)', status: 'completed' },
      { code: 'DOC-03', label: 'Kaveri 2.0 Encumbrance Certificate (Form 15)', status: 'completed' },
      { code: 'DOC-04', label: '50m SWD / Rajakaluve Spatial Buffer Inspection', status: 'in_progress' },
      { code: 'DOC-05', label: 'PTCL Act 1978 Non-Alienation Clearance', status: 'completed' }
    ]
  },
  {
    id: 'prop-blr-003',
    name: 'Bellandur Tech Corridor Plot (Sy 45/2)',
    appNo: 'OJ-2026-BLR-003',
    surveyHissa: 'Sy 45 / 2',
    village: 'Bellandur',
    taluk: 'Bengaluru East',
    district: 'Bengaluru Urban',
    extent: '3 Acres 04 Guntas',
    type: 'Commercial IT Zone',
    status: 'in_review',
    statusLabel: 'In Review',
    boundaries: {
      north: 'Bellandur Lake Catchment 30m Buffer Line',
      south: 'Outer Ring Road Service Highway',
      east: 'Adjoining Tech Park Sy 45/1',
      west: 'Primary Storm Water Drain (SWD 50m)'
    },
    coordinates: '12.9260° N, 77.6762° E',
    swdBufferStatus: 'warning',
    swdBufferDistance: 'Primary Rajakaluve 50m buffer intersects western edge',
    lakeBufferStatus: 'clear',
    docsCount: 8,
    titleFlowYears: 35,
    healthScore: 82,
    titleChain: [
      { year: 1989, type: 'Inheritance', title: 'Ancestral Revenue Settlement', docRef: 'RTC Vol 14', parties: 'Family Succession' },
      { year: 2008, type: 'BDA Sanction', title: 'Comprehensive Development Plan 2015', docRef: 'BMRDA/ZON/88', parties: 'BDA Town Planning' },
      { year: 2021, type: 'Joint Dev', title: 'Registered Joint Development Agreement', docRef: 'Doc No. 9102/2021', parties: 'Landowners & Infrastructure Corp' }
    ],
    checklistItems: [
      { code: 'DOC-01', label: 'Primary Registered Title Deeds (30-year flow)', status: 'completed' },
      { code: 'DOC-02', label: '50m Rajakaluve / SWD Buffer Demarcation', status: 'completed' },
      { code: 'DOC-03', label: 'Kaveri 2.0 EC Form 15 (1990-2026)', status: 'completed' },
      { code: 'DOC-04', label: 'BBMP B-Khata / e-Aasthi Transition Audit', status: 'in_progress' }
    ]
  }
];

export function PropertyWorkspaceLanding({ onLogin, onRegister, onExploreDemo }: PropertyWorkspaceLandingProps) {
  const [selectedPropIdx, setSelectedPropIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'schedule' | 'title_chain' | 'gis' | 'documents' | 'checklist' | 'opinion'>('schedule');

  const currentProperty = DEMO_PROPERTIES[selectedPropIdx];

  return (
    <div className="property-landing-root" style={{ background: '#0a0f1d', color: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 1. TOP EXECUTIVE HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(10, 15, 29, 0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100, padding: '14px 28px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/assets/ojix-wordmark-header.png" alt="OJIX" style={{ height: '28px', objectFit: 'contain' }} />
              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.15)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Property Intelligence
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'none', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              Karnataka Non-Litigation Due Diligence
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onExploreDemo}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Sparkles size={15} />
              <span>Instant Guest Workspace</span>
            </button>

            <button
              type="button"
              onClick={onLogin}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '6px',
                padding: '8px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={onRegister}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 18px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Register Firm
            </button>
          </div>

        </div>
      </header>

      {/* 2. HERO INTRODUCING OUR ACTUAL PROPERTY INTELLIGENCE WORKSPACE */}
      <section style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 28px 24px' }}>
        <div style={{ maxWidth: '840px', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', fontSize: '12px', fontWeight: 700, marginBottom: '14px' }}>
            <ShieldCheck size={14} />
            <span>KARNATAKA NON-LITIGATION DUE DILIGENCE PLATFORM</span>
          </div>
          
          <h1 style={{ margin: '0 0 12px', fontSize: '38px', fontWeight: 800, lineHeight: 1.2, color: '#ffffff', letterSpacing: '-0.5px' }}>
            Every survey parcel, 30-year title event &amp; spatial buffer. <br />
            <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              One verified legal workspace.
            </span>
          </h1>

          <p style={{ margin: 0, fontSize: '15px', color: '#94a3b8', lineHeight: 1.6 }}>
            Purpose-built for property advocates, corporate real estate counsel, and institutional investors. Examine connected Karnataka survey records, 50m Rajakaluve buffers, Bhoomi RTC mutations, and formal title certifications.
          </p>
        </div>

        {/* 3. INTERACTIVE PROPERTY DETAIL WORKSPACE SHOWCASE (MATCHING OUR REAL APP) */}
        <div style={{ background: '#131d36', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
          
          {/* Top Bar: Property Switcher Selector */}
          <div style={{ background: '#0d1527', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Select Property File:</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {DEMO_PROPERTIES.map((prop, idx) => {
                  const active = selectedPropIdx === idx;
                  return (
                    <button
                      key={prop.id}
                      type="button"
                      onClick={() => setSelectedPropIdx(idx)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: active ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: active ? '#ffffff' : '#94a3b8',
                        fontSize: '12px',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Building2 size={13} style={{ color: active ? '#38bdf8' : '#64748b' }} />
                      <span>{prop.surveyHissa} ({prop.village})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onExploreDemo}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Open in Live Workspace</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* REAL PROPERTY TITLE STRIP (Directly modeled on our App's property-title-row) */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                PROPERTY INTELLIGENCE / VERIFIED CASE FILE
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                {currentProperty.name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: '#94a3b8' }}>
                <MapPin size={14} style={{ color: '#38bdf8' }} />
                <span>{currentProperty.village} · {currentProperty.taluk} · {currentProperty.district}</span>
                <span>•</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{currentProperty.surveyHissa}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>DUE DILIGENCE HEALTH</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981' }}>{currentProperty.healthScore}% Verified</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                {currentProperty.statusLabel}
              </span>
            </div>
          </div>

          {/* REAL PROPERTY SUMMARY METADATA STRIP (Modeled on our App's property-summary-strip) */}
          <div style={{ background: 'rgba(10, 15, 29, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', fontSize: '11.5px' }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>APPLICATION NUMBER</span>
              <strong style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '12.5px' }}>{currentProperty.appNo}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>SURVEY / HISSA</span>
              <strong style={{ color: '#ffffff', fontSize: '12.5px' }}>{currentProperty.surveyHissa}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>LAND EXTENT</span>
              <strong style={{ color: '#ffffff', fontSize: '12.5px' }}>{currentProperty.extent}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>VERIFIED DOCUMENTS</span>
              <strong style={{ color: '#ffffff', fontSize: '12.5px' }}>{currentProperty.docsCount} Source Records</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>TITLE FLOW COVERAGE</span>
              <strong style={{ color: '#10b981', fontSize: '12.5px' }}>{currentProperty.titleFlowYears} Years Verified</strong>
            </div>
          </div>

          {/* REAL WORKSPACE TABS BAR (Directly from App.tsx) */}
          <div style={{ background: '#0e1628', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '0 24px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === 'schedule' ? '#38bdf8' : '#94a3b8',
                fontWeight: activeTab === 'schedule' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                borderBottom: activeTab === 'schedule' ? '2px solid #38bdf8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Building2 size={14} />
              <span>Property Schedule &amp; Boundaries</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gis')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === 'gis' ? '#38bdf8' : '#94a3b8',
                fontWeight: activeTab === 'gis' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                borderBottom: activeTab === 'gis' ? '2px solid #38bdf8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <MapPin size={14} />
              <span>Cadastral GIS &amp; 50m SWD Buffer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('title_chain')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === 'title_chain' ? '#38bdf8' : '#94a3b8',
                fontWeight: activeTab === 'title_chain' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                borderBottom: activeTab === 'title_chain' ? '2px solid #38bdf8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Clock size={14} />
              <span>30-Year Title Flow</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === 'checklist' ? '#38bdf8' : '#94a3b8',
                fontWeight: activeTab === 'checklist' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                borderBottom: activeTab === 'checklist' ? '2px solid #38bdf8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <ShieldCheck size={14} />
              <span>Karnataka Statutory Checklist</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === 'documents' ? '#38bdf8' : '#94a3b8',
                fontWeight: activeTab === 'documents' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                borderBottom: activeTab === 'documents' ? '2px solid #38bdf8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <FileText size={14} />
              <span>Document Vault</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('opinion')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === 'opinion' ? '#38bdf8' : '#94a3b8',
                fontWeight: activeTab === 'opinion' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                borderBottom: activeTab === 'opinion' ? '2px solid #38bdf8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Scale size={14} />
              <span>Advocate Sign-Off</span>
            </button>
          </div>

          {/* ACTIVE TAB CONTENT DISPLAY (Simulating the real app features) */}
          <div style={{ padding: '24px' }}>
            
            {/* TAB 1: SCHEDULE & FOUR-SIDE BOUNDARIES */}
            {activeTab === 'schedule' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px' }}>
                      FOUR-SIDE SCHEDULE OF THE PROPERTY (EAST / WEST / NORTH / SOUTH)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>North:</span>
                        <strong style={{ color: '#ffffff' }}>{currentProperty.boundaries.north}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>South:</span>
                        <strong style={{ color: '#ffffff' }}>{currentProperty.boundaries.south}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>East:</span>
                        <strong style={{ color: '#ffffff' }}>{currentProperty.boundaries.east}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>West:</span>
                        <strong style={{ color: '#ffffff' }}>{currentProperty.boundaries.west}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px' }}>
                      STATUTORY JURISDICTION &amp; IDENTIFIERS
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                      <div>Sub-Registrar Jurisdiction: <strong style={{ color: '#ffffff' }}>SRO Jayanagar / Bengaluru East</strong></div>
                      <div>Revenue Taluka: <strong style={{ color: '#ffffff' }}>{currentProperty.taluk}</strong></div>
                      <div>Hobli: <strong style={{ color: '#ffffff' }}>Varthur / Begur</strong></div>
                      <div>Coordinates: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{currentProperty.coordinates}</strong></div>
                      <div style={{ marginTop: '6px', padding: '8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <Check size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        <span>All four-side boundaries verified across Sale Deed Doc No. 4521/2024 and 11E survey sketch.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CADASTRAL GIS & 50M BUFFER */}
            {activeTab === 'gis' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '18px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '10px' }}>
                    SPATIAL BUFFER &amp; RAJAKALUVE CLEARANCE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
                    <div style={{ padding: '12px', borderRadius: '6px', background: currentProperty.swdBufferStatus === 'clear' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: currentProperty.swdBufferStatus === 'clear' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentProperty.swdBufferStatus === 'clear' ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                        <ShieldCheck size={16} />
                        <span>50m Primary Rajakaluve / SWD Buffer Check</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '4px' }}>
                        {currentProperty.swdBufferDistance}
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700 }}>
                        <CheckCircle2 size={16} />
                        <span>30m Lake Catchment Buffer Check</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '4px' }}>
                        Outside designated 30m lake protection perimeter under NGT &amp; Karnataka Tank Conservation Authority.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                  <Layers3 size={36} style={{ color: '#38bdf8', marginBottom: '8px' }} />
                  <strong style={{ color: '#ffffff', fontSize: '14px' }}>Interactive Mojini 11E Cadastral Overlay</strong>
                  <p style={{ margin: '4px 0 12px', fontSize: '12px', color: '#94a3b8', maxWidth: '320px' }}>
                    Survey parcel boundary polygon with revenue survey numbers, SWD lines, and village road network.
                  </p>
                  <button
                    type="button"
                    onClick={onExploreDemo}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    View Map in Full Workspace &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: 30-YEAR TITLE CHAIN */}
            {activeTab === 'title_chain' && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '14px' }}>
                  FLOW OF TITLE &amp; ROOT INSTRUMENTS (1994 – 2026)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentProperty.titleChain.map((ev, i) => (
                    <div key={ev.docRef} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', background: '#0a0f1d', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ width: '50px', fontWeight: 800, color: '#38bdf8', fontSize: '14px', paddingTop: '2px' }}>
                        {ev.year}
                      </div>
                      <div style={{ width: '2px', height: '36px', background: 'rgba(56, 189, 248, 0.3)', borderRadius: '1px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: '#ffffff', fontSize: '13px' }}>{ev.title}</strong>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{ev.type}</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                          {ev.docRef} • <em>Parties: {ev.parties}</em>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                        <Check size={12} style={{ display: 'inline', marginRight: '3px' }} /> Verified
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: STATUTORY CHECKLIST */}
            {activeTab === 'checklist' && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '14px' }}>
                  KARNATAKA STATUTORY INTAKE CHECKLIST (FRD §12 &amp; MIGRATION 039)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {currentProperty.checklistItems.map(item => (
                    <div key={item.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0f1d', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>{item.code}</span>
                        <span style={{ fontSize: '12px', color: '#ffffff' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: item.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: item.status === 'completed' ? '#34d399' : '#fbbf24' }}>
                        {item.status === 'completed' ? 'PASS' : 'IN REVIEW'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: DOCUMENT VAULT & OCR */}
            {activeTab === 'documents' && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '14px' }}>
                  DOCUMENT INTAKE &amp; OCR EXTRACTION
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ background: '#0a0f1d', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} style={{ color: '#38bdf8' }} />
                      <div>
                        <strong style={{ color: '#ffffff', display: 'block' }}>Sale_Deed_Doc_4521_2024.pdf</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Kaveri 2.0 Registered Absolute Conveyance • 8.4 MB • OCR Confidence 99.1%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>EXTRACTED &amp; ANCHORED</span>
                  </div>

                  <div style={{ background: '#0a0f1d', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} style={{ color: '#38bdf8' }} />
                      <div>
                        <strong style={{ color: '#ffffff', display: 'block' }}>Bhoomi_RTC_Pahani_Extract_2026.pdf</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Revenue Column 9/10/12 Owner &amp; Cultivator Verification • 2.1 MB</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>COLUMN 9 MATCHED</span>
                  </div>

                  <div style={{ background: '#0a0f1d', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} style={{ color: '#38bdf8' }} />
                      <div>
                        <strong style={{ color: '#ffffff', display: 'block' }}>Kaveri_EC_Form15_1994_2024.pdf</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>30-Year Encumbrance Certificate Search • 4.6 MB</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>NIL CHARGES</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: ADVOCATE OPINION & FORMAL SIGN-OFF */}
            {activeTab === 'opinion' && (
              <div style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Scale size={20} style={{ color: '#10b981' }} />
                    <strong style={{ color: '#ffffff', fontSize: '15px' }}>Lead Advocate Legal Opinion Certification</strong>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    FORMAL SIGN-OFF RECORDED
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.6, background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <em>&ldquo;Having examined the flow of title for 28 years from the 1998 Land Grant through Succession Mutation 12/2012, Family Partition 1892/2018, and Absolute Sale Deed 4521/2024, the title of the vendor Sri S. Suresh over Site No. 45/3A is marketable and free from statutory encumbrance under the PTCL Act 1978 and Karnataka Land Reforms Act 1961.&rdquo;</em>
                </div>

                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
                  <div style={{ color: '#94a3b8' }}>
                    Certified by: <strong style={{ color: '#ffffff' }}>Advocate K. R. Raghavan (KAR/2014/892)</strong>
                  </div>
                  <button
                    type="button"
                    onClick={onExploreDemo}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Download Full 18-Page Title Dossier (PDF) &rarr;
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Action Footer for the Showcase */}
          <div style={{ background: '#0a0f1d', borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              Want to inspect this case file, upload deeds, or run automated OCR discrepancy checks?
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onExploreDemo}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Launch Live Workspace (Demo Mode)</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 4. KEY CAPABILITIES ARCHITECTURE SECTION */}
      <section style={{ maxWidth: '1400px', margin: '48px auto', padding: '0 28px' }}>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', margin: '0 0 10px' }}>
            Built for Karnataka Land Laws &amp; Practice
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
            Seamlessly integrating state land record registries with rigorous statutory compliance.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          <div style={{ background: '#131d36', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <MapPin size={20} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>50m Rajakaluve &amp; Lake Buffer</h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
              Automatic spatial screening against BBMP Storm Water Drains (50m primary, 25m secondary, 15m tertiary) and 30m lake perimeter buffers.
            </p>
          </div>

          <div style={{ background: '#131d36', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Clock size={20} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>30-Year Flow of Title</h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
              Chronological linkage of Inam Grants, Succession Mutations, Partition Deeds, and registered conveyances with discrepancy flags.
            </p>
          </div>

          <div style={{ background: '#131d36', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <ShieldCheck size={20} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>10-Point Statutory Intake</h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
              Audits against Karnataka Land Revenue Act 1964, PTCL Act 1978 non-alienation, and Land Reforms Act 1961 Section 79A/B declarations.
            </p>
          </div>

          <div style={{ background: '#131d36', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Scale size={20} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Advocate Legal Sign-Off</h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
              Senior counsel formal title sign-off, caveats, and multi-template export (Standard DD, Bank Mortgage Opinion, Litigation Risk Brief).
            </p>
          </div>

        </div>
      </section>

      {/* 5. FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#0a0f1d', padding: '36px 28px', fontSize: '12px', color: '#64748b' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <img src="/assets/ojix-wordmark-header.png" alt="OJIX" style={{ height: '22px', objectFit: 'contain', opacity: 0.8 }} />
            <div style={{ marginTop: '6px', color: '#94a3b8' }}>
              OJIX Property Intelligence • Karnataka Due Diligence &amp; Title Verification Suite
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <button type="button" onClick={onLogin} style={{ background: 'none', border: 'none', padding: 0, color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>Legal Login</button>
            <button type="button" onClick={onExploreDemo} style={{ background: 'none', border: 'none', padding: 0, color: '#34d399', cursor: 'pointer', fontSize: '12px' }}>Explore Demo Case Files</button>
            <button type="button" onClick={onRegister} style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>Register Organization</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
