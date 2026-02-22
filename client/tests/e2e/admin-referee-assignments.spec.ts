import { expect, test, type Page, type Route } from '@playwright/test';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockAdminSession(page: Page) {
  await page.route('**/api/csrf-token', async (route) => {
    await fulfillJson(route, { csrfHmac: 'dummy.hmac.token' });
  });
  await page.route('**/api/auth/refresh', async (route) => {
    await fulfillJson(route, {
      access_token: 'playwright.admin.token',
      user: { id: 'admin-1', first_name: 'Админ', status: 'ACTIVE' },
      roles: ['ADMIN'],
    });
  });
  await page.route('**/api/auth/me', async (route) => {
    await fulfillJson(route, {
      user: { id: 'admin-1', first_name: 'Админ', status: 'ACTIVE' },
      roles: ['ADMIN'],
    });
  });
  await page.route('**/api/auth/cookie-cleanup', async (route) => {
    await fulfillJson(route, {});
  });
}

function buildMatch({
  slotCount,
  assignedUserId,
}: {
  slotCount: number;
  assignedUserId: string;
}) {
  return {
    id: 'm1',
    msk_date: '2030-01-01',
    msk_start_time: '12:00',
    msk_end_time: '13:00',
    schedule_missing: false,
    duration_missing: false,
    assignments: [
      {
        id: 'a1',
        status: 'DRAFT',
        role: { id: 'r1', group_id: 'rg1', name: 'Главный судья' },
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
        id: 'rg1',
        roles: [{ id: 'r1', count: slotCount }],
      },
    ],
    draft_clear_group_ids: [],
    draft_versions_by_group: { rg1: 'v1-initial' },
    team1: { id: 't1', name: 'Команда 1' },
    team2: { id: 't2', name: 'Команда 2' },
    ground: { id: 'g1', name: 'Арена 1' },
    tournament: {
      id: 'tour1',
      name: 'Кубок',
      short_name: 'Кубок',
      competition_type: { id: 'c1', alias: 'YOUTH', name: 'Юношеские' },
    },
    group: null,
    tour: null,
  };
}

function buildDualRoleMatch() {
  return {
    id: 'm1',
    msk_date: '2030-01-01',
    msk_start_time: '12:00',
    msk_end_time: '13:00',
    schedule_missing: false,
    duration_missing: false,
    assignments: [
      {
        id: 'a1',
        status: 'DRAFT',
        role: { id: 'r1', group_id: 'rg1', name: 'Главный судья' },
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
        role: { id: 'r2', group_id: 'rg1', name: 'Линейный судья' },
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
        id: 'rg1',
        roles: [
          { id: 'r1', count: 1 },
          { id: 'r2', count: 1 },
        ],
      },
    ],
    draft_clear_group_ids: [],
    draft_versions_by_group: { rg1: 'v1-initial' },
    team1: { id: 't1', name: 'Команда 1' },
    team2: { id: 't2', name: 'Команда 2' },
    ground: { id: 'g1', name: 'Арена 1' },
    tournament: {
      id: 'tour1',
      name: 'Кубок',
      short_name: 'Кубок',
      competition_type: { id: 'c1', alias: 'YOUTH', name: 'Юношеские' },
    },
    group: null,
    tour: null,
  };
}

const referees = [
  {
    id: 'u1',
    last_name: 'Иванов',
    first_name: 'Иван',
    patronymic: 'Иванович',
    roles: ['REFEREE'],
    availability: { status: 'FREE', preset: true },
    availability_by_date: {
      '2030-01-01': { status: 'FREE', preset: true },
    },
  },
  {
    id: 'u2',
    last_name: 'Петров',
    first_name: 'Пётр',
    patronymic: 'Петрович',
    roles: ['REFEREE'],
    availability: { status: 'FREE', preset: true },
    availability_by_date: {
      '2030-01-01': { status: 'FREE', preset: true },
    },
  },
];

test('admin day publish asks confirmation for incomplete assignments', async ({
  page,
}) => {
  const publishBodies: Array<Record<string, unknown>> = [];

  await mockAdminSession(page);
  await page.route('**/api/referee-assignments/role-groups', async (route) => {
    await fulfillJson(route, {
      groups: [
        {
          id: 'rg1',
          name: 'Судьи в поле',
          alias: 'FIELD',
          roles: [{ id: 'r1', name: 'Главный судья' }],
        },
      ],
    });
  });
  await page.route('**/api/tournaments/settings-options', async (route) => {
    await fulfillJson(route, { competition_types: [] });
  });
  await page.route('**/api/referee-assignments/matches?**', async (route) => {
    await fulfillJson(route, {
      matches: [buildMatch({ slotCount: 2, assignedUserId: 'u1' })],
    });
  });
  await page.route('**/api/referee-assignments/referees?**', async (route) => {
    await fulfillJson(route, { referees });
  });
  await page.route('**/api/referee-assignments/publish', async (route) => {
    publishBodies.push(
      route.request().postDataJSON() as Record<string, unknown>
    );
    await fulfillJson(route, {
      notifications: {
        queued: 1,
        published: 1,
        cancelled: 0,
        skipped_no_email: 0,
        failed: 0,
      },
    });
  });

  await page.goto('/admin/referee-assignments');

  await page
    .getByRole('button', { name: 'Отправить назначения за день' })
    .click();
  await expect(page.getByText(/Есть незаполненные назначения:/)).toBeVisible();
  expect(publishBodies).toHaveLength(0);

  await page.getByRole('button', { name: 'Подтвердить отправку' }).click();
  await expect.poll(() => publishBodies.length).toBe(1);
  expect(publishBodies[0]?.['allow_incomplete']).toBe(true);
});

test('admin autosave applies server snapshot on 409 conflict', async ({
  page,
}) => {
  await mockAdminSession(page);
  await page.route('**/api/referee-assignments/role-groups', async (route) => {
    await fulfillJson(route, {
      groups: [
        {
          id: 'rg1',
          name: 'Судьи в поле',
          alias: 'FIELD',
          roles: [{ id: 'r1', name: 'Главный судья' }],
        },
      ],
    });
  });
  await page.route('**/api/tournaments/settings-options', async (route) => {
    await fulfillJson(route, { competition_types: [] });
  });
  await page.route('**/api/referee-assignments/matches?**', async (route) => {
    await fulfillJson(route, {
      matches: [buildMatch({ slotCount: 1, assignedUserId: 'u1' })],
    });
  });
  await page.route('**/api/referee-assignments/referees?**', async (route) => {
    await fulfillJson(route, { referees });
  });
  await page.route(
    '**/api/referee-assignments/matches/m1/referees',
    async (route) => {
      await fulfillJson(
        route,
        {
          error: 'referee_assignments_conflict',
          details: {
            assignments: [
              {
                id: 'a2',
                status: 'DRAFT',
                role: {
                  id: 'r1',
                  group_id: 'rg1',
                  name: 'Главный судья',
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
            draft_versions_by_group: { rg1: 'v2-new' },
          },
        },
        409
      );
    }
  );

  await page.goto('/admin/referee-assignments');

  const select = page.locator('.referee-select').first();
  await expect(select).toBeVisible();
  await select.selectOption('');

  await expect.poll(async () => await select.inputValue()).toBe('u2');
});

test('admin clears one role to "Свободно", keeps it empty, and publishes update', async ({
  page,
}) => {
  const putBodies: Array<Record<string, unknown>> = [];
  const publishBodies: Array<Record<string, unknown>> = [];

  await mockAdminSession(page);
  await page.route('**/api/referee-assignments/role-groups', async (route) => {
    await fulfillJson(route, {
      groups: [
        {
          id: 'rg1',
          name: 'Судьи в поле',
          alias: 'FIELD',
          roles: [
            { id: 'r1', name: 'Главный судья' },
            { id: 'r2', name: 'Линейный судья' },
          ],
        },
      ],
    });
  });
  await page.route('**/api/tournaments/settings-options', async (route) => {
    await fulfillJson(route, { competition_types: [] });
  });
  await page.route('**/api/referee-assignments/matches?**', async (route) => {
    await fulfillJson(route, {
      matches: [buildDualRoleMatch()],
    });
  });
  await page.route('**/api/referee-assignments/referees?**', async (route) => {
    await fulfillJson(route, { referees });
  });
  await page.route(
    '**/api/referee-assignments/matches/m1/referees',
    async (route) => {
      putBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await fulfillJson(route, {
        assignments: [
          {
            id: 'a1-published',
            status: 'PUBLISHED',
            role: { id: 'r1', group_id: 'rg1', name: 'Главный судья' },
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
            role: { id: 'r2', group_id: 'rg1', name: 'Линейный судья' },
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
        draft_versions_by_group: { rg1: 'v2-new' },
      });
    }
  );
  await page.route('**/api/referee-assignments/publish', async (route) => {
    publishBodies.push(
      route.request().postDataJSON() as Record<string, unknown>
    );
    await fulfillJson(route, {
      notifications: {
        queued: 1,
        published: 1,
        cancelled: 1,
        skipped_no_email: 0,
        failed: 0,
      },
    });
  });

  await page.goto('/admin/referee-assignments');

  const selects = page.locator('.referee-select');
  await expect(selects).toHaveCount(2);
  await selects.nth(0).selectOption('');

  await expect.poll(() => putBodies.length).toBe(1);
  expect(putBodies[0]?.['assignments']).toEqual([
    { role_id: 'r2', user_id: 'u2' },
  ]);

  await expect.poll(async () => await selects.nth(0).inputValue()).toBe('');

  await page
    .getByRole('button', { name: 'Отправить назначения за день' })
    .click();
  await expect(page.getByText(/Есть незаполненные назначения:/)).toBeVisible();
  await page.getByRole('button', { name: 'Подтвердить отправку' }).click();

  await expect.poll(() => publishBodies.length).toBe(1);
  expect(publishBodies[0]?.['allow_incomplete']).toBe(true);
  await expect(page.getByText(/Назначения опубликованы/)).toBeVisible();
});
