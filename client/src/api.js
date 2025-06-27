import { translateError } from './errors.js';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export async function apiFetch(path, options = {}) {
  const opts = { credentials: 'include', ...options };
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const token = localStorage.getItem('access_token');
  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`;
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
