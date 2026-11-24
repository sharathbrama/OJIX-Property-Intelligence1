import React, { useState, useEffect } from 'react';
import { authFetch } from '../authFetch';

interface ChecklistItem {
  code: string;
  label: string;
  description: string;
  status: 'pending' | 'uploaded' | 'missing' | 'not_applicable';
  notes?: string;
  document_id?: string | null;
  sort_order: number;
  updated_at?: string;
}

interface IntakeChecklistProps {
  propertyId: string;
  canEdit: boolean; // true for operations, analyst (limited), admin, owner
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  uploaded: '#10b981',
  missing: '#ef4444',
  not_applicable: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  uploaded: 'Uploaded',
  missing: 'Missing',
  not_applicable: 'N/A',
};

export function IntakeChecklist({ propertyId, canEdit }: IntakeChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchChecklist();
  }, [propertyId]);

  async function fetchChecklist() {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/properties/${propertyId}/intake-checklist`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.checklist || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(code: string, status: string, notes?: string) {
    setUpdating(code);
    try {
      const res = await authFetch(`/api/properties/${propertyId}/intake-checklist/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(prev => prev.map(i => i.code === code ? { ...i, ...data.item } : i));
    } catch (e: any) {
      alert('Update failed: ' + e.message);
    } finally {
      setUpdating(null);
    }
  }

  const uploadedCount = items.filter(i => i.status === 'uploaded').length;
  const missingCount = items.filter(i => i.status === 'missing').length;
  const totalRequired = items.filter(i => i.status !== 'not_applicable').length;

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading intake checklist…</div>;
  if (error) return <div style={{ padding: 24, color: '#ef4444' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>📋 Document Intake Checklist</h3>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Karnataka statutory due-diligence documents
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ✓ {uploadedCount} Uploaded
          </span>
          {missingCount > 0 && (
            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              ✗ {missingCount} Missing
            </span>
          )}
          <span style={{ background: '#e5e7eb', color: '#374151', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            {uploadedCount}/{totalRequired} Complete
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: '#e5e7eb', borderRadius: 8, height: 8, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{
          background: missingCount > 0 ? '#f59e0b' : '#10b981',
          width: `${totalRequired > 0 ? (uploadedCount / totalRequired) * 100 : 0}%`,
          height: '100%',
          borderRadius: 8,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.code} style={{
            border: `1px solid ${item.status === 'missing' ? '#fca5a5' : item.status === 'uploaded' ? '#a7f3d0' : '#e5e7eb'}`,
            borderRadius: 10,
            padding: '14px 18px',
            background: item.status === 'missing' ? '#fff7f7' : item.status === 'uploaded' ? '#f0fdf4' : '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: STATUS_COLORS[item.status] || '#6b7280',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{item.label}</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{item.description}</div>
              {item.notes && (
                <div style={{ color: '#374151', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>📝 {item.notes}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: STATUS_COLORS[item.status] + '22',
                color: STATUS_COLORS[item.status],
                border: `1px solid ${STATUS_COLORS[item.status]}44`,
              }}>
                {STATUS_LABELS[item.status] || item.status}
              </span>
              {canEdit && (
                <select
                  disabled={updating === item.code}
                  value={item.status}
                  onChange={e => updateStatus(item.code, e.target.value)}
                  style={{
                    fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db',
                    borderRadius: 6, background: '#fff', cursor: 'pointer',
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="uploaded">Uploaded</option>
                  <option value="missing">Missing</option>
                  <option value="not_applicable">N/A</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: 14, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 13, color: '#78350f' }}>
        ⚠️ <strong>Note:</strong> Legal sign-off cannot proceed if any mandatory documents are marked "Missing".
        Mark documents "N/A" only if genuinely not applicable for this property type.
      </div>
    </div>
  );
}
