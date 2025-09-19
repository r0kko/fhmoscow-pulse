const STANDARD_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function createMatcher(path) {
  if (path instanceof RegExp) {
    return (url) => path.test(url.href);
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

function createHandler(method, path, resolver) {
  const matcher = createMatcher(path);
  return {
    method,
    resolver,
    matches(url, requestMethod) {
      return requestMethod === method && matcher(url);
    },
  };
}

function normaliseInput(input, baseOrigin) {
  if (typeof input === 'string') {
    if (/^[a-z]+:/i.test(input)) return input;
    return new URL(input, baseOrigin).href;
  }
  return input;
}

export const HttpResponse = {
  json(body, init = {}) {
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

export const http = STANDARD_METHODS.reduce((api, method) => {
  api[method.toLowerCase()] = (path, resolver) =>
    createHandler(method, path, resolver);
  return api;
}, {});

export function setupServer(...initialHandlers) {
  let originalFetch = null;
  const baseHandlers = [...initialHandlers];
  let handlers = [...baseHandlers];
  let onUnhandledRequest = 'warn';

  const events = {
    on() {
      /* noop */
    },
  };

  function applyHandlers(nextHandlers) {
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

      globalThis.fetch = async (input, init = {}) => {
        const normalised = normaliseInput(input, baseOrigin);
        const request =
          input instanceof Request
            ? input
            : new Request(normalised, init);
        const url = new URL(request.url, baseOrigin);
        const method = request.method.toUpperCase();
        const handler = handlers.find((h) => h.matches(url, method));
        if (!handler) {
          if (onUnhandledRequest === 'error') {
            throw new Error(`Unhandled ${method} ${url.href}`);
          }
          return originalFetch(input, init);
        }
        const result = await handler.resolver({ request });
        if (result instanceof Response) {
          return result;
        }
        throw new Error('Handler should return a Response instance');
      };
    },
    use(...nextHandlers) {
      handlers = [...nextHandlers, ...handlers];
    },
    resetHandlers(...nextHandlers) {
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

