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
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export function createUser(data) {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateUser(id, data) {
  return apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function blockUser(id) {
  return apiFetch(`/users/${id}/block`, { method: 'POST' });
}

export function unblockUser(id) {
  return apiFetch(`/users/${id}/unblock`, { method: 'POST' });
}

export function resetPassword(id, password) {
  return apiFetch(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function assignRole(id, roleAlias) {
  return apiFetch(`/users/${id}/roles/${roleAlias}`, { method: 'POST' });
}

export function removeRole(id, roleAlias) {
  return apiFetch(`/users/${id}/roles/${roleAlias}`, { method: 'DELETE' });
}
