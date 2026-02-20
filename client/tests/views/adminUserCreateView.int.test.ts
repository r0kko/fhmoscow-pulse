import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminUserCreate from '@/views/AdminUserCreate.vue';
import { apiFetch } from '@/api';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const routes: RouteRecordRaw[] = [
  { path: '/admin/users/new', component: AdminUserCreate },
  { path: '/admin/users/:id', component: { template: '<div>User card</div>' } },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

async function renderView() {
  const router = createRouterInstance();
  router.push('/admin/users/new');
  await router.isReady();
  render(AdminUserCreate, {
    global: {
      plugins: [router],
    },
  });
  return { router };
}

async function fillValidForm() {
  await fireEvent.update(screen.getByLabelText('ФИО'), 'Иванов Иван');
  await fireEvent.blur(screen.getByLabelText('ФИО'));
  await fireEvent.update(screen.getByLabelText('Дата рождения'), '2000-01-01');
  await fireEvent.update(screen.getByRole('combobox'), 'sex-1');
  await fireEvent.update(screen.getByPlaceholderText('Телефон'), '89991112233');
  await fireEvent.update(
    screen.getByPlaceholderText('Email'),
    'ivanov@example.com'
  );
}

describe('AdminUserCreate view', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('blocks submit when sex dictionary cannot be loaded', async () => {
    apiFetchMock.mockRejectedValueOnce(
      new Error('Не удалось загрузить справочник')
    );

    await renderView();

    expect(
      await screen.findByText('Не удалось загрузить справочник')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('maps validation_error.details to field-level errors', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/sexes') {
        return { sexes: [{ id: 'sex-1', name: 'Мужской', code: 'MALE' }] };
      }
      if (path === '/users') {
        const error = new Error('validation error') as Error & {
          code?: string;
          details?: unknown;
        };
        error.code = 'validation_error';
        error.details = [{ field: 'email', code: 'invalid_email' }];
        throw error;
      }
      return {};
    });

    await renderView();
    await fillValidForm();
    await fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(
      await screen.findByText('Неверный формат email')
    ).toBeInTheDocument();
  });

  it('shows resend CTA when delivery failed and retries invite', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/sexes') {
        return { sexes: [{ id: 'sex-1', name: 'Мужской', code: 'MALE' }] };
      }
      if (path === '/users') {
        return {
          user: { id: 'u1' },
          delivery: {
            invited: false,
            channel: 'email',
            status: 'failed',
            reason: 'delivery_failed',
          },
        };
      }
      if (path === '/users/u1/invite-resend') {
        return {
          user: { id: 'u1' },
          delivery: {
            invited: true,
            channel: 'email',
            status: 'queued',
          },
        };
      }
      return {};
    });

    await renderView();
    await fillValidForm();
    await fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Пользователь создан')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', {
      name: 'Повторно отправить приглашение',
    });
    expect(retryButton).toBeInTheDocument();

    await fireEvent.click(retryButton);

    await waitFor(() => {
      expect(
        screen.getByText('Приглашение поставлено в очередь отправки.')
      ).toBeInTheDocument();
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/users/u1/invite-resend', {
      method: 'POST',
    });
  });
});
