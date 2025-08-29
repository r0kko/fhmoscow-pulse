import { reactive } from 'vue';
import { apiFetch, setAccessToken, clearAccessToken } from './api.js';

export const auth = reactive({
  user: null,
  roles: [],
  token: null,
  mustChangePassword: false,
});

export function setAuthToken(token) {
  auth.token = token;
  setAccessToken(token);
}

export async function fetchCurrentUser() {
  const data = await apiFetch('/auth/me');
  auth.user = data.user;
  auth.roles = data.roles || [];
  auth.mustChangePassword = !!data.must_change_password;
}

export async function refreshFromCookie() {
  try {
    const data = await apiFetch('/auth/refresh', {
      method: 'POST',
      body: '{}',
      redirectOn401: false,
    });
    setAuthToken(data.access_token);
    auth.user = data.user;
    auth.roles = data.roles || [];
    auth.mustChangePassword = false;
  } catch (_) {
    // ignore errors
  }
}

export function clearAuth() {
  auth.user = null;
  auth.roles = [];
  auth.token = null;
  auth.mustChangePassword = false;
  clearAccessToken();
}
