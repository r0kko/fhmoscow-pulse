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
  type Router,
} from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminSportsCalendar from '@/views/AdminSportsCalendar.vue';
import edgeFade from '@/utils/edgeFade';
import { apiFetch } from '@/api';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const baseMatches = [
  {
    id: 101,
    date: '2030-01-01T12:00:00Z',
    team1: 'Спартак',
    team2: 'Динамо',
    home_club: 'Клуб А',
    away_club: 'Клуб Б',
    stadium: 'Арена 1',
    tournament: 'Кубок города',
    group: 'Группа 1',
    tour: '1 тур',
    urgent_unagreed: true,
    agreement_accepted: false,
    agreement_pending: true,
    agreements_allowed: true,
    status: { alias: 'SCHEDULED', name: 'Назначен' },
  },
  {
    id: 102,
    date: '2030-01-02T12:00:00Z',
    team1: 'ЦСКА',
    team2: 'Локомотив',
    home_club: 'Клуб В',
    away_club: 'Клуб Г',
    stadium: 'Арена 2',
    tournament: 'Первенство',
    group: 'Группа 2',
    tour: '2 тур',
    urgent_unagreed: false,
    agreement_accepted: true,
    agreement_pending: false,
    agreements_allowed: true,
    status: { alias: 'SCHEDULED', name: 'Назначен' },
  },
];

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/sports-calendar',
    component: AdminSportsCalendar,
  },
  { path: '/admin/matches/:id', component: { template: '<div />' } },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

async function renderCalendar() {
  const router = createRouterInstance();
  router.push('/admin/sports-calendar');
  await router.isReady();

  const utils = render(AdminSportsCalendar, {
    global: {
      plugins: [router],
      directives: {
        'edge-fade': edgeFade,
      },
    },
  });

  await waitFor(() => {
    expect(apiFetchMock).toHaveBeenCalled();
  });

  return { ...utils, router };
}

function installDefaultApiMock() {
  apiFetchMock.mockImplementation(async (path: string) => {
    const url = new URL(path, 'https://lk.fhmoscow.com');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const matches = q
      ? baseMatches.filter((item) =>
          [item.team1, item.team2, item.tournament, item.home_club]
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : baseMatches;

    return {
      matches: matches.map((item) => ({ ...item })),
      range: {
        start: '2030-01-01T00:00:00.000Z',
        end_exclusive: '2030-03-01T00:00:00.000Z',
      },
    };
  });
}

describe('Admin sports calendar view', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    apiFetchMock.mockReset();
    installDefaultApiMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues exactly one additional request when filters are applied', async () => {
    await renderCalendar();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await fireEvent.click(
      screen.getByRole('tab', { name: /Прошедшие/i, hidden: true })
    );
    await fireEvent.click(
      screen.getByRole('button', { name: 'Применить', hidden: true })
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('debounces search input and runs immediate submit on Enter', async () => {
    await renderCalendar();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    const input = screen.getByPlaceholderText(
      'Поиск по командам, клубам, стадионам'
    );

    await fireEvent.update(input, 'Спартак');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });

    await fireEvent.update(input, 'ЦСКА');
    await fireEvent.keyUp(input, { key: 'Enter' });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('resets filters and synchronizes URL + session state to defaults', async () => {
    const { container, router } = await renderCalendar();

    await fireEvent.click(
      screen.getByRole('button', {
        name: /Требуют внимания/i,
        hidden: true,
      })
    );
    await fireEvent.click(
      screen.getByRole('button', { name: 'Применить', hidden: true })
    );

    await screen.findByText(/1 фильтр активен/i);

    const resetButton =
      container.querySelector<HTMLButtonElement>('.summary-reset');
    expect(resetButton).not.toBeNull();
    await fireEvent.click(resetButton!);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });

    expect(router.currentRoute.value.query['status']).toBeUndefined();
    expect(router.currentRoute.value.query['q']).toBeUndefined();

    const state = JSON.parse(
      window.sessionStorage.getItem('admin-sports-calendar-state-v2') || '{}'
    );
    expect(state.statusScope).toBe('all');
    expect(state.search).toBe('');

    const searchInput = screen.getByPlaceholderText(
      'Поиск по командам, клубам, стадионам'
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('');
  });

  it('shows an empty-state message when there are no matches', async () => {
    apiFetchMock.mockResolvedValueOnce({
      matches: [],
      range: {
        start: '2030-01-01T00:00:00.000Z',
        end_exclusive: '2030-01-15T00:00:00.000Z',
      },
    });

    await renderCalendar();

    expect(
      await screen.findByText(
        'Нет матчей по выбранным фильтрам в указанном диапазоне.'
      )
    ).toBeInTheDocument();
  });

  it('supports keyboard removal of selected chips in filters modal', async () => {
    const { container } = await renderCalendar();

    const homeSelect = container.querySelector<HTMLSelectElement>('#f-home');
    expect(homeSelect).not.toBeNull();
    await fireEvent.update(homeSelect!, 'Клуб А');

    const addButton =
      homeSelect?.parentElement?.querySelector<HTMLButtonElement>('button');
    expect(addButton).not.toBeNull();
    await fireEvent.click(addButton!);

    const chipButton = await screen.findByRole('button', {
      name: 'Удалить фильтр Хозяин: Клуб А',
      hidden: true,
    });

    chipButton.focus();
    await fireEvent.keyDown(chipButton, { key: 'Enter' });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'Удалить фильтр Хозяин: Клуб А',
          hidden: true,
        })
      ).toBeNull();
    });

    const group = screen
      .getByText('Структурные фильтры')
      .closest('.modal-filter-group');
    expect(group).not.toBeNull();
    const withinGroup = within(group as HTMLElement);
    expect(
      withinGroup.queryByRole('button', {
        name: 'Удалить фильтр Хозяин: Клуб А',
        hidden: true,
      })
    ).toBeNull();
  });
});
