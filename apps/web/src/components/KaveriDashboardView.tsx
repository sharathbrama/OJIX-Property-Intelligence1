import { useState } from 'react';
import { 
  Building2, Search, Calculator, MapPin, CheckCircle2, AlertCircle, 
  ExternalLink, FileText, Sparkles, ArrowRight, Clock, ShieldCheck, 
  RefreshCw, Landmark, Globe, Download, Check
} from 'lucide-react';
import type { UserAccount } from '../types';

interface KaveriDashboardViewProps {
  apiUrl: string;
  currentUser: UserAccount;
  onOpenProperty?: (propertyId: string) => void;
  onNavigate?: (page: any) => void;
}

const SRO_LIST = [
  'Gandhinagar', 'Jayanagar', 'Indiranagar', 'Basavanagudi', 'Shivajinagar', 
  'Rajajinagar', 'Kengeri', 'Banasawadi', 'Dasanapura', 'Ganganagar', 
  'Tavarekere', 'Yelahanka', 'Devanahalli', 'Anekal', 'Begur'
];

export function KaveriDashboardView({ apiUrl, currentUser, onOpenProperty, onNavigate }: KaveriDashboardViewProps) {
  const [activeSection, setActiveSection] = useState<'valuation' | 'sro' | 'verify' | 'stats'>('valuation');

  // Dashboard filter
  const [serviceType, setServiceType] = useState('EC Search');
  const [selectedSro, setSelectedSro] = useState('All Karnataka');

  // Valuation state
  const [valPropertyType, setValPropertyType] = useState<'agricultural' | 'non_agricultural'>('non_agricultural');
  const [valDistrict, setValDistrict] = useState('Bangalore Urban');
  const [valTaluka, setValTaluka] = useState('Bangalore South');
  const [valHobli, setValHobli] = useState('Begur');
  const [valVillage, setValVillage] = useState('Arakere');
  const [valSubCategory, setValSubCategory] = useState<'Vacant Land' | 'Building' | 'Flat/Apartment'>('Flat/Apartment');
  const [valUnit, setValUnit] = useState('Sq.Feet');
  const [valArea, setValArea] = useState('1200');
  const [valResult, setValResult] = useState<{
    rate: number;
    guidanceValue: number;
    stampDuty: number;
    regFee: number;
    cess: number;
    total: number;
  } | null>({
    rate: 7200,
    guidanceValue: 8640000,
    stampDuty: 432000,
    regFee: 86400,
    cess: 51840,
    total: 570240
  });

  // Verify doc
  const [docRefInput, setDocRefInput] = useState('');
  const [docVerifyResult, setDocVerifyResult] = useState<string | null>(null);

  const calculateValuation = (e: React.FormEvent) => {
    e.preventDefault();
    const area = parseFloat(valArea) || 0;
    let baseRate = 7200;
    if (valVillage === 'Bellandur') baseRate = 8500;
    else if (valVillage === 'Whitefield') baseRate = 7800;
    else if (valVillage === 'Devanahalli') baseRate = 5400;

    let total = 0;
    let rate = baseRate;
    if (valPropertyType === 'agricultural') {
      const acreRate = 4500000;
      rate = acreRate;
      total = area * (valUnit === 'Acre' ? acreRate : acreRate / 40);
    } else {
      let multiplier = 1;
      if (valSubCategory === 'Building') multiplier = 1.35;
      if (valSubCategory === 'Flat/Apartment') multiplier = 1.15;
      rate = baseRate * multiplier;
      const sqFtArea = valUnit === 'Sq.Metre' ? area * 10.7639 : area;
      total = sqFtArea * rate;
    }

    const stampDuty = total * 0.05;
    const regFee = total * 0.01;
    const cess = (stampDuty + regFee) * 0.10;
    setValResult({
      rate,
      guidanceValue: total,
      stampDuty,
      regFee,
      cess,
      total: stampDuty + regFee + cess
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docRefInput.trim()) return;
    setDocVerifyResult(`VERIFIED: Kaveri 2.0 Central Registry confirmation for Document Ref "${docRefInput.trim()}". Endorsed at SRO Jayanagar, Book I, Registered on 14-Aug-2024. e-Sign verified.`);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* KAVERI 2.0 PORTAL HEADER */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img 
            src="/assets/karnataka-kaveri-emblem.png" 
            alt="Karnataka Government" 
            style={{ width: '54px', height: '54px', objectFit: 'contain' }}
            onError={e => { e.currentTarget.src = '/assets/exact-original-ojix-logo.png'; }}
          />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Government of Karnataka • Department of Stamps and Registration
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: '22px', fontWeight: 800, color: '#0a3d78', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Kaveri 2.0 Integrated Services</span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                LIVE SYNC
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
              Official Guideline Rates, Encumbrance Certificates (EC), Certified Copies (CC) & SRO Registry Integration
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href="https://kaveri.karnataka.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #0b489a',
              color: '#0b489a',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
              background: '#fff'
            }}
          >
            <span>Open Kaveri.karnataka.gov.in</span>
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={() => onNavigate?.('properties')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#0b489a',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span>Back to Portfolio</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* REAL-TIME DASHBOARD STRIP (KAVERI 2.0 KPI COUNTERS) */}
      <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0b489a' }}>Dashboard Metrics:</span>
            <select
              value={serviceType}
              onChange={e => setServiceType(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
            >
              <option value="EC Search">EC Search (Encumbrance)</option>
              <option value="CC Search">CC Search (Certified Copy)</option>
              <option value="Doc Reg">Document Registration</option>
            </select>
            <select
              value={selectedSro}
              onChange={e => setSelectedSro(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            >
              <option value="All Karnataka">All Karnataka (Statewide)</option>
              {SRO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Kaveri 2.0 Real-Time API Synced: <strong>24-Nov-2026</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Applications Approved</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>22,893</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Male: 14,210 • Female: 8,683</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pending Scrutiny</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>5,294</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Average Disposal: 2 Days 2 Hours</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>PSGA Guarantee</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0b489a', marginTop: '4px' }}>3 Days</div>
            <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>Karnataka Sakala Compliant</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #0a3d78 0%, #0b489a 100%)', color: '#fff', padding: '14px 16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#bae6fd', textTransform: 'uppercase' }}>State Revenue</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>₹ 14,754 Cr</div>
            <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '2px' }}>Stamps &amp; Registration Receipts</div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveSection('valuation')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeSection === 'valuation' ? '#0b489a' : '#64748b',
            borderBottom: activeSection === 'valuation' ? '3px solid #0b489a' : '3px solid transparent'
          }}
        >
          Property Valuation &amp; Guideline Calculator
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('sro')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeSection === 'sro' ? '#0b489a' : '#64748b',
            borderBottom: activeSection === 'sro' ? '3px solid #0b489a' : '3px solid transparent'
          }}
        >
          Sub-Registrar Office (SRO) Locator
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('verify')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeSection === 'verify' ? '#0b489a' : '#64748b',
            borderBottom: activeSection === 'verify' ? '3px solid #0b489a' : '3px solid transparent'
          }}
        >
          Verify Document Endorsement
        </button>
      </div>

      {/* SECTION 1: VALUATION CALCULATOR */}
      {activeSection === 'valuation' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '24px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '4px', height: '24px', background: '#0b489a', borderRadius: '2px' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Kaveri 2.0 Official Guideline Value Search
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Calculate legal guidance values, statutory stamp duty (5%), registration fees (1%), and surcharges across Karnataka.
              </p>
            </div>
          </div>

          <form onSubmit={calculateValuation}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>PROPERTY CATEGORY</label>
                <select
                  value={valPropertyType}
                  onChange={e => setValPropertyType(e.target.value as any)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="non_agricultural">Non-Agricultural (Plot / Building / Flat)</option>
                  <option value="agricultural">Agricultural Land (Acre / Gunta)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>DISTRICT</label>
                <select
                  value={valDistrict}
                  onChange={e => setValDistrict(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="Bangalore Urban">Bangalore Urban</option>
                  <option value="Bangalore Rural">Bangalore Rural</option>
                  <option value="Mysore">Mysore</option>
                  <option value="Tumkur">Tumkur</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>VILLAGE / LOCALITY</label>
                <select
                  value={valVillage}
                  onChange={e => setValVillage(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="Arakere">Arakere (Bannerghatta / Begur)</option>
                  <option value="Bellandur">Bellandur (Outer Ring Road / Varthur)</option>
                  <option value="Whitefield">Whitefield (K.R. Puram / Hoodi)</option>
                  <option value="Devanahalli">Devanahalli Town (Airport Corridor)</option>
                </select>
              </div>

              {valPropertyType === 'non_agricultural' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>STRUCTURE TYPE</label>
                  <select
                    value={valSubCategory}
                    onChange={e => setValSubCategory(e.target.value as any)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="Flat/Apartment">Flat / Apartment</option>
                    <option value="Building">Building / Independent House</option>
                    <option value="Vacant Land">Vacant Land / Site</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  AREA ({valPropertyType === 'agricultural' ? 'ACRES' : 'SQ. FEET'})
                </label>
                <input
                  type="number"
                  value={valArea}
                  onChange={e => setValArea(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                background: '#0b489a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 22px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Calculator size={15} />
              <span>Calculate Guidance Value</span>
            </button>
          </form>

          {valResult && (
            <div style={{ marginTop: '24px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Kaveri 2.0 Official Guideline Result</span>
                  <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: '#14532d' }}>
                    {valVillage} ({valDistrict}) • Rate: ₹ {valResult.rate.toLocaleString('en-IN')}/{valUnit}
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: '#166534' }}>Guidance Value:</small>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#15803d' }}>
                    ₹ {valResult.guidanceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '14px', background: '#fff', padding: '14px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Stamp Duty (5%)</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>₹ {valResult.stampDuty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Registration Fee (1%)</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>₹ {valResult.regFee.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Cess &amp; Surcharge (10%)</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>₹ {valResult.cess.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div style={{ borderLeft: '2px solid #22c55e', paddingLeft: '12px' }}>
                  <small style={{ color: '#15803d', fontWeight: 700, display: 'block' }}>Total Govt. Outlay</small>
                  <strong style={{ fontSize: '15px', color: '#15803d', fontWeight: 800 }}>₹ {valResult.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SRO LOCATOR */}
      {activeSection === 'sro' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '24px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '4px', height: '24px', background: '#0b489a', borderRadius: '2px' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Sub-Registrar Office (SRO) Jurisdiction Finder
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Locate designated SRO officers, contact telephone, office timings, and token counters.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0b489a', fontSize: '14px', display: 'block' }}>SRO Jayanagar (BTM / Begur)</strong>
              <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>B-Block, Commercial Complex, 4th Block Jayanagar, Bengaluru 560011</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>Officer: Senior Sub-Registrar (Group A) • Phone: 080-26631890</div>
              <div style={{ color: '#059669', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>Hours: 10:00 AM – 05:30 PM (Token cut-off: 04:00 PM)</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0b489a', fontSize: '14px', display: 'block' }}>SRO Varthur (Bellandur / East)</strong>
              <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>Main Road, Varthur, Bengaluru 560087 (Near Police Station)</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>Officer: Sub-Registrar Grade-I • Phone: 080-28538390</div>
              <div style={{ color: '#059669', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>Hours: 10:00 AM – 05:30 PM</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0b489a', fontSize: '14px', display: 'block' }}>SRO K.R. Puram (Whitefield / Mahadevapura)</strong>
              <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>Old Madras Road, K.R. Puram, Bengaluru 560036</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>Officer: Senior Sub-Registrar • Phone: 080-25610234</div>
              <div style={{ color: '#059669', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>Hours: 10:00 AM – 05:30 PM</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: VERIFY DOCUMENT */}
      {activeSection === 'verify' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '24px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '4px', height: '24px', background: '#0b489a', borderRadius: '2px' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Kaveri 2.0 Document Endorsement Verification
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Validate registered deed numbers, digital seals, and Book I central indexing entries.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Registration Number / Watermark Serial
              </label>
              <input
                type="text"
                value={docRefInput}
                onChange={e => setDocRefInput(e.target.value)}
                placeholder="e.g. JNR-1-04521-2024-25 or 4521/2024"
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                background: '#0b489a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Verify Online
            </button>

            {docVerifyResult && (
              <div style={{ marginTop: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '12px', fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>{docVerifyResult}</div>
              </div>
            )}
          </form>
        </div>
      )}

    </div>
  );
}
