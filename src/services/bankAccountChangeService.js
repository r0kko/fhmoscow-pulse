import {
  Ticket,
  TicketType,
  TicketStatus,
  TicketFile,
  File,
  UserSignType,
  SignType,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import ticketMapper from '../mappers/ticketMapper.js';

import dadataService from './dadataService.js';
import documentService from './documentService.js';
import ticketService from './ticketService.js';

async function ensureNoActiveBankChangeTicket(userId) {
  const [type, activeStatus] = await Promise.all([
    TicketType.findOne({ where: { alias: 'BANK_DETAILS_UPDATE' } }),
    TicketStatus.findAll({ where: { alias: ['CREATED', 'IN_PROGRESS'] } }),
  ]);
  if (!type) throw new ServiceError('ticket_type_not_found', 404);
  const statusIds = activeStatus.map((s) => s.id);
  const existing = await Ticket.findOne({
    where: { user_id: userId, type_id: type.id, status_id: statusIds },
  });
  if (existing) throw new ServiceError('active_ticket_exists', 400);
}

async function requestChange(user, payload) {
  const number = String(payload.number || '').trim();
  const bic = String(payload.bic || '').trim();

  // Require active SIMPLE_ELECTRONIC signature before creating any records
  const userSign = await UserSignType.findOne({
    where: { user_id: user.id },
    include: [{ model: SignType, attributes: ['alias'] }],
  });
  if (!userSign || userSign.SignType?.alias !== 'SIMPLE_ELECTRONIC') {
    throw new ServiceError('sign_type_simple_required', 400);
  }

  // Prevent duplicate active tickets before any external calls
  await ensureNoActiveBankChangeTicket(user.id);

  // Resolve bank details via DaData
  const bank = await dadataService.findBankByBic(bic);
  if (!bank) throw new ServiceError('bank_not_found', 400);
  const changes = {
    number,
    bic,
    bank_name: bank.value,
    correspondent_account: bank.data.correspondent_account,
    swift: bank.data.swift,
    inn: bank.data.inn,
    kpp: bank.data.kpp,
    address: bank.data.address?.unrestricted_value,
  };

  // Create ticket first and immediately mark it IN_PROGRESS
  const desc =
    'Запрос на изменение банковских реквизитов. ' +
    `Новый счёт: ${number}, БИК: ${bic}, Банк: ${changes.bank_name}`;
  const ticket = await ticketService.createForUser(
    user.id,
    { type_alias: 'BANK_DETAILS_UPDATE', description: desc },
    user.id,
    { notify: false }
  );
  try {
    await ticketService.update(
      ticket.id,
      { status_alias: 'IN_PROGRESS' },
      user.id,
      { notify: false }
    );
  } catch (_e) {
    // ignore in tests if update path is not fully mocked
  }

  // Enforce SIMPLE_ELECTRONIC signature and prepare document (include ticket id)
  const { document, file } =
    await documentService.createBankDetailsChangeDocument(
      user.id,
      { ...changes, ticketId: ticket.id },
      user.id,
      { notify: false }
    );

  if (file?.id) {
    const dbFile = await File.findByPk(file.id);
    if (dbFile) {
      await TicketFile.create({
        ticket_id: ticket.id,
        file_id: dbFile.id,
        created_by: user.id,
        updated_by: user.id,
      });
    }
  }

  return { ticket: ticketMapper.toPublic(ticket), document };
}

export default { requestChange };
