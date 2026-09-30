import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  AlertCircle,
  X,
  FileCheck,
  Scale,
  Calendar,
  Layers,
  HelpCircle,
  Check
} from 'lucide-react';

export interface TitleEventParty {
  name: string;
  normalizedName: string;
}

export interface TitleEvent {
  id: string;
  propertyId: string;
  documentId: string;
  sequenceOrder: number;
  eventDate: string;
  registrationDate?: string;
  deedType: string;
  fromParties: TitleEventParty[];
  toParties: TitleEventParty[];
  extentSqFt: number;
  extentRaw: string;
  consideration: number;
  status: 'verified' | 'unverified' | 'disputed';
  disputeRationale?: string;
  reviewedBy?: string;
  encumbranceStatus?: 'active_mortgage' | 'discharged' | 'none';
}

export interface TitleGap {
  code:
    | 'TITLE_GAP_MISSING_PREDECESSOR'
    | 'TITLE_GAP_CHRONOLOGICAL_INVERSION'
    | 'TITLE_GAP_EXTENT_OVERCONVEYANCE'
    | 'TITLE_UNRELEASED_ENCUMBRANCE'
    | 'TITLE_REGISTRATION_DELAY_EXCEEDED';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  sourceEventIds: string[];
  points?: number;
}

export interface TitleChainTimelineProps {
  propertyId: string;
  initialEvents?: TitleEvent[];
  onChainUpdated?: () => void;
}

