import { useState, useEffect } from 'react';
import { FileText, Search, Filter, Eye, ArrowUpRight, FolderOpen, ShieldCheck } from 'lucide-react';
import { authFetch } from '../authFetch';

interface GlobalDoc {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256?: string;
  doc_type?: string;
  processing_status: string;
  manual_review_status?: string;
  created_at: string;
  property_id: string;
  property_name: string;
  survey_number: string;
  village: string;
}

export function GlobalDocumentsView({ apiUrl, onOpenProperty, initialReviewOnly = false }: { apiUrl: string; onOpenProperty?: (propId: string) => void; initialReviewOnly?: boolean }) {
  const [docs, setDocs] = useState<GlobalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(initialReviewOnly ? 'needs-review' : 'all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDocs();
  }, [initialReviewOnly, apiUrl]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${apiUrl}/api/documents/all${initialReviewOnly ? '?review=1' : ''}`);
      const data = await res.json();
      setDocs(data.items || []);
    } catch { /* graceful fallback */ }
    finally { setLoading(false); }
  };

  const filtered = docs.filter(d => {
    if (filterType === 'needs-review') return true;
    if (filterType !== 'all' && d.doc_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.original_filename.toLowerCase().includes(q) ||
        (d.property_name && d.property_name.toLowerCase().includes(q)) ||
        (d.survey_number && d.survey_number.toLowerCase().includes(q)) ||
        (d.sha256 && d.sha256.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="global-docs-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOCUMENT INTELLIGENCE <span>•</span> ALL WORKSPACES</div>
          <h1>Source Documents Register</h1>
          <p>Central repository of deeds, encumbrance certificates, mutation records, and survey maps.</p>
        </div>
      </div>

      <div className="panel list-panel">
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents by name, survey number, property, or SHA-256 hash…"
            />
          </div>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
          >
            <option value="all">All Document Types</option>
            {initialReviewOnly && <option value="needs-review">Awaiting review</option>}
            <option value="sale_deed">Sale Deeds</option>
            <option value="encumbrance_certificate">Encumbrance Certificates</option>
            <option value="rtc_pahani">RTC / Pahani</option>
            <option value="mutation_extract">Mutation Extracts</option>
            <option value="conversion_order">Conversion Orders</option>
            <option value="sanction_plan">Sanction Plans</option>
          </select>

          <span className="result-count">{filtered.length} documents</span>
        </div>

        {loading ? (
          <div className="loading-state">Loading document registry…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen size={24} /></div>
            <strong>No documents found</strong>
            <p>Upload property documents in any property workspace to see them indexed here.</p>
          </div>
        ) : (
          <div className="document-list">
            {filtered.map(d => (
              <div className="document-row" key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div className="doc-icon"><FileText size={18} /></div>
                  <div className="doc-main">
                    <strong>{d.original_filename}</strong>
                    <span>
                      {d.mime_type} · {formatBytes(d.size_bytes)} · Linked to <strong>{d.property_name}</strong> (Sy. {d.survey_number})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {d.doc_type && (
                    <span className={`doc-type-pill ${d.doc_type}`}>
                      {d.doc_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  )}
                  <span className={`status-pill ${d.processing_status === 'completed' ? 'green' : 'amber'}`}>
                    <i /> {d.processing_status}
                  </span>
                  {d.sha256 && (
                    <span className="mono" style={{ fontSize: '9px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' }}>
                      {d.sha256.slice(0, 10)}…
                    </span>
                  )}
                  {onOpenProperty && (
                    <button
                      className="secondary-btn"
                      onClick={() => onOpenProperty(d.property_id)}
                      style={{ padding: '6px 10px', fontSize: '10px' }}
                    >
                      Open Property <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
