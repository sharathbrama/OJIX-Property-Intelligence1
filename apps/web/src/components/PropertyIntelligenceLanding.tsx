import { useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUpRight, Building2, Database, FileCheck2, Files, History, ListChecks, FileDown, Users, LockKeyhole, ScanText, BadgeCheck, Sparkles, MapPinned, ShieldCheck, Presentation, Globe } from 'lucide-react';
import { ClientShowcaseBannerModal } from './ClientShowcaseBanner';

interface PropertyIntelligenceLandingProps {
  onLogin: () => void;
  onRegister: () => void;
  onExploreDemo?: () => void;
}

const documents = ['Sale Deed', 'RTC / Pahani', 'Encumbrance Certificate', 'Mutation Records', 'Survey Documents', 'Legal Records', 'Land Maps', 'Ownership Documents'];
const developed = [
  ['Property workspace & case file', Building2], ['Document intake & management', Files], ['OCR & document extraction', ScanText], ['GIS & spatial review', MapPinned],
  ['Risk findings & compliance review', ShieldCheck], ['Evidence & source tracking', BadgeCheck], ['Workflow & pending actions', ListChecks], ['Reports & PDF export', FileDown],
  ['Team, matter & task workflows', Users], ['Workspace owner dashboard', Database], ['Authentication & role permissions', LockKeyhole], ['Audit & activity records', History],
] as const;

export function PropertyIntelligenceLanding({ onLogin, onRegister, onExploreDemo }: PropertyIntelligenceLandingProps) {
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  const handleDemo = () => {
    if (onExploreDemo) {
      onExploreDemo();
    } else {
      window.location.href = '/demo';
    }
  };

  return (
    <main className="ojix-story-site">
      <header className="ojix-story-header sales-site-header">
        <a className="ojix-story-brand" href="#top" aria-label="OJIX Property Intelligence home">
          <img src="/assets/ojix-wordmark-header.png" alt="OJIX" width="256" height="80"/>
          <span><strong>Property Intelligence</strong><small>Karnataka due diligence workspace</small></span>
        </a>
        <nav className="ojix-story-nav" aria-label="Main navigation">
          <a href="#ojix-platform">Platform</a><a href="#ojix-roles">Roles</a><a href="#ojix-capabilities">Capabilities</a><a href="#ojix-workflow">Review workflow</a>
        </nav>
        <div className="ojix-story-actions">
          <button
            type="button"
            className="story-banner-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 229, 255, 0.1)',
              color: '#00E5FF',
              border: '1px solid rgba(0, 229, 255, 0.35)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            onClick={() => setShowcaseOpen(true)}
          >
            <Presentation size={13}/> Showcase Banner
          </button>
          <a
            href="/assets/OJIX_Client_Showcase_Page.html"
            target="_blank"
            rel="noopener noreferrer"
            className="story-banner-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(37, 99, 235, 0.15)',
              color: '#3B82F6',
              border: '1px solid rgba(37, 99, 235, 0.4)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <Globe size={13}/> Showcase Page
          </a>
          <button type="button" className="story-demo-pill" onClick={handleDemo}>
            <Sparkles size={14}/> Live Demo
          </button>
          <button className="story-login-link" onClick={onLogin}>Client Login</button>
          <button className="story-secondary" onClick={onRegister}>Register</button>
        </div>
      </header>

      <section id="top" className="sales-triptych" aria-label="OJIX property intelligence overview">
        <article className="sales-panel sales-problem">
          <span className="sales-overline">BEFORE / THE DISCONNECTED REVIEW <ArrowDown size={13}/></span>
          <div className="sales-document-cloud">{documents.map((doc, i) => <span key={doc} style={{'--doc-index': i} as CSSProperties}><FileCheck2 size={14}/>{doc}</span>)}</div>
          <div className="sales-problem-copy"><h2>Too many<br/>moving<br/><em>parts?</em></h2><p>Deeds, RTC/Pahani records, encumbrances, land maps, and review evidence rarely move together. OJIX brings the work behind your due diligence into one connected workspace.</p></div>
        </article>
        <article className="sales-panel sales-solution">
          <span className="sales-overline">LESS FRICTION. MORE CLARITY. <ArrowUpRight size={13}/></span>
          <div className="sales-solution-core"><h2>Bring<br/>it all<br/>together.</h2><div className="sales-swoosh" aria-hidden="true"><svg viewBox="0 0 360 82"><path d="M4 64H133C190 64 200 25 252 25h69"/><path d="m304 8 19 17-19 17"/></svg></div><p>Discover a more connected way to conduct property due diligence in Karnataka.</p>
          <button className="sales-panel-cta" onClick={handleDemo}>Book a guided product demo <ArrowUpRight size={16}/></button>
          <div className="sales-contact"><span className="sales-qr-mark" aria-label="OJIX demo mark"><i>OJIX<br/>DEMO</i></span><span><b>WWW.OJIX.COM</b><small>info@ojix.in</small></span></div><small className="sales-company">OJIX Property Intelligence · OJIX Engineering &amp; Technology LLP</small></div>
        </article>
        <article className="sales-panel sales-product">
          <span className="sales-overline">OJIX PROPERTY INTELLIGENCE <ArrowUpRight size={13}/></span><img className="sales-product-logo" src="/assets/ojix-wordmark-header.png" alt="OJIX"/>
          <h2>OJIX —<br/>Property</h2><span className="sales-product-tag">PROPERTY INTELLIGENCE PLATFORM<br/>FOR KARNATAKA</span>
          <p>From deed intake to title review, spatial context, and legal workflows — one connected workspace for property due diligence.</p>
          <div className="sales-product-preview"><img src="/images/ojix-workspace-overview.webp" alt="Actual OJIX demonstration workspace screenshot"/></div>
          <strong className="sales-closing">One workspace.<br/>Complete property due diligence.</strong>
          <div className="sales-benefits"><span>Reduce legal risk</span><span>Faster reviews</span><span>Evidence-first workflow</span><span>Built for teams &amp; firms</span></div>
        </article>
      </section>

      <section className="sales-developed-section" aria-label="Developed OJIX capabilities">
        <span>WHAT WE HAVE DEVELOPED</span>
        <div>{developed.map(([label, Icon]) => <span key={label}><Icon size={14}/>{label}</span>)}</div>
      </section>

      {/* Client-Facing Presentation Banner Modal */}
      <ClientShowcaseBannerModal isOpen={showcaseOpen} onClose={() => setShowcaseOpen(false)} />

    </main>
  );
}
