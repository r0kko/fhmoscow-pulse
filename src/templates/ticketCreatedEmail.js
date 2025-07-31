export function renderTicketCreatedEmail(ticket) {
  const status = ticket.TicketStatus?.name || '';
  const subject = 'Обращение создано';
  const text = `Ваше обращение ${ticket.number} успешно создано. Текущий статус: ${status}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Ваше обращение <strong>${ticket.number}</strong> успешно создано. Текущий статус: ${status}.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTicketCreatedEmail };
