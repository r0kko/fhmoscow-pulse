import { translateError } from './errors.js';
import { clearAuth } from './auth.js';
export const API_BASE = (
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  'http://localhost:3000'
).replace(/\/+$/, '');

let accessToken = null;
let refreshPromise = null;
let refreshTimerId = null;
let refreshFailed =
  (typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem('refreshFailed') === '1') ||
  false;

function setRefreshFailed(val) {
  refreshFailed = val;
  if (typeof sessionStorage !== 'undefined') {
    if (val) {
      sessionStorage.setItem('refreshFailed', '1');
    } else {
      sessionStorage.removeItem('refreshFailed');
    }
  }
}

function getXsrfToken() {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split('; ');
  // Prefer the API-specific CSRF cookie; fallback to legacy name if present
  const names = ['XSRF-TOKEN-API', 'XSRF-TOKEN'];
  for (const name of names) {
    const row = cookies.find((c) => c.startsWith(`${name}=`));
    if (row) return decodeURIComponent(row.split('=')[1]);
  }
  return null;
}

function clearXsrfCookies() {
  try {
    const opts = 'Max-Age=0; path=/';
    document.cookie = `XSRF-TOKEN-API=; ${opts}`;
    document.cookie = `XSRF-TOKEN=; ${opts}`;
  } catch (_) {
    /* ignore */
  }
}

function shouldSendXsrf(method) {
  const m = (method || 'GET').toUpperCase();
  return !(m === 'GET' || m === 'HEAD' || m === 'OPTIONS');
}

export async function initCsrf() {
  try {
    await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
  } catch (_) {
    // ignore
  }
}

function decodeJwt(token) {
  try {
    const [, payload] = String(token || '').split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch (_) {
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
  const expMs =
    payload && payload.exp ? payload.exp * 1000 : now + 10 * 60 * 1000;
  // Refresh 2 minutes before expiry (minimum 5 seconds)
  const safetyMs = 2 * 60 * 1000;
  let delay = Math.max(5000, expMs - now - safetyMs);
  // Cap delay to 12 hours to avoid huge timers
  delay = Math.min(delay, 12 * 60 * 60 * 1000);
  refreshTimerId = setTimeout(async () => {
    try {
      await refreshToken();
    } catch (_) {
      /* ignore */
    }
  }, delay);
}

export function setAccessToken(token) {
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

export function getAccessToken() {
  return accessToken;
}

async function refreshToken() {
  if (refreshFailed) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      let headers = { 'Content-Type': 'application/json' };
      let xsrf = getXsrfToken();
      if (xsrf && shouldSendXsrf('POST')) headers['X-XSRF-TOKEN'] = xsrf;
      let res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: '{}',
      });
      let data = await res.json().catch(() => ({}));
      if (
        res.status === 403 &&
        (data?.error === 'EBADCSRFTOKEN' ||
          data?.error === 'CSRF token mismatch')
      ) {
        // Re-prime CSRF then retry once
        try {
          await initCsrf();
        } catch (_) {}
        headers = { 'Content-Type': 'application/json' };
        xsrf = getXsrfToken();
        if (xsrf && shouldSendXsrf('POST')) headers['X-XSRF-TOKEN'] = xsrf;
        res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: '{}',
        });
        data = await res.json().catch(() => ({}));
      }
      if (res.ok && data.access_token) {
        setAccessToken(data.access_token);
        setRefreshFailed(false);
        return true;
      }
    } catch (_err) {
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
    if (!payload || !payload.exp) return;
    const now = Date.now();
    const expMs = payload.exp * 1000;
    if (expMs - now < 90 * 1000) {
      // less than 90s left — refresh now
      refreshToken();
    }
  };
  try {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') kickIfNearExpiry();
    });
    window.addEventListener('online', () => kickIfNearExpiry());
  } catch (_) {
    /* ignore */
  }
}

