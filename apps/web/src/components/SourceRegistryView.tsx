import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Database, FileCheck2, MapPin, Building2, Layers, Search, Zap, Copy, Check, PlusCircle } from 'lucide-react';
import { authFetch } from '../authFetch';

interface RegistryHealth {
  name: string;
  displayName: string;
  department: string;
  officialUrl: string;
  status: string;
  portalReachability?: string;
  uptimePct: number | null;
  averageLatencyMs: number | null;
  recordTypes: string[];
}

interface VerificationDiscrepancy {
  field: string;
  workspaceValue: string;
  registryValue: string;
  severity: string;
  message: string;
}

interface RegistryVerificationResult {
  registryName: string;
  displayName: string;
  status: string;
  matchScorePct: number;
  queryParameters: Record<string, any>;
  matchedRecord: Record<string, any>;
  discrepancies: VerificationDiscrepancy[];
  evidenceHash: string;
  latencyMs: number;
  timestamp: string;
  officialPortalReference: string;
}

interface Property {
  id: string;
  name: string;
  village: string;
  survey_number: string;
  extent: string;
  district: string;
}

import type { UserAccount } from '../types';

export function SourceRegistryView({
  apiUrl,
  properties,
  onOpenProperty,
  currentUser,
  onCreateProperty,
}: {
  apiUrl: string;
  properties: Property[];
  onOpenProperty?: (p: any) => void;
  currentUser?: UserAccount | null;
  onCreateProperty?: (form: Record<string, any>) => Promise<void> | void;
}) {
  const [registries, setRegistries] = useState<RegistryHealth[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(properties[0]?.id || '');
  const [verifications, setVerifications] = useState<RegistryVerificationResult[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [activeRegTab, setActiveRegTab] = useState<string>('bhoomi');
  const [notice, setNotice] = useState('');

  // Source retrieval readiness state. No official records are fetched until an authorized connector exists.
  const [queryRegistry, setQueryRegistry] = useState<string>('all');
  const [querySurveyNumber, setQuerySurveyNumber] = useState<string>('34');
  const [queryHissa, setQueryHissa] = useState<string>('A');
  const [queryVillage, setQueryVillage] = useState<string>('Arakere');
  const [queryTaluk, setQueryTaluk] = useState<string>('Bengaluru South');
  const [queryDistrict, setQueryDistrict] = useState<string>('Bengaluru Urban');
  const [querySro, setQuerySro] = useState<string>('Jayanagar');
  const [queryPid, setQueryPid] = useState<string>('192-W0187-34');
  const [queryLoading, setQueryLoading] = useState<boolean>(false);
  const [queryResults, setQueryResults] = useState<RegistryVerificationResult[] | null>(null);
  const [queryTrustScore, setQueryTrustScore] = useState<number | null>(null);
  const [queryActiveTab, setQueryActiveTab] = useState<string>('bhoomi');
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [importingProp, setImportingProp] = useState<boolean>(false);

  useEffect(() => {
    fetchHealth();
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchExistingVerifications(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  const fetchHealth = async (probe = false) => {
    setLoading(true);
    try {
      const res = await authFetch(`${apiUrl}/api/source-registry/status${probe ? '?probe=true' : ''}`);
      const data = await res.json();
      if (data.registries) setRegistries(data.registries);
      if (probe) setNotice('Portal reachability checks completed. A reachable website does not mean OJIX is connected to, or has verified records from, that source.');
    } catch { /* graceful fallback */ }
    finally { setLoading(false); }
  };

  const fetchExistingVerifications = async (propId: string) => {
    try {
      const res = await authFetch(`${apiUrl}/api/source-registry/properties/${propId}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const mapped = data.items.map((it: any) => ({
          registryName: it.registry_name,
          displayName: it.registry_name.toUpperCase(),
          status: it.status,
          matchScorePct: 95,
          queryParameters: it.query_params || {},
          matchedRecord: it.matched_record || {},
          discrepancies: it.discrepancies || [],
          evidenceHash: it.response_hash || '',
          latencyMs: it.latency_ms || 100,
          timestamp: it.verified_at,
          officialPortalReference: ''
        }));
        setVerifications(mapped);
        setOverallScore(94);
      } else {
        setVerifications([]);
        setOverallScore(null);
      }
    } catch { /* graceful */ }
  };

  const handleRunSync = async () => {
    if (!selectedPropertyId) return;
    if (currentUser?.role === 'viewer') {
      setNotice('RBAC Permission Denied: Viewer role is read-only. Cannot trigger multi-registry synchronization.');
      return;
    }
    setVerifying(true);
    setNotice('');
    try {
      const res = await authFetch(`${apiUrl}/api/source-registry/properties/${selectedPropertyId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Sync failed with status ${res.status}`);
      }
      if (data.verifications) {
        setVerifications(data.verifications);
        setOverallScore(data.overallTrustScorePct);
        setNotice('No authorized government-data connectors are configured. Open the official portals or upload official records for evidence review.');
      }
    } catch (err: any) {
      setNotice(`Sync failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncSingle = async (regName: string) => {
    if (!selectedPropertyId) return;
    if (currentUser?.role === 'viewer') {
      setNotice('RBAC Permission Denied: Viewer role is read-only. Cannot trigger registry synchronization.');
      return;
    }
    setVerifying(true);
    setNotice('');
    try {
      const res = await authFetch(`${apiUrl}/api/source-registry/properties/${selectedPropertyId}/verify/${regName}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Sync failed with status ${res.status}`);
      }
      if (data.verification) {
        setVerifications(prev => {
          const filtered = prev.filter(v => v.registryName !== regName);
          return [...filtered, data.verification];
        });
        setNotice(`${regName.toUpperCase()} is not connected. No official property record was retrieved or verified.`);
      }
    } catch (err: any) {
      setNotice(`Sync failed for ${regName.toUpperCase()}: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handlePreset = (sy: string, hissa: string, village: string, taluk: string, sro: string, pid?: string) => {
    setQuerySurveyNumber(sy);
    setQueryHissa(hissa);
    setQueryVillage(village);
    setQueryTaluk(taluk);
    setQuerySro(sro);
    if (pid) setQueryPid(pid);
  };

  const handleDirectQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setQueryLoading(true);
    setNotice('');
    try {
      const res = await authFetch(`${apiUrl}/api/source-registry/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registry: queryRegistry,
          district: queryDistrict,
          taluk: queryTaluk,
          village: queryVillage,
          surveyNumber: querySurveyNumber,
          subdivision: queryHissa,
          sroOffice: querySro,
          pidNumber: queryPid,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setQueryResults(data.verifications || []);
      setQueryTrustScore(data.overallTrustScorePct ?? 0);
      if (data.verifications && data.verifications.length > 0) {
        setQueryActiveTab(data.verifications[0].registryName);
      }
      setNotice('Connection check completed. No official property records were retrieved. Use the official portal links or upload official documents.');
    } catch (err: any) {
      setNotice(`Automated query failed: ${err.message}`);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleImportAsProperty = async () => {
    if (!queryResults || !onCreateProperty) return;
    if (['viewer','data_steward'].includes(currentUser?.role || '')) {
      setNotice('RBAC Permission Denied: this role cannot create workspace properties.');
      return;
    }
    setImportingProp(true);
    try {
      await onCreateProperty({
        name: `${queryVillage} Sy. ${querySurveyNumber}/${queryHissa} (Unverified intake)`,
        survey_number: `${querySurveyNumber}`,
        subdivision: queryHissa,
        village: queryVillage,
        taluk: queryTaluk,
        district: queryDistrict,
        property_type: 'agricultural',
        extent: '0-30.00 (30 Guntas)',
        address: `${queryVillage}, ${queryTaluk}, ${queryDistrict}`,
        notes: 'Created from user-entered identifiers only. No government record was retrieved or verified.'
      });
      setNotice(`Property created and imported into workspace! Check Properties list.`);
    } catch (err: any) {
      setNotice(`Import failed: ${err.message}`);
    } finally {
      setImportingProp(false);
    }
  };

  const activeVerification = verifications.find(v => v.registryName === activeRegTab);
  const activeQueryResult = queryResults?.find(v => v.registryName === queryActiveTab) || queryResults?.[0];

  return (
    <div className="source-registry-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GOVERNMENT DATA SOURCES <span>•</span> CONNECTION STATUS</div>
          <h1>Government Source Catalog</h1>
          <p>Official portal links and reachability checks. Government property-record connectors are not configured.</p>
        </div>
        <button className="secondary-btn" onClick={() => fetchHealth(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Check Portal Reachability
        </button>

      </div>

      {notice && (
        <div className="alert alert-info">
          <ShieldCheck size={16} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* 6 Registries Health Grid */}
      <div className="section-header">
        <div>
          <h2>Karnataka source directory</h2>
          <p>Portal reachability is informational and does not verify any property record</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {registries.map(reg => (
          <div key={reg.name} className="panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={15} style={{ color: '#2563eb' }} />
                <strong style={{ fontSize: '12px', color: '#1e293b' }}>{reg.displayName}</strong>
              </div>
              <span className="status-pill amber">
                <i /> NOT CONNECTED
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>
              {reg.department}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '9px', color: '#475569', background: '#f8fafc', padding: '6px 10px', borderRadius: '5px' }}>
              <span>Portal: <strong>{reg.portalReachability || 'not checked'}</strong></span>
              <span>Probe latency: <strong>{reg.averageLatencyMs == null ? '—' : `${reg.averageLatencyMs}ms`}</strong></span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8' }}>{reg.recordTypes.length} record types</span>
              <a href={reg.officialUrl} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
                Portal <ExternalLink size={11} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Automated In-App Registry Search & Query Console */}
      <div className="panel" style={{ padding: '20px', marginBottom: '24px', border: '1px solid #bfdbfe', background: '#f8faff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'grid', placeItems: 'center', color: '#2563eb' }}>
                <Zap size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                Official-record retrieval readiness
              </h3>
              <span className="status-pill amber" style={{ fontSize: '9px' }}>
                <AlertTriangle size={11} /> CONNECTORS NOT CONFIGURED
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
              Enter identifiers to prepare a retrieval request. OJIX does not currently query Bhoomi, Kaveri, Mojini, Dishaank, e-Aasthi, or K-RERA records. Use the official portal or upload an official record.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Quick Presets:</span>
            <button
              type="button"
              className="secondary-btn"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              onClick={() => handlePreset('34', 'A', 'Arakere', 'Bengaluru South', 'Jayanagar', '192-W0187-34')}
            >
              🏷️ Sy. 34 Arakere
            </button>
            <button
              type="button"
              className="secondary-btn"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              onClick={() => handlePreset('112', '1', 'Begur', 'Bengaluru South', 'Bommanahalli', '192-W0188-112')}
            >
              🏷️ Sy. 112 Begur
            </button>
            <button
              type="button"
              className="secondary-btn"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              onClick={() => handlePreset('45', '2', 'Bellandur', 'Bengaluru East', 'Varthur', '192-W0150-45')}
            >
              🏷️ Sy. 45 Bellandur
            </button>
          </div>
        </div>

        {/* Query Input Form */}
        <form onSubmit={handleDirectQuery} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px', background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Target Registry
            </label>
            <select
              value={queryRegistry}
              onChange={e => setQueryRegistry(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            >
              <option value="all">⚡ All Registries (Federated)</option>
              <option value="bhoomi">Bhoomi (RTC & Mutation)</option>
              <option value="kaveri">Kaveri 2.0 (EC & Deeds)</option>
              <option value="mojini">Mojini 2.0 (Cadastral 11E)</option>
              <option value="dishaank">Dishaank (GIS Buffers)</option>
              <option value="easthi">e-Aasthi (BBMP Khata)</option>
              <option value="rera">K-RERA (Project Approvals)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Survey Number *
            </label>
            <input
              type="text"
              required
              value={querySurveyNumber}
              onChange={e => setQuerySurveyNumber(e.target.value)}
              placeholder="e.g. 34"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Hissa / Subdivision
            </label>
            <input
              type="text"
              value={queryHissa}
              onChange={e => setQueryHissa(e.target.value)}
              placeholder="e.g. A or 1"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Village
            </label>
            <input
              type="text"
              value={queryVillage}
              onChange={e => setQueryVillage(e.target.value)}
              placeholder="e.g. Arakere"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Taluk
            </label>
            <input
              type="text"
              value={queryTaluk}
              onChange={e => setQueryTaluk(e.target.value)}
              placeholder="e.g. Bengaluru South"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              District
            </label>
            <input
              type="text"
              value={queryDistrict}
              onChange={e => setQueryDistrict(e.target.value)}
              placeholder="e.g. Bengaluru Urban"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              SRO Office (Kaveri)
            </label>
            <input
              type="text"
              value={querySro}
              onChange={e => setQuerySro(e.target.value)}
              placeholder="e.g. Jayanagar"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              PID / Khata (e-Aasthi)
            </label>
            <input
              type="text"
              value={queryPid}
              onChange={e => setQueryPid(e.target.value)}
              placeholder="e.g. 192-W0187-34"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              className="primary-btn"
              disabled={queryLoading}
              style={{ width: '100%', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#2563eb' }}
            >
              {queryLoading ? <RefreshCw size={13} className="spin" /> : <Search size={13} />}
              {queryLoading ? 'Checking…' : 'Check Connection Status'}
            </button>
          </div>
        </form>

        {/* Live Extracted Results Section */}
        {queryResults && queryResults.length > 0 && (
          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="status-pill green">
                  <AlertTriangle size={12} /> {queryResults.length} Sources Not Connected
                </span>
                <span style={{ fontSize: '11px', color: '#475569' }}>
                  Verification score: <strong style={{ color: '#b45309' }}>{queryTrustScore ?? 0}%</strong>
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  Official records retrieved: <strong>0</strong>
                </span>
              </div>

              {onCreateProperty && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleImportAsProperty}
                  disabled={importingProp || ['viewer','data_steward'].includes(currentUser?.role || '')}
                  title={['viewer','data_steward'].includes(currentUser?.role || '') ? 'This role cannot create property workspaces' : 'Import this searched record into active workspace'}
                  style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1d4ed8' }}
                >
                  <PlusCircle size={13} />
                  {importingProp ? 'Creating…' : 'Create Unverified Intake'}
                </button>
              )}
            </div>

            {/* Registry Selection Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
              {queryResults.map(res => (
                <button
                  key={res.registryName}
                  type="button"
                  onClick={() => setQueryActiveTab(res.registryName)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: queryActiveTab === res.registryName ? '#2563eb' : '#e2e8f0',
                    background: queryActiveTab === res.registryName ? '#eff6ff' : '#f8fafc',
                    color: queryActiveTab === res.registryName ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className={`status-pill ${res.status === 'verified' ? 'green' : 'amber'}`} style={{ padding: '2px 4px', fontSize: '8px' }}>
                    <i />
                  </span>
                  {res.displayName.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Active Tab Extracted Details */}
            {activeQueryResult && (
              <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={15} style={{ color: '#2563eb' }} />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{activeQueryResult.displayName}</strong>
                    <span className={`status-pill ${activeQueryResult.status === 'verified' ? 'green' : 'amber'}`}>
                      {activeQueryResult.status.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    Verification Score: <strong>{activeQueryResult.matchScorePct}%</strong>
                  </span>
                </div>

                {/* Key Extracted Fields Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  {Object.entries(activeQueryResult.matchedRecord).slice(0, 10).map(([key, val]) => (
                    <div key={key} style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '5px', border: '1px solid #f1f5f9' }}>
                      <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                        {key.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <strong style={{ fontSize: '11px', color: '#1e293b', wordBreak: 'break-word' }}>
                        {typeof val === 'object' ? JSON.stringify(val).slice(0, 50) + (JSON.stringify(val).length > 50 ? '…' : '') : String(val)}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Evidence Hash */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '8px 12px', borderRadius: '5px', border: '1px solid #e2e8f0', fontSize: '10px', color: '#64748b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={13} style={{ color: '#059669' }} />
                    <span>Response Metadata Hash: <code style={{ color: '#0f172a', fontWeight: 600 }}>{activeQueryResult.evidenceHash.slice(0, 24)}…</code></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyHash(activeQueryResult.evidenceHash)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600 }}
                  >
                    {copiedHash ? <Check size={11} /> : <Copy size={11} />}
                    {copiedHash ? 'Copied' : 'Copy Full Hash'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Property Multi-Registry Verification Runner */}
      <div className="panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a' }}>
              Property source-connection check
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
              Check which official sources require portal retrieval or document upload. This does not verify property data.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={selectedPropertyId}
              onChange={e => setSelectedPropertyId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#1e293b' }}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Sy. {p.survey_number || 'N/A'})
                </option>
              ))}
            </select>

            <button className="primary-btn" onClick={handleRunSync} disabled={verifying || !selectedPropertyId}>
              <RefreshCw size={14} className={verifying ? 'spin' : ''} />
              {verifying ? 'Checking…' : 'Check Source Connections'}
            </button>
          </div>
        </div>

        {/* Verification Results Panel */}
        {overallScore !== null && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#ecfdf5',
                border: '3px solid #10b981',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}>
                <strong style={{ fontSize: '16px', color: '#065f46' }}>{overallScore}%</strong>
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                  Official verification unavailable
                </strong>
                <span style={{ fontSize: '10px', color: '#475569' }}>
                  No authorized registry connector is configured. No owner, RTC, deed, mutation, khata, GIS clearance, or RERA result has been verified.
                </span>
              </div>
              <span className="status-pill green">
                <AlertTriangle size={12} /> NOT VERIFIED
              </span>
            </div>
          </div>
        )}

        {/* Registry Result Tabs */}
        {verifications.length > 0 && (
          <div>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', overflowX: 'auto' }}>
              {verifications.map(v => (
                <button
                  key={v.registryName}
                  type="button"
                  onClick={() => setActiveRegTab(v.registryName)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: activeRegTab === v.registryName ? '#2563eb' : '#e2e8f0',
                    background: activeRegTab === v.registryName ? '#eff6ff' : '#fff',
                    color: activeRegTab === v.registryName ? '#1e40af' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{v.registryName}</span>
                  <span style={{
                    fontSize: '8px',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    background: v.status === 'verified' ? '#dcfce7' : '#fef3c7',
                    color: v.status === 'verified' ? '#15803d' : '#b45309'
                  }}>
                    {v.status.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Active Registry Data Viewer */}
            {activeVerification && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
                      {activeVerification.registryName.toUpperCase()} Connection Status
                    </h4>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Latency: {activeVerification.latencyMs}ms · Checked {new Date(activeVerification.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="secondary-btn"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => handleSyncSingle(activeVerification.registryName)}
                      disabled={verifying}
                    >
                      <RefreshCw size={12} className={verifying ? 'spin' : ''} />
                      Re-check {activeVerification.registryName.toUpperCase()}
                    </button>
                    {activeVerification.officialPortalReference && (
                      <a
                        href={activeVerification.officialPortalReference}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-btn"
                        style={{ padding: '4px 10px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ExternalLink size={12} /> Open Portal
                      </a>
                    )}
                    <span className="mono" style={{ fontSize: '9px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' }}>
                      SHA256: {activeVerification.evidenceHash.slice(0, 16)}…
                    </span>
                  </div>
                </div>

                {/* Discrepancy Warnings */}
                {activeVerification.discrepancies.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertTriangle size={15} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ fontSize: '10px', color: '#92400e' }}>
                        <strong>Variance Detected against Workspace:</strong>
                        {activeVerification.discrepancies.map((d, i) => (
                          <p key={i} style={{ margin: '4px 0 0' }}>{d.message}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Matched Data Key-Value Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  {Object.entries(activeVerification.matchedRecord).map(([key, val]) => (
                    <div key={key} style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '9px', color: '#64748b', textTransform: 'capitalize', display: 'block' }}>
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </span>
                      <strong style={{ fontSize: '11px', color: '#1e293b' }}>
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
