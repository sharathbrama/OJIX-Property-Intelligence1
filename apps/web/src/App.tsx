import { useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, BookOpen, BriefcaseBusiness, Building2, Check, ChevronDown, CircleHelp, ClipboardCheck, CloudUpload, Eye, FileCheck2, FileSearch, FileText, Filter, FolderOpen, Gauge, Layers3, LayoutDashboard, MapPin, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldAlert, ShieldCheck, Sparkles, Upload, X, LoaderCircle, ExternalLink, Download, Clock3, Map as MapIcon, GitMerge, Scale } from 'lucide-react';
import { SideBySideReview } from './components/SideBySideReview';
import { TitleChainTimeline } from './components/TitleChainTimeline';
import { MapViewer } from './components/MapViewer';
import { DiscrepancyMatrix, type DiscrepancyFinding } from './components/DiscrepancyMatrix';
import { ReportViewer } from './components/ReportViewer';
import { LegalResearchView } from './components/LegalResearchView';
import { SourceRegistryView } from './components/SourceRegistryView';
import { GlobalDocumentsView } from './components/GlobalDocumentsView';
import { GlobalRiskView } from './components/GlobalRiskView';
import { GlobalMapView } from './components/GlobalMapView';
import { SettingsView } from './components/SettingsView';
import type { PropertyDoc } from './types';


type Property = { id: string; name: string; village: string; hobli: string; taluk: string; district: string; survey_number: string; subdivision: string; extent: string; address: string; latitude: number | null; longitude: number | null; notes: string; status: string; updated_at: string; document_count?: number };
type Finding = { id?: string; code: string; title: string; severity: string; points: number; explanation: string; evidence_status: string; next_action: string };
type Doc = { id: string; original_filename: string; mime_type: string; size_bytes: number; sha256?: string; doc_type?: string; processing_status: string; extracted_fields?: any; created_at: string };
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
const dateLabel = (date?: string) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const pretty = (value?: string) => value ? value.replace(/_/g,' ').replace(/\b\w/g, s => s.toUpperCase()) : 'Not recorded';
const initials = (name: string) => name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();

