declare module 'msw/node' {
  import type { HttpHandler } from 'msw';

  export interface ServerListenOptions {
    onUnhandledRequest?: 'error' | 'warn' | 'bypass';
  }

  export interface SetupServerApi {
    listen(options?: ServerListenOptions): void;
    use(...handlers: HttpHandler[]): void;
    resetHandlers(...handlers: HttpHandler[]): void;
    close(): void;
  }

  export function setupServer(...handlers: HttpHandler[]): SetupServerApi;
}
