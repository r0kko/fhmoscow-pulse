import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// In containers, default to the API service name on the bridge network.
// Can be overridden via env VITE_API_PROXY_TARGET.
const target = process.env.VITE_API_PROXY_TARGET || 'http://app:3000';

const proxyConfig = {
  '/auth': {
    target,
    changeOrigin: true,
  },
  '/api': {
    target,
    changeOrigin: true,
    // Strip the /api prefix so backend sees routes at root
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'pulse.fhmoscow.com',
      'localhost',
      '127.0.0.1',
      'lk.fhmoscow.com',
    ],
    proxy: proxyConfig,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: [
      'pulse.fhmoscow.com',
      'localhost',
      '127.0.0.1',
      'lk.fhmoscow.com',
    ],
    // Vite Preview supports proxy since v5; mirror dev proxy for parity
    proxy: proxyConfig,
  },
});
