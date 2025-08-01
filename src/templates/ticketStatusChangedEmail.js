export function renderTicketStatusChangedEmail(ticket) {
  const status = ticket.TicketStatus?.name || '';
  const type = ticket.TicketType?.name || '';
  const subject = 'Статус обращения обновлён';
  const text = `Статус вашего обращения ${ticket.number} (${type}) изменён на: ${status}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Статус вашего обращения <strong>${ticket.number}</strong> (${type}) изменён на: ${status}.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTicketStatusChangedEmail };
