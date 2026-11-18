import React from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import './admin.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Global uncaught error catcher to ensure any script or module error is visible on screen
window.addEventListener('error', (event) => {
  console.error("Global window error:", event.error || event.message);
  const root = document.getElementById('root');
  if (root && (!root.hasChildNodes() || root.innerHTML.trim() === '')) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; padding: 24px; font-family: Inter, system-ui, sans-serif; color: #f8fafc;">
        <div style="max-width: 680px; width: 100%; background: #1e293b; border-radius: 16px; border: 1px solid #ef4444; padding: 32px;">
          <h2 style="color: #ef4444; margin: 0 0 12px;">Script Error Detected</h2>
          <p style="color: #cbd5e1; font-size: 14px;"><b>Message:</b> ${event.message}</p>
          <pre style="background: #0f172a; padding: 14px; border-radius: 8px; color: #fca5a5; font-size: 12px; overflow: auto;">${event.error?.stack || event.message}</pre>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.href='/';" style="margin-top: 16px; padding: 10px 18px; border-radius: 6px; background: #2563eb; color: #fff; border: 0; font-weight: 700; cursor: pointer;">Reset Cache & Reload</button>
        </div>
      </div>
    `;
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
