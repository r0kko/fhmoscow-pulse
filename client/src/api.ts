import { translateError } from './errors.js';

import { clearAuth } from './auth';

type Nullable<T> = T | null | undefined;

type HeadersMap = Record<string, string>;

type TimeoutResult = {
  signal?: AbortSignal;
  cancelTimeout?: () => void;
};

export type ApiError = Error & {
  code?: string | null;
  requestId?: string | null;
};

interface RetryOptions {
  _csrfRetried?: boolean;
  _429Retried?: boolean;
  _ddosRetried?: boolean;
}

export interface ApiFetchOptions extends RequestInit, RetryOptions {
  redirectOn401?: boolean;
  timeoutMs?: number;
}

type ErrorPayload = { error?: string | null };

function normalizeHeaders(headers: HeadersInit | undefined): HeadersMap {
  if (!headers) return {};
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers as [string, string][]);
  }
  return { ...(headers as HeadersMap) };
}

// Resolve API base URL with a strong preference for same-origin to avoid
// cross-host redirects (which can drop POST bodies or strip credentials),
// especially when an upstream CDN/WAF issues 30x to a canonical host.
function resolveApiBase() {
  const envBase =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE) ||
    null;

  // In browsers, prefer relative /api unless an absolute URL targets the
  // current origin. This prevents 301/302 during refresh calls that can turn
  // POST into GET and cause re-login loops.
  if (typeof window !== 'undefined') {
    try {
      if (!envBase) return '/api';
      // If configured as relative, keep as-is
      if (/^\//.test(envBase)) return envBase.replace(/\/+$/, '');
      const u = new URL(envBase);
      const loc = window.location;
      const sameHost =
        u.hostname === loc.hostname &&
        String(u.port || '') === (loc.port || '');
      if (sameHost) return u.origin.replace(/\/+$/, '');
      // Different host — avoid potential redirect/CORS pitfalls
      return '/api';
    } catch {
      return '/api';
    }
  }

  // Non-browser (tests/build tools): fall back to env or localhost
  return (envBase || 'http://localhost:3000').replace(/\/+$/, '');
}

export const API_BASE = resolveApiBase();

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;
let refreshFailed =
  (typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem('refreshFailed') === '1') ||
  false;

// Avoid indefinite waits behind CDN/proxies: set sane network timeouts
const DEFAULT_TIMEOUT_MS = 20000; // general API
const DEFAULT_REFRESH_TIMEOUT_MS = 12000; // token refresh
const DEFAULT_CSRF_TIMEOUT_MS = 8000; // CSRF bootstrap

function withTimeout(
  signal: Nullable<AbortSignal>,
  ms = DEFAULT_TIMEOUT_MS
): TimeoutResult {
  if (typeof AbortController === 'undefined') {
    return { signal: signal ?? undefined };
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('TimeoutError', 'AbortError')),
    ms
  );
  if (signal) {
    try {
      signal.addEventListener('abort', () => controller.abort(signal.reason));
    } catch {}
  }
  return {
    signal: controller.signal,
    cancelTimeout: () => clearTimeout(timer),
  };
}

function setRefreshFailed(val: boolean) {
  refreshFailed = val;
  if (typeof sessionStorage !== 'undefined') {
    if (val) {
      sessionStorage.setItem('refreshFailed', '1');
    } else {
      sessionStorage.removeItem('refreshFailed');
    }
  }
}

function getXsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split('; ');
  // Prefer the API-specific CSRF cookie; fallback to legacy name if present
  const names = ['XSRF-TOKEN-API', 'XSRF-TOKEN'];
  for (const name of names) {
    const row = cookies.find((c) => c.startsWith(`${name}=`));
    if (row) return decodeURIComponent(row.split('=')[1]);
  }
  try {
    // Fallback to stateless HMAC token stored in sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const h = sessionStorage.getItem('csrfHmac');
      if (h) return h;
    }
    // As a last resort, check an in-memory var (non-persistent across reloads)
    if (typeof window !== 'undefined' && window.__csrfHmac)
      return window.__csrfHmac;
  } catch {}
  return null;
}

function clearXsrfCookies() {
  try {
    const opts = 'Max-Age=0; path=/';
    document.cookie = `XSRF-TOKEN-API=; ${opts}`;
    document.cookie = `XSRF-TOKEN=; ${opts}`;
  } catch {
    /* ignore */
  }
}

