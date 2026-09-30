import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  FileText,
  HelpCircle,
} from 'lucide-react';

export interface DiscrepancyFinding {
  id: string;
  code: string;
  ruleId: string;
  ruleVersion: string;
  statutoryCitation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  points: number;
  field: 'extent' | 'boundary' | 'party' | 'survey_number';
  docA: { id: string; name: string; type: string; value: string };
  docB: { id: string; name: string; type: string; value: string };
  deltaText: string;
  explanation: string;
  nextAction: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'deferred';
  reviewRationale?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DiscrepancyMatrixProps {
  propertyId: string;
  discrepancies: DiscrepancyFinding[];
  riskSummary?: {
    score: number;
    band: string;
    findingCount: number;
    disclaimer: string;
  };
  onRefresh?: () => void;
  onReview?: (discId: string, status: 'accepted' | 'rejected' | 'deferred', rationale: string) => Promise<void>;
}

export const DiscrepancyMatrix: React.FC<DiscrepancyMatrixProps> = ({
  propertyId,
  discrepancies = [],
  riskSummary,
  onRefresh,
  onReview,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [reviewModalDisc, setReviewModalDisc] = useState<DiscrepancyFinding | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'accepted' | 'rejected' | 'deferred'>('accepted');
  const [reviewRationale, setReviewRationale] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = discrepancies.filter((d) => {
    if (filterSeverity === 'all') return true;
    return d.severity === filterSeverity;
  });

  const criticalCount = discrepancies.filter((d) => d.severity === 'critical').length;
  const highCount = discrepancies.filter((d) => d.severity === 'high').length;
  const mediumCount = discrepancies.filter((d) => d.severity === 'medium').length;

  const handleOpenReview = (disc: DiscrepancyFinding) => {
    setReviewModalDisc(disc);
    setReviewStatus(disc.status && disc.status !== 'pending' ? (disc.status as any) : 'accepted');
    setReviewRationale(disc.reviewRationale || '');
  };

  const handleSubmitReview = async () => {
    if (!reviewModalDisc || !onReview) return;
    if (!reviewRationale.trim()) {
      alert('Review rationale is mandatory.');
      return;
    }
    setSubmitting(true);
    try {
      await onReview(reviewModalDisc.id, reviewStatus, reviewRationale.trim());
      setReviewModalDisc(null);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1a202c', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale style={{ color: '#d84b42' }} size={22} />
            Cross-Document Discrepancy Engine (R4)
          </h2>
          <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '0.875rem' }}>
            Multi-source comparison across deeds, RTC/Pahani, e-Khata, and EC with 1% Karnataka survey tolerance.
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e0',
              background: '#f7fafc',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <RefreshCw size={16} /> Re-Screen Discrepancies
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase' }}>Total Findings</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2d3748', marginTop: '4px' }}>{discrepancies.length}</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: '8px', background: '#fff5f5', border: '1px solid #feb2b2' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c53030', textTransform: 'uppercase' }}>Critical (Over 10%)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#9b2c2c', marginTop: '4px' }}>{criticalCount}</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: '8px', background: '#fffaf0', border: '1px solid #fbd38d' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c05621', textTransform: 'uppercase' }}>High (5% to 10%)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#9c4221', marginTop: '4px' }}>{highCount}</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: '8px', background: '#ebf8ff', border: '1px solid #bee3f8' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2b6cb0', textTransform: 'uppercase' }}>Risk Score Impact</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2c5282', marginTop: '4px' }}>
            {riskSummary ? `${riskSummary.score}/100` : '—'}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'critical', 'high', 'medium'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filterSeverity === sev ? '1px solid #3182ce' : '1px solid #e2e8f0',
              background: filterSeverity === sev ? '#ebf8ff' : '#fff',
              color: filterSeverity === sev ? '#2b6cb0' : '#4a5568',
              textTransform: 'capitalize',
            }}
          >
            {sev === 'all' ? `All (${discrepancies.length})` : `${sev} (${sev === 'critical' ? criticalCount : sev === 'high' ? highCount : mediumCount})`}
          </button>
        ))}
      </div>

      {/* Findings List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f7fafc', borderRadius: '8px', border: '1px dashed #cbd5e0' }}>
          <ShieldCheck size={40} style={{ color: '#38a169', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2d3748', margin: 0 }}>No Discrepancies Detected</h3>
          <p style={{ color: '#718096', fontSize: '0.875rem', marginTop: '6px', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
            All compared documents and schedules match within the 1% permissible survey tolerance.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((d) => (
            <div
              key={d.id}
              style={{
                border: '1px solid #e2e8f0',
                borderLeft: `5px solid ${d.severity === 'critical' ? '#e53e3e' : d.severity === 'high' ? '#dd6b20' : '#3182ce'}`,
                borderRadius: '8px',
                padding: '1.25rem',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: d.severity === 'critical' ? '#fed7d7' : d.severity === 'high' ? '#feebc8' : '#e2e8f0',
                      color: d.severity === 'critical' ? '#9b2c2c' : d.severity === 'high' ? '#9c4221' : '#2d3748',
                      marginRight: '8px',
                    }}
                  >
                    {d.severity} ({d.points} pts)
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#718096', fontWeight: 600 }}>Rule: {d.ruleId} ({d.ruleVersion})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {d.status && d.status !== 'pending' && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: d.status === 'accepted' ? '#c6f6d5' : d.status === 'rejected' ? '#fed7d7' : '#feebc8',
                        color: d.status === 'accepted' ? '#22543d' : d.status === 'rejected' ? '#9b2c2c' : '#9c4221',
                        textTransform: 'uppercase',
                      }}
                    >
                      {d.status}
                    </span>
                  )}
                  {onReview && (
                    <button
                      onClick={() => handleOpenReview(d)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e0',
                        background: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Record Disposition
                    </button>
                  )}
                </div>
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a202c', margin: '4px 0 8px' }}>
                {d.deltaText}
              </h4>
              <p style={{ fontSize: '0.875rem', color: '#4a5568', margin: '0 0 12px' }}>{d.explanation}</p>

              {/* Side by Side comparison values */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f7fafc', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#718096' }}>Document A: {d.docA.name}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2d3748', marginTop: '2px' }}>{d.docA.value}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#718096' }}>Document B: {d.docB.name}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2d3748', marginTop: '2px' }}>{d.docB.value}</div>
                </div>
              </div>

              {/* Action and Legal reference footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#718096', borderTop: '1px solid #edf2f7', paddingTop: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <div><strong>Next Action:</strong> {d.nextAction}</div>
                <div><em>{d.statutoryCitation}</em></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModalDisc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.125rem', fontWeight: 700 }}>Record Lawyer Review Disposition</h3>
            <p style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '1rem' }}>
              Recording professional disposition for: <strong>{reviewModalDisc.deltaText}</strong>
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Disposition</label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as any)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              >
                <option value="accepted">Accepted (Finding Validated)</option>
                <option value="rejected">Rejected (Explained / False Alarm)</option>
                <option value="deferred">Deferred (Requires Physical Verification)</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Mandatory Review Rationale</label>
              <textarea
                rows={3}
                value={reviewRationale}
                onChange={(e) => setReviewRationale(e.target.value)}
                placeholder="State legal or survey reasons for this disposition..."
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setReviewModalDisc(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3182ce', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                {submitting ? 'Saving...' : 'Save Disposition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
