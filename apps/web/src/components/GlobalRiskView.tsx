import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Search, ArrowUpRight, CheckCircle2, Filter } from 'lucide-react';
import { authFetch } from '../authFetch';

interface FindingRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  points: number;
  explanation: string;
  evidence_status: string;
  next_action: string;
  property_id: string;
  property_name: string;
  survey_number: string;
  village: string;
}

export function GlobalRiskView({ apiUrl, onOpenProperty }: { apiUrl: string; onOpenProperty?: (propId: string) => void }) {
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchFindings();
  }, []);

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${apiUrl}/api/findings/all`);
      const data = await res.json();
      setFindings(data.items || []);
      setSeverityCounts(data.severityCounts || {});
    } catch { /* graceful fallback */ }
    finally { setLoading(false); }
  };

  const filtered = findings.filter(f => {
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    if (filterCategory !== 'all') {
      const codeOrTitle = (f.code || f.title || '').toUpperCase();
      if (!codeOrTitle.includes(filterCategory)) return false;
    }
    if (query) {
      const q = query.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.explanation.toLowerCase().includes(q) ||
        (f.property_name && f.property_name.toLowerCase().includes(q)) ||
        (f.survey_number && f.survey_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="global-risk-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RISK AUDIT <span>•</span> CROSS-PORTFOLIO REVIEW</div>
          <h1>Risk Reviews & Due Diligence Findings</h1>
          <p>Portfolio-wide summary of legal title gaps, environmental buffer overlaps, and document discrepancies.</p>
        </div>
      </div>

      {/* Severity Metrics */}
      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}><ShieldAlert size={18} /></div>
          <div className="metric-label">Critical Findings</div>
          <div className="metric-value">{severityCounts.critical || 0}</div>
          <div className="metric-change">Immediate legal blocker</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><AlertTriangle size={18} /></div>
          <div className="metric-label">High Attention</div>
          <div className="metric-value">{severityCounts.high || 0}</div>
          <div className="metric-change">Requires statutory clearance</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon blue"><AlertTriangle size={18} /></div>
          <div className="metric-label">Medium Priority</div>
          <div className="metric-value">{severityCounts.medium || 0}</div>
          <div className="metric-change">Survey or deed variance</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><CheckCircle2 size={18} /></div>
          <div className="metric-label">Preliminary / Low</div>
          <div className="metric-value">{(severityCounts.low || 0) + (severityCounts.unverified || 0)}</div>
          <div className="metric-change">Missing baseline records</div>
        </div>
      </div>

      <div className="panel list-panel">
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search findings by title, explanation, property, or survey number…"
            />
          </div>

          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
          >
            <option value="all">All Severities (FRD §12.2)</option>
            <option value="critical">Critical Review Required</option>
            <option value="high">High Review Required</option>
            <option value="medium">Moderate Review</option>
            <option value="low">Informational / Cleared</option>
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
          >
            <option value="all">All Categories (FRD §12.1)</option>
            <option value="TITLE">Title / Chain Gap</option>
            <option value="IDENTITY">Identity / Party</option>
            <option value="EXTENT">Extent / Boundary</option>
            <option value="ENCUMBRANCE">Encumbrance / Charge</option>
            <option value="GEO">Geo / Rajakaluve / Lake</option>
            <option value="PLANNING">Planning / Master Plan</option>
            <option value="DOCUMENT">Document / Scan</option>
            <option value="RESEARCH">Legal Precedent / PTCL</option>
          </select>

          <span className="result-count">{filtered.length} findings</span>
        </div>

        {loading ? (
          <div className="loading-state">Loading findings…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><ShieldAlert size={24} /></div>
            <strong>No matching findings</strong>
            <p>Run preliminary screenings or cross-registry syncs in properties to discover risk findings.</p>
          </div>
        ) : (
          <div className="finding-list">
            {filtered.map((f, i) => (
              <div className="finding-row" key={`${f.id || f.code}-${i}`}>
                <div className={`finding-icon ${f.severity}`}><AlertTriangle size={17} /></div>
                <div className="finding-body">
                  <div className="finding-title-row">
                    <strong>{f.title}</strong>
                    <span className={`severity ${f.severity}`}>{f.severity.toUpperCase()}</span>
                    <span className="mono" style={{ fontSize: '9px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {f.property_name} (Sy. {f.survey_number})
                    </span>
                  </div>
                  <p>{f.explanation}</p>
                  <div className="next-action" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span>NEXT ACTION</span>
                      {f.next_action}
                    </div>
                    {onOpenProperty && (
                      <button
                        className="secondary-btn"
                        onClick={() => onOpenProperty(f.property_id)}
                        style={{ padding: '4px 8px', fontSize: '9px', marginLeft: '12px' }}
                      >
                        Open Workspace <ArrowUpRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
