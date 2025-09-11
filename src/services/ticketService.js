import { Op } from 'sequelize';

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

async function generateNumber(transaction) {
  const now = new Date();
  const prefix = `${String(now.getFullYear()).slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;
  const options = {
    where: { number: { [Op.like]: `${prefix}-%` } },
    order: [['number', 'DESC']],
  };
  if (transaction) {
    options.transaction = transaction;
    options.lock = transaction.LOCK.UPDATE;
  }
  const lastTicket = await Ticket.findOne(options);
  const seq = lastTicket
    ? parseInt(lastTicket.number.split('-')[1], 10) + 1
    : 1;
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

async function listByUser(userId) {
  return Ticket.findAll({
    where: { user_id: userId },
    include: [TicketType, TicketStatus],
    order: [['created_at', 'ASC']],
  });
}

async function createForUser(
  userId,
  data,
  actorId,
  options = { notify: true }
) {
  const [user, type, status] = await Promise.all([
    User.findByPk(userId),
    TicketType.findOne({ where: { alias: data.type_alias } }),
    TicketStatus.findOne({ where: { alias: 'CREATED' } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!type) throw new ServiceError('ticket_type_not_found', 404);
  if (!status) throw new ServiceError('ticket_status_not_found', 404);
  if (type.alias === 'MED_CERT_UPLOAD') {
    const existing = await Ticket.findOne({
      where: { user_id: userId, type_id: type.id },
      include: [
        {
          model: TicketStatus,
          where: { alias: ['CREATED', 'IN_PROGRESS'] },
          required: true,
        },
      ],
    });
    if (existing) throw new ServiceError('active_ticket_exists', 400);
  }
  let ticket;
  if (Ticket.sequelize?.transaction) {
    ticket = await Ticket.sequelize.transaction(async (t) => {
      const number = await generateNumber(t);
      return Ticket.create(
        {
          number,
          user_id: userId,
          type_id: type.id,
          status_id: status.id,
          description: data.description,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction: t }
      );
    });
  } else {
    const number = await generateNumber();
    ticket = await Ticket.create({
      number,
      user_id: userId,
      type_id: type.id,
      status_id: status.id,
      description: data.description,
      created_by: actorId,
      updated_by: actorId,
    });
  }

  const result = await Ticket.findByPk(ticket.id, {
    include: [TicketType, TicketStatus],
  });
  if (options?.notify !== false) {
    try {
      await emailService.sendTicketCreatedEmail(user, result);
    } catch (err) {
      console.error('Email send failed', err);
    }
  }
  return result;
}

async function getById(id) {
  const ticket = await Ticket.findByPk(id);
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  return ticket;
}

async function updateForUser(
  userId,
  ticketId,
  data,
  actorId,
  options = { notify: true }
) {
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
  const result = await Ticket.findByPk(ticket.id, {
    include: [TicketType, TicketStatus],
  });
  if (data.status_alias) {
    if (options?.notify !== false) {
      try {
        const user = await User.findByPk(userId);
        if (user) {
          await emailService.sendTicketStatusChangedEmail(user, result);
        }
      } catch (err) {
        console.error('Email send failed', err);
      }
    }
    if (result.TicketType?.alias === 'NORMATIVE_ONLINE') {
      const nts = (await import('./normativeTicketService.js')).default;
      if (data.status_alias === 'CONFIRMED') {
        await nts.approveByTicket(result.id, actorId, false);
      } else if (data.status_alias === 'REJECTED') {
        await nts.rejectByTicket(result.id, actorId, false);
      }
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
  await ticket.update({ updated_by: actorId, number: null });
  await ticket.destroy({ hooks: false });
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const statusInclude = { model: TicketStatus };
  if (options.status === 'active') {
    statusInclude.where = { alias: ['CREATED', 'IN_PROGRESS'] };
    statusInclude.required = true;
  } else if (options.status === 'completed') {
    statusInclude.where = { alias: ['CONFIRMED', 'REJECTED'] };
    statusInclude.required = true;
  }
  const include = [
    { model: User },
    statusInclude,
    { model: TicketFile, include: [File] },
  ];
  if (options.user) {
    const term = `%${options.user}%`;
    include[0].where = {
      [Op.or]: [
        { last_name: { [Op.iLike]: term } },
        { first_name: { [Op.iLike]: term } },
        { patronymic: { [Op.iLike]: term } },
        { email: { [Op.iLike]: term } },
      ],
    };
    include[0].required = true;
  }
  if (options.type) {
    include.push({
      model: TicketType,
      where: { alias: options.type },
      required: true,
    });
  } else {
    include.push(TicketType);
  }
  return Ticket.findAndCountAll({
    include,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
}

async function update(id, data, actorId, options = { notify: true }) {
  const ticket = await Ticket.findByPk(id);
  if (!ticket) throw new ServiceError('ticket_not_found', 404);
  return updateForUser(ticket.user_id, id, data, actorId, options);
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
