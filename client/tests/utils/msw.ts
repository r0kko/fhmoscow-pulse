import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';

type ListenOptions = NonNullable<Parameters<typeof server.listen>[0]>;

export function setupMsw(options?: Parameters<typeof server.listen>[0]) {
  const listenArgs: ListenOptions = {
    onUnhandledRequest: options?.onUnhandledRequest ?? 'error',
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
