import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

export function renderTicketStatusChangedEmail(ticket) {
  const subject = 'Статус обращения обновлён';
  const previewText =
    `Обращение ${ticket?.number || ''}: новый статус ${ticket?.TicketStatus?.name || ''}`.trim();
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const ticketUrl = ticket?.id
    ? `${baseUrl}/tickets/${ticket.id}`
    : `${baseUrl}/tickets`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Статус вашего обращения <strong>${ticket?.number || '—'}</strong>${
        ticket?.TicketType?.name ? ` (${ticket.TicketType.name})` : ''
      } изменён на: <strong>${ticket?.TicketStatus?.name || '—'}</strong>.`,
      { html: true }
    ),
    infoGrid(
      [
        ticket?.TicketStatus?.name
          ? { label: 'Текущий статус', value: ticket.TicketStatus.name }
          : null,
        ticket?.assigned_to
          ? { label: 'Исполнитель', value: ticket.assigned_to }
          : null,
      ].filter(Boolean)
    ),
    button('Открыть обращение', ticketUrl),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderTicketStatusChangedEmail };
