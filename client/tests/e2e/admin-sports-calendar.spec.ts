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

function getRouteUrl(route: Route): URL {
  const request = route.request() as unknown as { url: () => string };
  return new URL(request.url());
}

function getPageUrl(page: Page): URL {
  const pageLike = page as unknown as { url: () => string };
  return new URL(pageLike.url());
}

test('calendar deep-link state survives open match and browser back', async ({
  page,
}) => {
  await mockAdminSession(page);

  const calendarResponse = {
    matches: [
      {
        id: 'match-1',
        date: '2026-03-07T12:00:00.000Z',
        team1: 'Спартак',
        team2: 'Динамо',
        home_club: 'Клуб А',
        away_club: 'Клуб Б',
        stadium: 'Арена',
        tournament: 'ВХЛ',
        group: 'Группа А',
        tour: '1 тур',
        agreement_accepted: false,
        agreement_pending: true,
        needs_attention: true,
        urgent_unagreed: true,
        agreements_allowed: true,
        status: { alias: 'SCHEDULED', name: 'Назначен' },
      },
    ],
    range: {
      start: '2026-03-01T00:00:00.000Z',
      end_exclusive: '2026-04-01T00:00:00.000Z',
    },
    day_tabs: [{ day_key: 1772841600000, count: 1, attention_count: 1 }],
    meta: { attention_days: 7, search_max_len: 80, direction: 'forward' },
  };

  await page.route('**/api/matches/**', async (route) => {
    const url = getRouteUrl(route);
    if (url.pathname.endsWith('/matches/admin/calendar')) {
      if (url.searchParams.get('anchor') !== '2026-03-07') {
        throw new Error('expected anchor=2026-03-07 in calendar request');
      }
      if (url.searchParams.getAll('tournament').join(',') !== 'ВХЛ') {
        throw new Error('expected tournament=ВХЛ in calendar request');
      }
      await fulfillJson(route, calendarResponse);
      return;
    }
    if (url.pathname.includes('/matches/match-1')) {
      await fulfillJson(route, { match: { id: 'match-1' } });
      return;
    }
    await fulfillJson(route, {});
  });

  await page.goto('/admin/sports-calendar?day=1772841600000&tournament=ВХЛ');

  const openMatchLink = page.getByRole('link', {
    name: /Открыть матч Спартак — Динамо/i,
  });
  await expect(openMatchLink).toBeVisible();
  await openMatchLink.click();
  await expect(page).toHaveURL(/\/admin\/matches\/match-1/);

  const historyPage = page as unknown as { goBack: () => Promise<void> };
  await historyPage.goBack();
  await expect(page).toHaveURL(/\/admin\/sports-calendar/);

  const currentUrl = getPageUrl(page);
  if (currentUrl.searchParams.get('day') !== '1772841600000') {
    throw new Error('expected day to be preserved in url after back');
  }
  if (currentUrl.searchParams.getAll('tournament').join(',') !== 'ВХЛ') {
    throw new Error('expected tournament to be preserved in url after back');
  }
  await expect(
    page.getByRole('link', { name: /Открыть матч Спартак — Динамо/i })
  ).toBeVisible();
});

test('empty calendar can be shifted forward from CTA', async ({ page }) => {
  await mockAdminSession(page);

  let calendarRequestCount = 0;
  await page.route('**/api/matches/**', async (route) => {
    const url = getRouteUrl(route);
    if (!url.pathname.endsWith('/matches/admin/calendar')) {
      await fulfillJson(route, {});
      return;
    }
    calendarRequestCount += 1;
    if (calendarRequestCount === 1) {
      if (!url.searchParams.get('anchor')) {
        throw new Error('expected non-empty anchor in first request');
      }
      await fulfillJson(route, {
        matches: [],
        range: {
          start: '2026-01-01T00:00:00.000Z',
          end_exclusive: '2026-01-15T00:00:00.000Z',
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
      return;
    }
    await fulfillJson(route, {
      matches: [
        {
          id: 'match-2',
          date: '2026-01-20T12:00:00.000Z',
          team1: 'Локомотив',
          team2: 'Спартак',
          home_club: 'Клуб Л',
          away_club: 'Клуб С',
          stadium: 'Арена-2',
          tournament: 'Кубок',
          group: 'Группа Б',
          tour: '2 тур',
          agreement_accepted: false,
          agreement_pending: false,
          needs_attention: false,
          urgent_unagreed: false,
          agreements_allowed: true,
          status: { alias: 'SCHEDULED', name: 'Назначен' },
        },
      ],
      range: {
        start: '2026-01-15T00:00:00.000Z',
        end_exclusive: '2026-02-15T00:00:00.000Z',
      },
      day_tabs: [{ day_key: 1768867200000, count: 1, attention_count: 0 }],
      meta: {
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: 1,
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
  });

  await page.goto('/admin/sports-calendar');
  await expect(
    page.getByText('В выбранном диапазоне матчей нет.')
  ).toBeVisible();

  await page
    .getByRole('button', { name: /Сдвинуть диапазон на \+14 дней/i })
    .click();
  await expect(
    page.getByRole('link', { name: /Открыть матч Локомотив — Спартак/i })
  ).toBeVisible();
});
