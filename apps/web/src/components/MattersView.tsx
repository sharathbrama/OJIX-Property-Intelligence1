import React, { useState, useEffect } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Link as LinkIcon,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
  X,
  ArrowRight,
  ExternalLink,
  Activity,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { authFetch } from '../authFetch';

export interface Matter {
  id: string;
  tenant_id: string;
  matter_number: string;
  title: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  review_purpose?: string;
  status: 'open' | 'in_review' | 'ready_for_signoff' | 'closed' | 'archived';
  priority: 'normal' | 'high' | 'urgent' | 'critical';
  due_date?: string;
  notes?: string;
  property_count?: number;
  assigned_lawyer_uid?: string;
  assigned_analyst_uid?: string;
  assigned_operations_uid?: string;
  assigned_consultant_uid?: string;
  created_at: string;
  updated_at: string;
}

export interface MattersViewProps {
  apiUrl: string;
  currentUser: any;
  onOpenProperty?: (propertyId: string) => void;
  onNavigate?: (page: any) => void;
}

export function MattersView({ apiUrl, currentUser, onOpenProperty }: MattersViewProps) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [matterProperties, setMatterProperties] = useState<any[]>([]);
  const [matterAudit, setMatterAudit] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'audit' | 'details'>('properties');

  // New Matter Form State
  const [formTitle, setFormTitle] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPurpose, setFormPurpose] = useState('Acquisition Legal Due Diligence');
  const [formPriority, setFormPriority] = useState<'normal' | 'high' | 'urgent' | 'critical'>('high');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canCreate = ['owner', 'admin', 'super_admin'].includes(currentUser?.role);

  useEffect(() => {
    fetchMatters();
  }, [statusFilter, priorityFilter]);

  async function fetchMatters() {
    setLoading(true);
    try {
      let url = `${apiUrl}/api/matters?`;
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (priorityFilter !== 'all') url += `priority=${priorityFilter}&`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setMatters(data.matters || []);
      }
    } catch (e) {
      console.error('Failed to load matters', e);
    } finally {
      setLoading(false);
    }
  }

  async function openMatterDetails(matter: Matter) {
    setSelectedMatter(matter);
    setDetailLoading(true);
    setActiveTab('properties');
    try {
      const [detailRes, auditRes] = await Promise.all([
        authFetch(`${apiUrl}/api/matters/${matter.id}`),
        authFetch(`${apiUrl}/api/matters/${matter.id}/audit`),
      ]);
      if (detailRes.ok) {
        const d = await detailRes.json();
        setMatterProperties(d.properties || []);
      }
      if (auditRes.ok) {
        const a = await auditRes.json();
        setMatterAudit(a.events || []);
      }
    } catch (e) {
      console.error('Failed to fetch matter detail', e);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!selectedMatter) return;
    try {
      const res = await authFetch(`${apiUrl}/api/matters/${selectedMatter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = { ...selectedMatter, status: newStatus as any };
        setSelectedMatter(updated);
        setMatters(prev => prev.map(m => m.id === updated.id ? updated : m));
        // Reload audit
        const auditRes = await authFetch(`${apiUrl}/api/matters/${selectedMatter.id}/audit`);
        if (auditRes.ok) {
          const a = await auditRes.json();
          setMatterAudit(a.events || []);
        }
      }
    } catch (e) {
      console.error('Failed to update matter status', e);
    }
  }

  async function handleCreateMatter(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formClient.trim()) {
      setErrorMessage('Matter Title and Client Name are required.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await authFetch(`${apiUrl}/api/matters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          client_name: formClient.trim(),
          client_email: formEmail.trim() || undefined,
          client_phone: formPhone.trim() || undefined,
          review_purpose: formPurpose,
          priority: formPriority,
          due_date: formDueDate || undefined,
          notes: formNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create matter.');
      }
      setShowCreateModal(false);
      setFormTitle('');
      setFormClient('');
      setFormEmail('');
      setFormPhone('');
      setFormNotes('');
      await fetchMatters();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating matter');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredMatters = matters.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.matter_number.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      m.client_name.toLowerCase().includes(q) ||
      (m.review_purpose && m.review_purpose.toLowerCase().includes(q))
    );
  });

  const activeCount = matters.filter(m => ['open', 'in_review', 'ready_for_signoff'].includes(m.status)).length;
  const criticalCount = matters.filter(m => ['critical', 'urgent'].includes(m.priority)).length;
  const closedCount = matters.filter(m => m.status === 'closed').length;

  return (
    <div className="matters-container" style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <BriefcaseBusiness size={15} />
            <span>FRD §5 / §7 • CLIENT MATTERS & ENGAGEMENTS WORKSPACE</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Client Matters Workspace</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Manage client-centric due diligence engagements, linked land parcels, multi-property portfolios, and advocate review milestones.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
            }}
          >
            <Plus size={16} /> New Client Matter
          </button>
        )}
      </div>

      {/* KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>TOTAL ACTIVE MATTERS</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>In progress across workspace</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>HIGH / CRITICAL PRIORITY</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{criticalCount}</div>
          <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Immediate due diligence focus</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>READY FOR ADVOCATE SIGN-OFF</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
            {matters.filter(m => m.status === 'ready_for_signoff').length}
          </div>
          <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>Awaiting Lead Advocate review</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>COMPLETED & RELEASED</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginTop: 4 }}>{closedCount}</div>
          <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Released to client / archived</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', background: '#fff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by Matter ID (e.g. OJIX-M-2026-001), Title, Client Name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In Review</option>
          <option value="ready_for_signoff">Ready for Sign-Off</option>
          <option value="closed">Closed / Released</option>
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      {/* Matters Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          Loading matters workspace…
        </div>
      ) : filteredMatters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <BriefcaseBusiness size={42} style={{ color: '#cbd5e1', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: '#334155' }}>No Matters Found</h3>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px 0' }}>
            {search ? 'Try adjusting your search criteria.' : 'Create your first client engagement matter to organize properties.'}
          </p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 6,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Plus size={15} /> Create First Matter
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Matter Ref</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Client & Engagement Title</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Review Purpose</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Priority</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Properties</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Due Date</th>
                <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatters.map(m => {
                const isOverdue = m.due_date && new Date(m.due_date) < new Date() && m.status !== 'closed';
                return (
                  <tr
                    key={m.id}
                    onClick={() => openMatterDetails(m)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                      {m.matter_number}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Client: {m.client_name}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#475569', fontSize: 13 }}>
                      {m.review_purpose || 'Due Diligence'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: m.priority === 'critical' ? '#fee2e2' : m.priority === 'urgent' ? '#ffedd5' : m.priority === 'high' ? '#fef3c7' : '#f1f5f9',
                        color: m.priority === 'critical' ? '#991b1b' : m.priority === 'urgent' ? '#9a3412' : m.priority === 'high' ? '#92400e' : '#475569',
                      }}>
                        {m.priority}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: m.status === 'closed' ? '#d1fae5' : m.status === 'ready_for_signoff' ? '#fef3c7' : m.status === 'in_review' ? '#dbeafe' : '#f1f5f9',
                        color: m.status === 'closed' ? '#065f46' : m.status === 'ready_for_signoff' ? '#92400e' : m.status === 'in_review' ? '#1e40af' : '#475569',
                      }}>
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#334155' }}>
                        <Building2 size={14} style={{ color: '#64748b' }} />
                        {m.property_count || 0}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 13, color: isOverdue ? '#dc2626' : '#64748b' }}>
                      {m.due_date ? new Date(m.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {isOverdue && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#ef4444' }}>OVERDUE</span>}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openMatterDetails(m); }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: '#334155',
                        }}
                      >
                        Inspect <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Matter Detail Drawer / Modal */}
      {selectedMatter && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <div style={{
            background: '#fff',
            width: '100%',
            maxWidth: 680,
            height: '100%',
            boxShadow: '-4px 0 25px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                    {selectedMatter.matter_number}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    background: selectedMatter.status === 'closed' ? '#d1fae5' : '#dbeafe',
                    color: selectedMatter.status === 'closed' ? '#065f46' : '#1e40af',
                    textTransform: 'uppercase',
                  }}>
                    {selectedMatter.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a' }}>
                  {selectedMatter.title}
                </h2>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Client: <strong>{selectedMatter.client_name}</strong> {selectedMatter.client_email ? `(${selectedMatter.client_email})` : ''}
                </div>
              </div>

              <button
                onClick={() => setSelectedMatter(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Transition Control for Owner/Admin */}
            {canCreate && (
              <div style={{ padding: '12px 24px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>Update Engagement Status:</span>
                <select
                  value={selectedMatter.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #93c5fd', fontSize: 12, fontWeight: 600, background: '#fff', color: '#1e3a8a' }}
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="ready_for_signoff">Ready for Sign-Off</option>
                  <option value="closed">Closed / Released</option>
                </select>
              </div>
            )}

            {/* Drawer Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
              <button
                onClick={() => setActiveTab('properties')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'properties' ? '2px solid #2563eb' : 'none',
                  color: activeTab === 'properties' ? '#2563eb' : '#64748b',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Building2 size={15} /> Linked Properties ({matterProperties.length})
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'audit' ? '2px solid #2563eb' : 'none',
                  color: activeTab === 'audit' ? '#2563eb' : '#64748b',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Activity size={15} /> Lifecycle Audit ({matterAudit.length})
              </button>
              <button
                onClick={() => setActiveTab('details')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'details' ? '2px solid #2563eb' : 'none',
                  color: activeTab === 'details' ? '#2563eb' : '#64748b',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <FolderOpen size={15} /> Engagement Info
              </button>
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading matter file…</div>
              ) : activeTab === 'properties' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Properties in this Matter</h3>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Multi-parcel due diligence</span>
                  </div>

                  {matterProperties.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                      <Building2 size={32} style={{ color: '#94a3b8', marginBottom: 8 }} />
                      <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>No properties linked to this matter yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {matterProperties.map(p => (
                        <div
                          key={p.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: 16,
                            background: '#fff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{p.name}</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                              Sy. No: <strong>{p.survey_number || 'N/A'}</strong> {p.subdivision ? `/ Hissa ${p.subdivision}` : ''} • Village: {p.village || 'N/A'}
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                              Extent: {p.extent || 'N/A'} • Status: <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{p.status}</span>
                            </div>
                          </div>

                          {onOpenProperty && (
                            <button
                              onClick={() => {
                                setSelectedMatter(null);
                                onOpenProperty(p.id);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                borderRadius: 6,
                                background: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer',
                              }}
                            >
                              Open Dossier <ExternalLink size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'audit' ? (
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Activity & Audit Trail</h3>
                  {matterAudit.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>No audit entries recorded yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {matterAudit.map((e, idx) => (
                        <div key={e.id || idx} style={{ borderLeft: '3px solid #2563eb', paddingLeft: 12, paddingBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{e.action}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {e.created_at ? new Date(e.created_at).toLocaleString('en-IN') : 'Just now'} • Actor: {e.actor_uid}
                          </div>
                          {e.details && (
                            <div style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, marginTop: 4, fontFamily: 'monospace' }}>
                              {typeof e.details === 'string' ? e.details : JSON.stringify(e.details)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Engagement File Metadata</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px 16px', fontSize: 14 }}>
                    <div style={{ color: '#64748b', fontWeight: 600 }}>Matter Number:</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedMatter.matter_number}</div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>Client Name:</div>
                    <div style={{ fontWeight: 600 }}>{selectedMatter.client_name}</div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>Client Email:</div>
                    <div>{selectedMatter.client_email || 'Not recorded'}</div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>Client Phone:</div>
                    <div>{selectedMatter.client_phone || 'Not recorded'}</div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>Review Purpose:</div>
                    <div>{selectedMatter.review_purpose || 'General Non-Litigation Due Diligence'}</div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>Due Date:</div>
                    <div>{selectedMatter.due_date ? new Date(selectedMatter.due_date).toLocaleDateString('en-IN') : 'Not set'}</div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>Intake Notes:</div>
                    <div style={{ color: '#334155' }}>{selectedMatter.notes || 'No specific intake notes.'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Matter Intake Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 580,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            <div style={{ background: '#0f172a', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Initiate New Client Matter</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>FRD §5 / §6.2 MAT-01 Matter Intake</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMatter} style={{ padding: 24 }}>
              {errorMessage && (
                <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  {errorMessage}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    Matter Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Legal Due Diligence for Sy. 45/2 Bellandur"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Keerthana Enterprises"
                      value={formClient}
                      onChange={e => setFormClient(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                      Client Email
                    </label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                      Review Purpose
                    </label>
                    <select
                      value={formPurpose}
                      onChange={e => setFormPurpose(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                    >
                      <option value="Acquisition Legal Due Diligence">Acquisition Legal Due Diligence</option>
                      <option value="Bank Mortgage Title Verification">Bank Mortgage Title Verification</option>
                      <option value="Agricultural Land Conversion Sec 95">Agricultural Land Conversion Sec 95</option>
                      <option value="BDA Layout & RMP Compliance Check">BDA Layout & RMP Compliance Check</option>
                      <option value="Partition & Family Settlement Audit">Partition & Family Settlement Audit</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                      Priority
                    </label>
                    <select
                      value={formPriority}
                      onChange={e => setFormPriority(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                    Intake Notes & Context
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide any background, preliminary deed numbers, or client instructions..."
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Creating…' : 'Create Matter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
