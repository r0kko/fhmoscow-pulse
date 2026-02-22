import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api';
import AdminProfessionalLeagueMatchReferees from '@/views/AdminProfessionalLeagueMatchReferees.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/professional-leagues/matches/:id/referees',
    component: AdminProfessionalLeagueMatchReferees,
  },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

const roleGroups = [
  {
    id: 'rg-lead',
    name: 'Руководство',
    alias: 'LEADERSHIP',
    roles: [{ id: 'rl1', name: 'Инспектор матча' }],
  },
  {
    id: 'rg-brig',
    name: 'Судьи в бригаде',
    alias: 'BRIGADE',
    roles: [{ id: 'rb1', name: 'Секретарь матча' }],
  },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function makeMatchRecord({
  date = '2030-01-01',
  assignments = [
    {
      id: 'a1',
      status: 'DRAFT',
      role: { id: 'rb1', group_id: 'rg-brig', name: 'Секретарь матча' },
      user: {
        id: 'u1',
        last_name: 'Иванов',
        first_name: 'Иван',
        patronymic: 'Иванович',
      },
    },
  ],
  draftClearGroupIds = [],
  refereeRequirements = [
    {
      id: 'rg-brig',
      roles: [{ id: 'rb1', count: 2 }],
    },
  ],
}: {
  date?: string;
  assignments?: Array<Record<string, unknown>>;
  draftClearGroupIds?: string[];
  refereeRequirements?: Array<Record<string, unknown>>;
}) {
  return {
    id: 'm1',
    msk_date: date,
    msk_start_time: '12:00',
    msk_end_time: '13:00',
    schedule_missing: false,
    duration_missing: false,
    assignments,
    referee_requirements: refereeRequirements,
    draft_clear_group_ids: draftClearGroupIds,
    draft_versions_by_group: { 'rg-brig': 'v1-initial' },
    team1: { id: 't1', name: 'Команда 1' },
    team2: { id: 't2', name: 'Команда 2' },
    ground: { id: 'g1', name: 'Арена 1' },
    tournament: {
      id: 'tour1',
      name: 'Кубок',
      short_name: 'Кубок',
      competition_type: { id: 'c-pro', alias: 'PRO', name: 'Профлиги' },
    },
    group: null,
    tour: null,
  };
}

function makeMatchCard() {
  return {
    id: 'm1',
    team1: 'Команда 1',
    team2: 'Команда 2',
    date_start: '2030-01-01T09:00:00.000Z',
    competition_type: { alias: 'PRO' },
    season: '2029/2030',
    tournament: 'Кубок',
    stage: 'Плей-офф',
    group: 'A',
    tour: '1',
  };
}

function makeReferees(date = '2030-01-01') {
  return [
    {
      id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
      roles: ['BRIGADE_REFEREE'],
      availability: { status: 'FREE' },
      availability_by_date: {
        [date]: { status: 'FREE', preset: true },
      },
    },
    {
      id: 'u2',
      last_name: 'Петров',
      first_name: 'Пётр',
      patronymic: 'Петрович',
      roles: ['BRIGADE_REFEREE'],
      availability: { status: 'FREE' },
      availability_by_date: {
        [date]: { status: 'FREE', preset: true },
      },
    },
  ];
}

async function renderView() {
  const router = createRouterInstance();
  router.push('/admin/professional-leagues/matches/m1/referees');
  await router.isReady();
  const utils = render(AdminProfessionalLeagueMatchReferees, {
    global: {
      plugins: [router],
      stubs: {
        Breadcrumbs: { template: '<nav data-testid="breadcrumbs" />' },
        InfoItem: {
          props: ['label', 'value'],
          template: '<div>{{ label }}: {{ value }}</div>',
        },
      },
    },
  });
  return { ...utils, router };
}

describe('AdminProfessionalLeagueMatchReferees view', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('requires confirmation before publishing incomplete match assignments', async () => {
    const publishBodies: Array<Record<string, unknown>> = [];

    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const url = new URL(path, 'https://lk.fhmoscow.com');
        if (url.pathname === '/referee-assignments/role-groups') {
          return { groups: roleGroups };
        }
        if (url.pathname === '/matches/m1') {
          return { match: makeMatchCard() };
        }
        if (url.pathname === '/referee-assignments/referees') {
          return { referees: makeReferees() };
        }
        if (url.pathname === '/referee-assignments/matches') {
          return { matches: [makeMatchRecord({})] };
        }
        if (
          url.pathname === '/referee-assignments/matches/m1/assignment-sheet'
        ) {
          return { sheet: null };
        }
        if (url.pathname === '/referee-assignments/matches/m1/publish') {
          publishBodies.push(JSON.parse(String(options?.body || '{}')));
          return {
            notifications: { queued: 1, published: 1, cancelled: 0, failed: 0 },
          };
        }
        return {};
      }
    );

    await renderView();

    const publishButton = await screen.findByRole('button', {
      name: 'Отправить назначения по матчу',
    });
    await fireEvent.click(publishButton);

    expect(
      await screen.findByText(/Есть незаполненные слоты:/)
    ).toBeInTheDocument();
    expect(publishBodies).toHaveLength(0);

    await fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить отправку' })
    );

    await waitFor(() => {
      expect(publishBodies).toHaveLength(1);
      expect(publishBodies[0]?.['allow_incomplete']).toBe(true);
    });
  });

  it('keeps cleared role empty after draft save and refresh with mixed statuses in one group', async () => {
    const putPayloads: Array<Record<string, unknown>> = [];
    let matchesRequestCount = 0;

    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const url = new URL(path, 'https://lk.fhmoscow.com');
        if (url.pathname === '/referee-assignments/role-groups') {
          return {
            groups: [
              roleGroups[0],
              {
                id: 'rg-brig',
                name: 'Судьи в бригаде',
                alias: 'BRIGADE',
                roles: [
                  { id: 'rb1', name: 'Секретарь матча' },
                  { id: 'rb2', name: 'Оператор табло' },
                ],
              },
            ],
          };
        }
        if (url.pathname === '/matches/m1') {
          return { match: makeMatchCard() };
        }
        if (url.pathname === '/referee-assignments/referees') {
          return { referees: makeReferees() };
        }
        if (url.pathname === '/referee-assignments/matches') {
          const postSaveAssignments = [
            {
              id: 'a1-published',
              status: 'PUBLISHED',
              role: { id: 'rb1', group_id: 'rg-brig', name: 'Секретарь матча' },
              user: {
                id: 'u1',
                last_name: 'Иванов',
                first_name: 'Иван',
                patronymic: 'Иванович',
              },
            },
            {
              id: 'a2',
              status: 'DRAFT',
              role: { id: 'rb2', group_id: 'rg-brig', name: 'Оператор табло' },
              user: {
                id: 'u2',
                last_name: 'Петров',
                first_name: 'Пётр',
                patronymic: 'Петрович',
              },
            },
          ];
          const initialAssignments = [
            {
              id: 'a1',
              status: 'DRAFT',
              role: { id: 'rb1', group_id: 'rg-brig', name: 'Секретарь матча' },
              user: {
                id: 'u1',
                last_name: 'Иванов',
                first_name: 'Иван',
                patronymic: 'Иванович',
              },
            },
            {
              id: 'a2',
              status: 'DRAFT',
              role: { id: 'rb2', group_id: 'rg-brig', name: 'Оператор табло' },
              user: {
                id: 'u2',
                last_name: 'Петров',
                first_name: 'Пётр',
                patronymic: 'Петрович',
              },
            },
          ];
          const assignments =
            matchesRequestCount === 0
              ? initialAssignments
              : postSaveAssignments;
          matchesRequestCount += 1;
          return {
            matches: [
              makeMatchRecord({
                assignments,
                draftClearGroupIds: [],
                refereeRequirements: [
                  {
                    id: 'rg-brig',
                    roles: [
                      { id: 'rb1', count: 1 },
                      { id: 'rb2', count: 1 },
                    ],
                  },
                ],
              }),
            ],
          };
        }
        if (
          url.pathname === '/referee-assignments/matches/m1/assignment-sheet'
        ) {
          return { sheet: null };
        }
        if (url.pathname === '/referee-assignments/matches/m1/referees') {
          const payload = options?.body ? JSON.parse(String(options.body)) : {};
          putPayloads.push(payload);
          return {
            assignments: [
              {
                id: 'a1-published',
                status: 'PUBLISHED',
                role: {
                  id: 'rb1',
                  group_id: 'rg-brig',
                  name: 'Секретарь матча',
                },
                user: {
                  id: 'u1',
                  last_name: 'Иванов',
                  first_name: 'Иван',
                  patronymic: 'Иванович',
                },
              },
              {
                id: 'a2',
                status: 'DRAFT',
                role: {
                  id: 'rb2',
                  group_id: 'rg-brig',
                  name: 'Оператор табло',
                },
                user: {
                  id: 'u2',
                  last_name: 'Петров',
                  first_name: 'Пётр',
                  patronymic: 'Петрович',
                },
              },
            ],
            draft_clear_group_ids: [],
            draft_version: 'v2-new',
            draft_versions_by_group: { 'rg-brig': 'v2-new' },
          };
        }
        return {};
      }
    );

    const { container } = await renderView();

    await waitFor(() => {
      expect(container.querySelectorAll('.referee-select').length).toBe(2);
    });

    const selects = Array.from(
      container.querySelectorAll('.referee-select')
    ) as HTMLSelectElement[];
    const [firstSelect, secondSelect] = selects;
    expect(firstSelect).toBeDefined();
    expect(secondSelect).toBeDefined();
    if (!firstSelect || !secondSelect) {
      throw new Error('Expected two referee select inputs');
    }
    await fireEvent.update(firstSelect, '');
    await fireEvent.click(
      await screen.findByRole('button', {
        name: 'Сохранить черновик назначений',
      })
    );

    await waitFor(() => {
      expect(putPayloads).toHaveLength(1);
    });
    expect(putPayloads[0]?.['assignments']).toEqual([
      { role_id: 'rb2', user_id: 'u2' },
    ]);

    await waitFor(() => {
      expect(firstSelect.value).toBe('');
      expect(secondSelect.value).toBe('u2');
    });
  });

  it('allows publish when only clear-marker exists and no draft assignments remain', async () => {
    const publishBodies: Array<Record<string, unknown>> = [];

    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const url = new URL(path, 'https://lk.fhmoscow.com');
        if (url.pathname === '/referee-assignments/role-groups') {
          return { groups: roleGroups };
        }
        if (url.pathname === '/matches/m1') {
          return { match: makeMatchCard() };
        }
        if (url.pathname === '/referee-assignments/referees') {
          return { referees: makeReferees() };
        }
        if (url.pathname === '/referee-assignments/matches') {
          return {
            matches: [
              makeMatchRecord({
                assignments: [],
                draftClearGroupIds: ['rg-brig'],
              }),
            ],
          };
        }
        if (
          url.pathname === '/referee-assignments/matches/m1/assignment-sheet'
        ) {
          return { sheet: null };
        }
        if (url.pathname === '/referee-assignments/matches/m1/publish') {
          publishBodies.push(JSON.parse(String(options?.body || '{}')));
          return {
            notifications: { queued: 0, published: 0, cancelled: 1, failed: 0 },
          };
        }
        return {};
      }
    );

    await renderView();

    const publishButton = await screen.findByRole('button', {
      name: 'Отправить назначения по матчу',
    });
    expect(publishButton).not.toBeDisabled();

    await fireEvent.click(publishButton);
    expect(
      await screen.findByText(/Есть незаполненные слоты:/)
    ).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить отправку' })
    );

    await waitFor(() => {
      expect(publishBodies).toHaveLength(1);
      expect(publishBodies[0]?.['allow_incomplete']).toBe(true);
    });
  });
});
