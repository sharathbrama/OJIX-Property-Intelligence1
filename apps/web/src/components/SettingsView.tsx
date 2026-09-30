import { useState, useEffect } from 'react';
import { Settings2, Building2, ShieldCheck, Save, Sliders, CheckCircle2 } from 'lucide-react';

interface SettingsData {
  org_name: string;
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
}

export function SettingsView({ apiUrl }: { apiUrl: string }) {
  const [form, setForm] = useState<SettingsData>({
    org_name: 'Karnataka Legal Partners LLP',
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
  });

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/settings`);
      const data = await res.json();
      if (data.settings) setForm(data.settings);
    } catch { /* graceful fallback */ }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const res = await fetch(`${apiUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
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
                <label className="form-field span-2">
                  <span>Organization / Law Firm Name</span>
                  <input
                    type="text"
                    value={form.org_name}
                    onChange={e => setForm({ ...form, org_name: e.target.value })}
                    required
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
                  <span>Default Revenue District</span>
                  <input
                    type="text"
                    value={form.default_district}
                    onChange={e => setForm({ ...form, default_district: e.target.value })}
                    required
                  />
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
