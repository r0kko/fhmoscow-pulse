const STANDARD_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;

type StandardMethod = (typeof STANDARD_METHODS)[number];

type PathMatcher = string | RegExp | ((url: URL) => boolean);

export interface HandlerContext {
  request: Request;
}

export type Resolver = (
  context: HandlerContext
) => Promise<Response> | Response;

export interface Handler {
  method: StandardMethod;
  resolver: Resolver;
  matches(url: URL, requestMethod: string): boolean;
}

type HttpApi = Record<
  Lowercase<StandardMethod>,
  (path: PathMatcher, resolver: Resolver) => Handler
>;

type FetchArguments = [input: RequestInfo | URL, init?: RequestInit];

type OnUnhandledStrategy = 'warn' | 'error';

type SetupServerOptions = {
  onUnhandledRequest?: OnUnhandledStrategy;
};

type SetupServerReturn = {
  listen: (options?: SetupServerOptions) => void;
  use: (...handlers: Handler[]) => void;
  resetHandlers: (...handlers: Handler[]) => void;
  close: () => void;
  events: { on: () => void };
};

function createMatcher(path: PathMatcher): (url: URL) => boolean {
  if (path instanceof RegExp) {
    return (url) => path.test(url.href);
  }
  if (typeof path === 'function') {
    return path;
  }
  if (typeof path === 'string') {
    if (path.startsWith('*/')) {
      const suffix = path.slice(1);
      return (url) =>
        url.pathname.endsWith(suffix) || url.href.endsWith(suffix);
    }
    if (/^https?:/i.test(path)) {
      return (url) => url.href === path;
    }
    return (url) => url.pathname === path;
  }
  return () => false;
}

function createHandler(
  method: StandardMethod,
  path: PathMatcher,
  resolver: Resolver
): Handler {
  const matcher = createMatcher(path);
  return {
    method,
    resolver,
    matches(url: URL, requestMethod: string) {
      return requestMethod === method && matcher(url);
    },
  };
}

function normaliseInput(
  input: RequestInfo | URL | string,
  baseOrigin: string
): RequestInfo | URL {
  if (typeof input === 'string') {
    if (/^[a-z]+:/i.test(input)) return input;
    return new URL(input, baseOrigin).href;
  }
  return input;
}

function toRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): Request {
  if (input instanceof Request) return input;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : String(input);
  return new Request(url, init);
}

function extractUrl(request: Request, baseOrigin: string): URL {
  try {
    return new URL(request.url, baseOrigin);
  } catch {
    return new URL(baseOrigin);
  }
}

export const HttpResponse = {
  json(body: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers,
    });
  },
};

export const http = STANDARD_METHODS.reduce<HttpApi>((api, method) => {
  api[method.toLowerCase() as Lowercase<StandardMethod>] = (path, resolver) =>
    createHandler(method, path, resolver);
  return api;
}, {} as HttpApi);

export type HttpHandler = Handler;

export function setupServer(...initialHandlers: Handler[]): SetupServerReturn {
  let originalFetch: typeof fetch | null = null;
  const baseHandlers = [...initialHandlers];
  let handlers = [...baseHandlers];
  let onUnhandledRequest: OnUnhandledStrategy = 'warn';

  const events = {
    on() {
      /* noop */
    },
  };

  function applyHandlers(nextHandlers: Handler[]): void {
    handlers = [...nextHandlers];
  }

  return {
    listen(options = {}) {
      onUnhandledRequest = options.onUnhandledRequest || onUnhandledRequest;
      if (!originalFetch) {
        originalFetch = globalThis.fetch.bind(globalThis);
      }
      const baseOrigin =
        (typeof window !== 'undefined' && window.location?.origin) ||
        'http://localhost';

      applyHandlers(baseHandlers);

      globalThis.fetch = async (
        input: FetchArguments[0],
        init: FetchArguments[1] = {}
      ): Promise<Response> => {
        const normalised = normaliseInput(input, baseOrigin);
        const request = toRequest(normalised, init);
        const url = extractUrl(request, baseOrigin);
        const method = request.method.toUpperCase();
        const handler = handlers.find((h) => h.matches(url, method));
        if (!handler) {
          if (onUnhandledRequest === 'error') {
            throw new Error(`Unhandled ${method} ${url.href}`);
          }
          if (originalFetch) {
            return originalFetch(input, init);
          }
          return fetch(input, init);
        }
        const result = await handler.resolver({ request });
        if (result instanceof Response) {
          return result;
        }
        throw new Error('Handler should return a Response instance');
      };
    },
    use(...nextHandlers: Handler[]) {
      handlers = [...nextHandlers, ...handlers];
    },
    resetHandlers(...nextHandlers: Handler[]) {
      if (nextHandlers.length > 0) {
        applyHandlers(nextHandlers);
      } else {
        applyHandlers(baseHandlers);
      }
    },
    close() {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
        originalFetch = null;
      }
      applyHandlers(baseHandlers);
    },
    events,
  };
}
