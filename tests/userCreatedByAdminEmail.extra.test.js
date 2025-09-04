import { expect, test } from '@jest/globals';

import { renderUserCreatedByAdminEmail } from '../src/templates/userCreatedByAdminEmail.js';

test('userCreatedByAdminEmail keeps plus-prefixed phone and uses name when available', () => {
  const user = {
    first_name: 'Анна',
    patronymic: undefined,
    phone: '+71234567890',
  };
  const { html, text } = renderUserCreatedByAdminEmail(user, 'pwd');
  expect(html).toContain('Здравствуйте, Анна!');
  expect(html).toContain('+71234567890');
  expect(text).toContain('Логин (телефон): +71234567890');
});

test('userCreatedByAdminEmail fallback greet without names', () => {
  const user = { phone: '70000000000' };
  const { html } = renderUserCreatedByAdminEmail(user, 'pwd');
  expect(html).toContain('Здравствуйте!');
});
