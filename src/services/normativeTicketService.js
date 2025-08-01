import { Op } from 'sequelize';

import {
  NormativeTicket,
  NormativeType,
  User,
  Season,
  Ticket,
  TicketStatus,
  NormativeResult,
  NormativeZone,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import ticketService from './ticketService.js';
import fileService from './fileService.js';
import normativeResultService from './normativeResultService.js';

async function createForUser(userId, data, file, actorId) {
  const [user, type] = await Promise.all([
    User.findByPk(userId),
    NormativeType.findByPk(data.type_id),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  if (!type.online_available)
    throw new ServiceError('online_not_available', 400);
  const season = await Season.findByPk(type.season_id);
  if (!season) throw new ServiceError('season_not_found', 404);

  const existing = await NormativeTicket.findOne({
    where: { user_id: userId, type_id: data.type_id },
    include: [
      {
        model: Ticket,
        required: true,
        include: [
          {
            model: TicketStatus,
            required: true,
            where: { alias: { [Op.in]: ['CREATED', 'IN_PROGRESS'] } },
          },
        ],
      },
    ],
  });
  if (existing) throw new ServiceError('active_ticket_exists', 400);

  const goodResult = await NormativeResult.findOne({
    where: { user_id: userId, type_id: data.type_id },
    include: [
      {
        model: NormativeZone,
        required: true,
        where: { alias: { [Op.ne]: 'RED' } },
      },
    ],
  });
  if (goodResult) throw new ServiceError('result_exists', 400);

  const ticket = await ticketService.createForUser(
    userId,
    {
      type_alias: 'NORMATIVE_ONLINE',
      description: `\u041f\u0440\u043e\u0448\u0443 \u0437\u0430\u0447\u0435\u0441\u0442\u044c \u0432 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435 \u0441\u0434\u0430\u0447\u0438 \u0434\u0438\u0441\u0446\u0438\u043f\u043b\u0438\u043d\u044b ${type.name} \u043c\u043e\u044e \u0441\u0430\u043c\u043e\u0441\u0442\u043e\u044f\u0442\u0435\u043b\u044c\u043d\u0443\u044e \u043f\u043e\u043f\u044b\u0442\u043a\u0443. \u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u0439: ${data.value}. \u0421 \u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c\u0438 \u0441\u0434\u0430\u0447\u0438 \u043d\u043e\u0440\u043c\u0430\u0442\u0438\u0432\u043e\u0432, \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c \u041a\u0422\u0421\u0421 \u043e\u0437\u043d\u0430\u043a\u043e\u043c\u043b\u0435\u043d.`,
    },
    actorId
  );
  if (file) {
    await fileService.uploadForNormativeTicket(
      ticket.id,
      file,
      actorId,
      user,
      type
    );
  }

  return NormativeTicket.create({
    user_id: userId,
    season_id: season.id,
    type_id: type.id,
    value: data.value,
    ticket_id: ticket.id,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function approve(id, actorId, updateStatus = true) {
  const nt = await NormativeTicket.findByPk(id);
  if (!nt) throw new ServiceError('normative_ticket_not_found', 404);
  let result;
  if (nt.normative_result_id) {
    result = await normativeResultService.getById(nt.normative_result_id);
  } else {
    result = await normativeResultService.create(
      {
        user_id: nt.user_id,
        season_id: nt.season_id,
        type_id: nt.type_id,
        value: nt.value,
        online: true,
      },
      actorId
    );
    await nt.update({ normative_result_id: result.id, updated_by: actorId });
  }
  if (updateStatus) {
    await ticketService.update(
      nt.ticket_id,
      { status_alias: 'CONFIRMED' },
      actorId
    );
  }
  return result;
}

async function approveByTicket(ticketId, actorId, updateStatus = true) {
  const nt = await NormativeTicket.findOne({ where: { ticket_id: ticketId } });
  if (!nt) throw new ServiceError('normative_ticket_not_found', 404);
  return approve(nt.id, actorId, updateStatus);
}

async function reject(id, actorId, updateStatus = true) {
  const nt = await NormativeTicket.findByPk(id);
  if (!nt) throw new ServiceError('normative_ticket_not_found', 404);
  if (updateStatus) {
    await ticketService.update(
      nt.ticket_id,
      { status_alias: 'REJECTED' },
      actorId
    );
  }
  await nt.destroy();
}

async function rejectByTicket(ticketId, actorId, updateStatus = true) {
  const nt = await NormativeTicket.findOne({ where: { ticket_id: ticketId } });
  if (!nt) throw new ServiceError('normative_ticket_not_found', 404);
  await reject(nt.id, actorId, updateStatus);
}

async function listActiveForUser(userId) {
  return NormativeTicket.findAll({
    where: { user_id: userId },
    include: [
      {
        model: Ticket,
        required: true,
        include: [
          {
            model: TicketStatus,
            required: true,
            where: { alias: { [Op.in]: ['CREATED', 'IN_PROGRESS'] } },
          },
        ],
      },
    ],
  });
}

export default {
  createForUser,
  approve,
  approveByTicket,
  reject,
  rejectByTicket,
  listActiveForUser,
};
