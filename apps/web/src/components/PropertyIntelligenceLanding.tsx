import type { CSSProperties } from 'react';
import { ArrowDown, ArrowRight, BadgeCheck, BookOpenCheck, Building2, ClipboardCheck, Database, FileCheck2, FileSearch, Files, Headphones, KeyRound, MapPinned, SearchCheck, ShieldCheck, Sparkles, UserCog, UsersRound, Waypoints } from 'lucide-react';
import { PropertyStoryVisual } from './PropertyStoryVisual';

interface PropertyIntelligenceLandingProps {
  onLogin: () => void;
  onRegister: () => void;
  onTryDemo: () => void;
}

const capabilities = [
  { icon: Building2, title: 'Property Intelligence', description: 'Keep parcel identity, location, boundaries, and recorded facts together in a structured property workspace.', image: '/images/ojix-property-records.webp', label: 'PROPERTY RECORDS' },
  { icon: Files, title: 'Document Management', description: 'Organise title deeds, revenue records, and supporting evidence so reviewers can find what they need.', image: '/images/ojix-document-review.webp', label: 'DOCUMENT REVIEW' },
  { icon: MapPinned, title: 'Land & Location', description: 'View recorded survey references and spatial context alongside the documents supplied for review.', image: '/images/ojix-property-records.webp', label: 'LAND CONTEXT' },
  { icon: ShieldCheck, title: 'Risk Assessment', description: 'Track identified findings, their severity, supporting evidence, and the next action for a reviewer.', image: '/images/ojix-risk-assessment.webp', label: 'FINDINGS' },
  { icon: SearchCheck, title: 'Source Verification', description: 'Record the source behind a fact and distinguish what is documented, missing, or still unverified.', image: '', label: 'SOURCE STATUS' },
  { icon: Waypoints, title: 'Review Workflow', description: 'Move work through collection, document review, discrepancy checks, and accountable human sign-off.', image: '', label: 'REVIEW FLOW' },
];

const workflow = [
  { icon: ClipboardCheck, number: '01', title: 'Create the property record', copy: 'Capture the property identity, survey details, location, and review purpose.' },
  { icon: Files, number: '02', title: 'Collect the documents', copy: 'Attach the records provided and keep each file connected to the property.' },
  { icon: FileSearch, number: '03', title: 'Review and compare', copy: 'Examine recorded facts against source documents and note gaps for follow-up.' },
  { icon: BadgeCheck, number: '04', title: 'Complete human review', copy: 'Resolve open findings and prepare the review for qualified professional sign-off.' },
];

const roles = [
  { title: 'Workspace Owner', description: 'Oversee the workspace, its members, settings, and property matters.', icon: KeyRound, featured: true },
  { title: 'Super Admin', description: 'Administer authorized platform-level operations and controls.', icon: ShieldCheck },
  { title: 'Organization Admin', description: 'Coordinate organization members, workflows, and records.', icon: UserCog },
  { title: 'Legal Reviewer', description: 'Review title evidence and due-diligence findings.', icon: BookOpenCheck },
  { title: 'Evidence Analyst', description: 'Analyze property records and prepare assigned matters.', icon: SearchCheck },
  { title: 'Document Operations', description: 'Manage document intake and processing queues.', icon: Files },
  { title: 'Consultant', description: 'Review assigned client dossiers and supporting evidence.', icon: UsersRound },
  { title: 'Support', description: 'Access authorized workspace diagnostics and assistance tools.', icon: Headphones },
  { title: 'Data Steward', description: 'Maintain source data and reference records.', icon: Database },
  { title: 'Viewer', description: 'Access approved read-only workspace records.', icon: FileCheck2 },
];

