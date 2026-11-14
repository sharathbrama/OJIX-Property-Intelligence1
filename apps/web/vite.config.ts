import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The public landing and read-only seeded demo run without an API. Client
  // login and registration use this origin once the backend is deployed.
  if (process.env.VERCEL && mode === 'production' && env.VITE_API_BASE_URL?.trim()) {
    const apiOrigin = new URL(env.VITE_API_BASE_URL.trim());
    if (apiOrigin.protocol !== 'https:') {
      throw new Error('VITE_API_BASE_URL must use HTTPS for Vercel production builds.');
    }
  }
  // Use the API port from the shared .env. Probing fallback ports can select
  // a stale API instance and make the browser display outdated errors.
  const target = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${env.PORT || '4002'}`;
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/health': { target, changeOrigin: true },
      },
    },
  };
});
