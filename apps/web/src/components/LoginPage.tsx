import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, UserCheck, Key, Lock, ArrowRight, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UserAccount, UserRole } from '../types';

interface LoginPageProps {
  apiUrl: string;
  onLoginSuccess: (token: string, user: UserAccount) => void;
}

export function LoginPage({ apiUrl, onLoginSuccess }: LoginPageProps) {
  const [dummyAccounts, setDummyAccounts] = useState<UserAccount[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>('user-owner');
  const [email, setEmail] = useState<string>('owner@ojix.local');
  const [password, setPassword] = useState<string>('ojix123');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetch(`${apiUrl}/api/auth/dummy-accounts`)
      .then(res => res.json())
      .then(data => {
        if (data.accounts) {
          setDummyAccounts(data.accounts);
        }
      })
      .catch(() => {
        // Fallback dummy accounts if API is booting
        setDummyAccounts([
          {
            uid: 'user-owner',
            email: 'owner@ojix.local',
            name: 'Rajesh Sharma',
            designation: 'Managing Partner',
            role: 'owner',
            avatar: 'RS',
            description: 'Workspace Owner — full tenant and governance administration, deletion, and system authorization.'
          },
          {
            uid: 'user-admin',
            email: 'admin@ojix.local',
            name: 'Priya Nair',
            designation: 'Firm Administrator',
            role: 'admin',
            avatar: 'PN',
            description: 'Firm Administrator — workspace settings, GIS configurations, member governance, and data export.'
          },
          {
            uid: 'user-lawyer',
            email: 'lawyer@ojix.local',
            name: 'Adv. Anand Rao',
            designation: 'Senior Legal Reviewer',
            role: 'lawyer',
            avatar: 'AR',
            description: 'Senior Legal Counsel — dispute/verify title chain events, override OCR extractions, and sign off reports.'
          },
          {
            uid: 'user-analyst',
            email: 'analyst@ojix.local',
            name: 'Kavita Reddy',
            designation: 'Due Diligence Analyst',
            role: 'analyst',
            avatar: 'KR',
            description: 'Due Diligence Analyst — case intake, document upload, trigger preliminary analyses, and run registry sync.'
          },
          {
            uid: 'user-viewer',
            email: 'viewer@ojix.local',
            name: 'Vikram Mehta',
            designation: 'Client / Audit Inspector',
            role: 'viewer',
            avatar: 'VM',
            description: 'External Auditor / Read-Only Client — inspect evidence, view map layers and reports (all mutations blocked).'
          }
        ]);
      });
  }, [apiUrl]);

  const selectAccount = (acc: UserAccount) => {
    setSelectedUid(acc.uid);
    setEmail(acc.email);
    setPassword('ojix123');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, uid: selectedUid, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'owner': return { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' };
      case 'admin': return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'lawyer': return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
      case 'analyst': return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
      case 'viewer': return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
      default: return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    }
  };

  const currentAccount = dummyAccounts.find(a => a.uid === selectedUid) || dummyAccounts[0];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, #1e293b 0%, #0f172a 100%)',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        maxWidth: '920px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)'
      }}>
        {/* Left Column: Brand & Role Selector */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px'
              }}>
                O
              </div>
              <div>
                <strong style={{ fontSize: '18px', color: '#0f172a', letterSpacing: '-0.3px', display: 'block' }}>
                  OJIX
                </strong>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px', fontWeight: 700 }}>
                  PROPERTY INTELLIGENCE
                </span>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              Bengaluru & Karnataka Legal Due-Diligence Workspace. Select a dummy role below to immediately test RBAC guardrails.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1-Click Dummy RBAC Accounts:
            </span>

            {dummyAccounts.map(acc => {
              const colors = getRoleBadgeColor(acc.role);
              const isSelected = acc.uid === selectedUid;

              return (
                <div
                  key={acc.uid}
                  onClick={() => selectAccount(acc)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: colors.bg,
                    color: colors.text,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    flexShrink: 0
                  }}>
                    {acc.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <strong style={{ fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acc.name}
                      </strong>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        textTransform: 'uppercase'
                      }}>
                        {acc.role}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {acc.designation} • {acc.email}
                    </span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} style={{ color: '#2563eb', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 'auto',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#065f46',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <ShieldCheck size={16} style={{ color: '#059669', flexShrink: 0, marginTop: '1px' }} />
            <span>
              All 6 Karnataka Government Portals (Bhoomi, Kaveri 2.0, Mojini, Dishaank, e-Aasthi, K-RERA) are integrated and ready for sync.
            </span>
          </div>
        </div>

        {/* Right Column: Sign In Form & Role Capabilities */}
        <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '20px', color: '#0f172a', fontWeight: 800 }}>
              Sign in to Workspace
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Selected Identity: <strong style={{ color: '#1e293b' }}>{currentAccount?.name}</strong> ({currentAccount?.role?.toUpperCase()})
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#991b1b',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Account Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <UserCheck size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Password (Dummy: <code style={{ color: '#2563eb' }}>ojix123</code>)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              </div>
            </div>

            {/* RBAC Capabilities Preview */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '11px',
              color: '#334155'
            }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '6px' }}>
                RBAC Access Level for {currentAccount?.role?.toUpperCase()}:
              </strong>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px', color: '#475569' }}>
                {currentAccount?.role === 'owner' && (
                  <>
                    <li>Full system authority & tenant ownership</li>
                    <li>Configure workspace & GIS buffer rules</li>
                    <li>Create properties, upload deeds & trigger screening</li>
                    <li>Dispute / verify title chain events</li>
                  </>
                )}
                {currentAccount?.role === 'admin' && (
                  <>
                    <li>Organization & GIS buffer settings configuration</li>
                    <li>Manage property workspaces & case files</li>
                    <li>Upload documents & run full government sync</li>
                    <li>Dispute / verify title chain events</li>
                  </>
                )}
                {currentAccount?.role === 'lawyer' && (
                  <>
                    <li>Verify & dispute title chain instruments with rationales</li>
                    <li>Override OCR extracted metadata & evidence bounds</li>
                    <li>Bookmark statutory case laws & export due-diligence PDF</li>
                    <li style={{ color: '#94a3b8' }}>Workspace admin settings locked to Admin/Owner</li>
                  </>
                )}
                {currentAccount?.role === 'analyst' && (
                  <>
                    <li>Create property case files & intake survey data</li>
                    <li>Upload registered deeds & trigger document extraction</li>
                    <li>Run multi-registry sync (Bhoomi, Kaveri, Mojini, etc.)</li>
                    <li style={{ color: '#94a3b8' }}>Senior legal sign-offs locked to Lawyer/Admin</li>
                  </>
                )}
                {currentAccount?.role === 'viewer' && (
                  <>
                    <li>Inspect property details, cadastral maps & findings</li>
                    <li>View official government records & evidence hashes</li>
                    <li>Read-only auditor access: all mutations blocked with 403</li>
                  </>
                )}
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? 'Authenticating…' : `Sign In as ${currentAccount?.role?.toUpperCase()}`}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
