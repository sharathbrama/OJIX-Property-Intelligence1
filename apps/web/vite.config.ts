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
  const target = env.VITE_API_PROXY_TARGET || (await isReachable(4000)
    ? 'http://127.0.0.1:4000'
    : await isReachable(4001) ? 'http://127.0.0.1:4001' : 'http://127.0.0.1:4000');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/health': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
      },
    },
  };
});
