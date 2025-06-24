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

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ошибка запроса, код ${res.status}`);
  }
  return data;
}
