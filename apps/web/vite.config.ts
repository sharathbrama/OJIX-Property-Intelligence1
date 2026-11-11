import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