function shouldSendXsrf(method?: string) {
  const m = (method || 'GET').toUpperCase();
  return !(m === 'GET' || m === 'HEAD' || m === 'OPTIONS');
}

async function readJsonSafe(res: Response): Promise<unknown> {
  if (!res?.clone) return null;
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

function buildApiError(
  message: string,
  code: string | null = null,
  reqId?: string | null
): ApiError {
  const err = new Error(message) as ApiError;
  if (code) err.code = code;
  if (reqId) err.requestId = reqId;
  return err;
}

export async function initCsrf() {
  try {
    const t = withTimeout(undefined, DEFAULT_CSRF_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/csrf-token`, {
      credentials: 'include',
      signal: t.signal,
    });
    t.cancelTimeout?.();
    try {
      const data = await res.clone().json();
      if (data && data.csrfHmac) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('csrfHmac', data.csrfHmac);
          } else if (typeof window !== 'undefined') {
            window.__csrfHmac = data.csrfHmac;
          }
        } catch {
          if (typeof window !== 'undefined') window.__csrfHmac = data.csrfHmac;
        }
        // Proactive re-prime before HMAC expiry to avoid EBADCSRFTOKEN
        try {
          scheduleCsrfReprime(data.csrfHmac);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore parsing errors */
    }
  } catch {
    // ignore network failures
  }
}

function parseCsrfHmacExp(token: Nullable<string>) {
  try {
    const [body] = String(token || '').split('.');
    if (!body) return 0;
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return (payload && payload.exp ? payload.exp : 0) * 1000;
  } catch {
    return 0;
  }
}

let csrfTimerId: ReturnType<typeof setTimeout> | null = null;
function scheduleCsrfReprime(token: Nullable<string>) {
  if (csrfTimerId) {
    clearTimeout(csrfTimerId);
    csrfTimerId = null;
  }
  const expMs = parseCsrfHmacExp(token);
  if (!expMs) return;
  const now = Date.now();
  // refresh 5 minutes before expiry (min 10s, max 12h)
  let delay = Math.max(10000, expMs - now - 5 * 60 * 1000);
  delay = Math.min(delay, 12 * 60 * 60 * 1000);
  csrfTimerId = setTimeout(() => {
    initCsrf().catch(() => {});
  }, delay);
}

function decodeJwt(token: Nullable<string>): Record<string, unknown> | null {
  try {
    const [, payload] = String(token || '').split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function scheduleProactiveRefresh() {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  if (!accessToken) return;
  const payload = decodeJwt(accessToken);
  const now = Date.now();
  const expSeconds =
    payload && typeof (payload as { exp?: unknown }).exp === 'number'
      ? (payload as { exp: number }).exp
      : undefined;
  const expMs = expSeconds ? expSeconds * 1000 : now + 10 * 60 * 1000;
  // Refresh 2 minutes before expiry (minimum 5 seconds)
  const safetyMs = 2 * 60 * 1000;
  let delay = Math.max(5000, expMs - now - safetyMs);
  // Cap delay to 12 hours to avoid huge timers
  delay = Math.min(delay, 12 * 60 * 60 * 1000);
  refreshTimerId = setTimeout(async () => {
    try {
      await refreshToken();
    } catch {
      /* ignore */
    }
  }, delay);
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  setRefreshFailed(false);
  scheduleProactiveRefresh();
}

export function clearAccessToken() {
  accessToken = null;
  setRefreshFailed(true);
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshToken(): Promise<boolean> {
  if (refreshFailed) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      let headers: HeadersMap = { 'Content-Type': 'application/json' };
      let xsrf = getXsrfToken();
      if (xsrf && shouldSendXsrf('POST')) {
        headers['X-XSRF-TOKEN'] = xsrf;
        headers['X-CSRF-TOKEN'] = xsrf;
      }
      const t1 = withTimeout(undefined, DEFAULT_REFRESH_TIMEOUT_MS);
      let res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: '{}',
        signal: t1.signal,
      });
      t1.cancelTimeout?.();
      let data = await res.json().catch(() => ({}));
      if (
        res.status === 403 &&
        (data?.error === 'EBADCSRFTOKEN' ||
          data?.error === 'CSRF token mismatch')
      ) {
        // Re-prime CSRF then retry once
        try {
          await initCsrf();
        } catch {}
        headers = { 'Content-Type': 'application/json' };
        xsrf = getXsrfToken();
        if (xsrf && shouldSendXsrf('POST')) {
          headers['X-XSRF-TOKEN'] = xsrf;
          headers['X-CSRF-TOKEN'] = xsrf;
        }
        const t2 = withTimeout(undefined, DEFAULT_REFRESH_TIMEOUT_MS);
        res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: '{}',
          signal: t2.signal,
        });
        t2.cancelTimeout?.();
        data = await res.json().catch(() => ({}));
      }
      // If misconfigured API_BASE causes a 404/405 after an upstream 30x redirect,
      // fall back once to same-origin /api to avoid refresh loops.
      if (
        !res.ok &&
        typeof window !== 'undefined' &&
        /^https?:/i.test(API_BASE) &&
        (res.status === 404 ||
          res.status === 405 ||
          data?.error === 'not_found')
      ) {
        try {
          const t3 = withTimeout(undefined, DEFAULT_REFRESH_TIMEOUT_MS);
          res = await fetch(`/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: '{}',
            signal: t3.signal,
          });
          t3.cancelTimeout?.();
          data = await res.json().catch(() => ({}));
        } catch {
          /* ignore */
        }
      }
      if (res.ok && data.access_token) {
        setAccessToken(data.access_token);
        setRefreshFailed(false);
        try {
          const hint =
            res.headers?.get && res.headers.get('X-Auth-Cookie-Cleanup');
          if (hint === '1') {
            // Fire-and-forget cleanup to remove legacy/broken cookie variants
            apiFetch('/auth/cookie-cleanup', {
              method: 'GET',
              redirectOn401: false,
            }).catch(() => {});
          }
        } catch {
          /* ignore */
        }
        return true;
      }
    } catch {
      // ignore
    } finally {
      refreshPromise = null;
    }
    setRefreshFailed(true);
    return false;
  })();

  return refreshPromise;
}

