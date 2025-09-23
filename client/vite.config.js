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
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      {
        find: '#tests',
        replacement: fileURLToPath(new URL('./tests', import.meta.url)),
      },
      {
        find: /^msw$/,
        replacement: fileURLToPath(
          new URL('./tests/vendor/msw.js', import.meta.url)
        ),
      },
      {
        find: /^msw\/node$/,
        replacement: fileURLToPath(
          new URL('./tests/vendor/msw-node.js', import.meta.url)
        ),
      },
    ],
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
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../coverage/client',
      // Focus unit coverage on shared UI primitives and client-side helpers.
      include: [
        'src/utils/**/*.{js,ts}',
        'src/components/CookieNotice.vue',
        'src/components/GlobalToast.vue',
        'src/components/InlineError.vue',
        'src/components/NavBar.vue',
        'src/components/PasswordInput.vue',
        'src/components/PasswordStrengthMeter.vue',
        'src/components/Pagination.vue',
        'src/components/EmptyState.vue',
        'src/components/BaseTile.vue',
        'src/components/MenuTile.vue',
        'src/components/UpcomingEventCard.vue',
      ],
      exclude: [
        'src/api.{js,ts}',
        'src/router.{js,ts}',
        'src/auth.{js,ts}',
        'src/dadata.{js,ts}',
        'src/errors.{js,ts}',
        'src/views/**',
        'src/utils/lineupSync.{js,ts}',
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
