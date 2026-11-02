import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Building2, Check, ChevronRight,
  CircleGauge, Database, FileText, Key, LayoutDashboard, LoaderCircle,
  LockKeyhole, Mail, RefreshCw, Search, Server, ShieldAlert, ShieldCheck,
  Users, X,
} from 'lucide-react';
import { authFetch } from '../authFetch';

type Section = 'overview' | 'organizations' | 'members' | 'sessions' | 'audit';
type AdminAction =
  | { kind: 'role'; member: any }
  | { kind: 'status'; member: any; status: 'active' | 'disabled' }
  | { kind: 'revoke'; session: any };

const sections: Array<[Section, string, any]> = [
  ['overview', 'Overview', LayoutDashboard],
  ['organizations', 'Organizations', Building2],
  ['members', 'Members', Users],
  ['sessions', 'Sessions', Server],
  ['audit', 'Audit log', FileText],
];
const assignableRoles = ['owner', 'admin', 'lawyer', 'analyst', 'operations', 'consultant', 'support', 'data_steward', 'viewer'] as const;
const pretty = (value?: string) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '—';
const date = (value?: string) => value ? new Date(value).toLocaleString('en-IN') : '—';

async function request<T>(apiUrl: string, path: string, init?: RequestInit) {
  const response = await authFetch(`${apiUrl}${path}`, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export function SuperAdminPage({ apiUrl }: { apiUrl: string }) {
  const [section, setSection] = useState<Section>('overview');
  const [data, setData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AdminAction | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const metrics = await request<any>(apiUrl, '/api/super-admin/overview');
      setOverview(metrics);
      const paths: Record<Section, string> = {
        overview: '/api/super-admin/overview', organizations: '/api/super-admin/organizations',
        members: '/api/super-admin/members', sessions: '/api/super-admin/sessions', audit: '/api/super-admin/audit',
      };
      if (section === 'overview') {
        const auditData = await request<any>(apiUrl, '/api/super-admin/audit?limit=100');
        setSecurityEvents((auditData.items || []).filter((event: any) => String(event.action).startsWith('auth.') || String(event.action).startsWith('super_admin.')));
        setData(metrics);
      } else setData(await request<any>(apiUrl, `${paths[section]}?page=${page}&limit=25&search=${encodeURIComponent(search)}`));
    } catch (loadError) { setError((loadError as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => void load(), search ? 250 : 0); return () => window.clearTimeout(timer); }, [section, page, search]);

  const mutate = async (path: string, method: string, body: any, success: string) => {
    setError(''); setNotice('');
    try {
      await request(apiUrl, path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setNotice(success); await load(); return true;
    } catch (mutationError) { setError((mutationError as Error).message); return false; }
  };
  const changeSection = (next: Section) => { setSection(next); setSearch(''); setPage(1); setNotice(''); };
  const rows = data?.items || [];

  return <div className="platform-console">
    <aside className="platform-rail">
      <div className="platform-brand"><strong>OJIX</strong><span>LEGAL<br />PROPERTY<br />INTELLIGENCE</span></div>
      <div className="platform-role"><ShieldCheck size={15} /> Super Admin</div>
      <nav>{sections.map(([id, label, Icon]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => changeSection(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <div className="platform-rail-footer"><span><i /> Platform operational</span><small>Cross-organization controls</small></div>
    </aside>
    <main className="platform-main">
      <header className="platform-topbar"><div><span>PLATFORM CONTROL CENTER</span><strong>{pretty(section)}</strong></div><div className="platform-top-actions"><span className="platform-status"><i /> Operational</span><button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={15} /> Refresh</button><span className="platform-avatar">SA</span></div></header>
      <div className="platform-content">
        {notice && <div className="admin-flash success"><Check size={15} />{notice}</div>}
        {error && <div className="admin-flash error"><AlertTriangle size={15} />{error}</div>}
        {loading ? <div className="platform-loading"><LoaderCircle className="spin" /> Loading platform data…</div> : <>
          {section === 'overview' && <PlatformOverview overview={overview} events={securityEvents} onNavigate={changeSection} />}
          {section === 'organizations' && <OrganizationsPanel rows={rows} search={search} setSearch={setSearch} page={page} total={Number(data?.total || 0)} setPage={setPage} />}
          {section === 'members' && <MembersPanel rows={rows} search={search} setSearch={setSearch} page={page} total={Number(data?.total || 0)} setPage={setPage} onAction={setAction} />}
          {section === 'sessions' && <SessionsPanel rows={rows} search={search} setSearch={setSearch} page={page} total={Number(data?.total || 0)} setPage={setPage} onAction={setAction} />}
          {section === 'audit' && <AuditPanel rows={rows} search={search} setSearch={setSearch} page={page} total={Number(data?.total || 0)} setPage={setPage} />}
        </>}
      </div>
    </main>
    {action && <ActionDialog action={action} onCancel={() => setAction(null)} onConfirm={async body => {
      const target = action.kind === 'revoke' ? `/api/super-admin/sessions/${action.session.id}` : `/api/super-admin/members/${action.member.id}`;
      const saved = await mutate(target, action.kind === 'revoke' ? 'DELETE' : 'PATCH', body, action.kind === 'revoke' ? 'Session revoked.' : 'Membership updated.');
      if (saved) setAction(null); return saved;
    }} />}
  </div>;
}

function PlatformOverview({ overview, events, onNavigate }: { overview: any; events: any[]; onNavigate: (section: Section) => void }) {
  const cards = [
    { label: 'Organizations', value: overview?.organizations?.total, detail: 'Platform workspaces', icon: Building2, tone: 'blue', target: 'organizations' as Section },
    { label: 'Active members', value: overview?.members?.active, detail: `${Number(overview?.members?.inactive || 0)} inactive`, icon: Users, tone: 'green', target: 'members' as Section },
    { label: 'Live sessions', value: overview?.sessions?.total, detail: 'Currently authenticated', icon: Server, tone: 'blue', target: 'sessions' as Section },
    { label: 'Security alerts', value: Number(overview?.findings?.critical || 0) + Number(overview?.findings?.high || 0), detail: 'Critical and high findings', icon: ShieldAlert, tone: 'red', target: 'audit' as Section },
  ];
  return <div className="platform-overview">
    <section className="platform-hero"><div><span>SUPER ADMIN</span><h1>Platform Control Center</h1><p>Monitor organizations, identities, active sessions and governance activity across OJIX.</p></div><div className="platform-hero-badge"><CircleGauge size={18} /><span><strong>Platform-wide visibility</strong><small>Protected administrative scope</small></span></div></section>
    <div className="platform-kpi-grid">{cards.map(card => <button key={card.label} className={`platform-kpi ${card.tone}`} onClick={() => onNavigate(card.target)}><span className="platform-kpi-icon"><card.icon /></span><span><small>{card.label}</small><strong>{Number(card.value || 0).toLocaleString()}</strong><em>{card.detail}</em></span><ChevronRight /></button>)}</div>
    <div className="platform-overview-grid"><div className="platform-overview-main"><HealthPanel overview={overview} /><InventoryChart overview={overview} /><SecurityEvents events={events} onViewAll={() => onNavigate('audit')} /></div><CriticalActions overview={overview} onNavigate={onNavigate} /></div>
  </div>;
}

function HealthPanel({ overview }: { overview: any }) {
  const connected = overview?.health?.database === 'connected';
  const services = [
    { label: 'API', status: 'Healthy', detail: 'Responding normally', icon: Server, state: 'healthy' },
    { label: 'Database', status: connected ? 'Healthy' : 'Unavailable', detail: connected ? 'MariaDB connected' : 'Connection not verified', icon: Database, state: connected ? 'healthy' : 'danger' },
    { label: 'Storage', status: 'Not reported', detail: 'Health metric pending', icon: FileText, state: 'unknown' },
    { label: 'Email', status: 'Not reported', detail: 'Delivery metric pending', icon: Mail, state: 'unknown' },
  ];
  return <section className="platform-panel platform-health"><PanelTitle icon={Activity} title="Platform Health" description="Live and explicitly unavailable service states"><Badge value={connected ? 'operational' : 'degraded'} /></PanelTitle><div className="platform-health-grid">{services.map(service => <article key={service.label}><service.icon /><div><strong>{service.label}</strong><span className={service.state}><i />{service.status}</span><small>{service.detail}</small></div></article>)}</div></section>;
}

function InventoryChart({ overview }: { overview: any }) {
  const entries = [['Organizations', Number(overview?.organizations?.total || 0), '#2d6cdf'], ['Members', Number(overview?.members?.total || 0), '#4aa3ff'], ['Applications', Number(overview?.properties?.total || 0), '#7259d6'], ['Documents', Number(overview?.documents?.total || 0), '#35a778']] as const;
  const max = Math.max(1, ...entries.map(entry => entry[1]));
  return <section className="platform-panel platform-inventory"><PanelTitle icon={BarChart3} title="Platform Inventory" description="Current records across the platform"><span className="platform-range">Current snapshot</span></PanelTitle><div className="platform-bar-chart">{entries.map(([label, value, color]) => <div key={label}><span>{label}</span><i><b style={{ width: `${Math.max(value ? 4 : 0, value / max * 100)}%`, background: color }} /></i><strong>{value.toLocaleString()}</strong></div>)}</div></section>;
}

function PanelTitle({ icon: Icon, title, description, children }: any) { return <header className="platform-panel-title"><div><Icon size={18} /><span><h2>{title}</h2><p>{description}</p></span></div>{children}</header>; }

function CriticalActions({ overview, onNavigate }: { overview: any; onNavigate: (section: Section) => void }) {
  const actions = [
    { label: 'Review organizations', detail: `${Number(overview?.organizations?.total || 0)} workspaces`, icon: Building2, tone: 'blue', target: 'organizations' as Section },
    { label: 'Manage member access', detail: `${Number(overview?.members?.inactive || 0)} inactive memberships`, icon: LockKeyhole, tone: 'amber', target: 'members' as Section },
    { label: 'Review live sessions', detail: `${Number(overview?.sessions?.total || 0)} sessions active`, icon: Server, tone: 'red', target: 'sessions' as Section },
    { label: 'Inspect audit trail', detail: 'Cross-organization events', icon: Key, tone: 'blue', target: 'audit' as Section },
  ];
  return <aside className="platform-panel platform-critical"><PanelTitle icon={AlertTriangle} title="Critical Actions" description="Protected administrative controls" /><div>{actions.map(item => <button key={item.label} className={item.tone} onClick={() => onNavigate(item.target)}><item.icon /><span><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight /></button>)}</div><footer><ShieldCheck size={15} /> Actions require authentication and are audited.</footer></aside>;
}

function SecurityEvents({ events, onViewAll }: { events: any[]; onViewAll: () => void }) {
  return <section className="platform-panel platform-events"><PanelTitle icon={ShieldCheck} title="Recent Security Events" description="Authentication and Super Admin activity"><button onClick={onViewAll}>View all</button></PanelTitle><div className="platform-event-table"><div className="head"><span>TIME</span><span>EVENT</span><span>ORGANIZATION</span><span>ACTOR</span><span>STATUS</span></div>{events.slice(0, 5).map(event => <div key={event.id}><span>{date(event.created_at)}</span><strong>{pretty(event.action)}</strong><span>{event.organization_name || 'Platform'}</span><span>{event.actor_uid}</span><Badge value="recorded" /></div>)}{!events.length && <EmptyState text="No recent security activity recorded." />}</div></section>;
}

function PanelHeader({ eyebrow, title, description, search, setSearch }: { eyebrow: string; title: string; description: string; search: string; setSearch: (value: string) => void }) { return <><div className="platform-section-heading"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div><label className="platform-search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records" /></label></>; }

function OrganizationsPanel({ rows, search, setSearch, page, total, setPage }: any) { return <section className="platform-data-page"><PanelHeader eyebrow="PLATFORM DIRECTORY" title="Organizations" description="Workspace size and membership status across the platform." search={search} setSearch={value => { setSearch(value); setPage(1); }} /><DataTable headings={['Organization', 'Slug', 'Members', 'Active', 'Applications', 'Created']} empty={!rows.length}>{rows.map((item: any) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.id}</small></td><td>{item.slug}</td><td>{item.member_count}</td><td><Badge value={Number(item.active_member_count) ? 'active' : 'inactive'} /> {item.active_member_count}</td><td>{item.property_count}</td><td>{date(item.created_at)}</td></tr>)}</DataTable><Pagination page={page} total={total} onPage={setPage} /></section>; }
function MembersPanel({ rows, search, setSearch, page, total, setPage, onAction }: any) { return <section className="platform-data-page"><PanelHeader eyebrow="IDENTITY GOVERNANCE" title="Members" description="Manage roles and access across every organization. All changes require an audit reason." search={search} setSearch={value => { setSearch(value); setPage(1); }} /><DataTable headings={['Member', 'Organization', 'Role', 'Status', 'Last login', 'Control']} empty={!rows.length}>{rows.map((member: any) => <tr key={member.id}><td><strong>{member.full_name || member.email || member.user_uid}</strong><small>{member.email || member.user_uid}</small></td><td>{member.organization_name}<small>{member.organization_id}</small></td><td><span className="platform-role-chip">{pretty(member.role)}</span></td><td><Badge value={member.status} /></td><td>{date(member.last_login_at)}</td><td><div className="platform-row-actions"><button onClick={() => onAction({ kind: 'role', member })}>Change role</button><button className={member.status === 'active' ? 'danger' : ''} onClick={() => onAction({ kind: 'status', member, status: member.status === 'active' ? 'disabled' : 'active' })}>{member.status === 'active' ? 'Disable' : 'Activate'}</button></div></td></tr>)}</DataTable><Pagination page={page} total={total} onPage={setPage} /></section>; }
function SessionsPanel({ rows, search, setSearch, page, total, setPage, onAction }: any) { return <section className="platform-data-page"><PanelHeader eyebrow="ACCESS SECURITY" title="Authentication Sessions" description="Inspect and revoke active sessions across all workspaces." search={search} setSearch={value => { setSearch(value); setPage(1); }} /><DataTable headings={['Account', 'Organization', 'Last activity', 'Expires', 'IP / device', 'Status', 'Action']} empty={!rows.length}>{rows.map((session: any) => { const active = !session.revoked_at && new Date(session.expires_at) > new Date(); return <tr key={session.id}><td><strong>{session.email || session.user_uid}</strong><small>{pretty(session.role)}</small></td><td>{session.organization_name || session.tenant_id}</td><td>{date(session.last_activity_at)}</td><td>{date(session.expires_at)}</td><td>{session.ip_address || '—'}<small>{session.user_agent || '—'}</small></td><td><Badge value={session.revoked_at ? 'revoked' : active ? 'active' : 'expired'} /></td><td>{active && <button className="platform-danger-button" onClick={() => onAction({ kind: 'revoke', session })}>Revoke</button>}</td></tr>; })}</DataTable><Pagination page={page} total={total} onPage={setPage} /></section>; }
function AuditPanel({ rows, search, setSearch, page, total, setPage }: any) { return <section className="platform-data-page"><PanelHeader eyebrow="GOVERNANCE RECORD" title="Audit Log" description="Search cross-organization actions by actor, event, entity or workspace." search={search} setSearch={value => { setSearch(value); setPage(1); }} /><DataTable headings={['Time', 'Organization', 'Actor', 'Action', 'Entity', 'Details']} empty={!rows.length}>{rows.map((event: any) => <tr key={event.id}><td>{date(event.created_at)}</td><td>{event.organization_name || 'Platform'}</td><td><span className="platform-actor">{event.actor_uid}</span></td><td><strong>{pretty(event.action)}</strong></td><td>{pretty(event.entity_type)}<small>{event.entity_id}</small></td><td><code>{JSON.stringify(event.details || {}).slice(0, 180)}</code></td></tr>)}</DataTable><Pagination page={page} total={total} onPage={setPage} /></section>; }

function DataTable({ headings, children, empty }: any) { return <div className="platform-table-wrap"><table><thead><tr>{headings.map((heading: string) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table>{empty && <EmptyState text="No matching records found." />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="platform-empty"><Search /> {text}</div>; }
function Badge({ value }: { value?: string }) { const state = ['active', 'healthy', 'operational', 'recorded'].includes(value || '') ? 'success' : ['revoked', 'degraded', 'disabled'].includes(value || '') ? 'danger' : 'warning'; return <span className={`platform-badge ${state}`}><i />{pretty(value)}</span>; }
function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / 25)); if (pages <= 1) return null; return <div className="platform-pagination"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages} · {total} records</span><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>; }

function ActionDialog({ action, onCancel, onConfirm }: { action: AdminAction; onCancel: () => void; onConfirm: (body: any) => Promise<boolean> }) {
  const [reason, setReason] = useState(''); const [role, setRole] = useState(action.kind === 'role' ? action.member.role : ''); const [saving, setSaving] = useState(false);
  const subject = action.kind === 'revoke' ? (action.session.email || action.session.user_uid) : (action.member.full_name || action.member.email || action.member.user_uid);
  const destructive = action.kind === 'revoke' || (action.kind === 'status' && action.status === 'disabled');
  const submit = async (event: FormEvent) => { event.preventDefault(); if (reason.trim().length < 3) return; setSaving(true); try { await onConfirm(action.kind === 'role' ? { role, reason: reason.trim() } : action.kind === 'status' ? { status: action.status, reason: reason.trim() } : { reason: reason.trim() }); } finally { setSaving(false); } };
  return <div className="platform-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}><form className="platform-dialog" role="dialog" aria-modal="true" onSubmit={submit}><header><span className={destructive ? 'danger' : ''}>{destructive ? <ShieldAlert /> : <ShieldCheck />}</span><button type="button" onClick={onCancel} aria-label="Close dialog"><X /></button></header><div><span className="platform-dialog-label">PROTECTED ACTION</span><h2>{action.kind === 'role' ? 'Change member role' : action.kind === 'status' ? `${action.status === 'active' ? 'Activate' : 'Disable'} membership` : 'Revoke session'}</h2><p>Target: <strong>{subject}</strong></p></div>{action.kind === 'role' && <label>New role<select value={role} onChange={event => setRole(event.target.value)}>{assignableRoles.map(item => <option key={item} value={item}>{pretty(item)}</option>)}</select></label>}<label>Audit reason<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} required placeholder="Explain why this action is required" /></label>{action.kind === 'role' && role === 'owner' && <div className="platform-dialog-warning"><AlertTriangle />Owner grants workspace-wide governance access.</div>}<footer><button type="button" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className={destructive ? 'danger' : 'primary'} disabled={saving || reason.trim().length < 3}>{saving ? 'Saving…' : 'Confirm action'}</button></footer></form></div>;
}