export function PropertyIntelligenceLanding({ onLogin, onRegister, onTryDemo }: PropertyIntelligenceLandingProps) {
  const explore = () => document.getElementById('ojix-capabilities')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  return (
    <main className="ojix-story-site">
      <header className="ojix-story-header">
        <a className="ojix-story-brand" href="#top" aria-label="OJIX Property Intelligence home">
          <img src="/assets/ojix-wordmark-header.png" alt="OJIX" width="256" height="80"/>
          <span><strong>Property Intelligence</strong><small>Karnataka due diligence workspace</small></span>
        </a>
        <nav className="ojix-story-nav" aria-label="Main navigation">
          <a href="#ojix-platform">Platform</a><a href="#ojix-roles">Roles</a><a href="#ojix-capabilities">Capabilities</a><a href="#ojix-workflow">Review workflow</a>
        </nav>
        <div className="ojix-story-actions"><button className="story-nav-cta" onClick={onTryDemo}>Try the Demo <ArrowRight size={15}/></button><button className="story-login-link" onClick={onLogin}>Client Login</button><button className="story-secondary" onClick={onRegister}>Register</button></div>
      </header>

      <section id="top" className="ojix-story-hero">
        <div className="story-contours" aria-hidden="true"/>
        <div className="story-hero-inner">
          <div className="ojix-story-copy">
            <span className="story-eyebrow story-hero-eyebrow"><i/> PROPERTY DUE DILIGENCE · KARNATAKA</span>
            <h1><span>Every property detail.</span><br/><em>One clear picture.</em></h1>
            <p className="story-hero-description">Bring property records, legal documents, land information, and due-diligence findings into one connected workspace.</p>
            <div className="story-hero-actions"><button className="story-primary" onClick={onTryDemo}>Try the Demo <ArrowRight size={16}/></button><button className="story-secondary" onClick={onLogin}>Client Login <ArrowRight size={16}/></button><button className="story-secondary" onClick={onRegister}>Register</button></div>
            <div className="story-assurance"><ShieldCheck size={16}/><span>Evidence-linked review</span><i/><span>Source status at a glance</span><i/><span>Human oversight</span></div>
          </div>
          <div className="story-hero-art-wrap"><PropertyStoryVisual/></div>
        </div>
        <div className="story-scroll-cue" aria-hidden="true"><span>ONE CONNECTED WORKSPACE</span><i/></div>
      </section>

      <section id="ojix-roles" className="ojix-roles-section">
        <div className="story-section-head reveal-on-scroll"><span className="story-eyebrow">PURPOSE-BUILT WORKSPACE ACCESS</span><h2>One review workspace.<br/><em>Clear roles for every contributor.</em></h2><p>Each role enters the same evidence-led workflow with access aligned to its assigned responsibilities.</p></div>
        <div className="story-role-grid">
          {roles.map(({title,description,icon:Icon,featured},i) => <article className={`story-role-card reveal-on-scroll${featured ? ' story-role-featured' : ''}`} style={{'--story-delay':`${i*75}ms`} as CSSProperties} key={title}>
            <div className="story-role-card-top">
              <span className="story-role-icon"><Icon size={featured ? 24 : 20}/></span>
              {featured && <span className="story-recommended">Recommended</span>}
            </div>
            <h3>{title}</h3><p>{description}</p>
            <span className="story-role-arrow" aria-hidden="true"><ArrowRight size={16}/></span>
            {featured && <div className="story-owner-illustration" aria-hidden="true"><span/><span/><Building2 size={32}/><i/></div>}
          </article>)}
        </div>
      </section>

      <section id="ojix-platform" className="ojix-product-showcase">
        <div className="story-section-head reveal-on-scroll"><span className="story-eyebrow">A CLEARER REVIEW WORKSPACE</span><h2>See the work.<br/><em>Understand what needs attention.</em></h2><p>Property records, documents, locations, and findings stay connected as your team reviews a matter.</p></div>
        <div className="story-showcase-layout">
          <div className="story-showcase-copy reveal-on-scroll">
            <span className="story-kicker"><Sparkles size={14}/> INSIDE OJIX</span>
            <h3>From the property record to the review detail.</h3>
            <p>Use a structured workspace to see active reviews, keep supporting files organised, and follow findings back to their source.</p>
            <ul><li><BadgeCheck size={16}/> Recorded facts stay distinct from verified facts</li><li><Files size={16}/> Documents remain attached to their property</li><li><Waypoints size={16}/> Review steps stay visible to the team</li></ul>
            <button className="story-text-cta" onClick={onLogin}>Login to workspace <ArrowRight size={15}/></button>
          </div>
          <div className="story-screen-stack reveal-on-scroll" aria-label="Screenshots of the OJIX application">
            <figure className="story-screen-main"><img src="/images/ojix-workspace-overview.webp" loading="lazy" decoding="async" alt="Screenshot of the OJIX demo workspace overview"/><figcaption><i/> DEMO WORKSPACE · OJIX APPLICATION SCREEN</figcaption></figure>
            <figure className="story-screen-float"><img src="/images/ojix-property-review.webp" loading="lazy" decoding="async" alt="Screenshot of the OJIX demo property review list"/><figcaption>DEMO PROPERTY REVIEW</figcaption></figure>
            <span className="story-screen-caption">Real OJIX application screens · demonstration records</span>
          </div>
        </div>
        <div className="story-capability-ribbon reveal-on-scroll"><span><Building2 size={17}/> Property records</span><i/><span><Files size={17}/> Documents</span><i/><span><MapPinned size={17}/> Land context</span><i/><span><ShieldCheck size={17}/> Findings & review</span></div>
      </section>

      <section id="ojix-capabilities" className="ojix-capabilities-section">
        <div className="story-section-head reveal-on-scroll"><span className="story-eyebrow">ONE PLACE FOR THE FULL REVIEW</span><h2>Built around the details<br/><em>that matter.</em></h2><p>Bring evidence together, make gaps visible, and keep decisions grounded in human review.</p></div>
        <div className="story-capability-grid">{capabilities.map(({icon:Icon,title,description,image,label},i)=><article className="story-capability-card reveal-on-scroll" style={{'--story-delay':`${i*65}ms`} as CSSProperties} key={title}>
          <div className="story-capability-visual">{image?<img src={image} loading="lazy" decoding="async" alt=""/>:<div className={`story-mini-illustration story-mini-${i}`} aria-hidden="true"><span/><span/><span/><Icon size={29}/></div>}<span>{label}</span></div>
          <span className="story-capability-icon"><Icon size={18}/></span><h3>{title}</h3><p>{description}</p>
        </article>)}</div>
      </section>

      <section id="ojix-workflow" className="ojix-workflow-section">
        <div className="story-section-head reveal-on-scroll"><span className="story-eyebrow">A TRACEABLE, HUMAN-LED PROCESS</span><h2>Every step has its<br/><em>evidence and owner.</em></h2><p>A practical review sequence keeps collection, comparison, and professional sign-off clear.</p></div>
        <div className="story-workflow-track reveal-on-scroll">{workflow.map(({icon:Icon,number,title,copy},i)=><article className="story-workflow-step reveal-on-scroll" style={{'--story-delay':`${i*90}ms`} as CSSProperties} key={number}><span className="story-step-number">{number}</span><span className="story-step-icon"><Icon size={20}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        <p className="story-workflow-note"><ShieldCheck size={15}/> OJIX organises the review. Legal conclusions and verification remain with the responsible human reviewer.</p>
      </section>

      <section className="ojix-story-cta reveal-on-scroll">
        <div className="story-cta-map" aria-hidden="true"><i/><i/><i/><i/><span/></div>
        <div><span className="story-eyebrow">START WITH A CLEAR RECORD</span><h2>Bring your next property review<br/><em>into focus.</em></h2><p>Explore the read-only sample, sign in to a client workspace, or register for access.</p></div>
        <div className="story-cta-actions"><button className="story-primary" onClick={onTryDemo}>Try the Demo <ArrowRight size={16}/></button><button className="story-secondary" onClick={onLogin}>Client Login</button><button className="story-secondary" onClick={onRegister}>Register</button></div>
      </section>

      <footer className="ojix-story-footer reveal-on-scroll"><a className="ojix-story-brand" href="#top"><img src="/assets/ojix-wordmark-header.png" alt="OJIX" width="256" height="80"/><span><strong>Property Intelligence</strong><small>Karnataka due diligence workspace</small></span></a><p>Structured property review, with evidence kept in view.</p><nav aria-label="Footer navigation"><a href="#ojix-platform">Platform</a><a href="#ojix-roles">Roles</a><a href="#ojix-capabilities">Capabilities</a><a href="#ojix-workflow">Workflow</a><button onClick={onLogin}>Login <ArrowRight size={14}/></button></nav><small className="story-legal">OJIX supports document organisation and review workflows. It does not replace official records or qualified legal advice.</small></footer>
    </main>
  );
}
