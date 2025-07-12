import {
  Ticket,
  TicketType,
  TicketStatus,
  User,
  TicketFile,
  File,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import emailService from './emailService.js';

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
  const result = await Ticket.findByPk(ticket.id, { include: [TicketType, TicketStatus] });
  try {
    await emailService.sendTicketCreatedEmail(user, result);
  } catch (err) {
    console.error('Email send failed', err);
  }
  return result;
}

async function getById(id) {
  const ticket = await Ticket.findByPk(id);
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  return ticket;
}

async function updateForUser(userId, ticketId, data, actorId) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, user_id: userId },
  });
  if (!ticket) throw new ServiceError('ticket_not_found', 404);

  let typeId = ticket.type_id;
  if (data.type_alias) {
    const type = await TicketType.findOne({
      where: { alias: data.type_alias },
    });
    if (!type) throw new ServiceError('ticket_type_not_found', 404);
    typeId = type.id;
  }

  let statusId = ticket.status_id;
  if (data.status_alias) {
    const status = await TicketStatus.findOne({
      where: { alias: data.status_alias },
    });
    if (!status) throw new ServiceError('ticket_status_not_found', 404);
    statusId = status.id;
  }

  await ticket.update({
    description: data.description ?? ticket.description,
    type_id: typeId,
    status_id: statusId,
    updated_by: actorId,
  });
  const result = await Ticket.findByPk(ticket.id, { include: [TicketType, TicketStatus] });
  if (data.status_alias) {
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await emailService.sendTicketStatusChangedEmail(user, result);
      }
    } catch (err) {
      console.error('Email send failed', err);
    }
  }
  return result;
}

async function removeForUser(userId, ticketId, actorId = null) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, user_id: userId },
    include: [TicketStatus],
  });
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  const statusAlias = ticket.TicketStatus?.alias;
  if (statusAlias && statusAlias !== 'CREATED') {
    throw new ServiceError('ticket_locked');
  }
  await ticket.update({ updated_by: actorId });
  await ticket.destroy();
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return Ticket.findAndCountAll({
    include: [
      User,
      TicketType,
      TicketStatus,
      { model: TicketFile, include: [File] },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
}

async function update(id, data, actorId) {
  const ticket = await Ticket.findByPk(id);
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  return updateForUser(ticket.user_id, id, data, actorId);
}

async function progressStatus(id, actorId) {
  const ticket = await Ticket.findByPk(id, { include: [TicketStatus] });
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  const current = ticket.TicketStatus.alias;
  let next = null;
  switch (current) {
    case 'CREATED':
      next = 'IN_PROGRESS';
      break;
    case 'IN_PROGRESS':
      next = 'CONFIRMED';
      break;
    case 'CONFIRMED':
      next = 'REJECTED';
      break;
    default:
      return Ticket.findByPk(id, { include: [TicketType, TicketStatus] });
  }
  return updateForUser(ticket.user_id, id, { status_alias: next }, actorId);
}

export default {
  listByUser,
  createForUser,
  updateForUser,
  removeForUser,
  getById,
  listAll,
  update,
  progressStatus,
};
