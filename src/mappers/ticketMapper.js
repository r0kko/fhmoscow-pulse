function sanitize(obj) {
  const { id, description, TicketType, TicketStatus } = obj;
  const res = { id, description };
  if (TicketType) {
    res.type = {
      id: TicketType.id,
      name: TicketType.name,
      alias: TicketType.alias,
    };
  }
  if (TicketStatus) {
    res.status = {
      id: TicketStatus.id,
      name: TicketStatus.name,
      alias: TicketStatus.alias,
    };
  }
  return res;
}

function toPublic(ticket) {
  if (!ticket) return null;
  const plain =
    typeof ticket.get === 'function' ? ticket.get({ plain: true }) : ticket;
  return sanitize(plain);
}

export default { toPublic };
