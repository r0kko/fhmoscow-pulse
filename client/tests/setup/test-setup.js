// Test setup for Vitest + Testing Library (Vue)
import '@testing-library/jest-dom/vitest';

// Optionally start MSW for integration tests that hit network
// Importing conditionally to avoid overhead for simple unit tests
if (process.env.MSW === '1') {
  const { server } = await import('../mocks/server.js');
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

// Silence noisy console.error logs in tests unless explicitly asserted
const originalError = console.error;
console.error = (...args) => {
  const msg = String(args[0] || '');
  if (msg.includes('Not implemented:')) return;
  originalError(...args);
};