export async function apiFetch(path, options = {}) {
  const {
    redirectOn401 = true,
    _csrfRetried = false,
    _429Retried = false,
    _ddosRetried = false,
    ...rest
  } = options;
  const opts = { credentials: 'include', ...rest };
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const xsrf = getXsrfToken();
  if (xsrf && shouldSendXsrf(opts.method)) {
    opts.headers['X-XSRF-TOKEN'] = xsrf;
  }
  if (accessToken) {
    opts.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (_err) {
    throw new Error('Сетевая ошибка');
  }

  const contentType =
    (res.headers?.get && res.headers.get('content-type')) || '';
  const data = await res.json().catch(() => ({}));
  // Graceful handling for 429 (rate limited), including upstream DDoS proxies
  if (res.status === 429) {
    const retryAfter = Number(
      res.headers?.get && res.headers.get('Retry-After')
    );
    const method = (opts.method || 'GET').toUpperCase();
    // Auto-retry once for idempotent GET/HEAD with short backoff
    if ((method === 'GET' || method === 'HEAD') && !_429Retried) {
      const secs =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? Math.min(5, Math.ceil(retryAfter))
          : 2;
      await new Promise((r) => setTimeout(r, secs * 1000));
      return apiFetch(path, { ...options, _429Retried: true });
    }
    let message = translateError(data.error) || 'Слишком много запросов';
    if (!Number.isNaN(retryAfter) && retryAfter > 0) {
      const secs = Math.max(1, Math.ceil(retryAfter));
      message = `${message}. Повторите через ${secs} с.`;
    }
    const err = new Error(message);
    err.code = data.error || 'rate_limited';
    throw err;
  }
  // DDoS/WAF challenge pages (403/503 with HTML) — retry once for idempotent calls
  if ((res.status === 403 || res.status === 503) && !_ddosRetried) {
    const method = (opts.method || 'GET').toUpperCase();
    if (
      (method === 'GET' || method === 'HEAD') &&
      /text\/html|text\/plain/i.test(contentType)
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      return apiFetch(path, { ...options, _ddosRetried: true });
    }
  }
  // Handle CSRF mismatch: re-prime token and retry once
  if (
    res.status === 403 &&
    (data?.error === 'EBADCSRFTOKEN' || data?.error === 'CSRF token mismatch')
  ) {
    if (!_csrfRetried) {
      try {
        await initCsrf();
      } catch (_) {}
      return apiFetch(path, { ...options, _csrfRetried: true });
    }
    try {
      clearXsrfCookies();
      await initCsrf();
    } catch (_) {}
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
    let message =
      translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    const err = new Error(message);
    err.code = data.error || null;
    if (reqId) err.requestId = reqId;
    throw err;
  }
  if (!res.ok) {
    let message =
      translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    const err = new Error(message);
    err.code = data.error || null;
    if (reqId) err.requestId = reqId;
    throw err;
  }
  return data;
}

export async function apiFetchForm(path, form, options = {}) {
  const {
    redirectOn401 = true,
    _csrfRetried = false,
    _429Retried = false,
    _ddosRetried = false,
    ...rest
  } = options;
  const opts = { credentials: 'include', ...rest, body: form };
  opts.headers = { ...(opts.headers || {}) };
  const xsrf = getXsrfToken();
  if (xsrf && shouldSendXsrf(opts.method || 'POST')) {
    opts.headers['X-XSRF-TOKEN'] = xsrf;
  }
  if (accessToken) {
    opts.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (_err) {
    throw new Error('Сетевая ошибка');
  }
  const contentType =
    (res.headers?.get && res.headers.get('content-type')) || '';
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const retryAfter = Number(
      res.headers?.get && res.headers.get('Retry-After')
    );
    const method = (opts.method || 'POST').toUpperCase();
    // Allow single auto-retry only for idempotent GET/HEAD
    if ((method === 'GET' || method === 'HEAD') && !_429Retried) {
      const secs =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? Math.min(5, Math.ceil(retryAfter))
          : 2;
      await new Promise((r) => setTimeout(r, secs * 1000));
      return apiFetchForm(path, form, { ...options, _429Retried: true });
    }
    let message = translateError(data.error) || 'Слишком много запросов';
    if (!Number.isNaN(retryAfter) && retryAfter > 0) {
      const secs = Math.max(1, Math.ceil(retryAfter));
      message = `${message}. Повторите через ${secs} с.`;
    }
    const err = new Error(message);
    err.code = data.error || 'rate_limited';
    throw err;
  }
  // DDoS/WAF challenge (403/503 with HTML) — retry once (idempotent only)
  if ((res.status === 403 || res.status === 503) && !_ddosRetried) {
    const method = (opts.method || 'POST').toUpperCase();
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
    (data?.error === 'EBADCSRFTOKEN' || data?.error === 'CSRF token mismatch')
  ) {
    if (!_csrfRetried) {
      try {
        await initCsrf();
      } catch (_) {}
      return apiFetchForm(path, form, { ...options, _csrfRetried: true });
    }
    try {
      clearXsrfCookies();
      await initCsrf();
    } catch (_) {}
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
      translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    const err = new Error(message);
    err.code = data.error || null;
    if (reqId) err.requestId = reqId;
    throw err;
  }
  if (!res.ok) {
    let message =
      translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    if (reqId) message += ` (id: ${reqId})`;
    const err = new Error(message);
    err.code = data.error || null;
    if (reqId) err.requestId = reqId;
    throw err;
  }
  return data;
}

export async function apiFetchBlob(path, options = {}) {
  const {
    redirectOn401 = true,
    _csrfRetried = false,
    _429Retried = false,
    _ddosRetried = false,
    ...rest
  } = options;
  const opts = { credentials: 'include', ...rest };
  opts.headers = { ...(opts.headers || {}) };
  const xsrf = getXsrfToken();
  if (xsrf && shouldSendXsrf(opts.method)) {
    opts.headers['X-XSRF-TOKEN'] = xsrf;
  }
  if (accessToken) {
    opts.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (_err) {
    throw new Error('Сетевая ошибка');
  }
  const reqId = res.headers?.get && res.headers.get('X-Request-Id');
  if (res.status === 429) {
    try {
      const data = await res.clone().json();
      const retryAfter = Number(
        res.headers?.get && res.headers.get('Retry-After')
      );
      const method = (opts.method || 'GET').toUpperCase();
      if ((method === 'GET' || method === 'HEAD') && !_429Retried) {
        const secs =
          !Number.isNaN(retryAfter) && retryAfter > 0
            ? Math.min(5, Math.ceil(retryAfter))
            : 2;
        await new Promise((r) => setTimeout(r, secs * 1000));
        return apiFetchBlob(path, { ...options, _429Retried: true });
      }
      let message = translateError(data.error) || 'Слишком много запросов';
      if (!Number.isNaN(retryAfter) && retryAfter > 0) {
        const secs = Math.max(1, Math.ceil(retryAfter));
        message = `${message}. Повторите через ${secs} с.`;
      }
      const err = new Error(message);
      err.code = data.error || 'rate_limited';
      if (reqId) err.requestId = reqId;
      throw err;
    } catch (_) {
      throw new Error(`Ошибка запроса, код ${res.status}`);
    }
  }
  if (res.status === 403) {
    try {
      const data = await res.clone().json();
      if (
        data?.error === 'EBADCSRFTOKEN' ||
        data?.error === 'CSRF token mismatch'
      ) {
        if (!_csrfRetried) {
          try {
            await initCsrf();
          } catch (_) {}
          return apiFetchBlob(path, { ...options, _csrfRetried: true });
        }
        try {
          clearXsrfCookies();
          await initCsrf();
        } catch (_) {}
        return apiFetchBlob(path, { ...options, _csrfRetried: true });
      }
    } catch (_) {
      // ignore
    }
  }
  // DDoS/WAF 403/503 with HTML payload — retry once for idempotent calls
  if ((res.status === 403 || res.status === 503) && !_ddosRetried) {
    const method = (opts.method || 'GET').toUpperCase();
    const ct = (res.headers?.get && res.headers.get('content-type')) || '';
    if (
      (method === 'GET' || method === 'HEAD') &&
      /text\/html|text\/plain/i.test(ct)
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
    // Try to extract API error code for friendly message
    try {
      const data = await res.clone().json();
      let message =
        translateError(data.error) || `Ошибка запроса, код ${res.status}`;
      if (reqId) message += ` (id: ${reqId})`;
      const err = new Error(message);
      err.code = data.error || null;
      if (reqId) err.requestId = reqId;
      throw err;
    } catch (_) {
      throw new Error(`Ошибка запроса, код ${res.status}`);
    }
  }
  if (!res.ok) {
    try {
      const data = await res.clone().json();
      let message =
        translateError(data.error) || `Ошибка запроса, код ${res.status}`;
      if (reqId) message += ` (id: ${reqId})`;
      const err = new Error(message);
      err.code = data.error || null;
      if (reqId) err.requestId = reqId;
      throw err;
    } catch (_) {
      throw new Error(`Ошибка запроса, код ${res.status}`);
    }
  }
  return res.blob();
}

export function apiUpload(path, form, { onProgress } = {}) {
  const xsrf = getXsrfToken();
  const token = accessToken;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.withCredentials = true;
    if (xsrf && shouldSendXsrf('POST'))
      xhr.setRequestHeader('X-XSRF-TOKEN', xsrf);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        /* noop */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        let message =
          translateError(data.error) || `Ошибка запроса, код ${xhr.status}`;
        if (xhr.status === 429) {
          const ra = parseInt(xhr.getResponseHeader('Retry-After') || '0', 10);
          if (ra > 0)
            message = `${translateError('rate_limited')}. Повторите через ${Math.ceil(ra)} с.`;
        }
        const err = new Error(message);
        err.code = data.error || null;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Сетевая ошибка'));
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.send(form);
  });
}