// Keep session alive on return to tab/network re‑gain if token is near expiry
if (typeof window !== 'undefined') {
  const kickIfNearExpiry = () => {
    const payload = decodeJwt(accessToken);
    const expSeconds =
      payload && typeof (payload as { exp?: unknown }).exp === 'number'
        ? (payload as { exp: number }).exp
        : undefined;
    if (!expSeconds) return;
    const now = Date.now();
    const expMs = expSeconds * 1000;
    if (expMs - now < 90 * 1000) {
      // less than 90s left — refresh now
      void refreshToken();
    }
  };
  try {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') kickIfNearExpiry();
    });
    window.addEventListener('online', () => kickIfNearExpiry());
    // Also re-prime CSRF HMAC if it's near expiry when tab becomes visible
    const kickCsrfIfNearExpiry = () => {
      try {
        let token = null;
        if (typeof sessionStorage !== 'undefined') {
          token = sessionStorage.getItem('csrfHmac');
        } else if (typeof window !== 'undefined') {
          token = window.__csrfHmac || null;
        }
        if (!token) return;
        const exp = parseCsrfHmacExp(token);
        if (!exp) return;
        const now = Date.now();
        if (exp - now < 5 * 60 * 1000) initCsrf().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') kickCsrfIfNearExpiry();
    });
    window.addEventListener('online', () => kickCsrfIfNearExpiry());
  } catch {
    /* ignore */
  }
}

interface HttpErrorOptions {
  status: number;
  data?: { error?: string | null } | null;
  reqId?: string | null;
  fallbackCode?: string | null;
  message?: string;
}

