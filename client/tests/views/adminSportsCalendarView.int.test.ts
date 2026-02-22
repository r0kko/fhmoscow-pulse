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
    id: '101',
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
    needs_attention: true,
    agreement_accepted: false,
    agreement_pending: true,
    agreements_allowed: true,
    status: { alias: 'SCHEDULED', name: 'Назначен' },
  },
  {
    id: '102',
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
    needs_attention: false,
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
  return renderCalendarAt('/admin/sports-calendar');
}

async function renderCalendarAt(path: string, router?: Router) {
  const activeRouter = router || createRouterInstance();
  activeRouter.push(path);
  await activeRouter.isReady();

  const utils = render(AdminSportsCalendar, {
    global: {
      plugins: [activeRouter],
      directives: {
        'edge-fade': edgeFade,
      },
    },
  });

  await waitFor(() => {
    expect(apiFetchMock).toHaveBeenCalled();
  });

  return { ...utils, router: activeRouter };
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
      day_tabs: [
        {
          day_key: Date.parse('2030-01-01T00:00:00.000Z'),
          count: 1,
          attention_count: 1,
        },
        {
          day_key: Date.parse('2030-01-02T00:00:00.000Z'),
          count: 1,
          attention_count: 0,
        },
      ],
      meta: {
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: matches.length,
        requested_anchor: url.searchParams.get('anchor'),
        requested_direction: (url.searchParams.get('direction') ||
          'forward') as 'forward' | 'backward',
        requested_count: Number(url.searchParams.get('count') || 14),
        requested_horizon: Number(url.searchParams.get('horizon') || 56),
        constraint_flags: {
          has_search: Boolean(q),
          has_structural_filters: Boolean(
            url.searchParams.getAll('home_club').length ||
            url.searchParams.getAll('away_club').length ||
            url.searchParams.getAll('tournament').length ||
            url.searchParams.getAll('group').length ||
            url.searchParams.getAll('stadium').length
          ),
        },
      },
    };
  });
}

