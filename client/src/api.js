import { translateError } from './errors.js';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

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
  if (!res.ok) {
    const message = translateError(data.error) || `Ошибка запроса, код ${res.status}`;
    throw new Error(message);
  }
  return data;
}
