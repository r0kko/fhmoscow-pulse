import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

export function renderTicketCreatedEmail(ticket) {
  const subject = 'Обращение создано';
  const previewText =
    `Обращение ${ticket?.number || ''} создано. Статус: ${ticket?.TicketStatus?.name || ''}`.trim();
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const ticketUrl = ticket?.id
    ? `${baseUrl}/tickets/${ticket.id}`
    : `${baseUrl}/tickets`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Ваше обращение <strong>${ticket?.number || '—'}</strong>${
        ticket?.TicketType?.name ? ` (${ticket.TicketType.name})` : ''
      } успешно создано.`,
      { html: true }
    ),
    infoGrid(
      [
        ticket?.TicketType?.name
          ? { label: 'Тип', value: ticket.TicketType.name }
          : null,
        ticket?.TicketStatus?.name
          ? { label: 'Статус', value: ticket.TicketStatus.name }
          : null,
        ticket?.priority
          ? { label: 'Приоритет', value: ticket.priority }
          : null,
      ].filter(Boolean)
    ),
    button('Открыть обращение', ticketUrl),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderTicketCreatedEmail };
