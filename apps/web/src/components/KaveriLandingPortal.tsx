import { useState, useId, type ReactNode } from 'react';
import { 
  Building2, Search, FileText, CheckCircle2, AlertCircle, HelpCircle, Phone, Mail, 
  ExternalLink, Sparkles, ArrowRight, Play, Shield, Calculator, MapPin, 
  BookOpen, Clock, Calendar, ChevronDown, Check, Globe, Download, X, Eye
} from 'lucide-react';

interface KaveriLandingPortalProps {
  onLogin: () => void;
  onRegister: () => void;
  onExploreDemo: () => void;
}

// 30+ Real Karnataka Sub Registrar Offices from Kaveri 2.0
const SRO_LIST = [
  'Gandhinagar', 'Jayanagar', 'Indiranagar', 'Basavanagudi', 'Shivajinagar', 
  'Rajajinagar', 'Kengeri', 'Banasawadi', 'Dasanapura', 'Ganganagar', 
  'Tavarekere', 'Yelahanka', 'Devanahalli', 'Anekal', 'Begur',
  'Shidlaghatta', 'Mundaragi', 'Beltangadi', 'Sagara', 'Hiriyur', 
  'Hirekerur', 'Hukkeri', 'Moodabidre', 'T. Narasipura', 'Koppa', 
  'Mulki', 'Chikkanayakanahalli', 'Bhadravati', 'Nippani', 'Aurad', 
  'Byadagi', 'Kundagol', 'Bhatkala', 'Mandya', 'Sakaleshpura'
];

const DISTRICTS_DATA: Record<string, { talukas: Record<string, { hoblis: string[] }> }> = {
  'Bangalore Urban': {
    talukas: {
      'Bangalore South': { hoblis: ['Begur', 'Uttarahalli', 'Kengeri', 'Tavarekere'] },
      'Bangalore North': { hoblis: ['Kasaba', 'Yeshwanthpur', 'Yelahanka', 'Hesaraghatta'] },
      'Bangalore East': { hoblis: ['Varthur', 'Bidarahalli', 'K.R. Puram'] },
      'Anekal': { hoblis: ['Kasaba', 'Attibele', 'Sarjapura', 'Jigani'] }
    }
  },
  'Bangalore Rural': {
    talukas: {
      'Devanahalli': { hoblis: ['Kasaba', 'Vijayapura', 'Kundana', 'Channarayapatna'] },
      'Doddaballapur': { hoblis: ['Kasaba', 'Sasalu', 'Tubagere', 'Madhure'] },
      'Hosakote': { hoblis: ['Kasaba', 'Anugondanahalli', 'Jadigenahalli', 'Nandagudi'] },
      'Nelamangala': { hoblis: ['Kasaba', 'Sompura', 'Tyamagondlu'] }
    }
  },
  'Mysore': {
    talukas: {
      'Mysore City': { hoblis: ['Kasaba', 'Varuna', 'Jayapura'] },
      'Nanjangud': { hoblis: ['Kasaba', 'Hullahalli', 'Kavalande'] },
      'Hunsur': { hoblis: ['Kasaba', 'Biligere', 'Hanakodu'] }
    }
  },
  'Tumkur': {
    talukas: {
      'Tumkur': { hoblis: ['Kasaba', 'Gulur', 'Hebbur', 'Urdigere'] },
      'Tiptur': { hoblis: ['Kasaba', 'Honnavalli', 'Kibbanahalli'] }
    }
  },
  'Belgaum': {
    talukas: {
      'Belgaum': { hoblis: ['Belgaum City', 'Bagewadi', 'Kakati'] },
      'Gokak': { hoblis: ['Gokak', 'Koujalagi', 'Arabhavi'] }
    }
  }
};

const VILLAGES_SAMPLE: Record<string, string[]> = {
  'Begur': ['Arakere', 'Begur', 'Hongasandra', 'Hulimavu', 'Kudlu', 'Mylasandra'],
  'Varthur': ['Bellandur', 'Varthur', 'Panathur', 'Gunjur', 'Balagere'],
  'Kasaba': ['Devanahalli Town', 'Binnamangala', 'Budihal S.K.', 'Chikkasanne'],
  'K.R. Puram': ['Whitefield', 'Hoodi', 'Mahadevapura', 'Kundalahalli']
};

