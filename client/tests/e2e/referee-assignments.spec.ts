import { expect, test, type Page, type Route } from '@playwright/test';

const TEST_DATE = '2099-02-10';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockAuthSession(page: Page) {
  await page.route('**/api/csrf-token', async (route) => {
    await fulfillJson(route, { csrfHmac: 'dummy.hmac.token' });
  });
  await page.route('**/api/auth/refresh', async (route) => {
    await fulfillJson(route, {
      access_token: 'playwright.token',
      user: { id: 'u1', first_name: 'Иван', status: 'ACTIVE' },
      roles: ['REFEREE'],
    });
  });
  await page.route('**/api/auth/me', async (route) => {
    await fulfillJson(route, {
      user: { id: 'u1', first_name: 'Иван', status: 'ACTIVE' },
      roles: ['REFEREE'],
    });
  });
}

test('referee assignments day can be confirmed', async ({ page }) => {
  let confirmed = false;
  await mockAuthSession(page);
  await page.route('**/api/referee-assignments/my/dates', async (route) => {
    await fulfillJson(route, {
      dates: [{ date: TEST_DATE, total: 1, published: 1, confirmed: 0 }],
    });
  });
  await page.route('**/api/referee-assignments/my?**', async (route) => {
    await fulfillJson(route, {
      date: TEST_DATE,
      day_summary: confirmed
        ? {
            total: 1,
            published: 0,
            confirmed: 1,
            needs_confirmation: false,
          }
        : {
            total: 1,
            published: 1,
            confirmed: 0,
            needs_confirmation: true,
          },
      matches: [
        {
          id: 'm1',
          date_start: '2099-02-10T09:00:00.000Z',
          msk_start_time: '12:00',
          msk_end_time: '12:30',
          duration_minutes: 30,
          tournament: { id: 't1', name: 'Кубок', short_name: 'Кубок' },
          group: { id: 'tg1', name: 'Группа A' },
          ground: { id: 'g1', name: 'Арена' },
          team1: { id: 'h1', name: 'Команда 1' },
          team2: { id: 'a1', name: 'Команда 2' },
          assignments: [
            {
              id: 'as1',
              status: confirmed ? 'CONFIRMED' : 'PUBLISHED',
              role: {
                id: 'r1',
                name: 'Главный судья',
                group_id: 'rg1',
                group_name: 'Поле',
              },
              user: {
                id: 'u1',
                last_name: 'Иванов',
                first_name: 'Иван',
                patronymic: 'Иванович',
              },
            },
          ],
        },
      ],
    });
  });
  await page.route('**/api/referee-assignments/my/confirm', async (route) => {
    confirmed = true;
    await fulfillJson(route, {
      date: TEST_DATE,
      confirmed_matches: ['m1'],
      confirmed_count: 1,
    });
  });

  await page.goto('/referee-assignments');

  await expect(page.getByText('Нужно подтвердить 1 матч')).toBeVisible();
  await page
    .getByRole('button', { name: 'Подтвердить назначения (1)' })
    .click();
  await page.getByRole('button', { name: 'Подтвердить все' }).click();
  await expect(
    page.getByText('Все назначения на день подтверждены')
  ).toBeVisible();
});

test('empty selected day has no active confirm action', async ({ page }) => {
  await mockAuthSession(page);
  await page.route('**/api/referee-assignments/my/dates', async (route) => {
    await fulfillJson(route, {
      dates: [{ date: TEST_DATE, total: 0, published: 0, confirmed: 0 }],
    });
  });
  await page.route('**/api/referee-assignments/my?**', async (route) => {
    await fulfillJson(route, {
      date: TEST_DATE,
      day_summary: {
        total: 0,
        published: 0,
        confirmed: 0,
        needs_confirmation: false,
      },
      matches: [],
    });
  });

  await page.goto('/referee-assignments');

  await expect(
    page.getByText('На выбранный день назначений нет.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Подтвердить назначения/ })
  ).toHaveCount(0);
});

test('confirm error is shown to user', async ({ page }) => {
  await mockAuthSession(page);
  await page.route('**/api/referee-assignments/my/dates', async (route) => {
    await fulfillJson(route, {
      dates: [{ date: TEST_DATE, total: 1, published: 1, confirmed: 0 }],
    });
  });
  await page.route('**/api/referee-assignments/my?**', async (route) => {
    await fulfillJson(route, {
      date: TEST_DATE,
      day_summary: {
        total: 1,
        published: 1,
        confirmed: 0,
        needs_confirmation: true,
      },
      matches: [
        {
          id: 'm1',
          date_start: '2099-02-10T09:00:00.000Z',
          msk_start_time: '12:00',
          tournament: { id: 't1', name: 'Кубок', short_name: 'Кубок' },
          team1: { id: 'h1', name: 'Команда 1' },
          team2: { id: 'a1', name: 'Команда 2' },
          assignments: [
            {
              id: 'as1',
              status: 'PUBLISHED',
              role: { id: 'r1', name: 'Главный судья', group_id: 'rg1' },
              user: { id: 'u1', last_name: 'Иванов', first_name: 'Иван' },
            },
          ],
        },
      ],
    });
  });
  await page.route('**/api/referee-assignments/my/confirm', async (route) => {
    await fulfillJson(route, { error: 'referee_assignments_missing' }, 400);
  });

  await page.goto('/referee-assignments');

  await page
    .getByRole('button', { name: 'Подтвердить назначения (1)' })
    .click();
  await page.getByRole('button', { name: 'Подтвердить все' }).click();
  await expect(page.getByText('Черновик назначения не найден')).toBeVisible();
});