export default function App() {
  const [page, setPage] = useState<'overview'|'properties'|'property'|'all-documents'|'all-findings'|'all-maps'|'legal-research'|'source-registry'|'settings'>('overview');
  const [properties, setProperties] = useState<Property[]>([]);
  const [overview, setOverview] = useState({ total: 0, in_review: 0, ready_for_review: 0, documents: 0 });
  const [selected, setSelected] = useState<Property | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [riskSummary, setRiskSummary] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [o, p] = await Promise.all([api<any>('/api/overview'), api<{items:Property[]}>('/api/properties')]);
      setOverview(o); setProperties(p.items);
      if (selected) {
        const d = await api<{item:Property;documents:Doc[];findings:Finding[]}>(`/api/properties/${selected.id}`);
        setSelected(d.item); setDocs(d.documents); setFindings(d.findings);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [selected?.id]);
  useEffect(() => { refresh(); }, []);

  const openProperty = async (property: Property) => {
    setBusy(true); setError('');
    try {
      const d = await api<{item:Property;documents:Doc[];findings:Finding[]}>(`/api/properties/${property.id}`);
      setSelected(d.item); setDocs(d.documents); setFindings(d.findings); setRiskSummary(null); setPage('property'); setMobileNav(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const openPropertyById = async (propId: string) => {
    const found = properties.find(p => p.id === propId);
    if (found) {
      await openProperty(found);
    } else {
      setBusy(true); setError('');
      try {
        const d = await api<{item:Property;documents:Doc[];findings:Finding[]}>(`/api/properties/${propId}`);
        setSelected(d.item); setDocs(d.documents); setFindings(d.findings); setRiskSummary(null); setPage('property'); setMobileNav(false);
      } catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    }
  };

  const createProperty = async (form: Record<string, any>) => {
    setBusy(true); setError('');
    try {
      const result = await api<{item:Property}>('/api/properties', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) });
      setShowCreate(false); setNotice('Property workspace created. Add source documents and run preliminary analysis.');
      await refresh(); await openProperty(result.item);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const analyze = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await api<{summary:any;findings:Finding[];dataStatus:string}>(`/api/properties/${selected.id}/analyze`, { method:'POST' });
      setRiskSummary(result.summary); setFindings(result.findings); setNotice('Preliminary screening completed. Review the evidence status for each finding.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!selected || !files?.length) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); Array.from(files).forEach(file => body.append('files', file));
      const result = await api<{items:Doc[];note:string}>(`/api/properties/${selected.id}/documents`, { method:'POST', body });
      setDocs(prev => [...result.items, ...prev]); setNotice(result.note); await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const downloadReport = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/properties/${selected.id}/report`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Unable to create report'); }
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`ojix-property-report-${selected.id}.json`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const printReport = async () => {
    if (!selected) return;
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) { setError('Pop-up blocked. Allow pop-ups to print the report.'); return; }
    reportWindow.document.write('<title>OJIX Property Report</title><p style="font-family:Arial;padding:24px">Preparing evidence report…</p>');
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/properties/${selected.id}/report`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Unable to create report'); }
      const report = await res.json();
      const p = report.property || {};
      const docsHtml = (report.documents || []).map((d:any)=>`<tr><td>${escapeHtml(d.original_filename)}</td><td>${escapeHtml(d.mime_type)}</td><td>${escapeHtml(String(d.processing_status))}</td><td>${escapeHtml(String(d.sha256 || ''))}</td></tr>`).join('');
      const findingsHtml = (report.findings || []).map((f:any)=>`<article><h3>${escapeHtml(f.title)} <small>${escapeHtml(f.severity)} · ${escapeHtml(f.evidence_status)} evidence</small></h3><p>${escapeHtml(f.explanation)}</p><p><b>Next action:</b> ${escapeHtml(f.next_action)}</p></article>`).join('') || '<p>No screening findings recorded yet.</p>';
      reportWindow.document.open();
      reportWindow.document.write(`<!doctype html><html><head><title>OJIX Property Evidence Report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:13px Arial,sans-serif;color:#243247;max-width:900px;margin:36px auto;padding:0 28px;line-height:1.5}h1{font-size:26px;margin:4px 0}h2{font-size:16px;border-bottom:1px solid #dfe5ed;padding-bottom:7px;margin-top:28px}.eyebrow{font-size:10px;letter-spacing:1.5px;color:#b34a42;font-weight:bold}p{color:#5c6879}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}td,th{padding:8px;border:1px solid #e2e6ec;text-align:left;overflow-wrap:anywhere}th{background:#f5f7fa}article{border:1px solid #e2e6ec;padding:12px 15px;margin:10px 0;border-radius:6px}article h3{font-size:13px;margin:0}article small{color:#9b7430;font-weight:normal}article p{font-size:12px;margin:8px 0}.warning{border:1px solid #ecdcb6;background:#fff9ed;padding:12px;border-radius:6px;color:#806a40;font-size:11px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px}.meta div{padding:10px;background:#f7f9fb;border-radius:5px}.meta span{display:block;color:#8792a2;font-size:10px}.meta b{font-size:12px}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head><body><div class="eyebrow">OJIX PROPERTY INTELLIGENCE</div><h1>Property Evidence Report</h1><p>Generated ${escapeHtml(new Date(report.generatedAt).toLocaleString())} · Preliminary due-diligence workspace</p><h2>Property identity</h2><div class="meta"><div><span>Property name</span><b>${escapeHtml(p.name||'Not recorded')}</b></div><div><span>Survey number / subdivision</span><b>${escapeHtml([p.survey_number,p.subdivision].filter(Boolean).join(' / ')||'Not recorded')}</b></div><div><span>Village / Hobli / Taluk</span><b>${escapeHtml([p.village,p.hobli,p.taluk].filter(Boolean).join(' / ')||'Not recorded')}</b></div><div><span>District</span><b>${escapeHtml(p.district||'Not recorded')}</b></div><div><span>Extent</span><b>${escapeHtml(p.extent||'Not recorded')}</b></div><div><span>Coordinates</span><b>${escapeHtml(p.latitude!=null&&p.longitude!=null?`${p.latitude}, ${p.longitude}`:'Not recorded')}</b></div></div><h2>Source documents (${(report.documents||[]).length})</h2><table><thead><tr><th>Filename</th><th>Type</th><th>Processing status</th><th>SHA-256 checksum</th></tr></thead><tbody>${docsHtml||'<tr><td colspan="4">No documents uploaded.</td></tr>'}</tbody></table><h2>Review findings (${(report.findings||[]).length})</h2>${findingsHtml}<h2>Limitations and professional review</h2><div class="warning">${escapeHtml(report.reviewNotice||'This is not a legal opinion or government certification.')}<br><br>${(report.dataLimitations||[]).map((x:string)=>escapeHtml(x)).join('<br>')}</div><p class="no-print">Use your browser's Print command and choose “Save as PDF” to create a PDF copy.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`);
      reportWindow.document.close();
    } catch (e) { reportWindow.close(); setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const filtered = properties.filter(p => `${p.name} ${p.village} ${p.survey_number} ${p.district}`.toLowerCase().includes(query.toLowerCase()));
  const navigate = (next: 'overview'|'properties'|'all-documents'|'all-findings'|'all-maps'|'legal-research'|'source-registry'|'settings') => {
    setPage(next);
    setMobileNav(false);
    setSelected(null);
    setNotice('');
  };

  const getPageTitle = () => {
    switch (page) {
      case 'overview': return 'Overview';
      case 'properties': return 'Properties';
      case 'all-documents': return 'Document Vault & Evidence Repository';
      case 'all-findings': return 'Risk Reviews & Audit Findings';
      case 'all-maps': return 'Map Intelligence & GIS Clearance';
      case 'legal-research': return 'Legal Research & Case Precedents';
      case 'source-registry': return 'Government Source Registry & Real-Time Sync';
      case 'settings': return 'Workspace & Engine Settings';
      case 'property': return selected?.name || 'Property workspace';
      default: return 'Overview';
    }
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><span>O</span><i /></div><div><strong>OJIX</strong><small>PROPERTY INTELLIGENCE</small></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon">OD</div><div className="workspace-copy"><strong>OJIX Demo Workspace</strong><span>Property due diligence</span></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className={`nav-item ${page==='overview'?'active':''}`} onClick={()=>navigate('overview')}><LayoutDashboard size={18}/><span>Overview</span></button>
        <button className={`nav-item ${page==='properties'||page==='property'?'active':''}`} onClick={()=>navigate('properties')}><Building2 size={18}/><span>Properties</span><span className="nav-count">{overview.total}</span></button>
        <button className={`nav-item ${page==='all-documents'?'active':''}`} onClick={()=>navigate('all-documents')}><FolderOpen size={18}/><span>Document Vault</span></button>
        <button className={`nav-item ${page==='all-findings'?'active':''}`} onClick={()=>navigate('all-findings')}><ShieldAlert size={18}/><span>Risk reviews</span></button>
        <button className={`nav-item ${page==='all-maps'?'active':''}`} onClick={()=>navigate('all-maps')}><MapIcon size={18}/><span>Map intelligence</span></button>
      </nav>
      <div className="nav-label nav-label-spaced">TOOLS</div>
      <nav>
        <button className={`nav-item ${page==='legal-research'?'active':''}`} onClick={()=>navigate('legal-research')}><BookOpen size={18}/><span>Legal research</span></button>
        <button className={`nav-item ${page==='source-registry'?'active':''}`} onClick={()=>navigate('source-registry')}><Activity size={18}/><span>Source registry</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={16}/><div><strong>Evidence-first workflow</strong><span>Every finding needs a source.</span></div></div>
        <button className={`nav-item ${page==='settings'?'active':''}`} onClick={()=>navigate('settings')}><Settings2 size={18}/><span>Settings</span></button>
        <div className="user-profile"><div className="avatar">DP</div><div className="user-copy"><strong>Demo Professional</strong><span>Workspace owner</span></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>
    {mobileNav && <div className="nav-scrim" onClick={()=>setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{getPageTitle()}</strong></div>
        </div>
        <div className="topbar-actions">
          <div className="environment"><span className="status-dot"/> LOCAL DEVELOPMENT</div>
          <button className="icon-btn" onClick={()=>setNotice('No new notifications.')} aria-label="Notifications"><Bell size={18}/><i className="notification-dot"/></button>
          <div className="top-avatar">DP</div>
        </div>
      </header>
      <div className="content">
        {error && <div className="alert alert-error"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}
        {notice && <div className="alert alert-info"><Sparkles size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        {page==='overview' && <Overview overview={overview} properties={properties} loading={loading} onCreate={()=>setShowCreate(true)} onOpen={openProperty} onProperties={()=>navigate('properties')} />}
        {page==='properties' && <PropertiesPage properties={filtered} query={query} setQuery={setQuery} loading={loading} onCreate={()=>setShowCreate(true)} onOpen={openProperty} />}
        {page==='property' && selected && <PropertyPage property={selected} docs={docs} findings={findings} riskSummary={riskSummary} busy={busy} onAnalyze={analyze} onUpload={uploadFiles} onReport={downloadReport} onPrint={printReport} onBack={()=>navigate('properties')} onDocUpdated={(updatedDoc)=>setDocs(prev=>prev.map(d=>d.id===updatedDoc.id?updatedDoc:d))} />}
        {page==='all-documents' && <GlobalDocumentsView apiUrl={API} onOpenProperty={openPropertyById} />}
        {page==='all-findings' && <GlobalRiskView apiUrl={API} onOpenProperty={openPropertyById} />}
        {page==='all-maps' && <GlobalMapView properties={properties} apiUrl={API} onOpenProperty={openProperty} onRefreshProperties={refresh} />}
        {page==='legal-research' && <LegalResearchView apiUrl={API} onOpenProperty={openPropertyById} />}
        {page==='source-registry' && <SourceRegistryView apiUrl={API} properties={properties} onOpenProperty={openProperty} />}
        {page==='settings' && <SettingsView apiUrl={API} />}
      </div>
      <footer className="footer"><span>OJIX Property Intelligence <b>•</b> MVP 0.1.0</span><span><ShieldCheck size={13}/> Confidential workspace <b>•</b> Evidence-based, not legal advice</span></footer>
    </main>
    {showCreate && <CreatePropertyModal onClose={()=>setShowCreate(false)} onSubmit={createProperty} busy={busy} />}
    {busy && <div className="busy-indicator"><LoaderCircle size={16} className="spin"/> Processing request…</div>}
  </div>;
}


function Overview({ overview, properties, loading, onCreate, onOpen, onProperties }: {overview:any;properties:Property[];loading:boolean;onCreate:()=>void;onOpen:(p:Property)=>void;onProperties:()=>void}) {
  return <>
    <div className="page-heading"><div><div className="eyebrow">PROPERTY DUE DILIGENCE <span>•</span> BENGALURU FIRST</div><h1>Good morning, Deepak</h1><p>See what is known, what needs review, and which evidence is still missing.</p></div><button className="primary-btn" onClick={onCreate}><Plus size={17}/> New property review</button></div>
    <div className="notice-banner"><div className="notice-icon"><ShieldCheck size={21}/></div><div><strong>Evidence before conclusions</strong><p>OJIX organizes documents, map context and review tasks. It does not certify ownership or replace professional legal review.</p></div><span className="banner-tag">MVP WORKSPACE</span></div>
    <div className="section-header"><div><h2>Workspace overview</h2><p>Live counts from your local development database</p></div><button className="text-btn" onClick={onProperties}>View all properties <ArrowUpRight size={15}/></button></div>
    <div className="metric-grid">
      <Metric icon={<Building2 size={18}/>} label="Property workspaces" value={loading?'—':overview.total} change="All active workspaces" tone="blue" />
      <Metric icon={<Clock3 size={18}/>} label="In review" value={loading?'—':overview.in_review} change="Need due-diligence work" tone="amber" />
      <Metric icon={<ClipboardCheck size={18}/>} label="Ready for review" value={loading?'—':overview.ready_for_review} change="Prepared for professional review" tone="green" />
      <Metric icon={<FileText size={18}/>} label="Source documents" value={loading?'—':overview.documents} change="Uploaded to workspaces" tone="violet" />
    </div>
    <div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-head"><div><h3>Recent property workspaces</h3><p>Continue where you left off</p></div><button className="icon-btn" onClick={onProperties} aria-label="View all"><MoreHorizontal size={18}/></button></div>
      {properties.length===0 && !loading ? <EmptyState title="No property workspaces yet" text="Create your first workspace to start organizing property evidence." action="Create property" onAction={onCreate}/> : <div className="property-table-wrap"><table className="data-table"><thead><tr><th>PROPERTY</th><th>SURVEY / LOCATION</th><th>STATUS</th><th>UPDATED</th><th></th></tr></thead><tbody>{properties.slice(0,5).map(p=><tr key={p.id} onClick={()=>onOpen(p)} className="click-row"><td><div className="property-cell"><div className="property-thumb"><Building2 size={17}/></div><div><strong>{p.name}</strong><small>{p.district || 'District not recorded'}</small></div></div></td><td><strong className="mono">{p.survey_number || 'Not recorded'}</strong><small>{p.village || 'Village not recorded'}</small></td><td><StatusPill status={p.status}/></td><td className="muted">{dateLabel(p.updated_at)}</td><td><ChevronDown className="row-arrow" size={16}/></td></tr>)}</tbody></table></div>}
    </section><section className="panel checklist-panel"><div className="panel-head"><div><h3>Review readiness</h3><p>Minimum evidence checklist</p></div><div className="panel-icon"><ClipboardCheck size={18}/></div></div><div className="readiness-intro"><div className="readiness-ring"><span>{properties.length?Math.round(properties.reduce((n,p)=>n+((p.survey_number?1:0)+(p.document_count?1:0)+(p.latitude!==null&&p.longitude!==null?1:0))/3,0)/properties.length*100):0}%</span></div><div><strong>Workspace completeness</strong><p>Basic completeness signals only; not a legal risk score.</p></div></div><div className="checklist"><ChecklistItem icon={<Check size={14}/>} label="Property identity fields" note="Survey number, village, extent"/><ChecklistItem icon={<FileCheck2 size={14}/>} label="Document evidence" note="Title chain and supporting records"/><ChecklistItem icon={<MapPin size={14}/>} label="Spatial context" note="Coordinates or surveyed geometry"/><ChecklistItem icon={<BadgeCheck size={14}/>} label="Professional review" note="Required before transaction decisions" pending/></div><button className="secondary-btn full-btn" onClick={onProperties}>Review properties <ArrowDownRight size={15}/></button></section></div>
    <div className="bottom-callout"><div className="callout-icon"><Sparkles size={19}/></div><div><strong>Next up: build your evidence trail</strong><p>Upload a sale deed, RTC, mutation record, khata or EC. The starter currently stores files and hashes; OCR automation is a subsequent integration.</p></div><div className="callout-pill">DOCUMENT INTELLIGENCE <span>PHASE 2</span></div></div>
  </>;
}
function Metric({icon,label,value,change,tone}:{icon:ReactNode;label:string;value:any;change:string;tone:string}){return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-change">{change}</div></div>}
function ChecklistItem({icon,label,note,pending=false}:{icon:ReactNode;label:string;note:string;pending?:boolean}){return <div className="check-item"><div className={`check-icon ${pending?'pending':''}`}>{icon}</div><div><strong>{label}</strong><span>{note}</span></div>{pending&&<span className="pending-tag">REQUIRED</span>}</div>}
function StatusPill({status}:{status:string}){const tone=status==='ready_for_review'?'green':status==='archived'?'grey':'amber';return <span className={`status-pill ${tone}`}><i/>{pretty(status)}</span>}
function EmptyState({title,text,action,onAction}:{title:string;text:string;action:string;onAction:()=>void}){return <div className="empty-state"><div className="empty-icon"><FolderOpen size={24}/></div><strong>{title}</strong><p>{text}</p><button className="secondary-btn" onClick={onAction}><Plus size={15}/>{action}</button></div>}

function PropertiesPage({properties,query,setQuery,loading,onCreate,onOpen}:{properties:Property[];query:string;setQuery:(q:string)=>void;loading:boolean;onCreate:()=>void;onOpen:(p:Property)=>void}){
  return <><div className="page-heading"><div><div className="eyebrow">WORKSPACE / PROPERTY REGISTER</div><h1>Property workspaces</h1><p>One place for property identity, documents, map context and review findings.</p></div><button className="primary-btn" onClick={onCreate}><Plus size={17}/> New property review</button></div><div className="panel list-panel"><div className="list-toolbar"><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by property, survey number, village…"/></div><button className="secondary-btn" onClick={()=>setQuery('')}><Filter size={15}/> Clear filters</button><span className="result-count">{properties.length} results</span></div>{loading?<div className="loading-state"><LoaderCircle className="spin"/> Loading property workspaces…</div>:properties.length===0?<EmptyState title="No matching properties" text="Try a different search or create a new property review." action="Create property" onAction={onCreate}/>:<div className="property-list">{properties.map(p=><button className="property-list-item" key={p.id} onClick={()=>onOpen(p)}><div className="property-thumb large"><Building2 size={20}/></div><div className="property-list-main"><strong>{p.name}</strong><span><MapPin size={13}/>{[p.village,p.taluk,p.district].filter(Boolean).join(' · ')||'Location not recorded'}</span><div className="property-tags"><span className="mono">Survey {p.survey_number||'—'}</span><span>{p.document_count||0} documents</span>{p.latitude!==null&&p.longitude!==null&&<span>Map point added</span>}</div></div><div className="property-list-side"><StatusPill status={p.status}/><small>Updated {dateLabel(p.updated_at)}</small></div><ArrowUpRight className="list-arrow" size={17}/></button>)}</div>}</div></>;
}

function PropertyPage({property,docs,findings,riskSummary,busy,onAnalyze,onUpload,onReport,onPrint,onBack,onDocUpdated}:{property:Property;docs:Doc[];findings:Finding[];riskSummary:any;busy:boolean;onAnalyze:()=>void;onUpload:(files:FileList|null)=>void;onReport:()=>void;onPrint:()=>void;onBack:()=>void;onDocUpdated?:(d:Doc)=>void}){
  const [tab,setTab]=useState<'summary'|'documents'|'title-chain'|'map'|'discrepancies'|'report'|'findings'>('summary');
  const [reviewingDoc, setReviewingDoc] = useState<Doc | null>(null);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyFinding[]>([]);
  const [discRiskSummary, setDiscRiskSummary] = useState<any>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  const loadDiscrepancies = useCallback(async () => {
    try {
      const data = await api<{discrepancies: DiscrepancyFinding[]; riskSummary: any}>(`/api/properties/${property.id}/discrepancies`);
      setDiscrepancies(data.discrepancies || []);
      setDiscRiskSummary(data.riskSummary || null);
    } catch { /* graceful fallback */ }
  }, [property.id]);

  useEffect(() => {
    loadDiscrepancies();
  }, [loadDiscrepancies]);

  const handleReviewDiscrepancy = async (discId: string, status: 'accepted'|'rejected'|'deferred', rationale: string) => {
    setDiscrepancies(prev => prev.map(d => d.id === discId ? { ...d, status, reviewRationale: rationale } : d));
  };

  return <><div className="detail-back"><button className="text-btn" onClick={onBack}><ArrowDownRight size={15} className="back-icon"/> All properties</button><span>/</span><span>Property workspace</span></div><div className="property-title-row"><div><div className="eyebrow">PROPERTY INTELLIGENCE / CASE FILE</div><h1>{property.name}</h1><p><MapPin size={15}/>{[property.village,property.taluk,property.district].filter(Boolean).join(' · ')||'Location not recorded'} <span className="dot-sep">•</span><span className="mono">Survey {property.survey_number||'not recorded'}</span></p></div><div className="title-actions"><button className="secondary-btn" onClick={onReport} disabled={busy}><Download size={15}/> Export JSON</button><button className="secondary-btn" onClick={onPrint} disabled={busy}><FileText size={15}/> Print / PDF</button><button className="primary-btn" onClick={onAnalyze} disabled={busy}><Sparkles size={16}/> Run screening</button></div></div>
    <div className="property-summary-strip"><div className="summary-avatar">{initials(property.name)}</div><div className="summary-meta"><span>WORKSPACE ID</span><strong className="mono">{property.id.slice(0,8).toUpperCase()}</strong></div><div className="summary-meta"><span>SURVEY NUMBER</span><strong>{property.survey_number||'Not recorded'}</strong></div><div className="summary-meta"><span>EXTENT</span><strong>{property.extent||'Not recorded'}</strong></div><div className="summary-meta"><span>SOURCE DOCUMENTS</span><strong>{docs.length} files</strong></div><div className="summary-status"><StatusPill status={property.status}/></div></div>
    <div className="tabs"><button className={tab==='summary'?'selected':''} onClick={()=>setTab('summary')}><Gauge size={16}/> Overview</button><button className={tab==='documents'?'selected':''} onClick={()=>setTab('documents')}><FileText size={16}/> Case Evidence <span>{docs.length}</span></button><button className={tab==='title-chain'?'selected':''} onClick={()=>setTab('title-chain')}><GitMerge size={16}/> Title Chain</button><button className={tab==='map'?'selected':''} onClick={()=>setTab('map')}><Layers3 size={16}/> GIS & Maps</button><button className={tab==='discrepancies'?'selected':''} onClick={()=>setTab('discrepancies')}><Scale size={16}/> Discrepancies {discrepancies.length > 0 && <span>{discrepancies.length}</span>}</button><button className={tab==='report'?'selected':''} onClick={()=>setTab('report')}><FileText size={16}/> Due Diligence Report</button><button className={tab==='findings'?'selected':''} onClick={()=>setTab('findings')}><ShieldAlert size={16}/> Findings <span>{findings.length}</span></button></div>
    {tab==='summary'&&<div className="detail-grid"><div className="detail-main-col"><section className="panel"><div className="panel-head"><div><h3>Property identity</h3><p>Entered property details. Verify against primary documents.</p></div><Building2 size={18} className="panel-head-icon"/></div><div className="identity-grid"><InfoField label="Property / project name" value={property.name}/><InfoField label="Survey number / subdivision" value={[property.survey_number,property.subdivision].filter(Boolean).join(' / ')}/><InfoField label="Village" value={property.village}/><InfoField label="Hobli" value={property.hobli}/><InfoField label="Taluk" value={property.taluk}/><InfoField label="District" value={property.district}/><InfoField label="Extent" value={property.extent}/><InfoField label="Address / directions" value={property.address}/></div>{property.notes&&<div className="notes-block"><span>WORKSPACE NOTES</span><p>{property.notes}</p></div>}</section><section className="panel"><div className="panel-head"><div><h3>Evidence readiness</h3><p>Missing evidence is a workflow task, not proof of a defect.</p></div><button className="text-btn" onClick={()=>setTab('documents')}>Manage documents <ArrowUpRight size={14}/></button></div><div className="evidence-rows"><EvidenceRow icon={<FileCheck2 size={17}/>} label="Source documents" detail={docs.length?`${docs.length} file(s) uploaded`:'No documents uploaded'} complete={docs.length>0}/><EvidenceRow icon={<MapPin size={17}/>} label="Map location" detail={property.latitude!==null&&property.longitude!==null?`${property.latitude}, ${property.longitude}`:'Coordinates not recorded'} complete={property.latitude!==null&&property.longitude!==null}/><EvidenceRow icon={<ShieldCheck size={17}/>} label="Professional review" detail="Required before relying on conclusions" complete={false}/></div></section></div><div className="detail-side-col"><section className="panel risk-card"><div className="panel-head"><div><h3>Preliminary screening</h3><p>Completeness and imported-layer checks</p></div><div className="metric-icon amber"><Gauge size={18}/></div></div>{riskSummary?<><div className="risk-score"><div className={`score-circle ${riskSummary.score>=70?'high':riskSummary.score>=35?'medium':'low'}`}><strong>{riskSummary.score}</strong><span>/ 100</span></div><div><span className="risk-label">SCREENING BAND</span><strong className="risk-band">{pretty(riskSummary.band)}</strong><p>{riskSummary.findingCount} findings generated</p></div></div><div className="risk-legend"><span><i className="legend-red"/> High attention</span><span><i className="legend-amber"/> Review required</span><span><i className="legend-green"/> Preliminary</span></div><p className="small-disclaimer">{riskSummary.disclaimer}</p></>:<div className="screening-empty"><div className="screening-art"><ShieldCheck size={27}/><Sparkles size={14}/></div><strong>No screening run yet</strong><p>Run the initial checks to identify missing identity fields, source documents and map coordinates.</p><button className="primary-btn full-btn" onClick={onAnalyze} disabled={busy}><Sparkles size={15}/> Run preliminary screening</button></div>}</section><section className="panel source-panel"><div className="panel-head"><div><h3>Data source status</h3><p>Integration readiness</p></div><ExternalLink size={16} className="panel-head-icon"/></div><SourceStatus label="Government record lookups" status="Not connected" tone="grey"/><SourceStatus label="Imported spatial datasets" status="Demo only" tone="amber"/><SourceStatus label="Document OCR" status="Not enabled" tone="grey"/><SourceStatus label="AI extraction" status="Not enabled" tone="grey"/></section></div></div>}
    {tab==='documents'&&<div className="panel documents-panel"><input ref={documentInput} id="document-upload-fallback" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" className="visually-hidden-input" onChange={e=>{onUpload(e.target.files);e.currentTarget.value=''}}/><div className="panel-head"><div><h3>Source documents</h3><p>Original files, checksums and processing status with side-by-side verification review.</p></div><label className="primary-btn upload-btn"><Upload size={15}/> Upload files<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" onChange={e=>{onUpload(e.target.files);e.currentTarget.value=''}}/></label></div><div className="upload-drop"><CloudUpload size={25}/><strong>Upload property evidence</strong><p>PDF, JPG, PNG or TIFF · Maximum 25 MB per file · Up to 10 files per upload</p><label className="secondary-btn">Choose files<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" onChange={e=>{onUpload(e.target.files);e.currentTarget.value=''}}/></label></div>{docs.length>0?<div className="document-list">{docs.map(d=><div className="document-row" key={d.id}><div className="doc-icon"><FileText size={18}/></div><div className="doc-main"><strong>{d.original_filename}</strong><span>{d.mime_type} · {formatBytes(d.size_bytes)} · Added {dateLabel(d.created_at)}</span></div>{d.doc_type&&<span className={`doc-type-pill ${d.doc_type}`}>{pretty(d.doc_type)}</span>}<span className={`status-pill ${d.processing_status==='completed'?'green':'amber'}`}><i/>{pretty(d.processing_status)}</span><span className="checksum" title="SHA-256 checksum">SHA-256 recorded</span><button className="secondary-btn review-doc-btn" onClick={()=>setReviewingDoc(d)}><Eye size={14}/> Review Document</button></div>)}</div>:<EmptyState title="No documents uploaded" text="Upload available sale deeds, RTC, mutation extracts, khata, EC, survey sketches or approvals." action="Choose files" onAction={()=>documentInput.current?.click()}/>}<p className="data-warning"><AlertTriangle size={15}/> Uploaded files are stored locally in development. Configure private Cloud Storage and OCR before production use. Do not upload sensitive client documents to an unsecured environment.</p></div>}
    {tab==='title-chain'&&<TitleChainTimeline propertyId={property.id} />}
    {tab==='map'&&<MapViewer property={property} onGeometryUpdated={() => onAnalyze()} />}
    {tab==='discrepancies'&&<DiscrepancyMatrix propertyId={property.id} discrepancies={discrepancies} riskSummary={discRiskSummary} onRefresh={loadDiscrepancies} onReview={handleReviewDiscrepancy} />}
    {tab==='report'&&<ReportViewer property={property} apiUrl={API} onSnapshotCreated={() => { loadDiscrepancies(); onAnalyze(); }} />}
    {tab==='findings'&&<div className="panel findings-panel"><div className="panel-head"><div><h3>Review findings</h3><p>Each finding includes its evidence status and recommended next action.</p></div><button className="primary-btn" onClick={onAnalyze} disabled={busy}><Sparkles size={15}/> Re-run screening</button></div>{findings.length===0?<EmptyState title="No findings yet" text="Run preliminary screening to check missing identity fields, documents and map location." action="Run screening" onAction={onAnalyze}/>:<div className="finding-list">{findings.map((f,i)=><div className="finding-row" key={`${f.code}-${i}`}><div className={`finding-icon ${f.severity}`}><AlertTriangle size={17}/></div><div className="finding-body"><div className="finding-title-row"><strong>{f.title}</strong><span className={`severity ${f.severity}`}>{pretty(f.severity)}</span><span className={`evidence-status ${f.evidence_status}`}>{pretty(f.evidence_status)} evidence</span></div><p>{f.explanation}</p><div className="next-action"><span>NEXT ACTION</span>{f.next_action}</div></div></div>)}</div>}<div className="report-notice"><ShieldCheck size={17}/><span>Findings are preliminary prompts for investigation, not determinations of ownership, illegality, encroachment, or transaction safety.</span></div></div>}
    {reviewingDoc && (
      <SideBySideReview
        propertyId={property.id}
        doc={reviewingDoc as PropertyDoc}
        onClose={() => setReviewingDoc(null)}
        onDocumentUpdated={(updated) => {
          setReviewingDoc(updated as Doc);
          if (onDocUpdated) onDocUpdated(updated as Doc);
        }}
      />
    )}
  </>;
}
function InfoField({label,value}:{label:string;value?:string|null}){return <div className="info-field"><span>{label}</span><strong>{value||'Not recorded'}</strong></div>}
function EvidenceRow({icon,label,detail,complete}:{icon:ReactNode;label:string;detail:string;complete:boolean}){return <div className="evidence-row"><div className={`evidence-icon ${complete?'complete':''}`}>{icon}</div><div><strong>{label}</strong><span>{detail}</span></div><span className={`evidence-state ${complete?'complete':''}`}>{complete?'Added':'Pending'}</span></div>}
function SourceStatus({label,status,tone}:{label:string;status:string;tone:string}){return <div className="source-status"><span>{label}</span><span className={`source-state ${tone}`}><i/>{status}</span></div>}
function formatBytes(n:number){if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}

function PropertyMap({property}:{property:Property}){
  const container = useRef<HTMLDivElement>(null); const map = useRef<MapLibreMap|null>(null); const [mapError,setMapError]=useState('');
  useEffect(()=>{
    if(!container.current||map.current)return;
    try{
      const center: [number,number] = property.longitude!==null&&property.latitude!==null?[property.longitude,property.latitude]:[77.5946,12.9716];
      const m = new maplibregl.Map({container:container.current,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]},center,zoom:property.longitude!==null?14:10});
      map.current=m;
      if(property.longitude!==null&&property.latitude!==null){new maplibregl.Marker({color:'#d84b42'}).setLngLat([property.longitude,property.latitude]).setPopup(new maplibregl.Popup().setHTML(`<strong>${escapeHtml(property.name)}</strong><br/>Entered point · not a surveyed boundary`)).addTo(m);}
      m.on('load', async ()=>{
        try {
          const geojson = await api<any>('/api/map/layers');
          m.addSource('ojix-imported-layers', { type: 'geojson', data: geojson });
          m.addLayer({ id: 'ojix-demo-polygons', type: 'fill', source: 'ojix-imported-layers', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#d6a44b', 'fill-opacity': 0.16 } });
          m.addLayer({ id: 'ojix-demo-lines', type: 'line', source: 'ojix-imported-layers', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#c19a4e', 'line-width': 2, 'line-dasharray': [2,2] } });
          m.addLayer({ id: 'ojix-demo-points', type: 'circle', source: 'ojix-imported-layers', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#c19a4e', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
        } catch { /* The entered map point remains usable when the layer endpoint is unavailable. */ }
      });
      m.on('error',()=>setMapError('Map tiles could not be loaded. Check internet access or configure a permitted tile provider.'));
      return ()=>{m.remove();map.current=null;};
    }catch{setMapError('Map could not be initialised.');}
  },[property.id]);
  return <div className="map-container"><div ref={container} className="map-canvas"/>{property.longitude===null&&<div className="map-empty-overlay"><MapPin size={23}/><strong>No property coordinates</strong><span>Showing Bengaluru as a general reference only.</span></div>}{mapError&&<div className="map-error">{mapError}</div>}<div className="map-credit">Map data © OpenStreetMap contributors</div></div>;
}
function escapeHtml(text:string){return text.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}

function CreatePropertyModal({onClose,onSubmit,busy}:{onClose:()=>void;onSubmit:(form:Record<string,any>)=>void;busy:boolean}){
  const [form,setForm]=useState({name:'',village:'',hobli:'',taluk:'',district:'Bengaluru Urban',surveyNumber:'',subdivision:'',extent:'',address:'',latitude:'',longitude:'',notes:''});
  const change=(key:string,value:string)=>setForm(p=>({...p,[key]:value}));
  const submit=(e:FormEvent)=>{e.preventDefault();onSubmit({...form,latitude:form.latitude.trim()?Number(form.latitude):null,longitude:form.longitude.trim()?Number(form.longitude):null});};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-header"><div><div className="eyebrow">NEW CASE FILE</div><h2>Create property workspace</h2><p>Enter what is known. Missing fields can be completed later.</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div><form onSubmit={submit}><div className="form-grid"><label className="form-field span-2"><span>Property / project name <b>*</b></span><input required minLength={2} maxLength={160} value={form.name} onChange={e=>change('name',e.target.value)} placeholder="e.g. Arakere property due diligence"/></label><label className="form-field"><span>Village</span><input value={form.village} onChange={e=>change('village',e.target.value)} placeholder="Village name"/></label><label className="form-field"><span>Hobli</span><input value={form.hobli} onChange={e=>change('hobli',e.target.value)} placeholder="Hobli"/></label><label className="form-field"><span>Taluk</span><input value={form.taluk} onChange={e=>change('taluk',e.target.value)} placeholder="Taluk"/></label><label className="form-field"><span>District</span><input value={form.district} onChange={e=>change('district',e.target.value)} placeholder="District"/></label><label className="form-field"><span>Survey number</span><input value={form.surveyNumber} onChange={e=>change('surveyNumber',e.target.value)} placeholder="Survey / Sy. No."/></label><label className="form-field"><span>Subdivision / hissa</span><input value={form.subdivision} onChange={e=>change('subdivision',e.target.value)} placeholder="Subdivision"/></label><label className="form-field"><span>Extent (as stated)</span><input value={form.extent} onChange={e=>change('extent',e.target.value)} placeholder="e.g. 30 guntas (unverified)"/></label><label className="form-field"><span>Latitude (optional)</span><input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e=>change('latitude',e.target.value)} placeholder="12.9716"/></label><label className="form-field"><span>Longitude (optional)</span><input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e=>change('longitude',e.target.value)} placeholder="77.5946"/></label><label className="form-field span-2"><span>Address / directions</span><input value={form.address} onChange={e=>change('address',e.target.value)} placeholder="Address or nearby landmark"/></label><label className="form-field span-2"><span>Initial notes</span><textarea rows={3} value={form.notes} onChange={e=>change('notes',e.target.value)} placeholder="Transaction context, documents expected, questions for reviewer…"/></label></div><div className="form-note"><ShieldCheck size={16}/><span>Coordinates are a map reference only. Entered details are not independently verified.</span></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn" disabled={busy}><Plus size={16}/> Create workspace</button></div></form></div></div>;
}
