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

async function mockSexes(page: Page) {
  await page.route('**/api/sexes', async (route) => {
    await fulfillJson(route, {
      sexes: [{ id: 'sex-1', name: 'Мужской', code: 'MALE' }],
    });
  });
}

async function fillUserCreateForm(page: Page) {
  await page.getByLabel('ФИО').fill('Иванов Иван');
  await page.getByLabel('ФИО').blur();
  await page.getByLabel('Дата рождения').fill('2000-01-01');
  await page.getByRole('combobox').selectOption('sex-1');
  await page.getByLabel('Телефон').fill('89991112233');
  await page.getByLabel('Email').fill('ivanov@example.com');
}

test('admin can create user and is redirected to user card', async ({
  page,
}) => {
  await mockAdminSession(page);
  await mockSexes(page);

  await page.route('**/api/users', async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, { users: [], total: 0 });
      return;
    }
    await fulfillJson(route, {
      user: { id: 'u1' },
      delivery: { invited: true, channel: 'email', status: 'sent' },
    });
  });
  await page.route('**/api/users/u1**', async (route) => {
    await fulfillJson(route, {
      user: {
        id: 'u1',
        first_name: 'Иван',
        last_name: 'Иванов',
      },
    });
  });

  await page.goto('/admin/users/new');
  await fillUserCreateForm(page);
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await expect(page).toHaveURL(/\/admin\/users\/u1$/);
});

test('admin sees duplicate email error on create', async ({ page }) => {
  await mockAdminSession(page);
  await mockSexes(page);

  await page.route('**/api/users', async (route) => {
    await fulfillJson(route, { error: 'email_exists' }, 400);
  });

  await page.goto('/admin/users/new');
  await fillUserCreateForm(page);
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await expect(page.getByText('Email уже зарегистрирован')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/users\/new$/);
});

test('admin can retry invite when initial delivery failed', async ({
  page,
}) => {
  await mockAdminSession(page);
  await mockSexes(page);

  await page.route('**/api/users', async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, {});
      return;
    }
    await fulfillJson(route, {
      user: { id: 'u2' },
      delivery: {
        invited: false,
        channel: 'email',
        status: 'failed',
        reason: 'delivery_exception',
      },
    });
  });
  await page.route('**/api/users/u2/invite-resend', async (route) => {
    await fulfillJson(route, {
      user: { id: 'u2' },
      delivery: { invited: true, channel: 'email', status: 'queued' },
    });
  });

  await page.goto('/admin/users/new');
  await fillUserCreateForm(page);
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await expect(
    page.getByRole('button', { name: 'Повторно отправить приглашение' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Повторно отправить приглашение' })
    .click();
  await expect(
    page.getByText('Приглашение поставлено в очередь отправки.')
  ).toBeVisible();
});
