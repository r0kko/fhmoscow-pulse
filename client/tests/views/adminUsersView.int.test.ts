import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminUsers from '@/views/AdminUsers.vue';
import { apiFetch } from '@/api';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('bootstrap/js/dist/tooltip', () => ({
  default: class TooltipMock {
    constructor(_el: unknown) {}
    dispose(): void {}
  },
}));

vi.mock('bootstrap/js/dist/modal', () => ({
  default: class ModalMock {
    constructor(..._args: unknown[]) {}
    show(): void {}
    hide(): void {}
    dispose(): void {}
  },
}));

const apiFetchMock = vi.mocked(apiFetch);

const baseUsers = [
  {
    id: 'u1',
    first_name: 'Иван',
    last_name: 'Иванов',
    patronymic: 'Иванович',
    phone: '79991112233',
    email: 'ivanov@example.com',
    birth_date: '2000-01-01',
    status: 'ACTIVE',
    status_name: 'Активен',
  },
  {
    id: 'u2',
    first_name: 'Петр',
    last_name: 'Петров',
    patronymic: 'Петрович',
    phone: '79992223344',
    email: 'petrov@example.com',
    birth_date: '2001-02-01',
    status: 'INACTIVE',
    status_name: 'Заблокирован',
  },
];

const routes: RouteRecordRaw[] = [
  { path: '/admin/users', component: AdminUsers },
  { path: '/admin/users/new', component: { template: '<div>new</div>' } },
  { path: '/admin/users/:id', component: { template: '<div>user</div>' } },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

async function renderView(path = '/admin/users') {
  const router = createRouterInstance();
  router.push(path);
  await router.isReady();
  render(AdminUsers, {
    global: {
      plugins: [router],
      directives: {
        'edge-fade': () => {},
      },
    },
  });
  return { router };
}

describe('AdminUsers view', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/roles') {
        return { roles: [] };
      }
      if (path.startsWith('/users/profile-completion?')) {
        return {
          profiles: [],
          meta: { total: 0, page: 1, pages: 1, limit: 20 },
        };
      }
      if (path.startsWith('/users?')) {
        return {
          users: baseUsers,
          total: 2,
          meta: { total: 2, page: 1, pages: 1, limit: 20 },
        };
      }
      return {};
    });
  });

  it('loads users once for deep-link filters (no duplicate requests)', async () => {
    await renderView('/admin/users?search=alex&status=ACTIVE');

    await waitFor(() => {
      const userCalls = apiFetchMock.mock.calls.filter(
        ([path]) =>
          typeof path === 'string' && String(path).startsWith('/users?')
      );
      expect(userCalls).toHaveLength(1);
    });
  });

  it('uses normalized default page size 20 with explicit options', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/roles') {
        return { roles: [] };
      }
      if (path.startsWith('/users?')) {
        return {
          users: baseUsers,
          total: 40,
          meta: { total: 40, page: 1, pages: 2, limit: 20 },
        };
      }
      if (path.startsWith('/users/profile-completion?')) {
        return {
          profiles: [],
          meta: { total: 0, page: 1, pages: 1, limit: 20 },
        };
      }
      return {};
    });

    await renderView('/admin/users');

    const pageSizeSelect = await screen.findByLabelText(
      'Количество на странице'
    );
    expect((pageSizeSelect as HTMLSelectElement).value).toBe('20');

    const options = Array.from(
      (pageSizeSelect as HTMLSelectElement).querySelectorAll('option')
    ).map((el) => el.value);
    expect(options).toEqual(['10', '20', '50']);
  });

  it('sets native indeterminate state for master checkbox', async () => {
    await renderView('/admin/users');

    const masterCheckbox = (await screen.findByLabelText(
      'Выбрать все на странице'
    )) as HTMLInputElement;
    const firstRowCheckbox = (await screen.findByLabelText(
      'Выбрать Иванов Иван'
    )) as HTMLInputElement;

    expect(masterCheckbox.indeterminate).toBe(false);

    await fireEvent.click(firstRowCheckbox);

    expect(masterCheckbox.indeterminate).toBe(true);
  });
});
