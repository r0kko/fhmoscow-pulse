import { fileURLToPath } from 'node:url';
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
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
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
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './tests/setup/vitest.setup.js',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../coverage/client',
      // Focus unit coverage on shared UI primitives and client-side helpers.
      include: [
        'src/utils/**/*.js',
        'src/components/CookieNotice.vue',
        'src/components/GlobalToast.vue',
      ],
      exclude: [
        'src/api.js',
        'src/router.js',
        'src/auth.js',
        'src/dadata.js',
        'src/errors.js',
        'src/views/**',
        'src/utils/lineupSync.js',
      ],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 75,
        lines: 80,
      },
    },
  },
});
