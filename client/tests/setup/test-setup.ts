// Test setup for Vitest + Testing Library (Vue)
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Optionally start MSW for integration tests that hit network
// Importing conditionally to avoid overhead for simple unit tests
if (process.env['MSW'] === '1') {
  import('../mocks/server')
    .then(({ server }) => {
      beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
      afterEach(() => server.resetHandlers());
      afterAll(() => server.close());
    })
    .catch((err) => {
      console.error('MSW bootstrap failed', err);
    });
}

// Silence noisy console.error logs in tests unless explicitly asserted
const originalError = console.error.bind(console);
console.error = (...args: Parameters<Console['error']>) => {
  const msg = String(args[0] || '');
  if (msg.includes('Not implemented:')) return;
  originalError(...args);
};
