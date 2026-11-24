import React, { useState, useEffect } from 'react';
import { authFetch } from '../authFetch';

interface SignOffRecord {
  id: string;
  advocate_name: string;
  bar_council_number: string;
  opinion_verdict: string;
  notes: string;
  snapshot_hash: string;
  created_at: string;
}

interface AdvocateSignOffModalProps {
  propertyId: string;
  propertyTitle: string;
  currentUserName: string;
  onClose: () => void;
  onSuccess: (signOff: SignOffRecord) => void;
}

const VERDICT_OPTIONS = [
  { value: 'marketable_title', label: '✅ Marketable Title — Clear for registration', color: '#10b981' },
  { value: 'conditional_clearance', label: '⚠️ Conditional Clearance — Subject to conditions', color: '#f59e0b' },
  { value: 'rejection_defective_title', label: '❌ Rejection — Defective Title', color: '#ef4444' },
];

export function AdvocateSignOffModal({ propertyId, propertyTitle, currentUserName, onClose, onSuccess }: AdvocateSignOffModalProps) {
  const [advocateName, setAdvocateName] = useState(currentUserName);
  const [barCouncilNumber, setBarCouncilNumber] = useState('');
  const [opinionVerdict, setOpinionVerdict] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingSignOff, setExistingSignOff] = useState<SignOffRecord | null>(null);
  const [checklistBlocked, setChecklistBlocked] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(true);

  useEffect(() => {
    // Check existing sign-off
    authFetch(`/api/properties/${propertyId}/legal-sign-off`)
      .then(r => r.json())
      .then(d => { if (d.signOff) setExistingSignOff(d.signOff); });

    // Check intake checklist for missing items
    authFetch(`/api/properties/${propertyId}/intake-checklist`)
      .then(r => r.json())
      .then(d => {
        const missing = (d.checklist || []).filter((i: any) => i.status === 'missing');
        setChecklistBlocked(missing.length > 0);
        setChecklistLoading(false);
      });
  }, [propertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barCouncilNumber.trim()) return setError('Bar Council enrollment number is required');
    if (!opinionVerdict) return setError('Please select an opinion verdict');

    setLoading(true);
    setError('');

    try {
      const res = await authFetch(`/api/properties/${propertyId}/legal-sign-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advocateName, barCouncilNumber, opinionVerdict, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sign-off failed');
      }
      const data = await res.json();
      onSuccess(data.signOff);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  const selectedVerdict = VERDICT_OPTIONS.find(v => v.value === opinionVerdict);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', padding: '20px 24px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>⚖️ Advocate Legal Sign-Off</h2>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>{propertyTitle}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Existing sign-off */}
          {existingSignOff && (
            <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 8 }}>✅ Already Signed Off</div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                <strong>{existingSignOff.advocate_name}</strong> — {existingSignOff.bar_council_number}<br />
                Verdict: <strong>{existingSignOff.opinion_verdict}</strong><br />
                Snapshot: <code style={{ fontSize: 11 }}>{existingSignOff.snapshot_hash.slice(0, 16)}…</code><br />
                Date: {new Date(existingSignOff.created_at).toLocaleString()}
              </div>
              <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: 12 }}>
                A new sign-off will supersede the existing one and create an immutable audit record.
              </p>
            </div>
          )}

          {/* Checklist warning */}
          {checklistLoading ? null : checklistBlocked ? (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: '#9a3412' }}>⛔ Cannot Sign Off — Missing Documents</div>
              <p style={{ margin: '8px 0 0', color: '#7c2d12', fontSize: 13 }}>
                One or more mandatory documents are marked "Missing" in the intake checklist.
                Please ensure all documents are uploaded or marked N/A before proceeding.
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Advocate Name *
                </label>
                <input
                  type="text" value={advocateName} onChange={e => setAdvocateName(e.target.value)} required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Bar Council Enrollment Number *
                </label>
                <input
                  type="text" value={barCouncilNumber} onChange={e => setBarCouncilNumber(e.target.value)} required
                  placeholder="e.g. KAR/1234/2018"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Opinion Verdict *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {VERDICT_OPTIONS.map(opt => (
                    <label key={opt.value} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      border: `2px solid ${opinionVerdict === opt.value ? opt.color : '#e5e7eb'}`,
                      borderRadius: 8, cursor: 'pointer',
                      background: opinionVerdict === opt.value ? opt.color + '11' : '#fff',
                      transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="verdict" value={opt.value}
                        checked={opinionVerdict === opt.value}
                        onChange={() => setOpinionVerdict(opt.value)}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: opinionVerdict === opt.value ? 600 : 400, color: opinionVerdict === opt.value ? opt.color : '#374151' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Notes / Conditions
                </label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Specify any conditions, caveats, or remarks..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {error && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '10px 14px', borderRadius: 8, color: '#be123c', fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
                <button type="button" onClick={onClose}
                  style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading || checklistBlocked}
                  style={{
                    padding: '10px 24px', background: checklistBlocked ? '#9ca3af' : '#1e3a8a',
                    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: checklistBlocked ? 'not-allowed' : 'pointer', color: '#fff',
                  }}>
                  {loading ? 'Signing…' : '⚖️ Execute Legal Sign-Off'}
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
            🔒 This action is <strong>immutable</strong>. The sign-off record and snapshot hash will be permanently stored in the audit log.
            This constitutes a formal legal opinion under the Advocates Act, 1961.
          </div>
        </div>
      </div>
    </div>
  );
}
