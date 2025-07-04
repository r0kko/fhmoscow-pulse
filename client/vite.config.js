import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
const target = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/auth': target,
    },
  },
  preview: {
    allowedHosts: ['pulse.fhmoscow.com'],
  },
});
