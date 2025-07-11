import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const target = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['pulse.fhmoscow.com', 'localhost', 'lk.fhmoscow.com'],
    proxy: {
      '/auth': target,
      '/api': target,
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['pulse.fhmoscow.com', 'localhost', 'lk.fhmoscow.com'],
  },
});