function getFetchUrl(callIndex = 0): URL {
  const call = apiFetchMock.mock.calls[callIndex];
  const path = call?.[0];
  expect(path).toBeTypeOf('string');
  return new URL(path as string, 'https://lk.fhmoscow.com');
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

  it('applies truncated overlong search input without requiring extra typing', async () => {
    await renderCalendar();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    const input = screen.getByPlaceholderText(
      'Поиск по командам, клубам, стадионам'
    ) as HTMLInputElement;
    const overlong = 'Супердлинныйпоисковыйзапрос'.repeat(5);
    const expected = overlong.slice(0, 80);

    await fireEvent.update(input, overlong);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });

    expect(input.value).toBe(expected);
    const url = getFetchUrl(apiFetchMock.mock.calls.length - 1);
    expect(url.searchParams.get('q')).toBe(expected);
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

    await screen.findByText(/1 параметр активен/i);

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
      window.sessionStorage.getItem('admin-sports-calendar-state-v3') || '{}'
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
      day_tabs: [],
      meta: {
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: 0,
        requested_anchor: null,
        requested_direction: 'forward',
        requested_count: 14,
        requested_horizon: 56,
        constraint_flags: {
          has_search: false,
          has_structural_filters: false,
        },
      },
    });

    await renderCalendar();

    expect(
      await screen.findByText('В выбранном диапазоне матчей нет.')
    ).toBeInTheDocument();
  });

  it('renders accessible empty-state status and keyboard-reachable actions', async () => {
    apiFetchMock.mockResolvedValueOnce({
      matches: [],
      range: {
        start: '2030-01-01T00:00:00.000Z',
        end_exclusive: '2030-01-15T00:00:00.000Z',
      },
      day_tabs: [],
      meta: {
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: 0,
        requested_anchor: null,
        requested_direction: 'forward',
        requested_count: 14,
        requested_horizon: 56,
        constraint_flags: {
          has_search: false,
          has_structural_filters: false,
        },
      },
    });

    await renderCalendar();

    const title = await screen.findByText('В выбранном диапазоне матчей нет.');
    const status = title.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status as HTMLElement).toHaveAttribute('aria-live', 'polite');
    const shiftButton = within(status as HTMLElement).getByRole('button', {
      name: /Сдвинуть диапазон/i,
    });
    shiftButton.focus();
    expect(document.activeElement).toBe(shiftButton);
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

  it('derives anchor from day deep-link and forwards tournament filter', async () => {
    await renderCalendarAt(
      '/admin/sports-calendar?day=1772841600000&tournament=ВХЛ'
    );

    const requestUrl = getFetchUrl(0);
    expect(requestUrl.searchParams.get('anchor')).toBe('2026-03-07');
    expect(requestUrl.searchParams.getAll('tournament')).toEqual(['ВХЛ']);
    expect(requestUrl.searchParams.has('day')).toBe(false);
  });

  it('rehydrates route query and uses replace for search + push for apply', async () => {
    const router = createRouterInstance();
    await router.push(
      '/admin/sports-calendar?time=past&status=pending&q=Спартак&home=Клуб%20А&anchor=2030-01-05'
    );
    await router.isReady();
    const pushSpy = vi.spyOn(router, 'push');
    const replaceSpy = vi.spyOn(router, 'replace');

    render(AdminSportsCalendar, {
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

    const firstUrl = getFetchUrl(0);
    expect(firstUrl.searchParams.get('direction')).toBe('backward');
    expect(firstUrl.searchParams.get('anchor')).toBe('2030-01-05');
    expect(firstUrl.searchParams.get('q')).toBe('Спартак');
    expect(firstUrl.searchParams.getAll('home_club')).toEqual(['Клуб А']);

    const input = screen.getByPlaceholderText(
      'Поиск по командам, клубам, стадионам'
    ) as HTMLInputElement;
    expect(input.value).toBe('Спартак');

    const replaceCallsBefore = replaceSpy.mock.calls.length;
    await fireEvent.update(input, 'Локомотив');
    await waitFor(() => {
      expect(replaceSpy.mock.calls.length).toBeGreaterThan(replaceCallsBefore);
    });
    const searchUrl = getFetchUrl(apiFetchMock.mock.calls.length - 1);
    expect(searchUrl.searchParams.get('q')).toBe('Локомотив');

    const pushCallsBefore = pushSpy.mock.calls.length;
    await fireEvent.click(
      screen.getByRole('button', { name: /Согласовано/i, hidden: true })
    );
    await fireEvent.click(
      screen.getByRole('button', { name: 'Применить', hidden: true })
    );
    await waitFor(() => {
      expect(pushSpy.mock.calls.length).toBeGreaterThan(pushCallsBefore);
    });
  });

  it('counts search as active parameter in summary', async () => {
    await renderCalendar();
    const input = screen.getByPlaceholderText(
      'Поиск по командам, клубам, стадионам'
    );
    await fireEvent.update(input, 'Спартак');
    await waitFor(() => {
      expect(screen.getByText(/1 параметр активен/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Параметры не применены')).toBeNull();
  });

  it('counts non-default period as active parameter without structural filters', async () => {
    await renderCalendarAt('/admin/sports-calendar?time=past');
    expect(await screen.findByText(/1 параметр активен/i)).toBeInTheDocument();
  });

  it('renders anchor parameter chip when anchor is non-default', async () => {
    await renderCalendarAt('/admin/sports-calendar?anchor=2030-01-05');
    expect(
      await screen.findByRole('button', {
        name: 'Удалить фильтр Опорная дата: 2030-01-05',
        hidden: true,
      })
    ).toBeInTheDocument();
  });

  it('shows constrained empty-state when active constraints are present', async () => {
    apiFetchMock.mockResolvedValueOnce({
      matches: [],
      range: {
        start: '2030-01-01T00:00:00.000Z',
        end_exclusive: '2030-01-15T00:00:00.000Z',
      },
      day_tabs: [],
      meta: {
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: 0,
        requested_anchor: '2030-01-01T00:00:00.000Z',
        requested_direction: 'forward',
        requested_count: 14,
        requested_horizon: 56,
        constraint_flags: {
          has_search: true,
          has_structural_filters: false,
        },
      },
    });
    await renderCalendarAt('/admin/sports-calendar?q=Спартак');
    expect(
      await screen.findByText('По текущим параметрам матчей не найдено.')
    ).toBeInTheDocument();
  });

  it('empty-state shift action moves anchor and triggers reload', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T12:00:00.000Z'));
    apiFetchMock.mockResolvedValue({
      matches: [],
      range: {
        start: '2030-01-01T00:00:00.000Z',
        end_exclusive: '2030-01-15T00:00:00.000Z',
      },
      day_tabs: [],
      meta: {
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: 0,
        requested_anchor: '2030-01-01T00:00:00.000Z',
        requested_direction: 'forward',
        requested_count: 14,
        requested_horizon: 56,
        constraint_flags: {
          has_search: false,
          has_structural_filters: false,
        },
      },
    });

    await renderCalendar();
    const firstUrl = getFetchUrl(0);
    await fireEvent.click(
      screen.getByRole('button', { name: /Сдвинуть диапазон/i })
    );
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });
    const secondUrl = getFetchUrl(1);
    const firstAnchor = firstUrl.searchParams.get('anchor');
    const secondAnchor = secondUrl.searchParams.get('anchor');
    expect(firstAnchor).toBe('2030-01-01');
    expect(secondAnchor).toBe('2030-01-15');
  });
});
