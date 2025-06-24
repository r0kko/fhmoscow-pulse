import { Taxation, TaxationType, Inn } from '../models/index.js';

import dadataService from './dadataService.js';
import fnsService from './fnsService.js';

async function getByUser(userId) {
  return Taxation.findOne({
    where: { user_id: userId },
    include: [TaxationType],
  });
}

function parseDate(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
}

async function fetchByInn(inn, opts = { dadata: true, fns: true }) {
  const results = await Promise.all([
    opts.dadata ? dadataService.findPartyByInnWithStatus(inn) : null,
    opts.fns ? fnsService.checkSelfEmployedWithStatus(inn) : null,
  ]);
  const partyRes = results[0] || { data: null, status: null };
  const fnsRes = results[1] || { data: null, status: null };
  const party = partyRes.data;
  const npd = fnsRes.data;

  let typeAlias = 'PERSON';
  let registrationDate = null;
  let ogrn = null;
  let okved = null;

  if (
    party &&
    party.data?.type === 'INDIVIDUAL' &&
    party.data?.state?.status === 'ACTIVE'
  ) {
    registrationDate = parseDate(party.data.state.registration_date);
    ogrn = party.data.ogrn;
    okved = party.data.okved;
    typeAlias = npd?.status ? 'IP_NPD' : 'IP_USN';
  } else if (npd?.status) {
    typeAlias = 'NPD';
  }

  const type = await TaxationType.findOne({ where: { alias: typeAlias } });
  const checkDate = new Date().toISOString().substring(0, 10);

  return {
    TaxationType: type,
    check_date: checkDate,
    registration_date: registrationDate,
    ogrn,
    okved,
    statuses: { dadata: partyRes.status, fns: fnsRes.status },
  };
}

async function updateByInn(userId, inn, actorId) {
  const data = await fetchByInn(inn);

  let taxation = await Taxation.findOne({ where: { user_id: userId } });
  const payload = {
    taxation_type_id: data.TaxationType.id,
    check_date: data.check_date,
    registration_date: data.registration_date,
    ogrn: data.ogrn,
    okved: data.okved,
  };
  if (!taxation) {
    taxation = await Taxation.create({
      user_id: userId,
      ...payload,
      created_by: actorId,
      updated_by: actorId,
    });
  } else {
    await taxation.update({ ...payload, updated_by: actorId });
  }
  return taxation;
}

async function removeByUser(userId) {
  const taxation = await Taxation.findOne({ where: { user_id: userId } });
  if (taxation) await taxation.destroy();
}

async function previewForUser(userId, opts) {
  const inn = await Inn.findOne({ where: { user_id: userId } });
  if (!inn) throw new Error('inn_not_found');
  return fetchByInn(inn.number, opts);
}

async function updateForUser(userId, actorId) {
  const inn = await Inn.findOne({ where: { user_id: userId } });
  if (!inn) throw new Error('inn_not_found');
  return updateByInn(userId, inn.number, actorId);
}

export default {
  getByUser,
  updateByInn,
  removeByUser,
  previewForUser,
  updateForUser,
};
