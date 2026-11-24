import { useState } from 'react';
import { X, Maximize2, Download, Printer, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

interface ClientShowcaseBannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClientShowcaseBannerModal({ isOpen, onClose }: ClientShowcaseBannerProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'interactive' | 'webpage'>('preview');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="banner-showcase-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(3, 5, 11, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Presentation Header Bar */}
      <header
        style={{
          width: '100%',
          maxWidth: '1600px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#00E5FF',
              backgroundColor: 'rgba(0, 229, 255, 0.08)',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              padding: '6px 14px',
              borderRadius: '9999px',
            }}
          >
            <ShieldCheck size={14} color="#00E5FF" />
            OJIX Client Presentation Showcase
          </span>
          <h2 id="banner-showcase-title" style={{ fontSize: '15px', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>
            Property Due Diligence. Reimagined.
          </h2>
        </div>

        {/* View Switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '3px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              style={{
                background: activeTab === 'preview' ? '#0284C7' : 'transparent',
                color: activeTab === 'preview' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              High-Res Visual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('interactive')}
              style={{
                background: activeTab === 'interactive' ? '#0284C7' : 'transparent',
                color: activeTab === 'interactive' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Interactive Banner
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('webpage')}
              style={{
                background: activeTab === 'webpage' ? '#2563EB' : 'transparent',
                color: activeTab === 'webpage' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Full Showcase Page
            </button>
          </div>

          <a
            href="/assets/OJIX_Client_Showcase_Page.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(37, 99, 235, 0.2)',
              border: '1px solid rgba(37, 99, 235, 0.45)',
              color: '#93C5FD',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} /> Open Showcase Webpage
          </a>

          <a
            href="/assets/OJIX_Client_Showcase_Banner.png"
            download="OJIX_Property_Intelligence_Showcase_Banner.png"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #0284C7 0%, #00E5FF 100%)',
              color: '#030712',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <Download size={14} /> Download 4K PNG
          </a>

          <a
            href="/assets/OJIX_Client_Showcase_Banner.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} /> Open Fullscreen
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close presentation showcase"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Banner Content Area */}
      <div
        style={{
          width: '100%',
          maxWidth: '1600px',
          maxHeight: 'calc(100vh - 110px)',
          overflow: 'auto',
          borderRadius: '10px',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(0, 229, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backgroundColor: '#050811',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {activeTab === 'preview' ? (
          <img
            src="/assets/OJIX_Client_Showcase_Banner.png"
            alt="OJIX Property Intelligence Client Showcase Banner"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: '8px',
            }}
          />
        ) : activeTab === 'interactive' ? (
          <iframe
            src="/assets/OJIX_Client_Showcase_Banner.html"
            title="OJIX Property Intelligence Interactive Banner"
            style={{
              width: '1600px',
              height: '1000px',
              border: 'none',
              borderRadius: '8px',
            }}
          />
        ) : (
          <iframe
            src="/assets/OJIX_Client_Showcase_Page.html"
            title="OJIX Property Intelligence Client Showcase Webpage"
            style={{
              width: '100%',
              height: 'calc(100vh - 120px)',
              border: 'none',
              borderRadius: '8px',
              background: '#F8FAFC',
            }}
          />
        )}
      </div>
    </div>
  );
}
