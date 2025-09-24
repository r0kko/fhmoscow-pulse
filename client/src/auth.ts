import { reactive } from 'vue';
import { apiFetch, setAccessToken, clearAccessToken } from './api';

export interface AuthUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  phone?: string;
  email?: string;
  status?: string;
  [key: string]: unknown;
}

interface AuthState {
  user: AuthUser | null;
  roles: string[];
  token: string | null;
  mustChangePassword: boolean;
}

interface AuthMeResponse {
  user: AuthUser;
  roles?: string[];
  must_change_password?: boolean;
}

interface AuthRefreshResponse {
  access_token: string;
  user: AuthUser;
  roles?: string[];
}

export const auth = reactive<AuthState>({
  user: null,
  roles: [],
  token: null,
  mustChangePassword: false,
});

export function setAuthToken(token: string | null) {
  auth.token = token;
  setAccessToken(token);
}

export async function fetchCurrentUser(): Promise<void> {
  const data = await apiFetch<AuthMeResponse>('/auth/me');
  auth.user = data.user;
  auth.roles = data.roles || [];
  auth.mustChangePassword = !!data.must_change_password;
}

export async function refreshFromCookie(): Promise<void> {
  try {
    const data = await apiFetch<AuthRefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: '{}',
      redirectOn401: false,
    });
    setAuthToken(data.access_token);
    auth.user = data.user;
    auth.roles = data.roles || [];
    auth.mustChangePassword = false;
  } catch {
    // Ask server to clean up legacy/broken cookies (best-effort)
    try {
      await apiFetch('/auth/cookie-cleanup', {
        method: 'GET',
        redirectOn401: false,
      });
    } catch {
      /* ignore */
    }
  }
}

export function clearAuth(): void {
  auth.user = null;
  auth.roles = [];
  auth.token = null;
  auth.mustChangePassword = false;
  clearAccessToken();
}
