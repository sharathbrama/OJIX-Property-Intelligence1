import { useState, useEffect } from 'react';
import { Search, BookOpen, Scale, AlertTriangle, ShieldCheck, ChevronDown, ChevronRight, ExternalLink, Bookmark, CheckCircle2, BookmarkCheck, ArrowRight } from 'lucide-react';
import { authFetch } from '../authFetch';

interface Precedent {
  caseName: string;
  citation: string;
  court: string;
  year: number;
  bench?: string;
  ratio: string;
  dueDiligenceImpact: string;
}

interface StatutoryProvision {
  id: string;
  actName: string;
  actShortCode: string;
  section: string;
  category: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  summary: string;
  statutoryText: string;
  practitionerNotes: string;
  keyPrecedents: Precedent[];
  relevantDocTypes: string[];
  mandatoryChecks: string[];
}

interface Category {
  category: string;
  label: string;
  count: number;
}

export function LegalResearchView({ apiUrl, onOpenProperty, readOnly = false }: { apiUrl: string; onOpenProperty?: (id: string) => void; readOnly?: boolean }) {
  const [provisions, setProvisions] = useState<StatutoryProvision[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchProvisions('', 'all');
    if (!readOnly) fetchBookmarks();
  }, [readOnly]);

  const fetchCategories = async () => {
    try {
      const res = await authFetch(`${apiUrl}/api/legal-research/categories`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch { /* graceful fallback */ }
  };

  const fetchProvisions = async (q: string, cat: string) => {
    setLoading(true);
    try {
      const url = new URL(`${apiUrl}/api/legal-research`);
      if (q) url.searchParams.set('q', q);
      if (cat && cat !== 'all') url.searchParams.set('category', cat);
      const res = await authFetch(url.toString());
      const data = await res.json();
      setProvisions(data.items || []);
    } catch { /* graceful fallback */ }
    finally { setLoading(false); }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await authFetch(`${apiUrl}/api/legal-research/bookmarks`);
      const data = await res.json();
      setBookmarks(data.items || []);
    } catch { /* graceful fallback */ }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProvisions(query, selectedCategory);
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    fetchProvisions(query, cat);
  };

  const toggleBookmark = async (prov: StatutoryProvision) => {
    setBookmarkingId(prov.id);
    try {
      const existing = bookmarks.find(b => b.act_id === prov.id);
      if (existing) {
        await authFetch(`${apiUrl}/api/legal-research/bookmarks/${existing.id}`, { method: 'DELETE' });
        setBookmarks(prev => prev.filter(b => b.id !== existing.id));
        setNotice(`Removed bookmark for ${prov.section}`);
      } else {
        const res = await authFetch(`${apiUrl}/api/legal-research/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actId: prov.id,
            sectionNumber: prov.section,
            title: prov.title,
            notes: `Due-diligence reference for ${prov.actShortCode}`
          })
        });
        const data = await res.json();
        if (data.item) {
          setBookmarks(prev => [data.item, ...prev]);
          setNotice(`Bookmarked ${prov.section}: ${prov.title}`);
        }
      }
    } catch { /* graceful */ }
    finally { setBookmarkingId(null); }
  };

  return (
    <div className="legal-research-container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">STATUTORY REPOSITORY <span>•</span> KARNATAKA REAL ESTATE LAW</div>
          <h1>Legal Research & Case Precedents</h1>
          <p>Statutory acts, High Court & Supreme Court citations, and due-diligence verification checklists.</p>
        </div>
      </div>

      {notice && (
        <div className="alert alert-info">
          <BookmarkCheck size={16} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* Search and Category Bar */}
      <div className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div className="search-field" style={{ flex: 1, maxWidth: 'none' }}>
            <Search size={18} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by act name, section, keyword (e.g. PTCL, Section 79A, Rajakaluve buffer, coparcenary, Lis Pendens)..."
            />
          </div>
          <button type="submit" className="primary-btn">
            <Search size={15} /> Search Laws
          </button>
        </form>

        <div className="category-chips-scroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => (
            <button
              key={cat.category}
              type="button"
              onClick={() => handleCategorySelect(cat.category)}
              className={`chip-btn ${selectedCategory === cat.category ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid #cbd5e1',
                background: selectedCategory === cat.category ? '#1e293b' : '#fff',
                color: selectedCategory === cat.category ? '#fff' : '#475569',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{cat.label}</span>
              <span style={{
                background: selectedCategory === cat.category ? '#334155' : '#f1f5f9',
                color: selectedCategory === cat.category ? '#f8fafc' : '#64748b',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '9px'
              }}>{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading statutory provisions and case precedents...
        </div>
      ) : provisions.length === 0 ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          No statutory provisions matched your query. Try searching for "PTCL", "79A", "buffer", or "conversion".
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {provisions.map(prov => {
            const isExpanded = expandedId === prov.id;
            const isBookmarked = bookmarks.some(b => b.act_id === prov.id);

            return (
              <div key={prov.id} className="panel" style={{ padding: '20px', transition: 'box-shadow 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#edf2f7',
                        color: '#2d3748',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700
                      }}>
                        {prov.actShortCode}
                      </span>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>{prov.section}</strong>
                      <span className={`severity ${prov.severity}`} style={{ fontSize: '9px' }}>
                        {prov.severity.toUpperCase()} RISK
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e293b' }}>
                      {prov.title}
                    </h3>
                    <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
                      {prov.summary}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!readOnly && <button
                      type="button"
                      onClick={() => toggleBookmark(prov)}
                      disabled={bookmarkingId === prov.id}
                      className="icon-btn"
                      title={isBookmarked ? 'Remove bookmark' : 'Bookmark provision'}
                      style={{ color: isBookmarked ? '#d97706' : '#94a3b8' }}
                    >
                      <Bookmark size={18} fill={isBookmarked ? '#d97706' : 'none'} />
                    </button>}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : prov.id)}
                      className="secondary-btn"
                      style={{ padding: '6px 10px', fontSize: '10px' }}
                    >
                      {isExpanded ? 'Hide Details' : 'View Full Text & Case Law'}
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Statutory Text */}
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                      <strong style={{ fontSize: '10px', color: '#1e3a8a', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Statutory Wording
                      </strong>
                      <p style={{ margin: 0, fontSize: '11px', color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{prov.statutoryText}"
                      </p>
                    </div>

                    {/* Practitioner Due Diligence Notes */}
                    <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
                      <strong style={{ fontSize: '10px', color: '#92400e', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Due Diligence Practice Note for Lawyers
                      </strong>
                      <p style={{ margin: 0, fontSize: '11px', color: '#78350f', lineHeight: 1.5 }}>
                        {prov.practitionerNotes}
                      </p>
                    </div>

                    {/* Mandatory Checks Checklist */}
                    <div>
                      <strong style={{ fontSize: '11px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                        Mandatory Title Search Checklist:
                      </strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {prov.mandatoryChecks.map((chk, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '10px', color: '#334155' }}>
                            <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                            <span>{chk}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Case Precedents */}
                    {prov.keyPrecedents && prov.keyPrecedents.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong style={{ fontSize: '11px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                          Leading Case Law Precedents:
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {prov.keyPrecedents.map((p, idx) => (
                            <div key={idx} style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', fontSize: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <strong>{p.caseName}</strong>
                                <span style={{ color: '#64748b' }}>{p.court} ({p.year}) · <span className="mono">{p.citation}</span></span>
                              </div>
                              <p style={{ margin: '4px 0', color: '#334155', lineHeight: 1.4 }}>
                                <strong>Ratio Decidendi:</strong> {p.ratio}
                              </p>
                              <div style={{ marginTop: '4px', color: '#0369a1', fontWeight: 600 }}>
                                <strong>Due Diligence Impact:</strong> {p.dueDiligenceImpact}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
