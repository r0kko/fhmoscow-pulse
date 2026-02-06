import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import PasswordResetView from '@/views/PasswordReset.vue';
import { setupMsw } from '../utils/msw';

const server = setupMsw();

interface JsonRequest {
  json(): Promise<unknown>;
}

const demoRoutes: RouteRecordRaw[] = [
  { path: '/password-reset', component: PasswordResetView },
  { path: '/login', component: { template: '<div>login</div>' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: demoRoutes,
  });
}

describe('PasswordReset View (integration)', () => {
  it('uses neutral reset-start flow and normalizes email', async () => {
    const startSpy = vi.fn<(payload: { email: string }) => void>();
    server.use(
      http.post(
        '*/password-reset/start',
        async ({ request }: { request: JsonRequest }) => {
          const body = (await request.json()) as { email: string };
          startSpy(body);
          return HttpResponse.json({ message: 'if_account_exists_code_sent' });
        }
      )
    );

    const router = createRouterInstance();
    router.push('/password-reset');
    await router.isReady();

    render(PasswordResetView, {
      global: {
        plugins: [router],
      },
    });

    const emailInput = screen.getByLabelText('Email');
    await fireEvent.update(emailInput, '  TEST@Example.COM  ');
    await fireEvent.click(
      screen.getByRole('button', { name: 'Отправить код' })
    );

    await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
    expect(startSpy.mock.calls[0]?.[0]).toEqual({ email: 'test@example.com' });
    expect(
      await screen.findByText(/Если учетная запись для.*существует/i)
    ).not.toBeNull();
  });

  it('accepts only 6 numeric chars for code and enables submit at length 6', async () => {
    server.use(
      http.post('*/password-reset/start', async () =>
        HttpResponse.json({ message: 'if_account_exists_code_sent' })
      ),
      http.post('*/password-reset/finish', async () =>
        HttpResponse.json({ message: 'password_updated' })
      )
    );

    const router = createRouterInstance();
    router.push('/password-reset');
    await router.isReady();

    render(PasswordResetView, {
      global: {
        plugins: [router],
      },
    });

    await fireEvent.update(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.click(
      screen.getByRole('button', { name: 'Отправить код' })
    );

    const codeInput = await screen.findByLabelText('Код из письма');
    await fireEvent.update(codeInput, '12ab34cd5678');
    expect(codeInput).toHaveValue('123456');

    const submitButton = screen.getByRole('button', {
      name: 'Сохранить пароль',
    });
    expect(submitButton).toBeDisabled();

    await fireEvent.update(
      screen.getByLabelText('Новый пароль'),
      'StrongPass1!'
    );
    await fireEvent.update(
      screen.getByLabelText('Повторите пароль'),
      'StrongPass1!'
    );
    expect(submitButton).toBeEnabled();
  });
});
