import React, { useEffect, useState } from 'react';
import { authFetch } from '../authFetch';
import {
  Download,
  FileCheck2,
  FileText,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Compass,
  ExternalLink,
  Lock,
} from 'lucide-react';

export interface ReportViewerProps {
  property: {
    id: string;
    name: string;
    survey_number?: string;
    village?: string;
    taluk?: string;
    district?: string;
    extent?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  apiUrl?: string;
  onSnapshotCreated?: () => void;
  readOnly?: boolean;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  property,
  apiUrl = '',
  onSnapshotCreated,
  readOnly = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    let active=true;
    let objectUrl='';
    authFetch(`${apiUrl}/api/properties/${property.id}/due-diligence-report/html`)
      .then(async response=>{if(!response.ok)throw new Error(`Report preview failed (${response.status})`);return response.blob();})
      .then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setPreviewUrl(objectUrl);})
      .catch(()=>{if(active)setPreviewUrl('');});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[apiUrl,property.id]);

  const handleCreateSnapshot = async () => {
    setLoading(true);
    setSnapshotSuccess(null);
    try {
      const res = await authFetch(`${apiUrl}/api/properties/${property.id}/due-diligence-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Snapshot failed (${res.status})`);
      const data = await res.json();
      setSnapshotSuccess(data.reportId);
      if (onSnapshotCreated) onSnapshotCreated();
    } catch (err: any) {
      alert(err.message || 'Error creating snapshot');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    const response=await authFetch(`${apiUrl}/api/properties/${property.id}/due-diligence-report/pdf`);
    if(!response.ok){const body=await response.json().catch(()=>({}));return alert(body.error||'A reviewer-approved report PDF could not be generated.');}
    const url=URL.createObjectURL(await response.blob());
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`${property.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-approved-report.pdf`;anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const handleOpenHtml = async () => {
    const response=await authFetch(`${apiUrl}/api/properties/${property.id}/due-diligence-report/html`);
    if(!response.ok)return alert(`Printable report failed (${response.status})`);
    const url=URL.createObjectURL(await response.blob());
    window.open(url,'_blank','noopener,noreferrer');
    window.setTimeout(()=>URL.revokeObjectURL(url),60000);
  };

  return (
    <div style={{ padding: '1.5rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1a202c', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ color: '#3182ce' }} size={22} />
            Due Diligence & Title Audit Report (R5)
          </h2>
          <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '0.875rem' }}>
            Draft evidence-organising report. Values remain unverified unless linked to reviewed source documents.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!readOnly&&<button
            onClick={handleCreateSnapshot}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e0',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <Lock size={16} /> Freeze New Snapshot
          </button>}
          <button
            onClick={handleOpenHtml}
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
            <Printer size={16} /> View Printable HTML
          </button>
          <button
            onClick={handleDownloadPdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#2b6cb0',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <Download size={16} /> Download approved PDF
          </button>
        </div>
      </div>

      {snapshotSuccess && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#c6f6d5', color: '#22543d', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
          <FileCheck2 size={20} />
          <span>Immutable snapshot created successfully! Report ID: <strong>{snapshotSuccess}</strong></span>
        </div>
      )}

      {/* 7 Mandatory Sections Checklist Card */}
      <div style={{ background: '#f7fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 12px', color: '#2d3748' }}>Mandatory Report Specifications (Section 13 FRD)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', fontSize: '0.8125rem', color: '#4a5568' }}>
          <div>✔ 1. Executive Summary & Risk Band</div>
          <div>✔ 2. Property Identification Matrix</div>
          <div>✔ 3. Title Chain & Gap Detection</div>
          <div>✔ 4. Discrepancy Matrix (1% tolerance)</div>
          <div>✔ 5. GIS Buffer Screening (SWD & Lakes)</div>
          <div>6. Evidence appendix; anchors appear only when recorded</div>
          <div>✔ 7. Statutory Disclaimers & Notice</div>
          <div>Map scale and north orientation shown only when available</div>
        </div>
      </div>

      {/* Interactive Report Preview Box */}
      <div style={{ border: '1px solid #cbd5e0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: '#edf2f7', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568' }}>
          <span>LIVE REPORT PREVIEW CONTAINER</span>
          <span>FORMAT: HTML evidence view</span>
        </div>
        {previewUrl?<iframe
          src={previewUrl}
          title="Due Diligence Report Preview"
          style={{ width: '100%', height: '560px', border: 'none', background: '#fff' }}
        />:<div style={{padding:'48px',textAlign:'center',color:'#64748b'}}>Report preview is unavailable.</div>}
      </div>
    </div>
  );
};
