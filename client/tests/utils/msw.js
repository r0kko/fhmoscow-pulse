import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server.js';

export function setupMsw(options = {}) {
  const listenArgs = {
    onUnhandledRequest: options.onUnhandledRequest || 'error',
  };

  beforeAll(() => {
    server.listen(listenArgs);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  return server;
}