function createHttpError({
  status,
  data,
  reqId,
  fallbackCode = null,
  message,
}: HttpErrorOptions): ApiError {
  const baseMessage =
    message || translateError(data?.error) || `Ошибка запроса, код ${status}`;
  const fullMessage = reqId ? `${baseMessage} (id: ${reqId})` : baseMessage;
  const err = new Error(fullMessage) as ApiError;
  err.code = data?.error || fallbackCode;
  if (reqId) err.requestId = reqId;
  return err;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    redirectOn401 = true,
    _csrfRetried = false,
    _429Retried = false,
    _ddosRetried = false,
    timeoutMs,
    headers: rawHeaders,
    signal,
    ...init
  } = options;

  const headers: HeadersMap = {
    'Content-Type': 'application/json',
    ...normalizeHeaders(rawHeaders),
  };

  const requestInit = init as RequestInit;
  const method = (requestInit.method || 'GET').toUpperCase();

  const xsrf = getXsrfToken();
  if (xsrf && shouldSendXsrf(requestInit.method)) {
    headers['X-XSRF-TOKEN'] = xsrf;
    headers['X-CSRF-TOKEN'] = xsrf;
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchInit: RequestInit = {
    ...requestInit,
    credentials: 'include',
    headers,
  };

  let res: Response;
  const timeout = withTimeout(
    signal ?? undefined,
    timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchInit,
      signal: timeout.signal,
    });
  } catch (error: unknown) {
    timeout.cancelTimeout?.();
    const err = error instanceof Error ? error : undefined;
    const msg =
      err?.name === 'AbortError' ? 'Таймаут запроса' : 'Сетевая ошибка';
    const apiError = new Error(msg) as ApiError;
    apiError.code = err?.name === 'AbortError' ? 'timeout' : 'network_error';
    throw apiError;
  }
  timeout.cancelTimeout?.();

  const contentType =
    (res.headers?.get && res.headers.get('content-type')) || '';
  const rawData = (await res.json().catch(() => ({}))) as unknown;
  const errorData = rawData as ErrorPayload;

  if (res.status === 429) {
    const retryAfter = Number(
      res.headers?.get && res.headers.get('Retry-After')
    );
    if ((method === 'GET' || method === 'HEAD') && !_429Retried) {
      const secs =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? Math.min(5, Math.ceil(retryAfter))
          : 2;
      await new Promise((r) => setTimeout(r, secs * 1000));
      return apiFetch(path, { ...options, _429Retried: true });
    }
    let message = translateError(errorData?.error) || 'Слишком много запросов';
    if (!Number.isNaN(retryAfter) && retryAfter > 0) {
      const secs = Math.max(1, Math.ceil(retryAfter));
      message = `${message}. Повторите через ${secs} с.`;
    }
    throw buildApiError(message, errorData?.error || 'rate_limited');
  }

  if ((res.status === 403 || res.status === 503) && !_ddosRetried) {
    if (
      (method === 'GET' || method === 'HEAD') &&
      /text\/html|text\/plain/i.test(contentType)
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      return apiFetch(path, { ...options, _ddosRetried: true });
    }
  }

  if (
    res.status === 403 &&
    (errorData?.error === 'EBADCSRFTOKEN' ||
      errorData?.error === 'CSRF token mismatch')
  ) {
    if (!_csrfRetried) {
      try {
        await initCsrf();
      } catch {}
      return apiFetch(path, { ...options, _csrfRetried: true });
    }
    try {
      clearXsrfCookies();
      await initCsrf();
    } catch {}
    return apiFetch(path, { ...options, _csrfRetried: true });
  }

  const reqId = res.headers?.get && res.headers.get('X-Request-Id');

  if (res.status === 401) {
    if (path !== '/auth/refresh' && !refreshFailed) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiFetch(path, options);
      }
    }
    clearAuth();
    if (
      redirectOn401 &&
      typeof window !== 'undefined' &&
      window.location &&
      window.location.pathname !== '/login'
    ) {
      window.location.href = '/login';
    }
    throw createHttpError({
      status: res.status,
      data: errorData,
      reqId,
    });
  }

  if (!res.ok) {
    throw createHttpError({
      status: res.status,
      data: errorData,
      reqId,
    });
  }

  return rawData as T;
}

