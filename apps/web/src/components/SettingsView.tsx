import { useState, useEffect } from 'react';
import { Settings2, Building2, ShieldCheck, Save, Sliders, CheckCircle2 } from 'lucide-react';
import { authFetch } from '../authFetch';

interface SettingsData {
  org_name: string;
  llpin?: string;
  office_address?: string;
  firm_logo_url?: string;
  firm_email?: string;
  default_report_template?: string;
  legal_disclaimer?: string;
  primary_contact: string;
  default_district: string;
  auto_screen_bhoomi: boolean;
  auto_screen_kaveri: boolean;
  auto_screen_spatial: boolean;
  swd_primary_buffer_m: number;
  swd_secondary_buffer_m: number;
  swd_tertiary_buffer_m: number;
  lake_buffer_m: number;
  survey_margin_tolerance_pct: number;
  ocr_confidence_threshold: number;
  enforce_mfa_privileged?: boolean;
}

import type { UserAccount } from '../types';

export function SettingsView({ apiUrl, currentUser }: { apiUrl: string; currentUser?: UserAccount | null }) {
  const [form, setForm] = useState<SettingsData>({
    org_name: 'Karnataka Legal Partners LLP',
    llpin: 'ADA-1604',
    office_address: 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
    firm_logo_url: '',
    firm_email: 'info@ojix.in',
    default_report_template: 'detailed_due_diligence',
    legal_disclaimer: 'The platform is an evidence and workflow system. It does not represent AI output as a legal opinion, ownership determination, or government certification. High-impact conclusions must be verified by a qualified Lead Advocate.',
    primary_contact: 'Deepak Professional (deepak@ojix.local)',
    default_district: 'Bengaluru Urban',
    auto_screen_bhoomi: true,
    auto_screen_kaveri: true,
    auto_screen_spatial: true,
    swd_primary_buffer_m: 50,
    swd_secondary_buffer_m: 25,
    swd_tertiary_buffer_m: 15,
    lake_buffer_m: 30,
    survey_margin_tolerance_pct: 1.0,
    ocr_confidence_threshold: 0.60,
    enforce_mfa_privileged: true,
  });

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const isReadOnly = Boolean(currentUser && currentUser.role !== 'admin' && currentUser.role !== 'owner');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await authFetch(`${apiUrl}/api/settings`);
      const data = await res.json();
      if (data.settings) setForm(data.settings);
    } catch { /* graceful fallback */ }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      setNotice(`RBAC Permission Denied: Role '${currentUser?.role}' cannot modify workspace settings. Admin or Owner required.`);
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const res = await authFetch(`${apiUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Save failed with status ${res.status}`);
      }
      if (data.settings) {
        setForm(data.settings);
        setNotice('Workspace configurations saved and applied across all due-diligence engines.');
      }
    } catch (err: any) {
      setNotice(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE PREFERENCES <span>•</span> TENANT CONFIGURATION</div>
          <h1>Workspace & Engine Settings</h1>
          <p>Configure legal organization credentials, spatial buffer rules, tolerance margins, and OCR thresholds.</p>
        </div>
      </div>

      {isReadOnly && (
        <div className="alert alert-warning" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', marginBottom: '16px' }}>
          <span><strong>RBAC Policy:</strong> Workspace configuration is restricted to Administrators and Owners. Your current role is <strong>{currentUser?.role?.toUpperCase()}</strong>.</span>
        </div>
      )}

      {notice && (
        <div className="alert alert-info">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Organization Profile */}
            <div className="panel" style={{ padding: '20px' }}>
              <div className="panel-head" style={{ padding: 0, marginBottom: '16px' }}>
                <div>
                  <h3>Organization & Legal Practice</h3>
                  <p>Displayed on formal due diligence title reports</p>
                </div>
                <Building2 size={18} style={{ color: '#64748b' }} />
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Organization / Law Firm Name</span>
                  <input
                    type="text"
                    value={form.org_name}
                    onChange={e => setForm({ ...form, org_name: e.target.value })}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Firm Registration / LLPIN</span>
                  <input
                    type="text"
                    placeholder="e.g. ADA-1604 or Reg No"
                    value={form.llpin || ''}
                    onChange={e => setForm({ ...form, llpin: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Primary Due Diligence Counsel</span>
                  <input
                    type="text"
                    value={form.primary_contact}
                    onChange={e => setForm({ ...form, primary_contact: e.target.value })}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Official Firm Email</span>
                  <input
                    type="email"
                    placeholder="e.g. info@ojix.in"
                    value={form.firm_email || ''}
                    onChange={e => setForm({ ...form, firm_email: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Default Revenue District</span>
                  <input
                    type="text"
                    value={form.default_district}
                    onChange={e => setForm({ ...form, default_district: e.target.value })}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Default Report Template Mode</span>
                  <select
                    value={form.default_report_template || 'detailed_due_diligence'}
                    onChange={e => setForm({ ...form, default_report_template: e.target.value })}
                  >
                    <option value="detailed_due_diligence">Detailed Due Diligence (Full Legal Opinion & Evidence)</option>
                    <option value="preliminary_screening">Preliminary Screening (Fast First-Look & Completeness)</option>
                    <option value="client_decision_pack">Client Decision Pack (Executive Summary & Limitations)</option>
                  </select>
                </label>
                <label className="form-field span-2">
                  <span>Registered Office Address</span>
                  <input
                    type="text"
                    placeholder="e.g. Ranga Rao Rd, Shankarapura, Bengaluru 560004"
                    value={form.office_address || ''}
                    onChange={e => setForm({ ...form, office_address: e.target.value })}
                  />
                </label>
                <label className="form-field span-2">
                  <span>Firm Logo (Upload Image or Enter URL)</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      id="firm-logo-file-input"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            if (ev.target?.result) {
                              setForm({ ...form, firm_logo_url: ev.target.result as string });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="firm-logo-file-input"
                      className="secondary-btn"
                      style={{ cursor: 'pointer', padding: '7px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      📁 Upload Logo File
                    </label>
                    <input
                      type="text"
                      placeholder="Or enter image URL (https://...)"
                      value={form.firm_logo_url || ''}
                      onChange={e => setForm({ ...form, firm_logo_url: e.target.value })}
                      style={{ flex: 1, minWidth: '220px' }}
                    />
                    {form.firm_logo_url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img
                          src={form.firm_logo_url}
                          alt="Firm Logo Preview"
                          style={{ height: '34px', maxWidth: '120px', objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px', background: '#fff' }}
                          onError={(e) => { (e.currentTarget.style.display = 'none'); }}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          title="Remove logo"
                          onClick={() => setForm({ ...form, firm_logo_url: '' })}
                          style={{ color: '#ef4444', fontSize: '16px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </label>
                <label className="form-field span-2">
                  <span>Legal Disclaimer & Limitation Statement (Printed on Title Reports)</span>
                  <textarea
                    rows={3}
                    placeholder="Mandatory legal limitation statement required by FRD RISK-05"
                    value={form.legal_disclaimer || ''}
                    onChange={e => setForm({ ...form, legal_disclaimer: e.target.value })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                    Enforces FRD Operating Principle: Platform evidence does not constitute a government certificate or ownership declaration without professional sign-off.
                  </small>
                </label>
              </div>
            </div>

            {/* Firm Security & Multi-Factor Authentication */}
            <div className="panel" style={{ padding: '20px' }}>
              <div className="panel-head" style={{ padding: 0, marginBottom: '16px' }}>
                <div>
                  <h3>Firm Security & Multi-Factor Authentication (FRD §6.1 AUTH-01 / §20)</h3>
                  <p>Enforce mandatory two-factor authentication (OTP) for workspace members and reviewers</p>
                </div>
                <ShieldCheck size={18} style={{ color: '#64748b' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.enforce_mfa_privileged ?? true}
                    onChange={e => setForm({ ...form, enforce_mfa_privileged: e.target.checked })}
                    disabled={isReadOnly}
                    style={{ marginTop: '3px', width: '18px', height: '18px', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', display: 'block' }}>
                      Enforce Mandatory MFA for Workspace Accounts & Reviewers
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, display: 'block', marginTop: '2px' }}>
                      Requires 6-digit email OTP verification on every login for Managing Partners (Owner), Organization Admins, Lead Advocates (Lawyers), Evidence Analysts, Operations, and Consultants per FRD AUTH-01. When turned off, workspace members can sign in directly with their password.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Spatial Buffer Rules */}
            <div className="panel" style={{ padding: '20px' }}>
              <div className="panel-head" style={{ padding: 0, marginBottom: '16px' }}>
                <div>
                  <h3>Karnataka GIS Buffer Rules</h3>
                  <p>Statutory distances enforced by BDA Revised Master Plan and NGT rulings</p>
                </div>
                <Sliders size={18} style={{ color: '#64748b' }} />
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Primary Stormwater Drain Buffer (m)</span>
                  <input
                    type="number"
                    value={form.swd_primary_buffer_m}
                    onChange={e => setForm({ ...form, swd_primary_buffer_m: Number(e.target.value) })}
                    min="10"
                    max="100"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Secondary Drain Buffer (m)</span>
                  <input
                    type="number"
                    value={form.swd_secondary_buffer_m}
                    onChange={e => setForm({ ...form, swd_secondary_buffer_m: Number(e.target.value) })}
                    min="5"
                    max="50"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Tertiary Drain Buffer (m)</span>
                  <input
                    type="number"
                    value={form.swd_tertiary_buffer_m}
                    onChange={e => setForm({ ...form, swd_tertiary_buffer_m: Number(e.target.value) })}
                    min="5"
                    max="30"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Lake Periphery Buffer (m)</span>
                  <input
                    type="number"
                    value={form.lake_buffer_m}
                    onChange={e => setForm({ ...form, lake_buffer_m: Number(e.target.value) })}
                    min="30"
                    max="100"
                    required
                  />
                </label>
              </div>
            </div>

            {/* Discrepancy & OCR Engine Thresholds */}
            <div className="panel" style={{ padding: '20px' }}>
              <div className="panel-head" style={{ padding: 0, marginBottom: '16px' }}>
                <div>
                  <h3>Discrepancy Tolerances & OCR Confidence</h3>
                  <p>Sensitivity parameters for automated screening</p>
                </div>
                <ShieldCheck size={18} style={{ color: '#64748b' }} />
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Survey Margin Tolerance (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    value={form.survey_margin_tolerance_pct}
                    onChange={e => setForm({ ...form, survey_margin_tolerance_pct: Number(e.target.value) })}
                    required
                  />
                  <small style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>
                    Variances below this threshold are flagged as normal survey variations.
                  </small>
                </label>

                <label className="form-field">
                  <span>OCR Confidence Threshold</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="0.99"
                    value={form.ocr_confidence_threshold}
                    onChange={e => setForm({ ...form, ocr_confidence_threshold: Number(e.target.value) })}
                    required
                  />
                  <small style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>
                    Extractions below this score trigger mandatory side-by-side manual review.
                  </small>
                </label>
              </div>
            </div>
          </div>

          {/* Action sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '14px', color: '#1e293b' }}>
                Save Configurations
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
                Changes will take immediate effect for all title analysis, geospatial buffer calculations, and PDF reports.
              </p>
              <button type="submit" className="primary-btn" style={{ width: '100%' }} disabled={saving}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
