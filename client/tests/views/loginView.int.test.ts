import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginView from '@/views/Login.vue';
import { auth } from '@/auth';
import { setupMsw } from '../utils/msw';

const server = setupMsw();

function resetAuth() {
  auth.user = null;
  auth.roles = [];
  auth.token = null;
  auth.mustChangePassword = false;
}

interface JsonRequest {
  json(): Promise<unknown>;
}

const demoRoutes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div>home</div>' } },
  { path: '/login', component: LoginView },
  { path: '/change-password', component: { template: '<div>change</div>' } },
  {
    path: '/awaiting-confirmation',
    component: { template: '<div>await</div>' },
  },
  { path: '/complete-profile', component: { template: '<div>complete</div>' } },
  { path: '/register', component: { template: '<div>register</div>' } },
  { path: '/password-reset', component: { template: '<div>reset</div>' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: demoRoutes,
  });
}

describe('Login View (integration)', () => {
  beforeEach(() => {
    resetAuth();
  });

  afterEach(() => {
    resetAuth();
    vi.useRealTimers();
  });

  it('authenticates successfully and routes to the dashboard', async () => {
    interface LoginPayload {
      phone: string;
      password: string;
    }

    const loginSpy = vi.fn<(payload: LoginPayload) => void>();
    server.use(
      http.post(
        '*/auth/login',
        async ({ request }: { request: JsonRequest }) => {
          const body = (await request.json()) as LoginPayload;
          loginSpy(body);
          return HttpResponse.json({
            access_token: 'access.token',
            user: { id: 10, status: 'ACTIVE', first_name: 'Анна' },
            roles: ['REFEREE'],
            must_change_password: false,
          });
        }
      )
    );

    const router = createRouterInstance();
    router.push('/login');
    await router.isReady();

    render(LoginView, {
      global: {
        plugins: [router],
      },
    });

    const phoneInput = screen.getByLabelText('Телефон');
    await fireEvent.update(phoneInput, '89991234567');
    expect(phoneInput).toHaveValue('+7 (999) 123-45-67');

    const passwordInput = screen.getByLabelText('Пароль');
    await fireEvent.update(passwordInput, 'Secret!23');

    await fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(loginSpy.mock.calls[0]?.[0]).toMatchObject({
      phone: '79991234567',
      password: 'Secret!23',
    });

    await waitFor(() => {
      expect(router.currentRoute.value.fullPath).toBe('/');
    });
    expect(auth.user).toMatchObject({ id: 10, first_name: 'Анна' });
    expect(auth.roles).toEqual(['REFEREE']);
  });

  it('surfaces backend validation errors and clears them on timeout', async () => {
    vi.useFakeTimers();
    server.use(
      http.post('*/auth/login', async () =>
        HttpResponse.json({ error: 'invalid_credentials' }, { status: 400 })
      )
    );

    const router = createRouterInstance();
    router.push('/login');
    await router.isReady();

    render(LoginView, {
      global: {
        plugins: [router],
      },
    });

    const phoneInput = screen.getByLabelText('Телефон');
    await fireEvent.update(phoneInput, '79991234567');

    const passwordInput = screen.getByLabelText('Пароль');
    await fireEvent.update(passwordInput, 'wrong');

    await fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    const alertMessage = await screen.findByText('Неверные учётные данные');
    expect(alertMessage.closest('[role="alert"]')).not.toBeNull();
    expect(router.currentRoute.value.fullPath).toBe('/login');

    vi.advanceTimersByTime(4000);
    await nextTick();
    expect(screen.queryByText('Неверные учётные данные')).toBeNull();
    expect(auth.user).toBeNull();
  });
});
