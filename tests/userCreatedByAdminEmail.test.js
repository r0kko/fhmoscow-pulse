import { expect, test } from '@jest/globals';

import { renderUserCreatedByAdminEmail } from '../src/templates/userCreatedByAdminEmail.js';

test('userCreatedByAdminEmail escapes dynamic fields in HTML', () => {
  const user = {
    first_name: 'Иван & Co',
    patronymic: 'Петрович',
    phone: '71234567890',
  };
  const password = 'A&Bc123!';
  const { html, text } = renderUserCreatedByAdminEmail(user, password);
  expect(html).toContain('Иван &amp; Co');
  expect(html).toContain('A&amp;Bc123!');
  // Text part remains raw (no escaping), for copy/paste safety
  expect(text).toContain('Временный пароль: A&Bc123!');
});