export async function apiFetchForm<T = unknown>(
  path: string,
  form: FormData,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    redirectOn401 = true,
    _csrfRetried = false,
    _429Retried = false,
    _ddosRetried = false,
    timeoutMs,
    headers: rawHeaders,
    signal,
    ...init
  } = options;

  const headers: HeadersMap = {
    ...normalizeHeaders(rawHeaders),
  };

  const requestInit = init as RequestInit;
  const method = (requestInit.method || 'POST').toUpperCase();
  const xsrf = getXsrfToken();
  if (xsrf && shouldSendXsrf(requestInit.method || 'POST')) {
    headers['X-XSRF-TOKEN'] = xsrf;
    headers['X-CSRF-TOKEN'] = xsrf;
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchInit: RequestInit = {
    ...requestInit,
    method: requestInit.method ?? 'POST',
    credentials: 'include',
    headers,
    body: form,
  };

  let res: Response;
  const timeout = withTimeout(
    signal ?? undefined,
    timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchInit,
      signal: timeout.signal,
    });
  } catch (error: unknown) {
    timeout.cancelTimeout?.();
    const err = error instanceof Error ? error : undefined;
    const msg =
      err?.name === 'AbortError' ? 'Таймаут запроса' : 'Сетевая ошибка';
    const apiError = new Error(msg) as ApiError;
    apiError.code = err?.name === 'AbortError' ? 'timeout' : 'network_error';
    throw apiError;
  }
  timeout.cancelTimeout?.();

  const contentType =
    (res.headers?.get && res.headers.get('content-type')) || '';
  const rawData = (await res.json().catch(() => ({}))) as unknown;
  const errorData = rawData as ErrorPayload;
  if (res.status === 429) {
    const retryAfter = Number(
      res.headers?.get && res.headers.get('Retry-After')
    );
    if ((method === 'GET' || method === 'HEAD') && !_429Retried) {
      const secs =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? Math.min(5, Math.ceil(retryAfter))
          : 2;
      await new Promise((r) => setTimeout(r, secs * 1000));
      return apiFetchForm(path, form, { ...options, _429Retried: true });
    }
    let message = translateError(errorData?.error) || 'Слишком много запросов';
    if (!Number.isNaN(retryAfter) && retryAfter > 0) {
      const secs = Math.max(1, Math.ceil(retryAfter));
      message = `${message}. Повторите через ${secs} с.`;
    }
    throw buildApiError(message, errorData?.error || 'rate_limited');
  }
  // DDoS/WAF challenge (403/503 with HTML) — retry once (idempotent only)
  if ((res.status === 403 || res.status === 503) && !_ddosRetried) {
    if (
      (method === 'GET' || method === 'HEAD') &&
      /text\/html|text\/plain/i.test(contentType)
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      return apiFetchForm(path, form, { ...options, _ddosRetried: true });
    }
  }
  if (
    res.status === 403 &&
    (errorData?.error === 'EBADCSRFTOKEN' ||
      errorData?.error === 'CSRF token mismatch')
  ) {
    if (!_csrfRetried) {
      try {
        await initCsrf();
      } catch {}
      return apiFetchForm(path, form, { ...options, _csrfRetried: true });
    }
    try {
      clearXsrfCookies();
      await initCsrf();
    } catch {}
    return apiFetchForm(path, form, { ...options, _csrfRetried: true });
  }
  const reqId = res.headers?.get && res.headers.get('X-Request-Id');
  if (res.status === 401) {
    if (path !== '/auth/refresh' && !refreshFailed) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiFetchForm(path, form, options);
      }
    }
    clearAuth();
    if (
      redirectOn401 &&
      typeof window !== 'undefined' &&
      window.location &&
      window.location.pathname !== '/login'
    ) {
      window.location.href = '/login';
    }
    let message =
      translateError(errorData?.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    throw buildApiError(message, errorData?.error || null, reqId);
  }
  if (!res.ok) {
    let message =
      translateError(errorData?.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    throw buildApiError(message, errorData?.error || null, reqId);
  }
  return rawData as T;
}

