import {
  NormativeTicket,
  NormativeType,
  User,
  Season,
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

  const ticket = await ticketService.createForUser(
    userId,
    {
      type_alias: 'NORMATIVE_ONLINE',
      description: type.name,
    },
    actorId
  );
  if (file) {
    await fileService.uploadForNormativeTicket(ticket.id, file, actorId);
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

async function approve(id, actorId) {
  const nt = await NormativeTicket.findByPk(id);
  if (!nt) throw new ServiceError('normative_ticket_not_found', 404);
  if (nt.normative_result_id) return nt;
  const result = await normativeResultService.create(
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
  await ticketService.update(
    nt.ticket_id,
    { status_alias: 'CONFIRMED' },
    actorId
  );
  return result;
}

async function reject(id, actorId) {
  const nt = await NormativeTicket.findByPk(id);
  if (!nt) throw new ServiceError('normative_ticket_not_found', 404);
  await ticketService.update(
    nt.ticket_id,
    { status_alias: 'REJECTED' },
    actorId
  );
  await nt.destroy();
}

export default { createForUser, approve, reject };