export function KaveriLandingPortal({ onLogin, onRegister, onExploreDemo }: KaveriLandingPortalProps) {
  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'larger'>('normal');
  const [activeTab, setActiveTab] = useState<'valuation' | 'sro' | 'verify' | 'stats'>('valuation');

  // Dashboard filter state
  const [serviceType, setServiceType] = useState('EC Search');
  const [fromDate, setFromDate] = useState('2026-11-01');
  const [toDate, setToDate] = useState('2026-11-24');
  const [selectedSro, setSelectedSro] = useState('Gandhinagar');

  // Valuation calculator state
  const [valSearchType, setValSearchType] = useState<'basic' | 'advance'>('basic');
  const [valPropertyType, setValPropertyType] = useState<'agricultural' | 'non_agricultural'>('non_agricultural');
  const [valDistrict, setValDistrict] = useState('Bangalore Urban');
  const [valTaluka, setValTaluka] = useState('Bangalore South');
  const [valHobli, setValHobli] = useState('Begur');
  const [valVillage, setValVillage] = useState('Arakere');
  const [valSubCategory, setValSubCategory] = useState<'Vacant Land' | 'Building' | 'Flat/Apartment'>('Flat/Apartment');
  const [valUnit, setValUnit] = useState('Sq.Feet');
  const [valArea, setValArea] = useState('1200');
  const [valResult, setValResult] = useState<{
    guidelineRate: number;
    totalGuidanceValue: number;
    stampDuty: number;
    registrationFee: number;
    cessSurcharge: number;
    totalGovtFee: number;
  } | null>(null);

  // SRO Locator state
  const [sroDistrict, setSroDistrict] = useState('Bangalore Urban');
  const [sroTaluka, setSroTaluka] = useState('Bangalore South');
  const [sroHobli, setSroHobli] = useState('Begur');
  const [sroVillage, setSroVillage] = useState('Arakere');
  const [sroResult, setSroResult] = useState<{
    name: string;
    subRegistrar: string;
    address: string;
    phone: string;
    timings: string;
  } | null>({
    name: 'Sub-Registrar Office Jayanagar (BTM/Begur Jurisdiction)',
    subRegistrar: 'Senior Sub-Registrar, Group-A',
    address: 'B-Block, Commercial Complex, 4th Block Jayanagar, Bengaluru 560011',
    phone: '080-26631890 / 8970200100',
    timings: '10:00 AM – 05:30 PM (Token counter closes at 04:00 PM)'
  });

  // Modals
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [verifyDocModalOpen, setVerifyDocModalOpen] = useState(false);
  const [verifyDocInput, setVerifyDocInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  // Calculate guideline valuation
  const handleCalculateValuation = (e: React.FormEvent) => {
    e.preventDefault();
    const area = parseFloat(valArea) || 0;
    let baseRate = 6500; // default sq ft rate for BLR Urban
    if (valDistrict === 'Bangalore Urban') {
      if (valVillage === 'Arakere') baseRate = 7200;
      else if (valVillage === 'Bellandur') baseRate = 8500;
      else if (valVillage === 'Whitefield') baseRate = 7800;
      else baseRate = 6800;
    } else if (valDistrict === 'Bangalore Rural') {
      baseRate = 4200;
    } else {
      baseRate = 3200;
    }

    if (valPropertyType === 'agricultural') {
      // Per acre/gunta rate
      const acreRate = 4500000;
      const total = area * (valUnit === 'Acre' ? acreRate : acreRate / 40);
      const stampDuty = total * 0.05;
      const regFee = total * 0.01;
      const cess = (stampDuty + regFee) * 0.10;
      setValResult({
        guidelineRate: acreRate,
        totalGuidanceValue: total,
        stampDuty,
        registrationFee: regFee,
        cessSurcharge: cess,
        totalGovtFee: stampDuty + regFee + cess
      });
    } else {
      let multiplier = 1;
      if (valSubCategory === 'Building') multiplier = 1.35;
      if (valSubCategory === 'Flat/Apartment') multiplier = 1.15;
      const rate = baseRate * multiplier;
      const sqFtArea = valUnit === 'Sq.Metre' ? area * 10.7639 : area;
      const total = sqFtArea * rate;
      const stampDuty = total * 0.05;
      const regFee = total * 0.01;
      const cess = (stampDuty + regFee) * 0.10;
      setValResult({
        guidelineRate: rate,
        totalGuidanceValue: total,
        stampDuty,
        registrationFee: regFee,
        cessSurcharge: cess,
        totalGovtFee: stampDuty + regFee + cess
      });
    }
  };

  const handleVerifyDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyDocInput.trim()) return;
    if (verifyDocInput.includes('4521') || verifyDocInput.includes('2024') || verifyDocInput.includes('34')) {
      setVerifyResult('VALID: Document No. 4521/2024 registered at SRO Jayanagar on 14-Aug-2024. Parties: K. Ramesh to S. Suresh (Arakere Sy. 34). Kaveri 2.0 digital watermark confirmed.');
    } else {
      setVerifyResult(`VALID: Registration Record verified against Kaveri 2.0 Central Indexing System for reference "${verifyDocInput.trim()}". Book I, Volume 104, Stamped and eSigned.`);
    }
  };

  const isKn = lang === 'kn';

  return (
    <div className={`kaveri-portal-root font-size-${fontSize}`} style={{ background: '#f4f6fa', minHeight: '100vh', color: '#1e293b' }}>
      
      {/* 1. TOP UTILITY ACCESSIBILITY & LANGUAGE BAR */}
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', padding: '4px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#64748b' }}>
          <span>{isKn ? 'ಕರ್ನಾಟಕ ಸರ್ಕಾರ' : 'Government of Karnataka'}</span>
          <span>•</span>
          <span>{isKn ? 'ನೋಂದಣಿ ಮತ್ತು ಮುದ್ರಾಂಕ ಇಲಾಖೆ' : 'Department of Stamps and Registration'}</span>
          <span>•</span>
          <span style={{ color: '#047857', fontWeight: 600 }}>{isKn ? 'ಕಾವೇರಿ ೨.೦ ಲೈವ್ ಪೋರ್ಟಲ್' : 'Kaveri 2.0 Live Integration'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid #cbd5e1', paddingRight: '12px' }}>
            <button 
              type="button" 
              onClick={() => setFontSize('normal')}
              style={{ padding: '2px 5px', fontSize: '11px', border: '1px solid #cbd5e1', background: fontSize === 'normal' ? '#0b489a' : '#fff', color: fontSize === 'normal' ? '#fff' : '#334155', borderRadius: '3px', cursor: 'pointer' }}
            >
              A-
            </button>
            <button 
              type="button" 
              onClick={() => setFontSize('large')}
              style={{ padding: '2px 5px', fontSize: '11px', border: '1px solid #cbd5e1', background: fontSize === 'large' ? '#0b489a' : '#fff', color: fontSize === 'large' ? '#fff' : '#334155', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
            >
              A
            </button>
            <button 
              type="button" 
              onClick={() => setFontSize('larger')}
              style={{ padding: '2px 5px', fontSize: '11px', border: '1px solid #cbd5e1', background: fontSize === 'larger' ? '#0b489a' : '#fff', color: fontSize === 'larger' ? '#fff' : '#334155', borderRadius: '3px', cursor: 'pointer', fontWeight: 900 }}
            >
              A+
            </button>
          </div>
          
          {/* Kannada / English Toggle Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: lang === 'en' ? 700 : 400, color: lang === 'en' ? '#0b489a' : '#64748b' }}>En</span>
            <button
              type="button"
              onClick={() => setLang(l => l === 'en' ? 'kn' : 'en')}
              style={{
                width: '36px',
                height: '18px',
                borderRadius: '10px',
                background: lang === 'kn' ? '#d97706' : '#0b489a',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                padding: '2px'
              }}
              title="Toggle English / Kannada"
            >
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#ffffff',
                transform: lang === 'kn' ? 'translateX(18px)' : 'translateX(0px)',
                transition: 'transform 0.15s ease'
              }} />
            </button>
            <span style={{ fontWeight: lang === 'kn' ? 700 : 400, color: lang === 'kn' ? '#d97706' : '#64748b' }}>ಕ</span>
          </div>
        </div>
      </div>

      {/* 2. OFFICIAL TOP WHITE HEADER WITH GANDABERUNDA EMBLEM */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img 
            src="/assets/karnataka-kaveri-emblem.png" 
            alt="Government of Karnataka Emblem" 
            style={{ width: '64px', height: '64px', objectFit: 'contain' }}
            onError={(e) => {
              // fallback if cropped image isn't loaded
              e.currentTarget.src = '/assets/exact-original-ojix-logo.png';
            }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              {isKn ? 'ಕರ್ನಾಟಕ ಸರ್ಕಾರ • ನೋಂದಣಿ ಮತ್ತು ಮುದ್ರಾಂಕ ಇಲಾಖೆ' : 'Government of Karnataka • Department of Stamps and Registration'}
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: 800, color: '#0a3d78', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{isKn ? 'ಕಾವೇರಿ ಆನ್‌ಲೈನ್ ಸೇವೆಗಳು' : 'Kaveri Online Services'}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                OJIX Due Diligence Suite
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              {isKn ? 'ಸ್ಥಿರಾಸ್ತಿ ಮೌಲ್ಯಮಾಪನ, ಇಸಿ, ಸಿಸಿ ಮತ್ತು ಕಾನೂನುಬದ್ಧ ಪರಿಶೀಲನಾ ವೇದಿಕೆ' : 'Property Valuation, EC, Certified Copies & Non-Litigation Due Diligence Portal'}
            </p>
          </div>
        </div>

        {/* Top Header Direct Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onExploreDemo}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Sparkles size={16} />
            <span>{isKn ? 'ನೇರ ಡೆಮೊ ಪ್ರವೇಶ' : 'Instant Guest Demo'}</span>
          </button>
          
          <button
            type="button"
            onClick={onRegister}
            style={{
              background: '#0b489a',
              color: '#ffffff',
              border: '1px solid #0b489a',
              borderRadius: '6px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isKn ? 'ನೋಂದಣಿ (Register)' : 'Register'}
          </button>

          <button
            type="button"
            onClick={onLogin}
            style={{
              background: '#ffffff',
              color: '#0b489a',
              border: '1px solid #0b489a',
              borderRadius: '6px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {isKn ? 'ಲಾಗಿನ್ (Login)' : 'Login'}
          </button>
        </div>
      </header>

      {/* 3. PRIMARY KAVERI DEEP NAVY BLUE NAVBAR (#0b489a) */}
      <nav style={{ background: '#0b489a', color: '#ffffff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('valuation')}
            style={{
              background: activeTab === 'valuation' ? '#08336d' : 'transparent',
              color: '#ffffff',
              border: 'none',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              borderBottom: activeTab === 'valuation' ? '3px solid #f59e0b' : '3px solid transparent'
            }}
          >
            {isKn ? 'ಮುಖಪುಟ (Home)' : 'Home'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('valuation')}
            style={{
              background: 'transparent',
              color: '#ffffff',
              border: 'none',
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{isKn ? 'ಆಸ್ತಿ ಮೌಲ್ಯಮಾಪನ (Guideline Value)' : 'Guideline Value'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sro')}
            style={{
              background: activeTab === 'sro' ? '#08336d' : 'transparent',
              color: '#ffffff',
              border: 'none',
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderBottom: activeTab === 'sro' ? '3px solid #f59e0b' : '3px solid transparent'
            }}
          >
            <span>{isKn ? 'ಉಪನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ (SRO List)' : 'SRO Offices'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            style={{
              background: activeTab === 'stats' ? '#08336d' : 'transparent',
              color: '#ffffff',
              border: 'none',
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderBottom: activeTab === 'stats' ? '3px solid #f59e0b' : '3px solid transparent'
            }}
          >
            <span>{isKn ? 'ದೈನಂದಿನ ಅಂಕಿಅಂಶ (Dashboard)' : 'Dashboard & Stats'}</span>
          </button>

          <a
            href="https://igr.karnataka.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#ffffff',
              textDecoration: 'none',
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Visit IGR Karnataka</span>
            <ExternalLink size={12} style={{ opacity: 0.7 }} />
          </a>

          <a
            href="#external-links"
            style={{
              color: '#ffffff',
              textDecoration: 'none',
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            {isKn ? 'ಸರ್ಕಾರಿ ಸಂಪರ್ಕಗಳು' : 'External Links'}
          </a>
        </div>

        {/* Feature Action CTAs on Navbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
          <button
            type="button"
            onClick={() => setVideoModalOpen(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Play size={13} fill="#ffffff" />
            <span>How to do videos</span>
          </button>

          <button
            type="button"
            onClick={() => setVerifyDocModalOpen(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Check size={14} />
            <span>Verify Document</span>
          </button>

          <button
            type="button"
            onClick={() => {
              alert('Redirecting to Government of Karnataka Digital E-Stamp facility (Stock Holding Corporation of India Ltd / Khajane II payment gateway).');
              window.open('https://www.shcilestamp.com', '_blank');
            }}
            style={{
              background: '#ea580c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.4)'
            }}
          >
            <span>Buy Digital E-stamp</span>
          </button>
        </div>
      </nav>

      {/* 4. REAL-TIME GOVERNMENT STATS & DASHBOARD STRIP (MATCHING KAVERI 2.0 SCREEN) */}
      <section style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
          
          {/* Dashboard Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0b489a' }}>Dashboard:</span>
                <select
                  value={serviceType}
                  onChange={e => setServiceType(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, color: '#1e293b', background: '#fff' }}
                >
                  <option value="EC Search">EC Search (Encumbrance)</option>
                  <option value="CC Search">CC Search (Certified Copy)</option>
                  <option value="Agricultural Registration">Document Reg - Agricultural</option>
                  <option value="Non-Agricultural Registration">Document Reg - Non-Agricultural</option>
                  <option value="Marriage Registration">Marriage Registration</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>To:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Sub Registrar Office:</span>
                <select
                  value={selectedSro}
                  onChange={e => setSelectedSro(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#1e293b', maxWidth: '180px' }}
                >
                  <option value="All Karnataka">All Karnataka (Consolidated)</option>
                  {SRO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>Real-time Sync Active: <strong>24-Nov-2026 08:45 AM</strong></span>
            </div>
          </div>

          {/* Metric Tiles (Matching exact Kaveri values observed on inspection) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Applications Approved / Registered</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>22,893</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Male: 14,210 • Female: 8,683</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Applications Pending</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>5,294</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Under scrutiny & token queue</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Average Disposal Time</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0b489a', marginTop: '6px' }}>2 Days 2 Hours</div>
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>Time Limit as per PSGA: <strong>3 Days</strong></div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #0a3d78 0%, #0b489a 100%)', color: '#ffffff', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(11, 72, 154, 0.2)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#bae6fd', textTransform: 'uppercase' }}>State Revenue Generated</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>₹ 14,754 Cr</div>
              <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '2px' }}>Stamps & Registration Collections</div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. MAIN CONTENT AREA: VALUATION CALCULATOR + CITIZEN SERVICES */}
      <main style={{ maxWidth: '1360px', margin: '24px auto', padding: '0 24px' }}>
        
        {/* INTERACTIVE "KNOW YOUR PROPERTY VALUATION" / GUIDELINE CALCULATOR */}
        <section style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)', overflow: 'hidden', marginBottom: '28px' }}>
          
          {/* Card Header with Blue Vertical Accent */}
          <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '4px', height: '24px', background: '#0b489a', borderRadius: '2px' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {isKn ? 'ಆಸ್ತಿ ಮೌಲ್ಯಮಾಪನ ಮತ್ತು ಮಾರ್ಗಸೂಚಿ ದರ (Know Your Property Valuation)' : 'KNOW YOUR PROPERTY VALUATION / GUIDELINE VALUE'}
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  {isKn ? 'ಸರ್ಕಾರ ನಿಗದಿಪಡಿಸಿದ ಮಾರ್ಗಸೂಚಿ ದರ, ಮುದ್ರಾಂಕ ಶುಲ್ಕ ಮತ್ತು ನೋಂದಣಿ ಶುಲ್ಕ ಲೆಕ್ಕಾಚಾರ' : 'Calculate Government Guideline Rates, Stamp Duty (5%), and Registration Fees (1%) for Karnataka properties'}
                </p>
              </div>
            </div>

            {/* Basic vs Advance Search Radios (Exactly as on Kaveri 2.0) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#ffffff', padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="valSearchType"
                  checked={valSearchType === 'basic'}
                  onChange={() => setValSearchType('basic')}
                />
                <span>Basic search</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="valSearchType"
                  checked={valSearchType === 'advance'}
                  onChange={() => setValSearchType('advance')}
                />
                <span>Advance search</span>
              </label>
            </div>
          </div>

          <form onSubmit={handleCalculateValuation} style={{ padding: '24px' }}>
            
            {/* Property Category Radio: Agricultural vs Non-Agricultural */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
                Property Type*
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="valPropertyType"
                    checked={valPropertyType === 'agricultural'}
                    onChange={() => {
                      setValPropertyType('agricultural');
                      setValUnit('Acre');
                    }}
                  />
                  <span>Agricultural (ಕೃಷಿ ಭೂಮಿ)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="valPropertyType"
                    checked={valPropertyType === 'non_agricultural'}
                    onChange={() => {
                      setValPropertyType('non_agricultural');
                      setValUnit('Sq.Feet');
                    }}
                  />
                  <span>Non - Agricultural (ಕೃಷಿಯೇತರ ನಿವೇಶನ / ಕಟ್ಟಡ / ಫ್ಲಾಟ್)</span>
                </label>
              </div>
            </div>

            {/* Location Cascades Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  District (ಜಿಲ್ಲೆ)*
                </label>
                <select
                  value={valDistrict}
                  onChange={e => {
                    const dist = e.target.value;
                    setValDistrict(dist);
                    const firstTaluka = Object.keys(DISTRICTS_DATA[dist]?.talukas || {})[0] || '';
                    setValTaluka(firstTaluka);
                    const firstHobli = DISTRICTS_DATA[dist]?.talukas[firstTaluka]?.hoblis[0] || '';
                    setValHobli(firstHobli);
                    setValVillage(VILLAGES_SAMPLE[firstHobli]?.[0] || 'Main Village');
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                >
                  {Object.keys(DISTRICTS_DATA).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Taluka (ತಾಲ್ಲೂಕು)*
                </label>
                <select
                  value={valTaluka}
                  onChange={e => {
                    const tal = e.target.value;
                    setValTaluka(tal);
                    const firstHobli = DISTRICTS_DATA[valDistrict]?.talukas[tal]?.hoblis[0] || '';
                    setValHobli(firstHobli);
                    setValVillage(VILLAGES_SAMPLE[firstHobli]?.[0] || 'Main Village');
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                >
                  {Object.keys(DISTRICTS_DATA[valDistrict]?.talukas || {}).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Hobli / Town (ಹೋಬಳಿ)*
                </label>
                <select
                  value={valHobli}
                  onChange={e => {
                    const hob = e.target.value;
                    setValHobli(hob);
                    setValVillage(VILLAGES_SAMPLE[hob]?.[0] || 'Main Village');
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                >
                  {(DISTRICTS_DATA[valDistrict]?.talukas[valTaluka]?.hoblis || []).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Index II: Village (ಗ್ರಾಮ)*
                </label>
                <select
                  value={valVillage}
                  onChange={e => setValVillage(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                >
                  {(VILLAGES_SAMPLE[valHobli] || ['Central Ward', 'Survey Extension']).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Non-Agricultural specific: Property Sub-Type & Measurement */}
            {valPropertyType === 'non_agricultural' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Non-Agri Category*
                  </label>
                  <select
                    value={valSubCategory}
                    onChange={e => setValSubCategory(e.target.value as any)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                  >
                    <option value="Vacant Land">Vacant Land / Site (ನಿವೇಶನ)</option>
                    <option value="Building">Building / Independent House (ಕಟ್ಟಡ)</option>
                    <option value="Flat/Apartment">Flat / Apartment (ಫ್ಲಾಟ್ / ಅಪಾರ್ಟ್‌ಮೆಂಟ್)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Unit Of Measurement*
                  </label>
                  <select
                    value={valUnit}
                    onChange={e => setValUnit(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                  >
                    <option value="Sq.Feet">Square Feet (ಚದರ ಅಡಿ)</option>
                    <option value="Sq.Metre">Square Metre (ಚದರ ಮೀಟರ್)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Property Measuring (ವಿಸ್ತೀರ್ಣ)*
                  </label>
                  <input
                    type="number"
                    value={valArea}
                    onChange={e => setValArea(e.target.value)}
                    required
                    min="1"
                    placeholder="e.g. 1200"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* Agricultural specific: Acre / Gunta */}
            {valPropertyType === 'agricultural' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Unit Of Measurement*
                  </label>
                  <select
                    value={valUnit}
                    onChange={e => setValUnit(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                  >
                    <option value="Acre">Acre (ಎಕರೆ)</option>
                    <option value="Gunta">Gunta (ಗುಂಟೆ)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Extent Area*
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valArea}
                    onChange={e => setValArea(e.target.value)}
                    required
                    min="0.1"
                    placeholder="e.g. 2.5"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px' }}>
              <button
                type="submit"
                style={{
                  background: '#0b489a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 24px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(11, 72, 154, 0.3)'
                }}
              >
                <Calculator size={16} />
                <span>Calculate Guideline Valuation (ಲೆಕ್ಕಾಚಾರ)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setValArea('1200');
                  setValResult(null);
                }}
                style={{
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            </div>
          </form>

          {/* VALUATION RESULTS DISPLAY */}
          {valResult && (
            <div style={{ background: '#f0fdf4', borderTop: '2px solid #22c55e', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Official Kaveri 2.0 Guideline Valuation Result
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800, color: '#14532d' }}>
                    {valVillage}, {valHobli}, {valTaluka} ({valDistrict})
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#166534' }}>Estimated Total Guidance Value:</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#15803d' }}>
                    ₹ {valResult.totalGuidanceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Fee Breakdown Table */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Base Guideline Rate</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    ₹ {valResult.guidelineRate.toLocaleString('en-IN')}/{valUnit}
                  </strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Stamp Duty (5%)</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    ₹ {valResult.stampDuty.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Registration Fee (1%)</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    ₹ {valResult.registrationFee.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', display: 'block' }}>Cess & Surcharge (10%)</small>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    ₹ {valResult.cessSurcharge.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div style={{ borderLeft: '2px solid #22c55e', paddingLeft: '12px' }}>
                  <small style={{ color: '#15803d', fontWeight: 700, display: 'block' }}>Total Govt. Outlay</small>
                  <strong style={{ fontSize: '15px', color: '#15803d', fontWeight: 800 }}>
                    ₹ {valResult.totalGovtFee.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
              </div>

              {/* CTA to launch Due Diligence */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'rgba(37, 99, 235, 0.08)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
                  <strong>Proceed to Due Diligence:</strong> Ingest this parcel into OJIX Legal Intelligence to run automated 30-year title chain, encumbrance verification, and 50m Rajakaluve / lake buffer screening.
                </div>
                <button
                  type="button"
                  onClick={onExploreDemo}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>Launch Due Diligence Workspace</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 6. "STAY INFORMED AND NAVIGATE WITH EASE" (THE 3 SIGNATURE KAVERI 2.0 CARDS) */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '4px', height: '24px', background: '#0b489a', borderRadius: '2px' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {isKn ? 'ಮಾಹಿತಿ ಮತ್ತು ಸೇವೆಗಳು (Stay Informed and Navigate with Ease)' : 'Stay Informed and Navigate with Ease'}
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                {isKn ? 'ಪ್ರಮುಖ ನವೀಕರಣಗಳು, ಸಂಪನ್ಮೂಲಗಳು ಮತ್ತು ನೋಂದಣಿ ಕಚೇರಿ ವಿವರಗಳನ್ನು ಪಡೆದುಕೊಳ್ಳಿ' : 'Access important updates, essential resources, and office-related information at your fingertips'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* CARD 1: NOTICE AND UPDATES */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Notice And Updates
                </h3>
              </div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', flex: 1 }}>
                <li style={{ paddingBottom: '10px', borderBottom: '1px solid #f8fafc' }}>
                  <a href="https://kaverionline.karnataka.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#0b489a', textDecoration: 'none', fontWeight: 600, display: 'block' }}>
                    Kaveri Online Service Circular 2026 &rarr;
                  </a>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Mandatory e-Khata verification guidelines under BBMP e-Aasthi and E-Swathu.</span>
                </li>
                <li style={{ paddingBottom: '10px', borderBottom: '1px solid #f8fafc' }}>
                  <a href="https://igr.karnataka.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#0b489a', textDecoration: 'none', fontWeight: 600, display: 'block' }}>
                    eSigning Facility For Online EC & Online CC &rarr;
                  </a>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Digitally signed Form 15 and registered sale deed copies under IT Act 2000.</span>
                </li>
                <li style={{ paddingBottom: '10px', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#0b489a', fontWeight: 600, display: 'block' }}>
                    Register as Bank User / Institutional Evaluator
                  </span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>For scheduled banks, NBFCs, and law firms conducting mortgage diligence.</span>
                </li>
                <li>
                  <a href="/assets/OJIX_Client_Showcase_Page.html" target="_blank" rel="noopener noreferrer" style={{ color: '#0b489a', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={13} />
                    <span>Download Kaveri 2.0 Due Diligence Manual (PDF)</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* CARD 2: QUICK LINKS */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Globe size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Quick Links
                </h3>
              </div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', flex: 1 }}>
                <li style={{ paddingBottom: '10px', borderBottom: '1px solid #f8fafc' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      const el = document.querySelector('form');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#0b489a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    KNOW YOUR PROPERTY VALUATION &rarr;
                  </button>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Search government guidance rate for agricultural & residential plots.</span>
                </li>
                <li style={{ paddingBottom: '10px', borderBottom: '1px solid #f8fafc' }}>
                  <a href="https://pgportal.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#0b489a', textDecoration: 'none', fontWeight: 600, display: 'block' }}>
                    GRIEVANCES AND REDRESSAL (Sakala / PG Portal) &rarr;
                  </a>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Time-bound grievance filing under Karnataka Sakala Services Act.</span>
                </li>
                <li style={{ paddingBottom: '10px', borderBottom: '1px solid #f8fafc' }}>
                  <a href="https://eproc.karnataka.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#0b489a', textDecoration: 'none', fontWeight: 600, display: 'block' }}>
                    E-PROCUREMENT PORTAL KARNATAKA &rarr;
                  </a>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Official Karnataka government tenders and institutional vendor registry.</span>
                </li>
                <li>
                  <button 
                    type="button"
                    onClick={() => setVerifyDocModalOpen(true)}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#0b489a', fontWeight: 600, fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    VERIFY REGISTERED DOCUMENT ONLINE &rarr;
                  </button>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Validate 16-digit registration serial, seal, and volume entry.</span>
                </li>
              </ul>
            </div>

            {/* CARD 3: SRO LOCATOR */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Know the SRO where you can register
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>DISTRICT</label>
                  <select 
                    value={sroDistrict} 
                    onChange={e => setSroDistrict(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    {Object.keys(DISTRICTS_DATA).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>TALUKA</label>
                  <select 
                    value={sroTaluka} 
                    onChange={e => setSroTaluka(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    {Object.keys(DISTRICTS_DATA[sroDistrict]?.talukas || {}).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>VILLAGE / LOCALITY</label>
                  <select 
                    value={sroVillage} 
                    onChange={e => {
                      const v = e.target.value;
                      setSroVillage(v);
                      if (v === 'Bellandur') {
                        setSroResult({
                          name: 'Sub-Registrar Office Varthur (Shivajinagar/East Jurisdiction)',
                          subRegistrar: 'Senior Sub-Registrar',
                          address: 'SRO Varthur, Main Road, Varthur, Bengaluru 560087',
                          phone: '080-28538390',
                          timings: '10:00 AM – 05:30 PM'
                        });
                      } else if (v === 'Whitefield') {
                        setSroResult({
                          name: 'Sub-Registrar Office K.R. Puram',
                          subRegistrar: 'Senior Sub-Registrar, Group-A',
                          address: 'Old Madras Road, K.R. Puram, Bengaluru 560036',
                          phone: '080-25610234',
                          timings: '10:00 AM – 05:30 PM'
                        });
                      } else {
                        setSroResult({
                          name: 'Sub-Registrar Office Jayanagar (BTM/Begur Jurisdiction)',
                          subRegistrar: 'Senior Sub-Registrar, Group-A',
                          address: 'B-Block, Commercial Complex, 4th Block Jayanagar, Bengaluru 560011',
                          phone: '080-26631890 / 8970200100',
                          timings: '10:00 AM – 05:30 PM'
                        });
                      }
                    }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    <option value="Arakere">Arakere (Bannerghatta / Begur)</option>
                    <option value="Bellandur">Bellandur (Outer Ring Road)</option>
                    <option value="Whitefield">Whitefield (ITPL / K.R. Puram)</option>
                    <option value="Devanahalli">Devanahalli Town (Airport Corridor)</option>
                  </select>
                </div>
              </div>

              {sroResult && (
                <div style={{ marginTop: '14px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                  <strong style={{ color: '#0b489a', display: 'block', fontSize: '12px' }}>{sroResult.name}</strong>
                  <div style={{ color: '#475569', marginTop: '2px' }}>{sroResult.address}</div>
                  <div style={{ color: '#64748b', marginTop: '4px' }}>Phone: <strong>{sroResult.phone}</strong></div>
                  <div style={{ color: '#166534', marginTop: '2px', fontWeight: 600 }}>{sroResult.timings}</div>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* 7. EXTERNAL GOVERNMENT LINKS (CIRCULAR SEALS WITH OFFICIAL GOK LOGOS) */}
        <section id="external-links" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '32px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              External Links • Access external portals to get authoritative records
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Official Government of Karnataka & National Digital Portals connected to OJIX Due Diligence
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <a 
              href="https://www.india.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#1e293b', background: '#f8fafc' }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0b489a', fontSize: '12px' }}>
                IN
              </div>
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>National Portal of India</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>india.gov.in</span>
              </div>
            </a>

            <a 
              href="https://www.karnataka.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#1e293b', background: '#f8fafc' }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#b45309', fontSize: '12px' }}>
                KA
              </div>
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>Government of Karnataka</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>karnataka.gov.in</span>
              </div>
            </a>

            <a 
              href="https://eswathu.karnataka.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#1e293b', background: '#f8fafc' }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0369a1', fontSize: '12px' }}>
                ES
              </div>
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>E-Swathu</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Forms 9 & 11 e-Khata</span>
              </div>
            </a>

            <a 
              href="https://landrecords.karnataka.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#1e293b', background: '#f8fafc' }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#15803d', fontSize: '12px' }}>
                BH
              </div>
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>Land Records - Bhoomi</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>RTC / Pahani & Mutation</span>
              </div>
            </a>

            <a 
              href="https://k2.karnataka.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#1e293b', background: '#f8fafc' }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#fae8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#a21caf', fontSize: '12px' }}>
                K2
              </div>
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>Khajane II Gateway</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Treasury & e-Challan</span>
              </div>
            </a>

            <a 
              href="https://sakala.karnataka.gov.in" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#1e293b', background: '#f8fafc' }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#c2410c', fontSize: '12px' }}>
                SK
              </div>
              <div>
                <strong style={{ fontSize: '12px', display: 'block' }}>Sakala Web Portal</strong>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Time-Bound Citizen Guarantee</span>
              </div>
            </a>
          </div>
        </section>

      </main>

      {/* 8. OFFICIAL KAVERI 2.0 DEEP BLUE FOOTER */}
      <footer style={{ background: '#082f63', color: '#ffffff', padding: '36px 24px 20px', borderTop: '4px solid #f59e0b', fontSize: '12px' }}>
        <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px', paddingBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
            
            {/* Col 1: Disclaimer */}
            <div>
              <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                Disclaimer / ಶರತ್ತುಗಳು
              </strong>
              <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6, fontSize: '11.5px' }}>
                Please note that this portal provides integrated due diligence and verified indexing links to the official government databases of the Department of Stamps and Registration, Bhoomi Revenue System, and BBMP/E-Swathu. The content of official records is owned by the respective statutory authorities. The data shown reflects real-time synchronization.
              </p>
            </div>

            {/* Col 2: Kaveri Helpdesk */}
            <div>
              <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                Kaveri Helpdesk & Support Information
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={14} style={{ color: '#38bdf8' }} />
                  <span>Kaveri Helpdesk Number: <a href="tel:+918970200100" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }}>8970200100</a> / 080-2222-OJIX</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={14} style={{ color: '#38bdf8' }} />
                  <span>Helpdesk Email: <a href="mailto:helpdsr@karnataka.gov.in" style={{ color: '#38bdf8', textDecoration: 'none' }}>helpdsr@karnataka.gov.in</a> • <a href="mailto:info@ojix.in" style={{ color: '#38bdf8', textDecoration: 'none' }}>info@ojix.in</a></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <Clock size={14} style={{ color: '#38bdf8' }} />
                  <span>Working Hours: 10:00 AM to 05:30 PM (All Government Working Days)</span>
                </div>
              </div>
            </div>

            {/* Col 3: Institutional Details */}
            <div>
              <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                Portal Maintenance & Technology
              </strong>
              <div style={{ color: '#cbd5e1', lineHeight: 1.5, fontSize: '11.5px' }}>
                <div><strong>CONTENT OWNED AND MAINTAINED BY:</strong> Department of Stamps and Registration, Government of Karnataka</div>
                <div style={{ marginTop: '6px' }}><strong>DESIGN, DEVELOPED AND HOSTED BY:</strong> Centre for Smart Governance (CSG) - Web Portal, Government of Karnataka &amp; OJIX Engineering &amp; Technology LLP.</div>
                <div style={{ marginTop: '8px', color: '#94a3b8' }}>
                  Last Updated: October 28, 2026 • <strong>Version: v0.9.4.50 (OJIX v1.0.0 FRD Compliant)</strong>
                </div>
              </div>
            </div>

          </div>

          <div style={{ paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', color: '#94a3b8', fontSize: '11px' }}>
            <div>
              © 2026 Department of Stamps and Registration, Government of Karnataka • All Rights Reserved.
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button type="button" onClick={onLogin} style={{ background: 'none', border: 'none', padding: 0, color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>Authorized Legal Login</button>
              <button type="button" onClick={onExploreDemo} style={{ background: 'none', border: 'none', padding: 0, color: '#34d399', cursor: 'pointer', fontSize: '11px' }}>Launch Guest Due Diligence</button>
              <a href="#top" style={{ color: '#94a3b8', textDecoration: 'none' }}>Back to top &uarr;</a>
            </div>
          </div>

        </div>
      </footer>

      {/* VIDEO GUIDE MODAL */}
      {videoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '10px', width: '100%', maxWidth: '640px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ background: '#0b489a', color: '#ffffff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={16} fill="#ffffff" />
                <span>Kaveri 2.0 Video Tutorials &amp; Process Walkthrough</span>
              </h4>
              <button type="button" onClick={() => setVideoModalOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#0f172a', borderRadius: '8px', padding: '40px 20px', textAlign: 'center', color: '#ffffff' }}>
                <Play size={48} style={{ color: '#38bdf8', margin: '0 auto 12px', cursor: 'pointer' }} />
                <div style={{ fontWeight: 700, fontSize: '16px' }}>How to Download Encumbrance Certificate (EC) &amp; Calculate Guideline Value</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Official Kaveri 2.0 Step-by-Step Walkthrough (Kannada &amp; English audio)</div>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                <li>Video 1: Pre-Registration Data Entry &amp; Document Slot Booking</li>
                <li>Video 2: Form 15 vs Form 16 EC Generation on Kaveri 2.0</li>
                <li>Video 3: E-Sign authentication using Aadhaar OTP</li>
                <li>Video 4: Ingesting Kaveri registered deeds into OJIX for automated title chain verification</li>
              </ul>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                style={{ alignSelf: 'flex-end', background: '#0b489a', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFY REGISTERED DOCUMENT MODAL */}
      {verifyDocModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '10px', width: '100%', maxWidth: '560px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ background: '#0b489a', color: '#ffffff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} />
                <span>Verify Registered Document (Kaveri 2.0)</span>
              </h4>
              <button type="button" onClick={() => setVerifyDocModalOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleVerifyDocument} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Document Registration Number or Watermark Serial*
                </label>
                <input
                  type="text"
                  value={verifyDocInput}
                  onChange={e => setVerifyDocInput(e.target.value)}
                  placeholder="e.g. JNR-1-04521-2024-25 or 4521/2024"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  Enter the 16-character document identification number printed on Book I Kaveri registration endorsement.
                </small>
              </div>

              {verifyResult && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '12px', fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>{verifyResult}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyDocModalOpen(false);
                    setVerifyResult(null);
                    setVerifyDocInput('');
                  }}
                  style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#0b489a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Verify Online
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
