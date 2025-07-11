import { Ticket, TicketType, TicketStatus, User } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listByUser(userId) {
  return Ticket.findAll({
    where: { user_id: userId },
    include: [TicketType, TicketStatus],
    order: [['created_at', 'ASC']],
  });
}

async function createForUser(userId, data, actorId) {
  const [user, type, status] = await Promise.all([
    User.findByPk(userId),
    TicketType.findOne({ where: { alias: data.type_alias } }),
    TicketStatus.findOne({ where: { alias: 'CREATED' } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!type) throw new ServiceError('ticket_type_not_found', 404);
  if (!status) throw new ServiceError('ticket_status_not_found', 404);
  const ticket = await Ticket.create({
    user_id: userId,
    type_id: type.id,
    status_id: status.id,
    description: data.description,
    created_by: actorId,
    updated_by: actorId,
  });
  return Ticket.findByPk(ticket.id, { include: [TicketType, TicketStatus] });
}

async function updateForUser(userId, ticketId, data, actorId) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, user_id: userId },
  });
  if (!ticket) throw new ServiceError('ticket_not_found', 404);

  let typeId = ticket.type_id;
  if (data.type_alias) {
    const type = await TicketType.findOne({ where: { alias: data.type_alias } });
    if (!type) throw new ServiceError('ticket_type_not_found', 404);
    typeId = type.id;
  }

  let statusId = ticket.status_id;
  if (data.status_alias) {
    const status = await TicketStatus.findOne({ where: { alias: data.status_alias } });
    if (!status) throw new ServiceError('ticket_status_not_found', 404);
    statusId = status.id;
  }

  await ticket.update({
    description: data.description ?? ticket.description,
    type_id: typeId,
    status_id: statusId,
    updated_by: actorId,
  });

  return Ticket.findByPk(ticket.id, { include: [TicketType, TicketStatus] });
}

async function removeForUser(userId, ticketId, actorId = null) {
  const ticket = await Ticket.findOne({ where: { id: ticketId, user_id: userId } });
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  await ticket.update({ updated_by: actorId });
  await ticket.destroy();
}

export default { listByUser, createForUser, updateForUser, removeForUser };
