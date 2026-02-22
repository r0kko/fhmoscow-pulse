import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminRefereeAvailability from '@/views/AdminRefereeAvailability.vue';
import { apiFetch } from '@/api';

vi.mock('bootstrap/js/dist/modal', () => ({
  default: class ModalMock {
    show() {}
    hide() {}
  },
}));

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/referee-availability',
    component: AdminRefereeAvailability,
  },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

function makeUsers(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    return {
      id: `u-${index}`,
      last_name: `Судья${String(index).padStart(3, '0')}`,
      first_name: `Имя${index}`,
      patronymic: `Отч${index}`,
      roles: index % 2 === 0 ? ['REFEREE'] : ['BRIGADE_REFEREE'],
      availability: {
        '2030-01-01': {
          status: 'FREE',
          preset: false,
          from_time: null,
          to_time: null,
          partial_mode: null,
        },
      },
    };
  });
}

const allUsers = makeUsers(150);

function buildGridResponse(urlString: string) {
  const url = new URL(urlString, 'https://lk.fhmoscow.com');
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const hasPage = url.searchParams.has('page');
  const hasLimit = url.searchParams.has('limit');
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '25');

  const roles = url.searchParams.getAll('role');

  let filtered = allUsers;
  if (roles.length) {
    const roleSet = new Set(roles);
    filtered = filtered.filter((u) => u.roles.some((r) => roleSet.has(r)));
  }

  if (search) {
    filtered = filtered.filter((u) => {
      const fullName = [u.last_name, u.first_name, u.patronymic]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return fullName.includes(search);
    });
  }

  const usePagination = hasPage || hasLimit;
  const rows = usePagination
    ? filtered.slice((page - 1) * limit, (page - 1) * limit + limit)
    : filtered;

  return {
    dates: ['2030-01-01'],
    availableDates: ['2030-01-01'],
    users: rows,
    meta: {
      total: filtered.length,
      page,
      pages: Math.max(1, Math.ceil(filtered.length / Math.max(limit, 1))),
      limit: usePagination ? limit : rows.length,
    },
  };
}

async function renderView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });

  router.push('/admin/referee-availability');
  await router.isReady();

  const utils = render(AdminRefereeAvailability, {
    global: {
      plugins: [router],
    },
  });
  return { ...utils, router };
}

describe('AdminRefereeAvailability view', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (path: string) => {
      const url = new URL(path, 'https://lk.fhmoscow.com');
      if (url.pathname === '/availabilities/admin-grid') {
        return buildGridResponse(path);
      }
      if (url.pathname.startsWith('/availabilities/admin/')) {
        const userId = url.pathname.split('/').at(-1) || 'u-1';
        return {
          user: allUsers.find((u) => u.id === userId) || allUsers[0],
          dates: ['2030-01-01'],
          availableDates: ['2030-01-01'],
          days: [
            {
              date: '2030-01-01',
              status: 'FREE',
              from_time: null,
              to_time: null,
              partial_mode: null,
              preset: false,
            },
          ],
        };
      }
      if (url.pathname === '/users') {
        return { users: [] };
      }
      return {};
    });
  });

  it('renders 150 referees with server pagination', async () => {
    await renderView();

    await waitFor(() => {
      expect(screen.getByText('Судья001 Имя1 Отч1')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Судья026 Имя26 Отч26')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(screen.getByText('Судья026 Имя26 Отч26')).toBeInTheDocument();
    });

    const gridCalls = apiFetchMock.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/availabilities/admin-grid?'));
    expect(gridCalls.some((path) => path.includes('page=2'))).toBe(true);
    expect(gridCalls.some((path) => path.includes('limit=25'))).toBe(true);
  });

  it('resets to first page on search and avoids false empty state', async () => {
    await renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      expect(screen.getByText('Судья026 Имя26 Отч26')).toBeInTheDocument();
    });

    await fireEvent.update(
      screen.getByRole('searchbox', { name: 'Поиск по ФИО' }),
      'Судья003'
    );

    await waitFor(() => {
      expect(screen.getByText('Судья003 Имя3 Отч3')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Нет данных для отображения.')
    ).not.toBeInTheDocument();

    const gridCalls = apiFetchMock.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/availabilities/admin-grid?'));
    expect(
      gridCalls.some((path) =>
        path.includes('search=%D0%A1%D1%83%D0%B4%D1%8C%D1%8F003')
      )
    ).toBe(true);
    expect(
      gridCalls.some(
        (path) =>
          path.includes('search=%D0%A1%D1%83%D0%B4%D1%8C%D1%8F003') &&
          path.includes('page=1')
      )
    ).toBe(true);
  });

  it('keeps search input focus while grid reloads', async () => {
    await renderView();

    await waitFor(() => {
      expect(screen.getByText('Судья001 Имя1 Отч1')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('searchbox', {
      name: 'Поиск по ФИО',
    }) as HTMLInputElement;
    searchInput.focus();

    expect(document.activeElement).toBe(searchInput);

    await fireEvent.update(searchInput, 'С');

    await waitFor(() => {
      const gridCalls = apiFetchMock.mock.calls
        .map(([path]) => String(path))
        .filter((path) => path.includes('/availabilities/admin-grid?'));
      expect(gridCalls.some((path) => path.includes('search='))).toBe(true);
    });

    expect(document.activeElement).toBe(searchInput);
  });

  it('blocks applying filters when no roles are selected', async () => {
    await renderView();

    await waitFor(() => {
      expect(screen.getByText('Судья001 Имя1 Отч1')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: /фильтр/i }));

    const field =
      (screen.getByText('Роли').closest('.mb-3') as HTMLElement | null) ||
      document.body;
    const roleCheckboxes = within(field).getAllByRole('checkbox', {
      hidden: true,
    });
    expect(roleCheckboxes.length).toBeGreaterThanOrEqual(2);

    for (const checkbox of roleCheckboxes) {
      if ((checkbox as HTMLInputElement).checked) {
        await fireEvent.click(checkbox);
      }
    }

    expect(screen.getByText('Выберите хотя бы одну роль.')).toBeInTheDocument();

    const applyButton = screen.getByRole('button', {
      name: 'Применить',
      hidden: true,
    });
    expect(applyButton).toBeDisabled();

    const callCountBefore = apiFetchMock.mock.calls.length;
    await fireEvent.click(applyButton);
    expect(apiFetchMock.mock.calls.length).toBe(callCountBefore);
  });

  it('keeps active filter summary after subsequent reload', async () => {
    await renderView();

    await waitFor(() => {
      expect(screen.getByText('Судья001 Имя1 Отч1')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: /фильтр/i }));

    const brigadeCheckbox = screen.getByRole('checkbox', {
      name: 'Судья в бригаде',
      hidden: true,
    });
    await fireEvent.click(brigadeCheckbox);

    await fireEvent.click(
      screen.getByRole('button', { name: 'Применить', hidden: true })
    );

    await waitFor(() => {
      expect(screen.getByText('Роли: Судья в поле')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(screen.getByText('Роли: Судья в поле')).toBeInTheDocument();
    });
  });
});