const API = (typeof import.meta.env.VITE_API_URL !== 'undefined' ? import.meta.env.VITE_API_URL : (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:4000' : ''));

const STANDARD_DISPUTE_TEMPLATES = [
  {
    code: 'MISSING_LINK_DOC',
    label: 'Missing Preceding Link Deed',
    rationale: 'MISSING_LINK_DOC: Recital references prior acquisition deed that is not registered or uploaded in the 30-year search index.',
  },
  {
    code: 'SUSPICIOUS_POA',
    label: 'Unverified / Suspicious Power of Attorney',
    rationale: 'SUSPICIOUS_POA: GPA not registered or executed without verified principal confirmation under Karnataka Stamp Act.',
  },
  {
    code: 'PENDING_LITIGATION',
    label: 'Pending Court Litigation',
    rationale: 'PENDING_LITIGATION: Property subject to active civil dispute in City Civil Court under Section 52 Transfer of Property Act (Lis Pendens).',
  },
  {
    code: 'HINDU_SUCCESSION_VIOLATION',
    label: 'Hindu Succession Act (Coparcenary) Issue',
    rationale: 'HINDU_SUCCESSION_VIOLATION: Partition deed executed post-2005 excludes daughters or coparcenary legal heirs from ancestral share.',
  },
  {
    code: 'SC_ST_PTCL_ACT_RESTRICTION',
    label: 'Karnataka PTCL Act Non-Alienation Clause',
    rationale: 'SC_ST_PTCL_ACT_RESTRICTION: Granted land alienation without prior sanction of Deputy Commissioner under PTCL Act 1978.',
  },
];

export const TitleChainTimeline: React.FC<TitleChainTimelineProps> = ({
  propertyId,
  initialEvents,
  onChainUpdated,
}) => {
  const [events, setEvents] = useState<TitleEvent[]>(initialEvents || []);
  const [gaps, setGaps] = useState<TitleGap[]>([]);
  const [dagSummary, setDagSummary] = useState<{
    isAcyclic: boolean;
    nodeCount: number;
    edgeCount: number;
    totalEvents: number;
    gapCount: number;
    verifiedCount: number;
    disputedCount: number;
    unverifiedCount: number;
  }>({
    isAcyclic: true,
    nodeCount: 0,
    edgeCount: 0,
    totalEvents: 0,
    gapCount: 0,
    verifiedCount: 0,
    disputedCount: 0,
    unverifiedCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  // Modals state
  const [disputeEvent, setDisputeEvent] = useState<TitleEvent | null>(null);
  const [disputeRationale, setDisputeRationale] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('Legal Counsel');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Event Form State
  const [newEventForm, setNewEventForm] = useState({
    deedType: 'Absolute Sale Deed',
    eventDate: new Date().toISOString().slice(0, 10),
    registrationDate: new Date().toISOString().slice(0, 10),
    fromName: '',
    toName: '',
    extentSqFt: '43560',
    extentRaw: '1 Acre',
    consideration: '5000000',
    encumbranceStatus: 'none',
  });

  const fetchTitleChain = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/properties/${propertyId}/title-chain`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch title chain (${res.status})`);
      }
      const data = await res.json();
      setEvents(data.events || []);
      setGaps(data.gaps || []);
      if (data.summary) {
        setDagSummary(data.summary);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading title chain.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchTitleChain();
  }, [fetchTitleChain]);

  // Review Event Action (Verify or Clear)
  const handleReviewEvent = async (eventId: string, status: 'verified' | 'unverified' | 'disputed', rationale?: string) => {
    setBusy(true);
    setError('');
    setSuccessNotice('');
    try {
      const res = await fetch(`${API}/api/properties/${propertyId}/title-events/${eventId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          rationale: rationale || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Review action failed (${res.status})`);
      }

      setSuccessNotice(
        status === 'verified'
          ? 'Instrument successfully verified by reviewer.'
          : status === 'disputed'
          ? 'Instrument dispute recorded with rationale.'
          : 'Instrument status reset to unverified.'
      );

      setDisputeEvent(null);
      setDisputeRationale('');
      await fetchTitleChain();
      if (onChainUpdated) onChainUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update review status.');
    } finally {
      setBusy(false);
    }
  };

  // Create New Title Event Action
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventForm.fromName.trim() || !newEventForm.toName.trim()) {
      setError('Seller and Buyer party names are mandatory.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        deedType: newEventForm.deedType,
        eventDate: newEventForm.eventDate,
        registrationDate: newEventForm.registrationDate || undefined,
        fromParties: [{ name: newEventForm.fromName.trim() }],
        toParties: [{ name: newEventForm.toName.trim() }],
        extentSqFt: Number(newEventForm.extentSqFt) || 0,
        extentRaw: newEventForm.extentRaw.trim() || `${newEventForm.extentSqFt} sq ft`,
        consideration: Number(newEventForm.consideration) || 0,
        status: 'unverified',
        encumbranceStatus: newEventForm.encumbranceStatus,
      };

      const res = await fetch(`${API}/api/properties/${propertyId}/title-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to record deed (${res.status})`);
      }

      setShowAddModal(false);
      setSuccessNotice('New title deed registered into ownership timeline.');
      setNewEventForm({
        deedType: 'Absolute Sale Deed',
        eventDate: new Date().toISOString().slice(0, 10),
        registrationDate: new Date().toISOString().slice(0, 10),
        fromName: '',
        toName: '',
        extentSqFt: '43560',
        extentRaw: '1 Acre',
        consideration: '5000000',
        encumbranceStatus: 'none',
      });
      await fetchTitleChain();
      if (onChainUpdated) onChainUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to add title event.');
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not recorded';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '₹ 0 (Nominal / Gift)';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="title-chain-container">
      {/* Top Banner and Summary Stats */}
      <div className="title-chain-header">
        <div className="header-left">
          <div className="eyebrow">OWNERSHIP GRAPH ENGINE <span>•</span> 30-YEAR LOOKBACK</div>
          <h2>Title Chain & Ownership Timeline</h2>
          <p>
            Chronological graph of property transfers, Karnataka patronymic entity resolution, and automated title gap screening.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="secondary-btn"
            onClick={fetchTitleChain}
            disabled={loading || busy}
            title="Refresh title timeline"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="primary-btn"
            onClick={() => setShowAddModal(true)}
            disabled={busy}
          >
            <Plus size={15} /> Add Deed to Chain
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={15} /></button>
        </div>
      )}

      {successNotice && (
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          <span>{successNotice}</span>
          <button onClick={() => setSuccessNotice('')}><X size={15} /></button>
        </div>
      )}

      {/* DAG Metrics Bar */}
      <div className="dag-metrics-grid">
        <div className="dag-metric-card">
          <div className="metric-icon blue"><FileText size={17} /></div>
          <div className="dag-metric-content">
            <span className="metric-label">Instruments Linked</span>
            <strong className="metric-val">{dagSummary.totalEvents || events.length} Deeds</strong>
            <span className="metric-hint">Chronologically sequenced</span>
          </div>
        </div>

        <div className="dag-metric-card">
          <div className="metric-icon green"><Users size={17} /></div>
          <div className="dag-metric-content">
            <span className="metric-label">Parties Resolved</span>
            <strong className="metric-val">{dagSummary.nodeCount || 0} Entities</strong>
            <span className="metric-hint">With South Indian alias normalizer</span>
          </div>
        </div>

        <div className="dag-metric-card">
          <div className={`metric-icon ${dagSummary.isAcyclic ? 'green' : 'amber'}`}>
            <Scale size={17} />
          </div>
          <div className="dag-metric-content">
            <span className="metric-label">Graph Topological Integrity</span>
            <strong className="metric-val">
              {dagSummary.isAcyclic ? 'Acyclic Valid' : 'Cycle Detected'}
            </strong>
            <span className="metric-hint">
              {dagSummary.isAcyclic ? 'No circular conveyance loops' : 'Review circular transfer loop'}
            </span>
          </div>
        </div>

        <div className="dag-metric-card">
          <div className={`metric-icon ${gaps.length > 0 ? 'amber' : 'green'}`}>
            <ShieldAlert size={17} />
          </div>
          <div className="dag-metric-content">
            <span className="metric-label">Title Gaps & Anomalies</span>
            <strong className="metric-val">{gaps.length} Finding{gaps.length === 1 ? '' : 's'}</strong>
            <span className="metric-hint">
              {gaps.length === 0 ? 'Chain intact (30-yr window)' : 'Attention required'}
            </span>
          </div>
        </div>
      </div>

      {/* Title Gaps Warning Section */}
      {gaps.length > 0 ? (
        <div className="gaps-panel">
          <div className="gaps-panel-head">
            <div className="gaps-head-title">
              <AlertCircle size={18} className="gap-alert-icon" />
              <div>
                <h3>Detected Chain of Title Gaps ({gaps.length})</h3>
                <p>Automated findings require legal examination or supplemental document requests.</p>
              </div>
            </div>
            <span className="gaps-badge">ATTENTION REQUIRED</span>
          </div>
          <div className="gaps-list">
            {gaps.map((gap, index) => {
              const isCrit = gap.severity === 'critical';
              const isHigh = gap.severity === 'high';
              return (
                <div key={`${gap.code}-${index}`} className={`gap-item-card ${gap.severity}`}>
                  <div className="gap-item-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="gap-item-body">
                    <div className="gap-item-header">
                      <strong className="gap-title">{gap.title}</strong>
                      <span className={`severity ${gap.severity}`}>{gap.severity.toUpperCase()}</span>
                      {gap.points && (
                        <span className="points-pill">+{gap.points} Risk Points</span>
                      )}
                    </div>
                    <p className="gap-description">{gap.description}</p>
                    {gap.sourceEventIds && gap.sourceEventIds.length > 0 && (
                      <div className="gap-sources">
                        <span>Associated Instrument(s):</span>
                        {gap.sourceEventIds.map(srcId => (
                          <span key={srcId} className="source-tag">
                            ID: {srcId.slice(0, 14)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="clean-chain-banner">
          <ShieldCheck size={20} className="clean-shield" />
          <div>
            <strong>Unbroken Chain of Title Verified</strong>
            <p>No missing preceding title deeds, registration delays (&gt;120 days), unreleased encumbrances, or extent over-conveyances detected within the 30-year search window.</p>
          </div>
          <span className="clean-tag">100% UNBROKEN</span>
        </div>
      )}

      {/* Interactive Timeline & Deed Cards */}
      <div className="timeline-container">
        <div className="timeline-section-title">
          <Layers size={16} />
          <h3>Chronological Instruments & Transfer Graph</h3>
          <span className="count-pill">{events.length} Instruments</span>
        </div>

        {events.length === 0 ? (
          <div className="empty-timeline">
            <Calendar size={32} />
            <strong>No Title Events Recorded</strong>
            <p>Upload property documents or manually record previous title deeds to build the ownership graph.</p>
            <button className="primary-btn" onClick={() => setShowAddModal(true)}>
              <Plus size={15} /> Add First Title Deed
            </button>
          </div>
        ) : (
          <div className="timeline-events-list">
            {events.map((ev, index) => {
              const isVerified = ev.status === 'verified';
              const isDisputed = ev.status === 'disputed';
              const isFirst = index === 0;
              const isLast = index === events.length - 1;

              return (
                <div key={ev.id} className={`timeline-card-wrapper ${ev.status}`}>
                  {/* Timeline track node */}
                  <div className="timeline-spine">
                    <div className={`timeline-node ${ev.status}`}>
                      <span>#{index + 1}</span>
                    </div>
                    {!isLast && <div className="timeline-line" />}
                  </div>

                  {/* Main Event Deed Card */}
                  <div className={`deed-card ${ev.status}`}>
                    {/* Card Header */}
                    <div className="deed-header">
                      <div className="deed-type-group">
                        <span className="deed-seq">Step {index + 1}</span>
                        <h4 className="deed-type-title">{ev.deedType}</h4>
                        {isFirst && <span className="root-pill">ROOT GRANT</span>}
                        {isLast && <span className="latest-pill">CURRENT DEED</span>}
                        {ev.encumbranceStatus === 'active_mortgage' && (
                          <span className="encumbrance-pill active">ACTIVE MORTGAGE</span>
                        )}
                        {ev.encumbranceStatus === 'discharged' && (
                          <span className="encumbrance-pill discharged">DISCHARGED CHARGE</span>
                        )}
                      </div>

                      <div className="deed-status-badge-wrap">
                        {isVerified && (
                          <span className="status-badge verified">
                            <CheckCircle2 size={13} /> Verified
                          </span>
                        )}
                        {isDisputed && (
                          <span className="status-badge disputed">
                            <AlertTriangle size={13} /> Disputed
                          </span>
                        )}
                        {!isVerified && !isDisputed && (
                          <span className="status-badge unverified">
                            <Clock size={13} /> Unverified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dates Bar */}
                    <div className="deed-dates-bar">
                      <div className="date-item">
                        <span className="date-label">Execution Date</span>
                        <strong className="date-val">{formatDate(ev.eventDate)}</strong>
                      </div>
                      {ev.registrationDate && (
                        <div className="date-item">
                          <span className="date-label">Registration Date</span>
                          <strong className="date-val">{formatDate(ev.registrationDate)}</strong>
                        </div>
                      )}
                      <div className="date-item">
                        <span className="date-label">Document ID</span>
                        <span className="mono-text">{ev.documentId ? ev.documentId.slice(0, 16) : 'Registered Instrument'}</span>
                      </div>
                    </div>

                    {/* Transfer Parties Flow (From -> To) */}
                    <div className="parties-flow-box">
                      <div className="party-side from">
                        <div className="party-side-head">
                          <User size={13} />
                          <span>TRANSFEROR / SELLER (EXECUTIVE)</span>
                        </div>
                        <div className="parties-list">
                          {ev.fromParties.map((p, pIdx) => (
                            <div key={pIdx} className="party-entry">
                              <strong className="party-raw-name">{p.name}</strong>
                              <span className="party-norm-badge" title="Normalized Party Entity">
                                {p.normalizedName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flow-arrow-box">
                        <ArrowRight size={18} className="flow-arrow-icon" />
                        <span className="flow-arrow-text">CONVEYS TO</span>
                      </div>

                      <div className="party-side to">
                        <div className="party-side-head">
                          <User size={13} />
                          <span>TRANSFEREE / BUYER (CLAIMANT)</span>
                        </div>
                        <div className="parties-list">
                          {ev.toParties.map((p, pIdx) => (
                            <div key={pIdx} className="party-entry">
                              <strong className="party-raw-name">{p.name}</strong>
                              <span className="party-norm-badge" title="Normalized Party Entity">
                                {p.normalizedName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Property Specs: Extent & Consideration */}
                    <div className="deed-specs-strip">
                      <div className="spec-item">
                        <span className="spec-label">Conveyed Extent</span>
                        <strong className="spec-value">{ev.extentRaw || `${ev.extentSqFt.toLocaleString()} sq ft`}</strong>
                        <span className="spec-sub">({ev.extentSqFt.toLocaleString()} Sq. Ft. normalized)</span>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Sale Consideration</span>
                        <strong className="spec-value">{formatCurrency(ev.consideration)}</strong>
                        <span className="spec-sub">INR Certified Stampable</span>
                      </div>

                      <div className="spec-item">
                        <span className="spec-label">Review Audit</span>
                        <span className="spec-value reviewer">
                          {ev.reviewedBy ? `Reviewed by ${ev.reviewedBy}` : 'Pending Legal Verification'}
                        </span>
                      </div>
                    </div>

                    {/* Dispute Rationale Banner (if disputed) */}
                    {isDisputed && (
                      <div className="dispute-box">
                        <div className="dispute-head">
                          <AlertTriangle size={15} />
                          <strong>Legal Reviewer Dispute Recorded</strong>
                        </div>
                        <p className="dispute-text">{ev.disputeRationale}</p>
                        {ev.reviewedBy && (
                          <span className="dispute-meta">Recorded by: {ev.reviewedBy}</span>
                        )}
                      </div>
                    )}

                    {/* Review Actions Footer */}
                    <div className="deed-footer-actions">
                      {!isVerified && (
                        <button
                          className="secondary-btn verify-btn"
                          onClick={() => handleReviewEvent(ev.id, 'verified')}
                          disabled={busy}
                          title="Verify that this instrument and party chain are legally sound"
                        >
                          <Check size={14} /> Mark as Verified
                        </button>
                      )}

                      {!isDisputed ? (
                        <button
                          className="secondary-btn dispute-btn"
                          onClick={() => {
                            setDisputeEvent(ev);
                            setDisputeRationale(ev.disputeRationale || '');
                          }}
                          disabled={busy}
                          title="Raise a formal dispute or challenge on this title instrument"
                        >
                          <AlertTriangle size={14} /> Raise Legal Dispute
                        </button>
                      ) : (
                        <button
                          className="secondary-btn clear-btn"
                          onClick={() => handleReviewEvent(ev.id, 'unverified')}
                          disabled={busy}
                          title="Clear the dispute and mark back as unverified"
                        >
                          <RefreshCw size={13} /> Clear Dispute
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reviewer Dispute Dialog Modal */}
      {disputeEvent && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDisputeEvent(null); }}>
          <div className="modal dispute-modal">
            <div className="modal-header">
              <div>
                <div className="eyebrow">LEGAL DUE DILIGENCE <span>•</span> DISPUTE LOGGING</div>
                <h2>Dispute Title Instrument #{disputeEvent.sequenceOrder}</h2>
                <p>
                  Record a formal legal defect, missing link deed, or suspicious transaction reason.
                  A non-empty rationale is mandatory.
                </p>
              </div>
              <button className="icon-btn" onClick={() => setDisputeEvent(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: '20px 25px' }}>
              <div className="dispute-target-summary">
                <strong>{disputeEvent.deedType}</strong>
                <span>Executed: {formatDate(disputeEvent.eventDate)} · Extent: {disputeEvent.extentRaw}</span>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
                  Quick Insert Standard Karnataka Legal Templates:
                </label>
                <div className="template-chips">
                  {STANDARD_DISPUTE_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.code}
                      type="button"
                      className="template-chip-btn"
                      onClick={() => setDisputeRationale(tmpl.rationale)}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
                  Dispute Legal Rationale <b>*</b>
                </label>
                <textarea
                  rows={4}
                  className="form-control"
                  style={{ width: '100%', padding: '10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  placeholder="Enter detailed legal reason, court case number, or missing recital deed reference..."
                  value={disputeRationale}
                  onChange={(e) => setDisputeRationale(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
                  Reviewer Name / Advocate ID
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '9px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ padding: '16px 25px', borderTop: '1px solid #edf0f4' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDisputeEvent(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={busy || !disputeRationale.trim()}
                onClick={() => handleReviewEvent(disputeEvent.id, 'disputed', disputeRationale.trim())}
              >
                <AlertTriangle size={14} /> Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deed Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal add-deed-modal">
            <div className="modal-header">
              <div>
                <div className="eyebrow">TITLE TIMELINE <span>•</span> RECORD INSTRUMENT</div>
                <h2>Add Title Deed to Ownership Chain</h2>
                <p>Enter the registered conveyance or inheritance record to include in the title graph.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateEvent}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Deed / Instrument Type <b>*</b></span>
                  <select
                    className="form-select"
                    value={newEventForm.deedType}
                    onChange={(e) => setNewEventForm({ ...newEventForm, deedType: e.target.value })}
                  >
                    <option value="Absolute Sale Deed">Absolute Sale Deed</option>
                    <option value="Gift Deed">Gift Deed (Dhana Patra)</option>
                    <option value="Partition Deed">Partition Deed</option>
                    <option value="Release Deed">Release Deed</option>
                    <option value="Mortgage Deed">Mortgage Deed</option>
                    <option value="Tahsildar Grant Order">Tahsildar Grant Order / Saguvali Chit</option>
                    <option value="Mutation Extract">Mutation Extract (Bhoomi MR)</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Encumbrance Status</span>
                  <select
                    className="form-select"
                    value={newEventForm.encumbranceStatus}
                    onChange={(e) => setNewEventForm({ ...newEventForm, encumbranceStatus: e.target.value })}
                  >
                    <option value="none">None (Clear Title)</option>
                    <option value="active_mortgage">Active Mortgage (Bank Charge)</option>
                    <option value="discharged">Discharged / Satisfaction Recorded</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Execution Date <b>*</b></span>
                  <input
                    type="date"
                    required
                    value={newEventForm.eventDate}
                    onChange={(e) => setNewEventForm({ ...newEventForm, eventDate: e.target.value })}
                  />
                </label>

                <label className="form-field">
                  <span>Registration Date (SRO)</span>
                  <input
                    type="date"
                    value={newEventForm.registrationDate}
                    onChange={(e) => setNewEventForm({ ...newEventForm, registrationDate: e.target.value })}
                  />
                </label>

                <label className="form-field span-2">
                  <span>Seller / Transferor Party Name <b>*</b></span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sri Muniyappa (S/o Govindappa)"
                    value={newEventForm.fromName}
                    onChange={(e) => setNewEventForm({ ...newEventForm, fromName: e.target.value })}
                  />
                </label>

                <label className="form-field span-2">
                  <span>Buyer / Transferee Party Name <b>*</b></span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh M (S/o Muniyappa)"
                    value={newEventForm.toName}
                    onChange={(e) => setNewEventForm({ ...newEventForm, toName: e.target.value })}
                  />
                </label>

                <label className="form-field">
                  <span>Extent in Sq. Ft. <b>*</b></span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newEventForm.extentSqFt}
                    onChange={(e) => setNewEventForm({ ...newEventForm, extentSqFt: e.target.value })}
                  />
                </label>

                <label className="form-field">
                  <span>Stated Extent (Karnataka Land Unit)</span>
                  <input
                    type="text"
                    placeholder="e.g. 1 Acre 20 Guntas"
                    value={newEventForm.extentRaw}
                    onChange={(e) => setNewEventForm({ ...newEventForm, extentRaw: e.target.value })}
                  />
                </label>

                <label className="form-field span-2">
                  <span>Sale Consideration (INR)</span>
                  <input
                    type="number"
                    min="0"
                    value={newEventForm.consideration}
                    onChange={(e) => setNewEventForm({ ...newEventForm, consideration: e.target.value })}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={busy}
                >
                  <Plus size={15} /> Save Instrument
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
