import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api';
import AdminProfessionalRefereeAssignments from '@/views/AdminProfessionalRefereeAssignments.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/professional-leagues/referee-assignments',
    component: AdminProfessionalRefereeAssignments,
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

function makeMatch({
  date = '2030-01-01',
  slotCount = 1,
  assignedUserId = 'u1',
}: {
  date?: string;
  slotCount?: number;
  assignedUserId?: string;
}) {
  return {
    id: 'm1',
    msk_date: date,
    msk_start_time: '12:00',
    msk_end_time: '13:00',
    schedule_missing: false,
    duration_missing: false,
    assignments: [
      {
        id: 'a1',
        status: 'DRAFT',
        role: { id: 'rb1', group_id: 'rg-brig', name: 'Секретарь матча' },
        user: {
          id: assignedUserId,
          last_name: assignedUserId === 'u1' ? 'Иванов' : 'Петров',
          first_name: assignedUserId === 'u1' ? 'Иван' : 'Пётр',
          patronymic: 'Тестович',
        },
      },
    ],
    referee_requirements: [
      {
        id: 'rg-brig',
        roles: [{ id: 'rb1', count: slotCount }],
      },
    ],
    draft_clear_group_ids: [],
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
  router.push('/admin/professional-leagues/referee-assignments');
  await router.isReady();
  const utils = render(AdminProfessionalRefereeAssignments, {
    global: {
      plugins: [router],
    },
  });
  return { ...utils, router };
}

describe('AdminProfessionalRefereeAssignments view', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('applies server snapshot on draft conflict (409)', async () => {
    const date = '2030-01-01';

    apiFetchMock.mockImplementation(async (path: string) => {
      const url = new URL(path, 'https://lk.fhmoscow.com');
      if (url.pathname === '/referee-assignments/role-groups') {
        return { groups: roleGroups };
      }
      if (url.pathname === '/referee-assignments/matches') {
        return {
          matches: [makeMatch({ date, slotCount: 1, assignedUserId: 'u1' })],
        };
      }
      if (url.pathname === '/referee-assignments/referees') {
        return { referees: makeReferees(date) };
      }
      if (url.pathname === '/referee-assignments/matches/m1/referees') {
        const err = new Error(
          'Назначения уже изменены другим администратором. Данные обновлены.'
        ) as Error & { code?: string; details?: unknown };
        err.code = 'referee_assignments_conflict';
        err.details = {
          assignments: [
            {
              id: 'a2',
              status: 'DRAFT',
              role: { id: 'rb1', group_id: 'rg-brig', name: 'Секретарь матча' },
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
        throw err;
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
    await fireEvent.update(select, '');

    await waitFor(() => {
      expect(select.value).toBe('u2');
    });
  });

  it('keeps cleared role empty after autosave when another role in group remains drafted', async () => {
    const date = '2030-01-01';
    const putPayloads: Array<Record<string, unknown>> = [];

    apiFetchMock.mockImplementation(
      async (path: string, init?: RequestInit) => {
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
        if (url.pathname === '/referee-assignments/matches') {
          return {
            matches: [
              {
                ...makeMatch({ date, slotCount: 1, assignedUserId: 'u1' }),
                assignments: [
                  {
                    id: 'a1',
                    status: 'DRAFT',
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
                referee_requirements: [
                  {
                    id: 'rg-brig',
                    roles: [
                      { id: 'rb1', count: 1 },
                      { id: 'rb2', count: 1 },
                    ],
                  },
                ],
              },
            ],
          };
        }
        if (url.pathname === '/referee-assignments/referees') {
          return { referees: makeReferees(date) };
        }
        if (url.pathname === '/referee-assignments/matches/m1/referees') {
          const payload = init?.body ? JSON.parse(String(init.body)) : {};
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
    await fireEvent.update(selects[0], '');

    await waitFor(
      () => {
        expect(putPayloads).toHaveLength(1);
      },
      { timeout: 1500 }
    );
    expect(putPayloads[0]?.assignments).toEqual([
      { role_id: 'rb2', user_id: 'u2' },
    ]);

    await waitFor(() => {
      expect(selects[0]?.value).toBe('');
      expect(selects[1]?.value).toBe('u2');
    });
  });

  it('requires confirmation before publishing incomplete day assignments', async () => {
    const date = '2030-01-01';
    const publishBodies: Array<Record<string, unknown>> = [];

    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const url = new URL(path, 'https://lk.fhmoscow.com');
        if (url.pathname === '/referee-assignments/role-groups') {
          return { groups: roleGroups };
        }
        if (url.pathname === '/referee-assignments/matches') {
          return {
            matches: [makeMatch({ date, slotCount: 2, assignedUserId: 'u1' })],
          };
        }
        if (url.pathname === '/referee-assignments/referees') {
          return { referees: makeReferees(date) };
        }
        if (url.pathname === '/referee-assignments/publish') {
          publishBodies.push(JSON.parse(String(options?.body || '{}')));
          return {
            notifications: {
              queued: 1,
              published: 1,
              cancelled: 0,
              skipped_no_email: 0,
              failed: 0,
            },
          };
        }
        return {};
      }
    );

    await renderView();

    const publishButton = await screen.findByRole('button', {
      name: 'Отправить назначения',
    });
    await fireEvent.click(publishButton);

    expect(
      await screen.findByText(/Есть незаполненные назначения:/)
    ).toBeInTheDocument();
    expect(publishBodies).toHaveLength(0);

    await fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить отправку' })
    );

    await waitFor(() => {
      expect(publishBodies).toHaveLength(1);
      expect(publishBodies[0]?.allow_incomplete).toBe(true);
    });
  });
});
