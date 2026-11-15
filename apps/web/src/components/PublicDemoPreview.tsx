import { useState } from 'react';
import { ArrowLeft, BadgeCheck, Building2, ClipboardList, FileText, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import './public-demo-preview.css';

type DemoSection = 'overview' | 'property' | 'documents' | 'findings' | 'map';

const navigation: { id: DemoSection; label: string; icon: typeof Building2 }[] = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'property', label: 'Property record', icon: Building2 },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'findings', label: 'Review findings', icon: BadgeCheck },
  { id: 'map', label: 'Location context', icon: MapPinned },
];

const documents = [
  ['Sale deed extract', 'Sample document · 2021'],
  ['RTC record', 'Sample document · 2023'],
  ['Survey sketch', 'Illustrative sample · 2022'],
];

const findings = [
  ['Survey details need comparison', 'Compare the supplied sample records before reaching a conclusion.', 'Review'],
  ['Supporting document not included', 'The demonstration file set is intentionally incomplete.', 'Follow up'],
  ['Location source not verified', 'No official land boundary or government connector is configured in this preview.', 'Unverified'],
];

export function PublicDemoPreview({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<DemoSection>('overview');
  const current = navigation.find(item => item.id === section)!;
  const CurrentIcon = current.icon;

  return (
    <main className="public-demo-shell">
      <header className="public-demo-topbar">
        <a className="public-demo-brand" href="#demo" aria-label="OJIX demo home">
          <img src="/assets/ojix-wordmark-header.png" alt="OJIX" />
          <span><strong>Property Intelligence</strong><small>Demonstration workspace</small></span>
        </a>
        <div className="public-demo-top-actions">
          <span className="public-demo-label"><Sparkles size={15}/> PUBLIC SYNTHETIC DEMO · READ ONLY</span>
          <button type="button" onClick={onExit}><ArrowLeft size={16}/> Back to site</button>
        </div>
      </header>

      <div className="public-demo-body">
        <aside className="public-demo-sidebar">
          <div className="public-demo-workspace"><span className="public-demo-workspace-icon"><Building2 size={18}/></span><span><small>WORKSPACE</small><strong>OJIX Sample</strong></span></div>
          <nav aria-label="Sample workspace sections">
            {navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon size={17}/>{label}</button>)}
          </nav>
          <div className="public-demo-sidebar-note"><ShieldCheck size={16}/><span>All records here are fictional samples. This preview cannot access or change client workspaces.</span></div>
        </aside>

        <section className="public-demo-content" aria-live="polite">
          <div className="public-demo-page-heading"><div><span className="public-demo-eyebrow">SAMPLE PROPERTY · OJIX-DEMO-0001</span><h1><CurrentIcon size={25}/>{section === 'overview' ? 'Workspace overview' : current.label}</h1><p>A read-only walkthrough using synthetic demonstration records.</p></div><span className="public-demo-status"><i/> Synthetic sample</span></div>

          {section === 'overview' && <>
            <div className="public-demo-stat-grid"><article><span>Sample matters</span><strong>1</strong><small>Fictional record</small></article><article><span>Documents</span><strong>3</strong><small>Illustrative samples</small></article><article><span>Open findings</span><strong>3</strong><small>Require human review</small></article><article><span>Verified sources</span><strong>0</strong><small>No live connectors</small></article></div>
            <div className="public-demo-card-grid"><article className="public-demo-card public-demo-property-card"><div className="public-demo-card-heading"><div><span>PROPERTY RECORD</span><h2>Sample Bengaluru parcel</h2></div><span className="public-demo-tag">SYNTHETIC</span></div><div className="public-demo-facts"><div><small>Application</small><strong>OJIX-DEMO-0001</strong></div><div><small>District</small><strong>Bengaluru Urban · sample</strong></div><div><small>Survey reference</small><strong>42/7A · illustrative</strong></div><div><small>Extent</small><strong>1.20 acres · sample</strong></div></div><button type="button" className="public-demo-link" onClick={() => setSection('property')}>View sample property <ArrowLeft size={15}/></button></article>
              <article className="public-demo-card public-demo-callout"><span className="public-demo-callout-icon"><ShieldCheck size={20}/></span><span className="public-demo-eyebrow">HOW TO READ THIS DEMO</span><h2>Records are examples, not verification.</h2><p>Every name, location, document and finding in this preview is synthetic. No official records are connected.</p></article></div>
            <article className="public-demo-card"><div className="public-demo-card-heading"><div><span>NEEDS ATTENTION</span><h2>Sample review findings</h2></div><button type="button" className="public-demo-link" onClick={() => setSection('findings')}>See all <ArrowLeft size={15}/></button></div><FindingRows compact/></article>
          </>}

          {section === 'property' && <article className="public-demo-card"><div className="public-demo-card-heading"><div><span>PROPERTY IDENTITY</span><h2>Sample Bengaluru parcel</h2></div><span className="public-demo-tag">FICTIONAL</span></div><div className="public-demo-facts public-demo-facts-wide"><div><small>Application number</small><strong>OJIX-DEMO-0001</strong></div><div><small>Review purpose</small><strong>Demonstration only</strong></div><div><small>Property type</small><strong>Illustrative residential parcel</strong></div><div><small>District / taluk</small><strong>Bengaluru Urban · sample</strong></div><div><small>Village / hobli</small><strong>Sample locality · fictional</strong></div><div><small>Survey / subdivision</small><strong>42/7A · illustrative</strong></div><div><small>Extent</small><strong>1.20 acres · sample</strong></div><div><small>Record status</small><strong>Sample only · not verified</strong></div></div><p className="public-demo-disclaimer">This example is intentionally fictional. Do not use it to make legal, financial, or property decisions.</p></article>}

          {section === 'documents' && <article className="public-demo-card"><div className="public-demo-card-heading"><div><span>ATTACHED SAMPLE FILES</span><h2>Demonstration documents</h2></div><span className="public-demo-tag">NO DOWNLOADS</span></div><div className="public-demo-document-list">{documents.map(([name, detail]) => <div key={name}><span className="public-demo-document-icon"><FileText size={18}/></span><span><strong>{name}</strong><small>{detail}</small></span><span className="public-demo-document-state">Illustrative</span></div>)}</div><p className="public-demo-disclaimer">These are sample labels for walkthrough purposes; no source documents or client files are available in this public preview.</p></article>}

          {section === 'findings' && <article className="public-demo-card"><div className="public-demo-card-heading"><div><span>HUMAN REVIEW REQUIRED</span><h2>Sample findings</h2></div><span className="public-demo-tag">NOT LEGAL ADVICE</span></div><FindingRows/><p className="public-demo-disclaimer">A qualified reviewer must check real source documents and official records before drawing conclusions.</p></article>}

          {section === 'map' && <article className="public-demo-card"><div className="public-demo-card-heading"><div><span>LOCATION CONTEXT</span><h2>Illustrative map preview</h2></div><span className="public-demo-tag">NOT GEOGRAPHIC DATA</span></div><div className="public-demo-map-placeholder"><MapPinned size={36}/><strong>No verified parcel boundary is available</strong><span>This sample view does not show official survey geometry or live government data.</span></div><p className="public-demo-disclaimer">The location details shown elsewhere in this demo are fictional and must not be used for navigation or property identification.</p></article>}
        </section>
      </div>
    </main>
  );
}

function FindingRows({ compact = false }: { compact?: boolean }) {
  return <div className="public-demo-finding-list">{findings.slice(0, compact ? 2 : findings.length).map(([title, copy, state]) => <div key={title}><span className="public-demo-finding-dot"/><span><strong>{title}</strong><small>{copy}</small></span><em>{state}</em></div>)}</div>;
}
