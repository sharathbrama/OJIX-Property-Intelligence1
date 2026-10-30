import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import net from 'node:net';

const isReachable = (port: number) => new Promise<boolean>(resolve => {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(350);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(false));
});

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiCandidates = (env.VITE_API_PROXY_TARGET ? [env.VITE_API_PROXY_TARGET] : [4003, 4000, 4001, 4002, 4004, 4005].map(port => `http://127.0.0.1:${port}`));
  const target = (await Promise.all(apiCandidates.map(async candidate => ({ candidate, reachable: await isReachable(Number(new URL(candidate).port)) }))))
    .find(result => result.reachable)?.candidate || apiCandidates[0];
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
