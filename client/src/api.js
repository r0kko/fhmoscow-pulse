import { translateError } from './errors.js';
import { clearAuth } from './auth.js';
const API_BASE = (
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  'http://localhost:3000'
).replace(/\/+$/, '');

let accessToken = null;
let refreshPromise = null;
let refreshFailed =
  (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('refreshFailed') === '1') ||
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
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export async function initCsrf() {
  try {
    await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
  } catch (_) {
    // ignore
  }
}

export function setAccessToken(token) {
  accessToken = token;
  setRefreshFailed(false);
}

export function clearAccessToken() {
  accessToken = null;
  setRefreshFailed(true);
}

export function getAccessToken() {
  return accessToken;
}

async function refreshToken() {
  if (refreshFailed) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
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

export async function apiFetch(path, options = {}) {
  const { redirectOn401 = true, ...rest } = options;
  const opts = { credentials: 'include', ...rest };
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const xsrf = getXsrfToken();
  if (xsrf) {
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

  const data = await res.json().catch(() => ({}));
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
    const message = translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    throw new Error(message);
  }
  if (!res.ok) {
    const message = translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function apiFetchForm(path, form, options = {}) {
  const { redirectOn401 = true, ...rest } = options;
  const opts = { credentials: 'include', ...rest, body: form };
  opts.headers = { ...(opts.headers || {}) };
  const xsrf = getXsrfToken();
  if (xsrf) {
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
  const data = await res.json().catch(() => ({}));
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
    const message = translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    throw new Error(message);
  }
  if (!res.ok) {
    const message = translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function apiFetchBlob(path, options = {}) {
  const { redirectOn401 = true, ...rest } = options;
  const opts = { credentials: 'include', ...rest };
  opts.headers = { ...(opts.headers || {}) };
  const xsrf = getXsrfToken();
  if (xsrf) {
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
    throw new Error(`Ошибка запроса, код ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`Ошибка запроса, код ${res.status}`);
  }
  return res.blob();
}