export async function apiFetchBlob(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Blob> {
  const {
    redirectOn401 = true,
    _csrfRetried = false,
    _429Retried = false,
    _ddosRetried = false,
    timeoutMs,
    headers: rawHeaders,
    signal,
    ...init
  } = options;

  const headers: HeadersMap = {
    ...normalizeHeaders(rawHeaders),
  };
  const requestInit = init as RequestInit;
  const method = (requestInit.method || 'GET').toUpperCase();

  const xsrf = getXsrfToken();
  if (xsrf && shouldSendXsrf(requestInit.method)) {
    headers['X-XSRF-TOKEN'] = xsrf;
    headers['X-CSRF-TOKEN'] = xsrf;
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchInit: RequestInit = {
    ...requestInit,
    credentials: 'include',
    headers,
  };

  let res: Response;
  const timeout = withTimeout(
    signal ?? undefined,
    timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchInit,
      signal: timeout.signal,
    });
  } catch (error: unknown) {
    timeout.cancelTimeout?.();
    const err = error instanceof Error ? error : undefined;
    const msg =
      err?.name === 'AbortError' ? 'Таймаут запроса' : 'Сетевая ошибка';
    const apiError = new Error(msg) as ApiError;
    apiError.code = err?.name === 'AbortError' ? 'timeout' : 'network_error';
    throw apiError;
  }
  timeout.cancelTimeout?.();

  const reqId = res.headers?.get && res.headers.get('X-Request-Id');

  if (res.status === 429) {
    const data = (await readJsonSafe(res)) as { error?: string | null } | null;
    const retryAfterHeader = res.headers?.get && res.headers.get('Retry-After');
    const retryAfter = Number(retryAfterHeader);
    if ((method === 'GET' || method === 'HEAD') && !_429Retried) {
      const secs =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? Math.min(5, Math.ceil(retryAfter))
          : 2;
      await new Promise((r) => setTimeout(r, secs * 1000));
      return apiFetchBlob(path, { ...options, _429Retried: true });
    }
    let message = translateError(data?.error) || 'Слишком много запросов';
    if (!Number.isNaN(retryAfter) && retryAfter > 0) {
      const secs = Math.max(1, Math.ceil(retryAfter));
      message = `${message}. Повторите через ${secs} с.`;
    }
    throw buildApiError(message, data?.error || 'rate_limited', reqId);
  }

  if (res.status === 403) {
    try {
      const data = (await res.clone().json()) as ErrorPayload;
      if (
        data?.error === 'EBADCSRFTOKEN' ||
        data?.error === 'CSRF token mismatch'
      ) {
        if (!_csrfRetried) {
          try {
            await initCsrf();
          } catch {}
          return apiFetchBlob(path, { ...options, _csrfRetried: true });
        }
        try {
          clearXsrfCookies();
          await initCsrf();
        } catch {}
        return apiFetchBlob(path, { ...options, _csrfRetried: true });
      }
    } catch {
      // ignore
    }
  }

  if ((res.status === 403 || res.status === 503) && !_ddosRetried) {
    const contentType =
      (res.headers?.get && res.headers.get('content-type')) || '';
    if (
      (method === 'GET' || method === 'HEAD') &&
      /text\/html|text\/plain/i.test(contentType)
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      return apiFetchBlob(path, { ...options, _ddosRetried: true });
    }
  }

  if (res.status === 401) {
    if (path !== '/auth/refresh' && !refreshFailed) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiFetchBlob(path, options);
      }
    }
    clearAuth();
    if (
      redirectOn401 &&
      typeof window !== 'undefined' &&
      window.location &&
      window.location.pathname !== '/login'
    ) {
      window.location.href = '/login';
    }
    const data = (await readJsonSafe(res)) as { error?: string | null } | null;
    let message =
      translateError(data?.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    throw buildApiError(message, data?.error || null, reqId);
  }

  if (!res.ok) {
    const data = (await readJsonSafe(res)) as { error?: string | null } | null;
    let message =
      translateError(data?.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    throw buildApiError(message, data?.error || null, reqId);
  }

  return res.blob();
}

interface UploadOptions {
  onProgress?: (progress: number) => void;
}

export function apiUpload(
  path: string,
  form: FormData,
  { onProgress }: UploadOptions = {}
): Promise<unknown> {
  const xsrf = getXsrfToken();
  const token = accessToken;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.withCredentials = true;
    if (xsrf && shouldSendXsrf('POST')) {
      xhr.setRequestHeader('X-XSRF-TOKEN', xsrf);
      xhr.setRequestHeader('X-CSRF-TOKEN', xsrf);
    }
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* noop */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      const payload = data as ErrorPayload;
      let message =
        translateError(payload.error) || `Ошибка запроса, код ${xhr.status}`;
      if (xhr.status === 429) {
        const ra = parseInt(xhr.getResponseHeader('Retry-After') || '0', 10);
        if (ra > 0) {
          message = `${translateError('rate_limited')}. Повторите через ${Math.ceil(
            ra
          )} с.`;
        }
      }
      const err = buildApiError(message, payload.error || null);
      reject(err);
    };
    xhr.onerror = () =>
      reject(buildApiError('Сетевая ошибка', 'network_error'));
    if (onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent<EventTarget>) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress(e.loaded / e.total);
        }
      };
    }
    xhr.send(form);
  });
}
