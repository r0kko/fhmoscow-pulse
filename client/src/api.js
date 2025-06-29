import { translateError } from './errors.js';
import { clearAuth } from './auth.js';
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  'http://localhost:3000';

let accessToken = null;

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
      return true;
    }
  } catch (_err) {
    // ignore
  }
  return false;
}

export async function apiFetch(path, options = {}) {
  const opts = { credentials: 'include', ...options };
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
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
    const refreshed = await refreshToken();
    if (refreshed) {
      return apiFetch(path, options);
    }
    clearAuth();
    if (typeof window !== 'undefined' && window.location) {
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
