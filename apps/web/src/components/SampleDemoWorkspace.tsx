import { useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, FileCheck2, FileText, MapPinned, ShieldAlert } from 'lucide-react';
import './sample-demo.css';

type DemoSection = 'overview' | 'property' | 'documents' | 'findings' | 'map' | 'report';

const sections: { id: DemoSection; label: string; icon: typeof Building2 }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'property', label: 'Property record', icon: MapPinned },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'findings', label: 'Findings', icon: ShieldAlert },
  { id: 'map', label: 'Map context', icon: MapPinned },
  { id: 'report', label: 'Report', icon: FileCheck2 },
];

export function SampleDemoWorkspace({ onBack, onLogin, onRegister }: { onBack: () => void; onLogin: () => void; onRegister: () => void }) {
  const [section, setSection] = useState<DemoSection>('overview');
  const current = sections.find(item => item.id === section)!;

  return <main className="sample-demo-page">
    <header className="sample-demo-topbar">
      <button className="sample-demo-brand" onClick={onBack} aria-label="Back to OJIX homepage"><img src="/assets/ojix-wordmark-header.png" alt="OJIX"/><span><b>OJIX</b><small>Property Intelligence</small></span></button>
      <div className="sample-demo-actions"><span className="sample-demo-readonly"><BadgeCheck size={15}/> Public read-only demo</span><button onClick={onLogin}>Client Login</button><button className="sample-demo-register" onClick={onRegister}>Register</button></div>
    </header>
    <div className="sample-demo-banner"><strong>Sample workspace · synthetic data</strong><span>This preview shows the repository's seeded sample matter. It is read-only and does not connect to or change a database.</span></div>
    <div className="sample-demo-layout">
      <aside className="sample-demo-sidebar"><div className="sample-demo-workspace-name"><span>OJ</span><div><b>OJIX Local Demo Workspace</b><small>Sample environment</small></div></div><nav aria-label="Sample workspace navigation">{sections.map(({ id, label, icon: Icon }) => <button className={section === id ? 'active' : ''} key={id} onClick={() => setSection(id)}><Icon size={17}/>{label}</button>)}</nav><button className="sample-demo-back" onClick={onBack}><ArrowLeft size={16}/> Back to homepage</button></aside>
      <section className="sample-demo-content" aria-live="polite">
        <div className="sample-demo-heading"><div><small>DEMO APPLICATION · OJIX-DEMO-0001</small><h1>{section === 'overview' ? 'Sample Arakere Due Diligence' : current.label}</h1><p>Bengaluru Urban · Karnataka · Seeded illustrative property</p></div><span className="sample-demo-status">SYNTHETIC SAMPLE</span></div>
        {section === 'overview' && <>
          <div className="sample-demo-kpis"><article><small>Application</small><b>OJIX-DEMO-0001</b><span>Sample matter</span></article><article><small>Location</small><b>Arakere (sample label)</b><span>Bengaluru Urban</span></article><article><small>Survey reference</small><b>DEMO-34 · Hissa A</b><span>Illustrative identifier</span></article><article><small>Review status</small><b>Demo record</b><span>Not a legal verification</span></article></div>
          <div className="sample-demo-card"><div className="sample-demo-card-title"><Building2 size={18}/><h2>Property summary</h2></div><dl><dt>Village</dt><dd>Arakere (sample label)</dd><dt>Hobli</dt><dd>Demo Hobli</dd><dt>Taluk</dt><dd>Bengaluru South (demo)</dd><dt>Extent</dt><dd>Not verified</dd><dt>Coordinates</dt><dd>12.8870, 77.5960 · illustrative map point only</dd></dl><p>Seed note: Sample workspace data is synthetic and must not be used for a transaction.</p></div>
          <div className="sample-demo-card sample-demo-next"><div><h2>Explore the sample matter</h2><p>Browse the property record, document area, findings, map context and report sections from the left menu.</p></div><button onClick={() => setSection('property')}>Open property record <ArrowRight size={15}/></button></div>
        </>}
        {section === 'property' && <div className="sample-demo-card"><div className="sample-demo-card-title"><MapPinned size={18}/><h2>Seeded property details</h2></div><dl><dt>Application number</dt><dd>OJIX-DEMO-0001</dd><dt>Property</dt><dd>Sample Arakere Due Diligence</dd><dt>Survey number</dt><dd>DEMO-34</dd><dt>Subdivision</dt><dd>A</dd><dt>Village / Hobli</dt><dd>Arakere (sample label) / Demo Hobli</dd><dt>District</dt><dd>Bengaluru Urban</dd><dt>Address</dt><dd>Illustrative map point only; not a verified parcel</dd></dl></div>}
        {section === 'documents' && <div className="sample-demo-card"><div className="sample-demo-card-title"><FileText size={18}/><h2>Document workspace</h2></div><div className="sample-demo-empty"><FileCheck2 size={30}/><b>No sample documents are seeded</b><span>Uploaded files require the authenticated API and private document storage. This public preview has no upload or download actions.</span></div></div>}
        {section === 'findings' && <div className="sample-demo-card"><div className="sample-demo-card-title"><ShieldAlert size={18}/><h2>Preliminary findings</h2></div><div className="sample-demo-empty"><ShieldAlert size={30}/><b>Run screening in the connected workspace</b><span>This seeded property has no sample finding rows. Findings are not fabricated in this read-only preview.</span></div></div>}
        {section === 'map' && <div className="sample-demo-card"><div className="sample-demo-card-title"><MapPinned size={18}/><h2>Illustrative location context</h2></div><div className="sample-demo-coordinate"><MapPinned size={32}/><b>12.8870° N · 77.5960° E</b><span>Seeded illustrative point only · not a verified parcel boundary</span></div><p>The repository seed labels its polygon as a synthetic demo reference, not an official boundary or government feature.</p></div>}
        {section === 'report' && <div className="sample-demo-card"><div className="sample-demo-card-title"><FileCheck2 size={18}/><h2>Report workspace</h2></div><div className="sample-demo-empty"><FileText size={30}/><b>No report is seeded for this matter</b><span>Report creation and export use the connected API. PDF export is not currently available.</span></div></div>}
        <footer className="sample-demo-footer">Read-only sample preview. Client login and registration remain separate and require the connected production services.</footer>
      </section>
    </div>
  </main>;
}
