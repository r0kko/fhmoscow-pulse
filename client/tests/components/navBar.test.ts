import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NavBar from '../../src/components/NavBar.vue';
import type { AuthUser } from '../../src/auth';

vi.mock('../../src/api', async () => {
  const actual = await vi.importActual('../../src/api');
  return {
    ...actual,
    apiFetch: vi.fn(() => Promise.resolve({})),
    initCsrf: vi.fn(() => Promise.resolve()),
  };
});

import * as authModule from '../../src/auth';
import * as apiModule from '../../src/api';

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div>home</div>' } },
  { path: '/login', component: { template: '<div>login</div>' } },
];

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function resetAuthState(): void {
  authModule.auth.user = null;
  authModule.auth.roles = [];
  authModule.auth.token = null;
  authModule.auth.mustChangePassword = false;
}

describe('NavBar', () => {
  const apiFetchMock = vi.mocked(apiModule.apiFetch);
  const initCsrfMock = vi.mocked(apiModule.initCsrf);

  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
  });

  it('shows current user and performs logout workflow', async () => {
    const user: AuthUser = {
      first_name: 'Анна',
      last_name: 'Иванова',
      patronymic: 'Сергеевна',
    };
    authModule.auth.user = user;

    const clearSpy = vi.spyOn(authModule, 'clearAuth');
    const router = createTestRouter();
    router.push('/');

    render(NavBar, {
      global: {
        plugins: [router],
      },
    });
    await router.isReady();

    expect(
      screen.getByText('Иванова Анна Сергеевна', { exact: false })
    ).toBeInTheDocument();

    const logoutButtons = screen.getAllByRole('button', { name: 'Выйти' });
    expect(logoutButtons.length).toBeGreaterThan(0);
    const primaryLogout = logoutButtons[0]!;
    await fireEvent.click(primaryLogout);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', {
        method: 'POST',
      });
    });

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
      expect(router.currentRoute.value.fullPath).toBe('/login');
    });

    expect(initCsrfMock).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('fetches current user when not yet hydrated', async () => {
    const fetchSpy = vi
      .spyOn(authModule, 'fetchCurrentUser')
      .mockResolvedValue(undefined);

    const router = createTestRouter();
    router.push('/');

    render(NavBar, {
      global: {
        plugins: [router],
      },
    });
    await router.isReady();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    fetchSpy.mockRestore();
  });

  it('falls back to logout when hydration fails', async () => {
    const fetchSpy = vi
      .spyOn(authModule, 'fetchCurrentUser')
      .mockRejectedValue(new Error('unauthorized'));

    const router = createTestRouter();
    router.push('/');

    render(NavBar, {
      global: {
        plugins: [router],
      },
    });
    await router.isReady();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', {
        method: 'POST',
      });
    });

    await waitFor(() => {
      expect(router.currentRoute.value.fullPath).toBe('/login');
    });

    fetchSpy.mockRestore();
  });
});
