import { translateError } from './errors.js';
import { clearAuth } from './auth.js';
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  'http://localhost:3000';

let accessToken = null;
let refreshPromise = null;
let refreshFailed = false;

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
}

export function clearAccessToken() {
  accessToken = null;
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
        refreshFailed = false;
        return true;
      }
    } catch (_err) {
      // ignore
    } finally {
      refreshPromise = null;
    }
    refreshFailed = true;
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
    if (redirectOn401 && typeof window !== 'undefined' && window.location) {
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
