import React from 'react';

export function SalesBrochure() {
  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2563eb 100%)', color: '#fff', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 18px', borderRadius: 20, fontSize: 13, letterSpacing: 2, marginBottom: 24 }}>
            🏛️ KARNATAKA-FIRST PROPERTY INTELLIGENCE
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 900, margin: '0 0 20px', lineHeight: 1.1, letterSpacing: -1 }}>
            OJIX<br />
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Property Intelligence
            </span>
          </h1>
          <p style={{ fontSize: 22, opacity: 0.85, lineHeight: 1.5, marginBottom: 36 }}>
            End-to-end property due diligence platform for Karnataka.<br />
            From document intake to advocate sign-off — 10 phases, 8 roles, one system.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/demo" style={{ padding: '14px 32px', background: '#2563eb', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', display: 'inline-block' }}>
              🚀 Try Live Demo
            </a>
            <a href="mailto:sales@ojix.in" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block' }}>
              📧 Contact Sales
            </a>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '28px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20 }}>
          {[
            { label: 'Due Diligence Phases', value: '10', icon: '📋' },
            { label: 'Role Workflows', value: '8', icon: '👥' },
            { label: 'Document Types', value: '50+', icon: '📄' },
            { label: 'Languages', value: 'EN + KN', icon: '🌐' },
            { label: 'GIS Buffer Rules', value: 'Real-time', icon: '🗺️' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28 }}>{stat.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#60a5fa' }}>{stat.value}</div>
              <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.5 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Statement */}
      <div style={{ padding: '60px 40px', background: '#fff', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>The Problem We Solve</h2>
        <p style={{ color: '#475569', fontSize: 18, lineHeight: 1.6, marginBottom: 32 }}>
          Property fraud in Karnataka costs buyers crores annually. Manual title verification is slow, opaque, and error-prone.
          Courts, revenue departments, and municipal records speak different languages — literally.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { icon: '⏱️', title: 'Weeks of Manual Search', desc: 'Title chain verification takes 3–6 weeks through traditional methods' },
            { icon: '📜', title: 'Fragmented Records', desc: 'EC, RTC, Khata, Court records — all in separate silos' },
            { icon: '🌊', title: 'Rajakaluve Risk', desc: 'Storm-water drains and buffer zones cause millions in losses' },
            { icon: '🔤', title: 'Bilingual Barrier', desc: 'Revenue documents in Kannada, legal docs in English — no unified view' },
          ].map(item => (
            <div key={item.title} style={{ padding: 24, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{item.title}</div>
              <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 10 Phase Workflow */}
      <div style={{ padding: '60px 40px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>10-Phase Due Diligence Workflow</h2>
          <p style={{ color: '#475569', fontSize: 16, marginBottom: 36 }}>Structured, traceable, legally defensible</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { phase: 1, title: 'Property Intake', desc: 'Register property, capture owner details, assign team', role: 'Operations', color: '#3b82f6' },
              { phase: 2, title: 'Document Collection', desc: 'Upload EC, Title Deeds, RTC, Khata, Survey records', role: 'Operations', color: '#8b5cf6' },
              { phase: 3, title: 'OCR Extraction', desc: 'Bilingual OCR (Kannada + English) extracts structured data', role: 'System', color: '#06b6d4' },
              { phase: 4, title: 'Data Verification', desc: 'Analyst reviews extracted fields, corrects OCR errors', role: 'Analyst', color: '#10b981' },
              { phase: 5, title: 'Title Chain Analysis', desc: '40-year ownership chain reconstruction and gap detection', role: 'Analyst', color: '#10b981' },
              { phase: 6, title: 'Spatial Screening', desc: 'GIS buffer checks: Rajakaluve, NH, Railway, Forest zones', role: 'Analyst', color: '#f59e0b' },
              { phase: 7, title: 'Legal Review', desc: 'Lawyer audits findings, flags discrepancies', role: 'Lawyer', color: '#ef4444' },
              { phase: 8, title: 'Advocate Sign-Off', desc: 'Formal opinion: Marketable / Conditional / Defective', role: 'Lawyer', color: '#ef4444' },
              { phase: 9, title: 'Report Generation', desc: 'PDF report with evidence anchors and GIS map', role: 'Consultant', color: '#f97316' },
              { phase: 10, title: 'Client Delivery', desc: 'Secure share to client viewer with approved status gate', role: 'Consultant', color: '#84cc16' },
            ].map((item, idx) => (
              <div key={item.phase} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: item.color,
                    color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{item.phase}</div>
                  {idx < 9 && <div style={{ width: 2, height: 32, background: '#e2e8f0' }} />}
                </div>
                <div style={{ paddingBottom: 24, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{item.title}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: item.color + '22', color: item.color }}>
                      {item.role}
                    </span>
                  </div>
                  <div style={{ color: '#475569', fontSize: 14 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role Capabilities */}
      <div style={{ padding: '60px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Role-Based Access & Capabilities</h2>
          <p style={{ color: '#475569', fontSize: 16, marginBottom: 36 }}>Each role has purpose-built workflows with strict permission boundaries</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { role: 'Operations', icon: '📥', color: '#3b82f6', caps: ['Document intake', 'Checklist management', 'Property registration'] },
              { role: 'Analyst', icon: '🔍', color: '#8b5cf6', caps: ['OCR verification', 'Title chain build', 'Evidence tagging'] },
              { role: 'Lawyer', icon: '⚖️', color: '#ef4444', caps: ['Legal review', 'Formal sign-off', 'Opinion verdicts'] },
              { role: 'Consultant', icon: '📊', color: '#f97316', caps: ['Client packs', 'Report export', 'Matter sharing'] },
              { role: 'Viewer', icon: '👁️', color: '#10b981', caps: ['Shared matters', 'Approved reports', 'Secure access'] },
              { role: 'Admin', icon: '⚙️', color: '#6b7280', caps: ['User management', 'Role assignment', 'Audit logs'] },
              { role: 'Data Steward', icon: '🗂️', color: '#0ea5e9', caps: ['GIS rule versions', 'Source freshness', 'Buffer management'] },
              { role: 'Owner', icon: '👑', color: '#fbbf24', caps: ['Full system access', 'All reports', 'API console'] },
            ].map(item => (
              <div key={item.role} style={{ padding: 20, border: `1px solid ${item.color}33`, borderRadius: 12, background: item.color + '08' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, color: item.color, marginBottom: 10, fontSize: 15 }}>{item.role}</div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', listStyleType: 'disc' }}>
                  {item.caps.map(c => (
                    <li key={c} style={{ color: '#475569', fontSize: 13, marginBottom: 4 }}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div style={{ padding: '60px 40px', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 36 }}>Key Technology Features</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {[
              { icon: '🔤', title: 'Bilingual OCR', desc: 'Tesseract-powered extraction in both Kannada and English. Handles revenue, legal, and municipal documents.' },
              { icon: '⛓️', title: '40-Year Title Chain', desc: 'Automated ancestor deed reconstruction with gap detection and risk flagging at every link.' },
              { icon: '🗺️', title: 'GIS Spatial Screening', desc: 'Real-time buffer zone analysis: Rajakaluve drains, NH corridors, Railway ROW, Forest boundaries.' },
              { icon: '📍', title: 'Karnataka Location Hierarchy', desc: 'State → District → Taluk → Hobli → Village — full Karnataka revenue hierarchy with survey numbers.' },
              { icon: '🔒', title: 'Immutable Audit Trail', desc: 'Every action, every sign-off, every share is permanently logged with SHA-256 snapshot hash.' },
              { icon: '📄', title: 'PDF Report Engine', desc: 'Headless Chromium-generated reports with evidence bounding boxes, maps, and advocate signature block.' },
            ].map(feat => (
              <div key={feat.title} style={{ padding: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{feat.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{feat.title}</div>
                <div style={{ opacity: 0.75, fontSize: 14, lineHeight: 1.6 }}>{feat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '80px 40px', background: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', marginBottom: 16 }}>
            Ready to transform your<br />property due diligence?
          </h2>
          <p style={{ color: '#475569', fontSize: 18, marginBottom: 36, lineHeight: 1.6 }}>
            Request a live demo or contact our sales team for a customized walkthrough tailored to your firm's workflow.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/demo" style={{ padding: '16px 36px', background: '#1e3a8a', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 17, textDecoration: 'none', display: 'inline-block' }}>
              🚀 Start Free Demo
            </a>
            <a href="mailto:sales@ojix.in" style={{ padding: '16px 36px', background: '#fff', color: '#1e3a8a', borderRadius: 10, fontWeight: 700, fontSize: 17, textDecoration: 'none', border: '2px solid #1e3a8a', display: 'inline-block' }}>
              📧 sales@ojix.in
            </a>
          </div>
          <p style={{ marginTop: 32, color: '#94a3b8', fontSize: 13 }}>
            © 2025 OJIX Technologies · Karnataka · India<br />
            Designed for property lawyers, analysts, and consultants in Bengaluru and beyond.
          </p>
        </div>
      </div>
    </div>
  );
}
