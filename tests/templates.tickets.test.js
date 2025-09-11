import { expect, test } from '@jest/globals';

import { renderTicketCreatedEmail } from '../src/templates/ticketCreatedEmail.js';
import { renderTicketStatusChangedEmail } from '../src/templates/ticketStatusChangedEmail.js';

test('renderTicketCreatedEmail returns subject/text/html', () => {
  const res = renderTicketCreatedEmail({
    number: 'T-1',
    TicketType: { name: 'Ошибка' },
    TicketStatus: { name: 'NEW' },
  });
  expect(res.subject).toMatch(/обращени/i);
  expect(res.text).toContain('T-1');
  expect(res.text).toContain('NEW');
});

test('renderTicketStatusChangedEmail returns subject/text/html', () => {
  const res = renderTicketStatusChangedEmail({
    number: 'T-2',
    TicketType: { name: 'Опечатка' },
    TicketStatus: { name: 'RESOLVED' },
  });
  expect(res.subject).toMatch(/статус/i);
  expect(res.text).toContain('RESOLVED');
  expect(res.html).toContain('Опечатка');
});
