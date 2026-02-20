import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminRefereeAssignments from '@/views/AdminRefereeAssignments.vue';
import { apiFetch } from '@/api';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/referee-assignments',
    component: AdminRefereeAssignments,
  },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

const roleGroups = [
  {
    id: 'rg1',
    name: 'Судьи в поле',
    roles: [{ id: 'r1', name: 'Главный судья' }],
  },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function makeMatch(date = '2030-01-01') {
  return {
    id: 'm1',
    msk_date: date,
    msk_start_time: '12:00',
    msk_end_time: '13:00',
    schedule_missing: false,
    duration_missing: false,
    assignments: [],
    referee_requirements: [
      {
        id: 'rg1',
        roles: [{ id: 'r1', count: 1 }],
      },
    ],
    draft_clear_group_ids: [],
    team1: { id: 't1', name: 'Команда 1' },
    team2: { id: 't2', name: 'Команда 2' },
    ground: { id: 'g1', name: 'Арена 1' },
    tournament: {
      id: 'tour1',
      name: 'Кубок',
      short_name: 'Кубок',
      competition_type: { id: 'c1', name: 'Юношеские' },
    },
    group: null,
    tour: null,
  };
}

function makeReferee({
  id,
  lastName,
  firstName,
  patronymic,
  date,
  availabilityOnDate,
  availability,
}: {
  id: string;
  lastName: string;
  firstName: string;
  patronymic?: string;
  date: string;
  availabilityOnDate: {
    status: string;
    preset: boolean;
    from_time?: string | null;
    to_time?: string | null;
    partial_mode?: string | null;
  };
  availability?: {
    status: string;
    preset: boolean;
    from_time?: string | null;
    to_time?: string | null;
    partial_mode?: string | null;
  };
}) {
  return {
    id,
    last_name: lastName,
    first_name: firstName,
    patronymic: patronymic || '',
    roles: ['REFEREE'],
    availability:
      availability ||
      ({
        status: availabilityOnDate.status,
        preset: availabilityOnDate.preset,
        from_time: availabilityOnDate.from_time || null,
        to_time: availabilityOnDate.to_time || null,
        partial_mode: availabilityOnDate.partial_mode || null,
      } as const),
    availability_by_date: {
      [date]: {
        status: availabilityOnDate.status,
        preset: availabilityOnDate.preset,
        from_time: availabilityOnDate.from_time || null,
        to_time: availabilityOnDate.to_time || null,
        partial_mode: availabilityOnDate.partial_mode || null,
      },
    },
  };
}

async function renderView() {
  const router = createRouterInstance();
  router.push('/admin/referee-assignments');
  await router.isReady();
  const utils = render(AdminRefereeAssignments, {
    global: {
      plugins: [router],
    },
  });
  return { ...utils, router };
}

describe('AdminRefereeAssignments view', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows only referees with explicit availability on selected date and sends strict flag', async () => {
    const date = '2030-01-01';
    window.localStorage.setItem('adminRefereeAssignmentsDate', date);

    apiFetchMock.mockImplementation(async (path: string) => {
      const url = new URL(path, 'https://lk.fhmoscow.com');
      if (url.pathname === '/referee-assignments/role-groups') {
        return { groups: roleGroups };
      }
      if (url.pathname === '/tournaments/settings-options') {
        return { competition_types: [] };
      }
      if (url.pathname === '/referee-assignments/matches') {
        return { matches: [makeMatch(date)] };
      }
      if (url.pathname === '/referee-assignments/referees') {
        return {
          referees: [
            makeReferee({
              id: 'u1',
              lastName: 'Иванов',
              firstName: 'Иван',
              patronymic: 'Иванович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
            makeReferee({
              id: 'u2',
              lastName: 'Петров',
              firstName: 'Пётр',
              patronymic: 'Петрович',
              date,
              availabilityOnDate: { status: 'FREE', preset: false },
              availability: { status: 'FREE', preset: true },
            }),
          ],
        };
      }
      return {};
    });

    const { container } = await renderView();

    await waitFor(() => {
      const panelText =
        container.querySelector('.referee-panel')?.textContent || '';
      expect(panelText).toContain('Иванов');
    });
    const panelText =
      container.querySelector('.referee-panel')?.textContent || '';
    expect(panelText).not.toContain('Петров');

    const refereeCalls = apiFetchMock.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/referee-assignments/referees?'));
    expect(refereeCalls.length).toBeGreaterThan(0);
    expect(
      refereeCalls.some((path) => path.includes('require_preset_for_date=1'))
    ).toBe(true);
  });

  it('formats referee names by uniqueness rules in assignment cells', async () => {
    const date = '2030-01-01';
    window.localStorage.setItem('adminRefereeAssignmentsDate', date);

    apiFetchMock.mockImplementation(async (path: string) => {
      const url = new URL(path, 'https://lk.fhmoscow.com');
      if (url.pathname === '/referee-assignments/role-groups') {
        return { groups: roleGroups };
      }
      if (url.pathname === '/tournaments/settings-options') {
        return { competition_types: [] };
      }
      if (url.pathname === '/referee-assignments/matches') {
        return { matches: [makeMatch(date)] };
      }
      if (url.pathname === '/referee-assignments/referees') {
        return {
          referees: [
            makeReferee({
              id: 'u1',
              lastName: 'Иванов',
              firstName: 'Петр',
              patronymic: 'Олегович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
            makeReferee({
              id: 'u2',
              lastName: 'Иванов',
              firstName: 'Сергей',
              patronymic: 'Сергеевич',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
            makeReferee({
              id: 'u3',
              lastName: 'Петров',
              firstName: 'Иван',
              patronymic: 'Иванович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
            makeReferee({
              id: 'u4',
              lastName: 'Петров',
              firstName: 'Иван',
              patronymic: 'Олегович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
          ],
        };
      }
      return {};
    });

    const { container } = await renderView();

    await waitFor(() => {
      expect(container.querySelector('.referee-select')).not.toBeNull();
    });

    const select = container.querySelector(
      '.referee-select'
    ) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option')).map((opt) =>
      (opt.textContent || '').trim()
    );

    expect(options).toContain('Иванов Петр');
    expect(options).toContain('Иванов Сергей');
    expect(options).toContain('Петров Иван И.');
    expect(options).toContain('Петров Иван О.');
  });

  it('ignores stale save error when a newer selection is already saved', async () => {
    const date = '2030-01-01';
    window.localStorage.setItem('adminRefereeAssignmentsDate', date);

    const putRequests: Array<{
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
    }> = [];

    apiFetchMock.mockImplementation(async (path: string) => {
      const url = new URL(path, 'https://lk.fhmoscow.com');
      if (url.pathname === '/referee-assignments/role-groups') {
        return { groups: roleGroups };
      }
      if (url.pathname === '/tournaments/settings-options') {
        return { competition_types: [] };
      }
      if (url.pathname === '/referee-assignments/matches') {
        return { matches: [makeMatch(date)] };
      }
      if (url.pathname === '/referee-assignments/referees') {
        return {
          referees: [
            makeReferee({
              id: 'u1',
              lastName: 'Иванов',
              firstName: 'Иван',
              patronymic: 'Иванович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
            makeReferee({
              id: 'u2',
              lastName: 'Петров',
              firstName: 'Пётр',
              patronymic: 'Петрович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
          ],
        };
      }
      if (url.pathname === '/referee-assignments/matches/m1/referees') {
        return await new Promise((resolve, reject) => {
          putRequests.push({ resolve, reject });
        });
      }
      return {};
    });

    const { container } = await renderView();

    await waitFor(() => {
      expect(container.querySelector('.referee-select')).not.toBeNull();
    });

    const select = container.querySelector(
      '.referee-select'
    ) as HTMLSelectElement;

    await fireEvent.update(select, 'u1');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(putRequests).toHaveLength(1);

    await fireEvent.update(select, 'u2');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(putRequests).toHaveLength(2);

    const latestRequest = putRequests[1];
    if (!latestRequest) {
      throw new Error('Expected second PUT request to be queued');
    }
    latestRequest.resolve({
      assignments: [
        {
          id: 'a1',
          status: 'DRAFT',
          role: { id: 'r1', group_id: 'rg1', name: 'Главный судья' },
          user: {
            id: 'u2',
            last_name: 'Петров',
            first_name: 'Пётр',
            patronymic: 'Петрович',
          },
        },
      ],
      draft_clear_group_ids: [],
    });

    await waitFor(() => {
      expect(select.value).toBe('u2');
    });

    const staleRequest = putRequests[0];
    if (!staleRequest) {
      throw new Error('Expected first PUT request to be queued');
    }
    staleRequest.reject(new Error('Судья недоступен в выбранное время'));

    await waitFor(() => {
      expect(select.value).toBe('u2');
    });
    expect(screen.queryByText('Судья недоступен в выбранное время')).toBeNull();
  });

  it('keeps newest referees list when date changes quickly', async () => {
    const firstDate = '2030-01-01';
    const secondDate = '2030-01-02';
    window.localStorage.setItem('adminRefereeAssignmentsDate', firstDate);

    const resolveFirstRefereesRef: {
      current: ((value: unknown) => void) | null;
    } = { current: null };

    apiFetchMock.mockImplementation(async (path: string) => {
      const url = new URL(path, 'https://lk.fhmoscow.com');
      if (url.pathname === '/referee-assignments/role-groups') {
        return { groups: roleGroups };
      }
      if (url.pathname === '/tournaments/settings-options') {
        return { competition_types: [] };
      }
      if (url.pathname === '/referee-assignments/matches') {
        const date = String(url.searchParams.get('date') || firstDate);
        return { matches: [makeMatch(date)] };
      }
      if (url.pathname === '/referee-assignments/referees') {
        const date = String(url.searchParams.get('date') || firstDate);
        if (date === firstDate) {
          return await new Promise((resolve) => {
            resolveFirstRefereesRef.current = resolve;
          });
        }
        return {
          referees: [
            makeReferee({
              id: 'u2',
              lastName: 'Петров',
              firstName: 'Пётр',
              patronymic: 'Петрович',
              date,
              availabilityOnDate: { status: 'FREE', preset: true },
            }),
          ],
        };
      }
      return {};
    });

    const { container } = await renderView();

    await waitFor(() => {
      expect(resolveFirstRefereesRef.current).not.toBeNull();
    });

    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    await fireEvent.update(dateInput, secondDate);

    await waitFor(() => {
      const panelText =
        container.querySelector('.referee-panel')?.textContent || '';
      expect(panelText).toContain('Петров');
    });

    const resolveFirstReferees = resolveFirstRefereesRef.current;
    if (!resolveFirstReferees) {
      throw new Error('Expected first referees request resolver');
    }
    resolveFirstReferees({
      referees: [
        makeReferee({
          id: 'u1',
          lastName: 'Иванов',
          firstName: 'Иван',
          patronymic: 'Иванович',
          date: firstDate,
          availabilityOnDate: { status: 'FREE', preset: true },
        }),
      ],
    });

    await waitFor(() => {
      const panelText =
        container.querySelector('.referee-panel')?.textContent || '';
      expect(panelText).toContain('Петров');
      expect(panelText).not.toContain('Иванов');
    });
  });
});
