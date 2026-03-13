import crypto from 'node:crypto';

import ExcelJS from 'exceljs';
import { Op, QueryTypes } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import { utcToMoscow } from '../utils/time.js';
import {
  Tournament,
  TournamentGroup,
  TournamentGroupReferee,
  RefereeRole,
  Ground,
  Match,
  MatchReferee,
  MatchRefereeStatus,
  GameStatus,
  User,
  Team,
  RefereeTariffStatus,
  GroundTravelRateStatus,
  RefereeAccrualDocumentStatus,
  RefereeAccrualSource,
  RefereeAccrualPostingType,
  RefereeAccrualComponent,
  RefereeAccountingAction,
  RefereeAccrualStatusTransition,
  RefereeTariffRule,
  GroundRefereeTravelRate,
  RefereeAccrualDocument,
  RefereeAccrualPosting,
  AccountingAuditEvent,
} from '../models/index.js';

const FARE_CODE_RE = /^[A-Z][A-Z0-9]{1,7}$/;

const TARIFF_TRAVEL_MODE = 'ARENA_FIXED';
const MATCH_REFEREE_ELIGIBLE_ALIASES = ['PUBLISHED', 'CONFIRMED'];
const MAX_ACCRUAL_NUMBER_ATTEMPTS = 5;
const DEFAULT_ACCRUAL_LOOKBACK_DAYS = 30;
const TAXATION_TYPE_ALIAS_RE = /^[A-Z_][A-Z0-9_]{1,31}$/;
const PAYMENT_REGISTRY_MISSING_FIELD_CODES = [
  'inn',
  'phone',
  'bank_account_number',
  'bic',
  'correspondent_account',
  'taxation_type',
];
const FILTERED_ACCRUAL_SELECTION_PAGE_LIMIT = 1000;

function readConfiguredLookbackDays() {
  const raw = Number.parseInt(
    String(process.env.REFEREE_ACCRUAL_GENERATION_LOOKBACK_DAYS || ''),
    10
  );
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_ACCRUAL_LOOKBACK_DAYS;
  }
  return raw;
}

const REFEREE_ACCRUAL_GENERATION_LOOKBACK_DAYS = readConfiguredLookbackDays();

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeFareCode(value) {
  const code = normalizeString(value).toUpperCase();
  if (!FARE_CODE_RE.test(code)) {
    throw new ServiceError('invalid_fare_code', 400);
  }
  return code;
}

function normalizeTaxationTypeAlias(value) {
  if (value == null || value === '') return null;
  const alias = normalizeString(value).toUpperCase();
  if (!TAXATION_TYPE_ALIAS_RE.test(alias)) {
    throw new ServiceError('invalid_taxation_type_alias', 400);
  }
  return alias;
}

function normalizeDateOnly(value, code = 'invalid_date') {
  const text = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ServiceError(code, 400);
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError(code, 400);
  }
  return text;
}

function normalizeOptionalDateOnly(value, code = 'invalid_date') {
  if (value == null || value === '') return null;
  return normalizeDateOnly(value, code);
}

function ensureDateOrder(validFrom, validTo, code = 'invalid_validity_period') {
  if (validTo && validFrom > validTo) {
    throw new ServiceError(code, 400);
  }
}

function normalizeRubToCents(value, { allowNegative = false, code } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new ServiceError(code || 'invalid_amount', 400);
  if (!isValidRubText(raw))
    throw new ServiceError(code || 'invalid_amount', 400);

  const normalized = raw.replace(',', '.');
  const negative = normalized.startsWith('-');
  if (negative && !allowNegative) {
    throw new ServiceError(code || 'invalid_amount', 400);
  }

  const [rubPartRaw, fracRaw = ''] = normalized.replace('-', '').split('.');
  const rubPart = Number.parseInt(rubPartRaw || '0', 10);
  if (!Number.isFinite(rubPart)) {
    throw new ServiceError(code || 'invalid_amount', 400);
  }
  const fraction = Number.parseInt(fracRaw.padEnd(2, '0').slice(0, 2), 10);
  if (!Number.isFinite(fraction)) {
    throw new ServiceError(code || 'invalid_amount', 400);
  }

  const cents = rubPart * 100 + fraction;
  return negative ? -cents : cents;
}

function isValidRubText(raw) {
  let text = String(raw || '').trim();
  if (!text) return false;
  if (text.startsWith('-')) text = text.slice(1);
  if (!text) return false;

  let separatorIndex = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '.' || char === ',') {
      if (separatorIndex !== -1) return false;
      separatorIndex = i;
      continue;
    }
    if (char < '0' || char > '9') return false;
  }

  if (separatorIndex === -1) return true;
  const integerPart = text.slice(0, separatorIndex);
  const fractionPart = text.slice(separatorIndex + 1);
  if (!integerPart || !fractionPart) return false;
  return fractionPart.length <= 2;
}

function dbRubToCents(value) {
  return normalizeRubToCents(String(value ?? '0'), {
    allowNegative: true,
    code: 'invalid_amount',
  });
}

function centsToRub(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Number(cents || 0));
  const rub = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${rub}.${frac}`;
}

function parsePagination(pageRaw, limitRaw, defaultLimit = 50, maxLimit = 500) {
  const page = Math.max(1, Number.parseInt(String(pageRaw || '1'), 10) || 1);
  const limit = Math.max(
    1,
    Math.min(
      maxLimit,
      Number.parseInt(String(limitRaw || ''), 10) || defaultLimit
    )
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPaymentRegistryMissingFields(row = {}) {
  return PAYMENT_REGISTRY_MISSING_FIELD_CODES.filter((field) => {
    const value = row[field];
    return value == null || normalizeString(value) === '';
  });
}

function buildPaymentRegistryFilename(tournamentName, exportDate = null) {
  const safeTournament = normalizeString(tournamentName)
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const datePart =
    normalizeOptionalDateOnly(
      exportDate || moscowTodayDateKey(),
      'invalid_date'
    ) || new Date().toISOString().slice(0, 10);
  const tournamentPart = safeTournament || 'tournament';
  return `payment-registry-${tournamentPart}-${datePart}.xlsx`;
}

function moscowDateKey(date) {
  if (!date) return null;
  const msk = utcToMoscow(date);
  if (!msk) return null;
  const y = msk.getUTCFullYear();
  const m = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const d = String(msk.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function moscowTodayDateKey() {
  return moscowDateKey(new Date());
}

function shiftDateKey(dateKey, days) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return dateKey;
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countStates(rows = []) {
  const items = Array.isArray(rows) ? rows : [];
  const ok = items.filter((item) => item.state === 'ok').length;
  const outOfPeriod = items.filter(
    (item) => item.state === 'out_of_period'
  ).length;
  const missing = items.filter((item) => item.state === 'missing').length;
  return {
    total: items.length,
    ok,
    out_of_period: outOfPeriod,
    missing,
  };
}

function pickCoverageDate(days = []) {
  const normalizedDays = (Array.isArray(days) ? days : [])
    .map((item) => String(item || ''))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort((a, b) => a.localeCompare(b));

  if (!normalizedDays.length) {
    return moscowTodayDateKey() || new Date().toISOString().slice(0, 10);
  }

  const today = moscowTodayDateKey() || new Date().toISOString().slice(0, 10);
  const future = normalizedDays.find((day) => day >= today);
  return future || normalizedDays[normalizedDays.length - 1];
}

function toMoscowDayRange(fromDate, toDate) {
  const start = new Date(`${fromDate}T00:00:00+03:00`);
  const end = new Date(`${toDate}T00:00:00+03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ServiceError('invalid_date', 400);
  }
  const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, endExclusive };
}

function normalizeDateRange({ fromDate, toDate, defaultDaysBack = 30 }) {
  const today = moscowTodayDateKey() || new Date().toISOString().slice(0, 10);
  const from =
    normalizeOptionalDateOnly(fromDate) ||
    shiftDateKey(today, -defaultDaysBack);
  const to = normalizeOptionalDateOnly(toDate) || today;
  ensureDateOrder(from, to, 'invalid_date_range');
  return { from, to };
}

function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  const fromA = aFrom;
  const toA = aTo || '9999-12-31';
  const fromB = bFrom;
  const toB = bTo || '9999-12-31';
  return fromA <= toB && fromB <= toA;
}

function trimString(value, max = 255) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function buildAccrualFingerprint(payload) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function summarizeAmounts(baseCents, mealCents, travelCents) {
  const total = baseCents + mealCents + travelCents;
  return {
    base_amount_rub: centsToRub(baseCents),
    meal_amount_rub: centsToRub(mealCents),
    travel_amount_rub: centsToRub(travelCents),
    total_amount_rub: centsToRub(total),
    total_cents: total,
  };
}

function isSequelizeUniqueError(error) {
  return String(error?.name || '') === 'SequelizeUniqueConstraintError';
}

function isAccrualNumberUniqueConflict(error) {
  if (!isSequelizeUniqueError(error)) return false;
  const byPath = Array.isArray(error?.errors)
    ? error.errors.some((item) => String(item?.path || '') === 'accrual_number')
    : false;
  if (byPath) return true;
  const constraint = String(error?.constraint || '').toLowerCase();
  return constraint.includes('accrual') && constraint.includes('number');
}

async function writeAuditEvent({
  entityType,
  entityId,
  action,
  before,
  after,
  actorId,
  transaction,
}) {
  await AccountingAuditEvent.create(
    {
      entity_type: entityType,
      entity_id: entityId,
      action,
      before_json: before ?? null,
      after_json: after ?? null,
      actor_id: actorId || null,
      created_by: actorId || null,
      updated_by: actorId || null,
    },
    { transaction }
  );
}

async function ensureTournamentExists(tournamentId) {
  const tournament = await Tournament.findByPk(tournamentId, {
    attributes: ['id'],
  });
  if (!tournament) throw new ServiceError('tournament_not_found', 404);
}

async function ensureGroupBelongsTournament(tournamentId, groupId) {
  const group = await TournamentGroup.findByPk(groupId, {
    attributes: ['id', 'tournament_id'],
  });
  if (!group) throw new ServiceError('group_not_found', 404);
  if (String(group.tournament_id) !== String(tournamentId)) {
    throw new ServiceError('group_tournament_mismatch', 400);
  }
}

async function ensureRefereeRoleExists(roleId) {
  const role = await RefereeRole.findByPk(roleId, { attributes: ['id'] });
  if (!role) throw new ServiceError('referee_role_not_found', 404);
}

async function ensureGroundExists(groundId) {
  const ground = await Ground.findByPk(groundId, { attributes: ['id'] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
}

async function loadRefData(transaction = null) {
  const [
    tariffStatuses,
    travelRateStatuses,
    documentStatuses,
    sources,
    postingTypes,
    components,
    actions,
    statusTransitions,
  ] = await Promise.all([
    RefereeTariffStatus.findAll({
      attributes: ['id', 'alias', 'name_ru', 'display_order'],
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      transaction,
    }),
    GroundTravelRateStatus.findAll({
      attributes: ['id', 'alias', 'name_ru', 'display_order'],
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      transaction,
    }),
    RefereeAccrualDocumentStatus.findAll({
      attributes: [
        'id',
        'alias',
        'name_ru',
        'display_order',
        'allow_bulk',
        'is_terminal',
      ],
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      transaction,
    }),
    RefereeAccrualSource.findAll({
      attributes: ['id', 'alias', 'name_ru', 'display_order'],
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      transaction,
    }),
    RefereeAccrualPostingType.findAll({
      attributes: ['id', 'alias', 'name_ru', 'display_order'],
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      transaction,
    }),
    RefereeAccrualComponent.findAll({
      attributes: ['id', 'alias', 'name_ru', 'display_order'],
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      transaction,
    }),
    RefereeAccountingAction.findAll({
      attributes: [
        'id',
        'alias',
        'scope',
        'name_ru',
        'display_order',
        'maker_checker_guard',
        'requires_comment',
      ],
      where: { is_active: true },
      order: [
        ['scope', 'ASC'],
        ['display_order', 'ASC'],
      ],
      transaction,
    }),
    RefereeAccrualStatusTransition.findAll({
      attributes: [
        'id',
        'from_status_id',
        'to_status_id',
        'action_id',
        'is_enabled',
      ],
      where: { is_enabled: true },
      include: [
        {
          model: RefereeAccrualDocumentStatus,
          as: 'FromStatus',
          attributes: ['id', 'alias', 'name_ru'],
          where: { is_active: true },
          required: true,
        },
        {
          model: RefereeAccrualDocumentStatus,
          as: 'ToStatus',
          attributes: ['id', 'alias', 'name_ru'],
          where: { is_active: true },
          required: true,
        },
        {
          model: RefereeAccountingAction,
          as: 'Action',
          attributes: ['id', 'alias', 'scope', 'name_ru', 'requires_comment'],
          where: { is_active: true },
          required: true,
        },
      ],
      order: [['id', 'ASC']],
      transaction,
    }),
  ]);

  const toAliasMap = (rows) => {
    const map = new Map();
    for (const row of rows) map.set(String(row.alias), row);
    return map;
  };
  const toIdMap = (rows) => {
    const map = new Map();
    for (const row of rows) map.set(String(row.id), row);
    return map;
  };

  return {
    tariffStatuses,
    travelRateStatuses,
    documentStatuses,
    sources,
    postingTypes,
    components,
    actions,
    statusTransitions,

    tariffStatusByAlias: toAliasMap(tariffStatuses),
    travelRateStatusByAlias: toAliasMap(travelRateStatuses),
    documentStatusByAlias: toAliasMap(documentStatuses),
    documentStatusById: toIdMap(documentStatuses),
    sourceByAlias: toAliasMap(sources),
    postingTypeByAlias: toAliasMap(postingTypes),
    postingTypeById: toIdMap(postingTypes),
    componentByAlias: toAliasMap(components),
    componentById: toIdMap(components),
    actionByAlias: toAliasMap(actions),
  };
}

function requireRefAlias(map, alias, code = 'invalid_alias') {
  const normalized = normalizeString(alias).toUpperCase();
  const row = map.get(normalized);
  if (!row) throw new ServiceError(code, 400);
  return row;
}

async function resolvePublishedAssignmentStatusIds() {
  const statuses = await MatchRefereeStatus.findAll({
    where: {
      alias: { [Op.in]: MATCH_REFEREE_ELIGIBLE_ALIASES },
    },
    attributes: ['id', 'alias'],
  });
  const ids = statuses.map((item) => item.id);
  if (!ids.length) {
    throw new ServiceError('referee_statuses_missing', 500);
  }
  return ids;
}

async function assertTariffOverlapAbsent({
  tournamentId,
  stageGroupId,
  refereeRoleId,
  fareCode,
  validFrom,
  validTo,
  statusId,
  refData,
  excludeId = null,
}) {
  const activeIds = [refData.tariffStatusByAlias.get('ACTIVE')?.id].filter(
    Boolean
  );

  if (!activeIds.includes(statusId)) return;

  const where = {
    tournament_id: tournamentId,
    stage_group_id: stageGroupId,
    referee_role_id: refereeRoleId,
    fare_code: fareCode,
    tariff_status_id: { [Op.in]: activeIds },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const rows = await RefereeTariffRule.findAll({
    where,
    attributes: ['id', 'valid_from', 'valid_to'],
  });

  for (const row of rows) {
    const existingFrom = String(row.valid_from);
    const existingTo = row.valid_to ? String(row.valid_to) : null;
    if (rangesOverlap(validFrom, validTo, existingFrom, existingTo)) {
      throw new ServiceError('tariff_validity_overlap', 409);
    }
  }
}

async function assertTravelRateOverlapAbsent({
  groundId,
  validFrom,
  validTo,
  statusId,
  refData,
  excludeId = null,
}) {
  const activeId = refData.travelRateStatusByAlias.get('ACTIVE')?.id;
  if (!activeId || statusId !== activeId) return;

  const where = {
    ground_id: groundId,
    travel_rate_status_id: activeId,
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const rows = await GroundRefereeTravelRate.findAll({
    where,
    attributes: ['id', 'valid_from', 'valid_to'],
  });

  for (const row of rows) {
    const existingFrom = String(row.valid_from);
    const existingTo = row.valid_to ? String(row.valid_to) : null;
    if (rangesOverlap(validFrom, validTo, existingFrom, existingTo)) {
      throw new ServiceError('travel_rate_validity_overlap', 409);
    }
  }
}

async function listDocumentPostingRows(documentId, transaction = null) {
  return RefereeAccrualPosting.findAll({
    where: { document_id: documentId },
    attributes: [
      'id',
      'line_no',
      'posting_type_id',
      'component_id',
      'amount_rub',
      'reason_code',
      'comment',
    ],
    order: [['line_no', 'ASC']],
    transaction,
    ...(transaction?.LOCK?.UPDATE ? { lock: transaction.LOCK.UPDATE } : {}),
  });
}

function sumPostingComponents(postingRows = [], refData) {
  const totals = {
    BASE: 0,
    MEAL: 0,
    TRAVEL: 0,
  };

  for (const row of postingRows || []) {
    const component = refData.componentById.get(String(row.component_id || ''));
    const alias = String(component?.alias || '').toUpperCase();
    if (!Object.hasOwn(totals, alias)) continue;
    totals[alias] += dbRubToCents(row.amount_rub);
  }

  return {
    baseCents: totals.BASE,
    mealCents: totals.MEAL,
    travelCents: totals.TRAVEL,
  };
}

function buildAccrualAmountsFromPostingRows(postingRows = [], refData) {
  const totals = sumPostingComponents(postingRows, refData);
  return summarizeAmounts(
    totals.baseCents,
    totals.mealCents,
    totals.travelCents
  );
}

async function syncAccrualDocumentAmounts({
  document,
  postingRows,
  actorId,
  transaction,
  refData,
  documentStatusId = undefined,
}) {
  const amounts = buildAccrualAmountsFromPostingRows(postingRows, refData);
  const updates = {
    base_amount_rub: amounts.base_amount_rub,
    meal_amount_rub: amounts.meal_amount_rub,
    travel_amount_rub: amounts.travel_amount_rub,
    total_amount_rub: amounts.total_amount_rub,
    updated_by: actorId,
  };
  if (documentStatusId !== undefined) {
    updates.document_status_id = documentStatusId;
  }

  await document.update(updates, { transaction, returning: false });
  return amounts;
}

async function countLiveAccrualsByField(
  fieldName,
  fieldValue,
  deletedStatusId,
  transaction = null
) {
  if (!fieldValue) return 0;

  const where = {
    [fieldName]: fieldValue,
  };
  if (deletedStatusId) {
    where.document_status_id = { [Op.ne]: deletedStatusId };
  }

  return RefereeAccrualDocument.count({
    where,
    transaction,
  });
}

async function resolveTariffRuleForMatch({
  tournamentId,
  stageGroupId,
  refereeRoleId,
  matchDate,
  refData,
}) {
  const resolutionStatusIds = ['ACTIVE', 'RETIRED']
    .map((alias) => refData.tariffStatusByAlias.get(alias)?.id)
    .filter(Boolean);
  if (!resolutionStatusIds.length) {
    throw new ServiceError('tariff_statuses_not_configured', 500);
  }

  return RefereeTariffRule.findOne({
    where: {
      tournament_id: tournamentId,
      stage_group_id: stageGroupId,
      referee_role_id: refereeRoleId,
      tariff_status_id: { [Op.in]: resolutionStatusIds },
      valid_from: { [Op.lte]: matchDate },
      [Op.or]: [{ valid_to: null }, { valid_to: { [Op.gte]: matchDate } }],
    },
    order: [
      ['valid_from', 'DESC'],
      ['version', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });
}

async function resolveTravelRateForMatch({ groundId, matchDate, refData }) {
  const resolutionStatusIds = ['ACTIVE', 'RETIRED']
    .map((alias) => refData.travelRateStatusByAlias.get(alias)?.id)
    .filter(Boolean);
  if (!resolutionStatusIds.length) {
    throw new ServiceError('travel_rate_statuses_not_configured', 500);
  }

  return GroundRefereeTravelRate.findOne({
    where: {
      ground_id: groundId,
      travel_rate_status_id: { [Op.in]: resolutionStatusIds },
      valid_from: { [Op.lte]: matchDate },
      [Op.or]: [{ valid_to: null }, { valid_to: { [Op.gte]: matchDate } }],
    },
    order: [
      ['valid_from', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });
}

function buildTariffCoverageState({
  group,
  role,
  activeRowsByDate,
  activeRowsAny,
}) {
  const state = activeRowsByDate.length
    ? 'ok'
    : activeRowsAny.length
      ? 'out_of_period'
      : 'missing';
  return {
    stage_group_id: String(group.id),
    referee_role_id: String(role.id),
    stage_group_name: group.name || null,
    referee_role_name: role.name || null,
    state,
    active_count: activeRowsAny.length,
    in_period_count: activeRowsByDate.length,
  };
}

function buildTravelCoverageState({ ground, activeRowsByDate, activeRowsAny }) {
  const state = activeRowsByDate.length
    ? 'ok'
    : activeRowsAny.length
      ? 'out_of_period'
      : 'missing';
  return {
    ground_id: String(ground.id),
    ground_name: ground.name || null,
    state,
    active_count: activeRowsAny.length,
    in_period_count: activeRowsByDate.length,
  };
}

async function nextAccrualNumber(matchDate, transaction) {
  const compact = String(matchDate).replace(/-/g, '').slice(0, 6);
  const prefix = `RA-${compact}-`;
  const rows = await sequelize.query(
    `WITH current_max AS (
       SELECT COALESCE(
         MAX(
           CASE
             WHEN accrual_number ~ :pattern
               THEN CAST(RIGHT(accrual_number, 6) AS INTEGER)
             ELSE 0
           END
         ),
         0
       ) AS max_seq
       FROM referee_accrual_documents
       WHERE accrual_number LIKE :prefix_like
     )
     INSERT INTO referee_accrual_number_counters (
       period_yyyymm,
       last_seq,
       created_at,
       updated_at
     )
     SELECT :period, current_max.max_seq + 1, NOW(), NOW()
     FROM current_max
     ON CONFLICT (period_yyyymm) DO UPDATE
     SET last_seq = GREATEST(
           referee_accrual_number_counters.last_seq + 1,
           (SELECT max_seq + 1 FROM current_max)
         ),
         updated_at = NOW()
     RETURNING last_seq`,
    {
      replacements: {
        period: compact,
        pattern: `^${prefix}[0-9]{6}$`,
        prefix_like: `${prefix}%`,
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  const next = Number.parseInt(String(rows?.[0]?.last_seq || ''), 10) || 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}

function shouldEnforceAccrualMakerChecker(action) {
  if (!action?.maker_checker_guard) return false;
  const scope = String(action.scope || '').toUpperCase();
  const alias = String(action.alias || '').toUpperCase();

  // The simplified accrual workflow has a single terminal action.
  // Requiring a second operator here makes both generated accruals and
  // manual adjustments operationally unusable.
  if (scope === 'ACCRUAL' && alias === 'APPROVE') {
    return false;
  }

  return true;
}

async function createGeneratedAccrualDocument({
  calc,
  actorId,
  draftStatusId,
  refData,
}) {
  for (let attempt = 0; attempt < MAX_ACCRUAL_NUMBER_ATTEMPTS; attempt += 1) {
    try {
      return await sequelize.transaction(async (tx) => {
        const existing = await RefereeAccrualDocument.findOne({
          where: {
            match_referee_id: calc.match_referee_id,
            original_document_id: null,
          },
          attributes: ['id'],
          paranoid: false,
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });

        if (existing) {
          return { created: null, skippedExisting: true };
        }

        const accrualNumber = await nextAccrualNumber(
          calc.match_date_snapshot,
          tx
        );
        const created = await RefereeAccrualDocument.create(
          {
            ...calc,
            accrual_number: accrualNumber,
            document_status_id: draftStatusId,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );

        await createPostingRows({
          documentId: created.id,
          postingTypeAlias: 'ORIGINAL',
          baseCents: dbRubToCents(created.base_amount_rub),
          mealCents: dbRubToCents(created.meal_amount_rub),
          travelCents: dbRubToCents(created.travel_amount_rub),
          actorId,
          transaction: tx,
          refData,
          startLineNo: 1,
        });

        await writeAuditEvent({
          entityType: 'REFEREE_ACCRUAL_DOCUMENT',
          entityId: created.id,
          action: 'CREATE',
          before: null,
          after: created.get({ plain: true }),
          actorId,
          transaction: tx,
        });

        return { created, skippedExisting: false };
      });
    } catch (error) {
      if (isAccrualNumberUniqueConflict(error)) {
        if (attempt < MAX_ACCRUAL_NUMBER_ATTEMPTS - 1) {
          continue;
        }
        throw new ServiceError('accrual_number_conflict_retry', 409);
      }

      if (isSequelizeUniqueError(error)) {
        return { created: null, skippedExisting: true };
      }

      throw error;
    }
  }

  throw new ServiceError('accrual_number_conflict_retry', 409);
}

async function createPostingRows({
  documentId,
  postingTypeAlias,
  baseCents,
  mealCents,
  travelCents,
  actorId,
  reasonCode,
  comment,
  transaction,
  refData,
  startLineNo = 1,
}) {
  const postingType = requireRefAlias(
    refData.postingTypeByAlias,
    postingTypeAlias,
    'posting_types_not_configured'
  );

  const payload = [
    { componentAlias: 'BASE', amountCents: baseCents },
    { componentAlias: 'MEAL', amountCents: mealCents },
    { componentAlias: 'TRAVEL', amountCents: travelCents },
  ];

  const rows = payload
    .filter(
      (item) =>
        item.amountCents !== 0 || String(postingType.alias) === 'ORIGINAL'
    )
    .map((item, index) => {
      const component = requireRefAlias(
        refData.componentByAlias,
        item.componentAlias,
        'posting_components_not_configured'
      );
      return {
        document_id: documentId,
        line_no: startLineNo + index,
        posting_type_id: postingType.id,
        component_id: component.id,
        amount_rub: centsToRub(item.amountCents),
        reason_code: reasonCode || null,
        comment: comment || null,
        created_by: actorId || null,
        updated_by: actorId || null,
      };
    });

  if (!rows.length) return;
  await RefereeAccrualPosting.bulkCreate(rows, { transaction });
}

function buildAccrualInclude({
  withPostings = false,
  withChain = false,
  withOriginal = false,
} = {}) {
  const include = [
    { model: Tournament, attributes: ['id', 'name'] },
    {
      model: Match,
      attributes: ['id', 'date_start'],
      include: [
        {
          model: Team,
          as: 'HomeTeam',
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: Team,
          as: 'AwayTeam',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    },
    {
      model: User,
      as: 'Referee',
      attributes: ['id', 'first_name', 'last_name', 'patronymic'],
    },
    { model: RefereeRole, attributes: ['id', 'name'] },
    { model: TournamentGroup, attributes: ['id', 'name'] },
    { model: Ground, attributes: ['id', 'name'], required: false },
    {
      model: RefereeTariffRule,
      attributes: ['id', 'fare_code'],
      required: false,
    },
    {
      model: GroundRefereeTravelRate,
      attributes: ['id', 'rate_code', 'travel_amount_rub'],
      required: false,
    },
    {
      model: RefereeAccrualDocumentStatus,
      as: 'DocumentStatus',
      attributes: ['id', 'alias', 'name_ru'],
      required: false,
    },
    {
      model: RefereeAccrualSource,
      as: 'Source',
      attributes: ['id', 'alias', 'name_ru'],
      required: false,
    },
  ];

  if (withPostings) {
    include.push({
      model: RefereeAccrualPosting,
      as: 'Postings',
      attributes: ['id', 'line_no', 'amount_rub', 'reason_code', 'comment'],
      include: [
        {
          model: RefereeAccrualPostingType,
          as: 'PostingType',
          attributes: ['id', 'alias', 'name_ru'],
          required: false,
        },
        {
          model: RefereeAccrualComponent,
          as: 'Component',
          attributes: ['id', 'alias', 'name_ru'],
          required: false,
        },
      ],
      required: false,
    });
  }

  if (withChain || withOriginal) {
    include.push({
      model: RefereeAccrualDocument,
      as: 'OriginalDocument',
      attributes: ['id', 'accrual_number', 'document_status_id'],
      include: [
        {
          model: RefereeAccrualDocumentStatus,
          as: 'DocumentStatus',
          attributes: ['id', 'alias', 'name_ru'],
          required: false,
        },
      ],
      required: false,
    });
  }

  if (withChain) {
    include.push({
      model: RefereeAccrualDocument,
      as: 'Adjustments',
      attributes: [
        'id',
        'accrual_number',
        'document_status_id',
        'total_amount_rub',
        'created_at',
      ],
      include: [
        {
          model: RefereeAccrualDocumentStatus,
          as: 'DocumentStatus',
          attributes: ['id', 'alias', 'name_ru'],
          required: false,
        },
      ],
      required: false,
    });
  }

  return include;
}

function normalizeTariffStatusAlias(refData, statusAlias, fallback = 'DRAFT') {
  const alias = normalizeString(statusAlias || fallback).toUpperCase();
  const status = refData.tariffStatusByAlias.get(alias);
  if (!status) throw new ServiceError('invalid_tariff_status', 400);
  return status;
}

function normalizeTravelRateStatusAlias(
  refData,
  statusAlias,
  fallback = 'ACTIVE'
) {
  const alias = normalizeString(statusAlias || fallback).toUpperCase();
  const status = refData.travelRateStatusByAlias.get(alias);
  if (!status) throw new ServiceError('invalid_travel_rate_status', 400);
  return status;
}

function normalizeDocumentStatusAlias(refData, statusAlias) {
  if (!statusAlias) return null;
  const alias = normalizeString(statusAlias).toUpperCase();
  const status = refData.documentStatusByAlias.get(alias);
  if (!status) throw new ServiceError('invalid_accrual_status', 400);
  return status;
}

function normalizeSourceAlias(refData, sourceAlias) {
  if (!sourceAlias) return null;
  const alias = normalizeString(sourceAlias).toUpperCase();
  const source = refData.sourceByAlias.get(alias);
  if (!source) throw new ServiceError('invalid_accrual_source', 400);
  return source;
}

async function listRefereeTariffRules({
  tournamentId,
  page = 1,
  limit = 100,
  fareCode,
  stageGroupId,
  refereeRoleId,
  status,
  onDate,
}) {
  await ensureTournamentExists(tournamentId);
  const refData = await loadRefData();

  const {
    offset,
    limit: normalizedLimit,
    page: normalizedPage,
  } = parsePagination(page, limit, 100, 5000);

  const where = { tournament_id: tournamentId };
  if (fareCode) where.fare_code = normalizeFareCode(fareCode);
  if (stageGroupId) where.stage_group_id = stageGroupId;
  if (refereeRoleId) where.referee_role_id = refereeRoleId;
  if (status) {
    where.tariff_status_id = normalizeTariffStatusAlias(refData, status).id;
  }
  if (onDate) {
    const date = normalizeDateOnly(onDate);
    where.valid_from = { [Op.lte]: date };
    where[Op.or] = [{ valid_to: null }, { valid_to: { [Op.gte]: date } }];
  }

  const data = await RefereeTariffRule.findAndCountAll({
    where,
    include: [
      {
        model: TournamentGroup,
        attributes: ['id', 'name'],
      },
      {
        model: RefereeRole,
        attributes: ['id', 'name'],
      },
      {
        model: RefereeTariffStatus,
        as: 'TariffStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
    order: [
      ['valid_from', 'DESC'],
      ['version', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit: normalizedLimit,
    offset,
  });

  return {
    rows: data.rows,
    count: data.count,
    page: normalizedPage,
    limit: normalizedLimit,
  };
}

async function createRefereeTariffRule(
  tournamentId,
  payload = {},
  actorId = null
) {
  await ensureTournamentExists(tournamentId);
  const refData = await loadRefData();

  const stageGroupId = normalizeString(payload.stage_group_id);
  const refereeRoleId = normalizeString(payload.referee_role_id);
  if (!stageGroupId) throw new ServiceError('group_not_found', 404);
  if (!refereeRoleId) throw new ServiceError('referee_role_not_found', 404);

  await Promise.all([
    ensureGroupBelongsTournament(tournamentId, stageGroupId),
    ensureRefereeRoleExists(refereeRoleId),
  ]);

  const fareCode = normalizeFareCode(payload.fare_code);
  const baseAmountCents = normalizeRubToCents(payload.base_amount_rub, {
    code: 'invalid_base_amount',
  });
  const mealAmountCents = normalizeRubToCents(payload.meal_amount_rub, {
    code: 'invalid_meal_amount',
  });
  if (baseAmountCents < 0) throw new ServiceError('invalid_base_amount', 400);
  if (mealAmountCents < 0) throw new ServiceError('invalid_meal_amount', 400);

  const validFrom = normalizeDateOnly(payload.valid_from);
  const validTo = normalizeOptionalDateOnly(payload.valid_to);
  ensureDateOrder(validFrom, validTo);

  const status = normalizeTariffStatusAlias(refData, 'ACTIVE', 'ACTIVE');

  const maxVersion =
    (await RefereeTariffRule.max('version', {
      where: {
        tournament_id: tournamentId,
        stage_group_id: stageGroupId,
        referee_role_id: refereeRoleId,
        fare_code: fareCode,
      },
    })) || 0;

  await assertTariffOverlapAbsent({
    tournamentId,
    stageGroupId,
    refereeRoleId,
    fareCode,
    validFrom,
    validTo,
    statusId: status.id,
    refData,
  });

  const created = await RefereeTariffRule.create({
    tournament_id: tournamentId,
    stage_group_id: stageGroupId,
    referee_role_id: refereeRoleId,
    fare_code: fareCode,
    base_amount_rub: centsToRub(baseAmountCents),
    meal_amount_rub: centsToRub(mealAmountCents),
    travel_mode: TARIFF_TRAVEL_MODE,
    valid_from: validFrom,
    valid_to: validTo,
    tariff_status_id: status.id,
    version: Number(maxVersion) + 1,
    filed_by: null,
    approved_by: actorId,
    created_by: actorId,
    updated_by: actorId,
  });

  await writeAuditEvent({
    entityType: 'REFEREE_TARIFF_RULE',
    entityId: created.id,
    action: 'CREATE',
    before: null,
    after: created.get({ plain: true }),
    actorId,
  });

  return RefereeTariffRule.findByPk(created.id, {
    include: [
      { model: TournamentGroup, attributes: ['id', 'name'] },
      { model: RefereeRole, attributes: ['id', 'name'] },
      {
        model: RefereeTariffStatus,
        as: 'TariffStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
  });
}

async function updateRefereeTariffRule(
  tournamentId,
  tariffId,
  payload = {},
  actorId = null
) {
  const refData = await loadRefData();
  const tariff = await RefereeTariffRule.findOne({
    where: { id: tariffId, tournament_id: tournamentId },
    include: [
      {
        model: RefereeTariffStatus,
        as: 'TariffStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
  });
  if (!tariff) throw new ServiceError('tariff_rule_not_found', 404);

  const deletedStatusId = refData.documentStatusByAlias.get('DELETED')?.id;
  const hasLiveAccruals =
    (await countLiveAccrualsByField(
      'tariff_rule_id',
      tariff.id,
      deletedStatusId,
      null
    )) > 0;
  const hasBusinessFieldMutation = [
    'stage_group_id',
    'referee_role_id',
    'fare_code',
    'base_amount_rub',
    'meal_amount_rub',
    'valid_from',
    'valid_to',
  ].some((key) => Object.hasOwn(payload || {}, key));
  if (hasLiveAccruals && hasBusinessFieldMutation) {
    throw new ServiceError('tariff_rule_locked_by_accruals', 409);
  }

  const before = tariff.get({ plain: true });
  const updates = { updated_by: actorId };

  const nextStageGroupId =
    payload.stage_group_id !== undefined
      ? normalizeString(payload.stage_group_id)
      : tariff.stage_group_id;
  const nextRefereeRoleId =
    payload.referee_role_id !== undefined
      ? normalizeString(payload.referee_role_id)
      : tariff.referee_role_id;

  if (payload.stage_group_id !== undefined) {
    if (!nextStageGroupId) throw new ServiceError('group_not_found', 404);
    await ensureGroupBelongsTournament(tournamentId, nextStageGroupId);
    updates.stage_group_id = nextStageGroupId;
  }
  if (payload.referee_role_id !== undefined) {
    if (!nextRefereeRoleId) {
      throw new ServiceError('referee_role_not_found', 404);
    }
    await ensureRefereeRoleExists(nextRefereeRoleId);
    updates.referee_role_id = nextRefereeRoleId;
  }

  const nextFareCode =
    payload.fare_code !== undefined
      ? normalizeFareCode(payload.fare_code)
      : String(tariff.fare_code);
  if (payload.fare_code !== undefined) updates.fare_code = nextFareCode;

  const nextBaseAmountCents =
    payload.base_amount_rub !== undefined
      ? normalizeRubToCents(payload.base_amount_rub, {
          code: 'invalid_base_amount',
        })
      : dbRubToCents(tariff.base_amount_rub);
  const nextMealAmountCents =
    payload.meal_amount_rub !== undefined
      ? normalizeRubToCents(payload.meal_amount_rub, {
          code: 'invalid_meal_amount',
        })
      : dbRubToCents(tariff.meal_amount_rub);
  if (nextBaseAmountCents < 0)
    throw new ServiceError('invalid_base_amount', 400);
  if (nextMealAmountCents < 0)
    throw new ServiceError('invalid_meal_amount', 400);

  if (payload.base_amount_rub !== undefined) {
    updates.base_amount_rub = centsToRub(nextBaseAmountCents);
  }
  if (payload.meal_amount_rub !== undefined) {
    updates.meal_amount_rub = centsToRub(nextMealAmountCents);
  }

  const nextValidFrom =
    payload.valid_from !== undefined
      ? normalizeDateOnly(payload.valid_from)
      : String(tariff.valid_from);
  const nextValidTo =
    payload.valid_to !== undefined
      ? normalizeOptionalDateOnly(payload.valid_to)
      : tariff.valid_to
        ? String(tariff.valid_to)
        : null;
  const requestedStatusAlias =
    normalizeString(payload.status).toUpperCase() ||
    String(tariff.TariffStatus?.alias || 'ACTIVE');
  const nextStatus = normalizeTariffStatusAlias(
    refData,
    requestedStatusAlias,
    String(tariff.TariffStatus?.alias || 'ACTIVE')
  );
  const retirementBoundary =
    String(nextStatus.alias || '').toUpperCase() === 'RETIRED'
      ? moscowTodayDateKey() || new Date().toISOString().slice(0, 10)
      : null;
  const normalizedValidTo =
    retirementBoundary && (!nextValidTo || nextValidTo > retirementBoundary)
      ? retirementBoundary
      : nextValidTo;
  if (payload.valid_from !== undefined) updates.valid_from = nextValidFrom;
  if (
    payload.valid_to !== undefined ||
    normalizedValidTo !== nextValidTo ||
    requestedStatusAlias === 'RETIRED'
  ) {
    updates.valid_to = normalizedValidTo;
  }
  ensureDateOrder(nextValidFrom, normalizedValidTo);

  updates.tariff_status_id = nextStatus.id;

  await assertTariffOverlapAbsent({
    tournamentId,
    stageGroupId: nextStageGroupId,
    refereeRoleId: nextRefereeRoleId,
    fareCode: nextFareCode,
    validFrom: nextValidFrom,
    validTo: normalizedValidTo,
    statusId: nextStatus.id,
    refData,
    excludeId: tariff.id,
  });

  await tariff.update(updates, { returning: false });

  const reloaded = await RefereeTariffRule.findByPk(tariff.id, {
    include: [
      { model: TournamentGroup, attributes: ['id', 'name'] },
      { model: RefereeRole, attributes: ['id', 'name'] },
      {
        model: RefereeTariffStatus,
        as: 'TariffStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
  });

  await writeAuditEvent({
    entityType: 'REFEREE_TARIFF_RULE',
    entityId: tariff.id,
    action:
      String(nextStatus.alias || '').toUpperCase() === 'RETIRED'
        ? 'RETIRE'
        : 'UPDATE',
    before,
    after: reloaded.get({ plain: true }),
    actorId,
  });

  return reloaded;
}

function tariffActionToStatusAlias(actionAlias) {
  const alias = normalizeString(actionAlias).toUpperCase();
  if (alias === 'FILE') return 'ACTIVE';
  if (alias === 'ACTIVATE') return 'ACTIVE';
  if (alias === 'RETIRE') return 'RETIRED';
  throw new ServiceError('invalid_tariff_action', 400);
}

async function runTariffAction(
  tournamentId,
  tariffId,
  actionAlias,
  actorId = null
) {
  const refData = await loadRefData();
  const action = requireRefAlias(
    refData.actionByAlias,
    actionAlias,
    'invalid_tariff_action'
  );
  if (String(action.scope) !== 'TARIFF') {
    throw new ServiceError('invalid_tariff_action', 400);
  }
  return updateRefereeTariffRule(
    tournamentId,
    tariffId,
    { status: tariffActionToStatusAlias(action.alias) },
    actorId
  );
}

async function fileRefereeTariffRule(tournamentId, tariffId, actorId = null) {
  return runTariffAction(tournamentId, tariffId, 'FILE', actorId);
}

async function activateRefereeTariffRule(
  tournamentId,
  tariffId,
  actorId = null
) {
  return runTariffAction(tournamentId, tariffId, 'ACTIVATE', actorId);
}

async function retireRefereeTariffRule(tournamentId, tariffId, actorId = null) {
  return runTariffAction(tournamentId, tariffId, 'RETIRE', actorId);
}

async function listGroundTravelRates({
  groundId,
  page = 1,
  limit = 100,
  status,
  onDate,
}) {
  await ensureGroundExists(groundId);
  const refData = await loadRefData();

  const {
    offset,
    page: normalizedPage,
    limit: normalizedLimit,
  } = parsePagination(page, limit, 100, 1000);

  const where = { ground_id: groundId };
  if (status) {
    where.travel_rate_status_id = normalizeTravelRateStatusAlias(
      refData,
      status,
      'ACTIVE'
    ).id;
  }
  if (onDate) {
    const date = normalizeDateOnly(onDate);
    where.valid_from = { [Op.lte]: date };
    where[Op.or] = [{ valid_to: null }, { valid_to: { [Op.gte]: date } }];
  }

  const data = await GroundRefereeTravelRate.findAndCountAll({
    where,
    include: [
      {
        model: GroundTravelRateStatus,
        as: 'TravelRateStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
    order: [
      ['valid_from', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit: normalizedLimit,
    offset,
  });

  return {
    rows: data.rows,
    count: data.count,
    page: normalizedPage,
    limit: normalizedLimit,
  };
}

async function createGroundTravelRate(groundId, payload = {}, actorId = null) {
  await ensureGroundExists(groundId);
  const refData = await loadRefData();

  const travelAmountCents = normalizeRubToCents(payload.travel_amount_rub, {
    code: 'invalid_travel_amount',
  });
  if (travelAmountCents < 0)
    throw new ServiceError('invalid_travel_amount', 400);

  const validFrom = normalizeDateOnly(payload.valid_from);
  const validTo = normalizeOptionalDateOnly(payload.valid_to);
  ensureDateOrder(validFrom, validTo);

  const status = normalizeTravelRateStatusAlias(refData, 'ACTIVE', 'ACTIVE');

  await assertTravelRateOverlapAbsent({
    groundId,
    validFrom,
    validTo,
    statusId: status.id,
    refData,
  });

  const created = await GroundRefereeTravelRate.create({
    ground_id: groundId,
    rate_code: trimString(payload.rate_code, 16),
    travel_amount_rub: centsToRub(travelAmountCents),
    valid_from: validFrom,
    valid_to: validTo,
    travel_rate_status_id: status.id,
    created_by: actorId,
    updated_by: actorId,
  });

  await writeAuditEvent({
    entityType: 'GROUND_REFEREE_TRAVEL_RATE',
    entityId: created.id,
    action: 'CREATE',
    before: null,
    after: created.get({ plain: true }),
    actorId,
  });

  return GroundRefereeTravelRate.findByPk(created.id, {
    include: [
      {
        model: GroundTravelRateStatus,
        as: 'TravelRateStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
  });
}

async function updateGroundTravelRate(
  groundId,
  rateId,
  payload = {},
  actorId = null
) {
  const refData = await loadRefData();
  const rate = await GroundRefereeTravelRate.findOne({
    where: { id: rateId, ground_id: groundId },
    include: [
      {
        model: GroundTravelRateStatus,
        as: 'TravelRateStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
  });
  if (!rate) throw new ServiceError('travel_rate_not_found', 404);

  const requestedStatusAlias = normalizeString(payload.status).toUpperCase();

  const deletedStatusId = refData.documentStatusByAlias.get('DELETED')?.id;
  const hasLiveAccruals =
    (await countLiveAccrualsByField(
      'travel_rate_id',
      rate.id,
      deletedStatusId,
      null
    )) > 0;
  const hasBusinessFieldMutation = [
    'rate_code',
    'travel_amount_rub',
    'valid_from',
    'valid_to',
  ].some((key) => Object.hasOwn(payload || {}, key));
  if (hasLiveAccruals && hasBusinessFieldMutation) {
    throw new ServiceError('travel_rate_locked_by_accruals', 409);
  }

  const before = rate.get({ plain: true });

  const nextTravelAmountCents =
    payload.travel_amount_rub !== undefined
      ? normalizeRubToCents(payload.travel_amount_rub, {
          code: 'invalid_travel_amount',
        })
      : dbRubToCents(rate.travel_amount_rub);
  if (nextTravelAmountCents < 0) {
    throw new ServiceError('invalid_travel_amount', 400);
  }

  const nextValidFrom =
    payload.valid_from !== undefined
      ? normalizeDateOnly(payload.valid_from)
      : String(rate.valid_from);
  const nextValidTo =
    payload.valid_to !== undefined
      ? normalizeOptionalDateOnly(payload.valid_to)
      : rate.valid_to
        ? String(rate.valid_to)
        : null;
  const effectiveRequestedStatusAlias =
    requestedStatusAlias === 'DELETED' ? 'RETIRED' : requestedStatusAlias;
  const nextStatus = normalizeTravelRateStatusAlias(
    refData,
    effectiveRequestedStatusAlias ||
      String(rate.TravelRateStatus?.alias || 'ACTIVE'),
    String(rate.TravelRateStatus?.alias || 'ACTIVE')
  );
  const retirementBoundary =
    String(nextStatus.alias || '').toUpperCase() === 'RETIRED'
      ? moscowTodayDateKey() || new Date().toISOString().slice(0, 10)
      : null;
  const normalizedValidTo =
    retirementBoundary && (!nextValidTo || nextValidTo > retirementBoundary)
      ? retirementBoundary
      : nextValidTo;
  ensureDateOrder(nextValidFrom, normalizedValidTo);

  await assertTravelRateOverlapAbsent({
    groundId,
    validFrom: nextValidFrom,
    validTo: normalizedValidTo,
    statusId: nextStatus.id,
    refData,
    excludeId: rate.id,
  });

  const updates = {
    updated_by: actorId,
  };
  if (payload.rate_code !== undefined) {
    updates.rate_code = trimString(payload.rate_code, 16);
  }
  if (payload.travel_amount_rub !== undefined) {
    updates.travel_amount_rub = centsToRub(nextTravelAmountCents);
  }
  if (payload.valid_from !== undefined) updates.valid_from = nextValidFrom;
  if (
    payload.valid_to !== undefined ||
    normalizedValidTo !== nextValidTo ||
    effectiveRequestedStatusAlias === 'RETIRED'
  ) {
    updates.valid_to = normalizedValidTo;
  }
  updates.travel_rate_status_id = nextStatus.id;

  await rate.update(updates, { returning: false });

  const reloaded = await GroundRefereeTravelRate.findByPk(rate.id, {
    include: [
      {
        model: GroundTravelRateStatus,
        as: 'TravelRateStatus',
        attributes: ['id', 'alias', 'name_ru'],
      },
    ],
  });

  await writeAuditEvent({
    entityType: 'GROUND_REFEREE_TRAVEL_RATE',
    entityId: rate.id,
    action:
      String(nextStatus.alias || '').toUpperCase() === 'RETIRED'
        ? 'RETIRE'
        : 'UPDATE',
    before,
    after: reloaded.get({ plain: true }),
    actorId,
  });

  return reloaded;
}

async function getTournamentPaymentsDashboard({
  tournamentId,
  onDate = null,
} = {}) {
  await ensureTournamentExists(tournamentId);
  const refData = await loadRefData();

  const groups = await TournamentGroup.findAll({
    where: { tournament_id: tournamentId },
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  });
  const groupIds = groups.map((group) => String(group.id));

  const groupReferees = groupIds.length
    ? await TournamentGroupReferee.findAll({
        where: {
          tournament_group_id: { [Op.in]: groupIds },
        },
        attributes: ['tournament_group_id', 'referee_role_id', 'count'],
      })
    : [];

  const activeRoleIds = [
    ...new Set(
      groupReferees
        .filter((item) => Number(item.count || 0) > 0)
        .map((item) => String(item.referee_role_id || ''))
        .filter(Boolean)
    ),
  ];

  const roles = activeRoleIds.length
    ? await RefereeRole.findAll({
        where: { id: { [Op.in]: activeRoleIds } },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      })
    : [];

  const matches = await Match.findAll({
    where: { tournament_id: tournamentId },
    attributes: ['id', 'tournament_group_id', 'ground_id', 'date_start'],
    order: [['date_start', 'ASC']],
  });

  const scheduleMap = new Map();
  for (const match of matches) {
    const day = moscowDateKey(match.date_start);
    if (day) {
      scheduleMap.set(day, Number(scheduleMap.get(day) || 0) + 1);
    }
  }

  const scheduleDates = [...scheduleMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => ({ day, count }));

  const coverageDate =
    normalizeOptionalDateOnly(onDate) ||
    pickCoverageDate(scheduleDates.map((item) => item.day));
  const coverageMatches = matches.filter(
    (match) => moscowDateKey(match.date_start) === coverageDate
  );
  const coverageGroupIds = new Set(
    coverageMatches
      .map((match) => String(match.tournament_group_id || ''))
      .filter(Boolean)
  );
  const coverageGroundIds = new Set(
    coverageMatches
      .map((match) => String(match.ground_id || ''))
      .filter(Boolean)
  );
  const coverageGroups = groups.filter((group) =>
    coverageGroupIds.has(String(group.id))
  );
  const coverageGroupReferees = groupReferees.filter((item) =>
    coverageGroupIds.has(String(item.tournament_group_id || ''))
  );
  const coverageRoleIds = new Set(
    coverageGroupReferees
      .filter((item) => Number(item.count || 0) > 0)
      .map((item) => String(item.referee_role_id || ''))
      .filter(Boolean)
  );
  const coverageRoles = roles.filter((role) =>
    coverageRoleIds.has(String(role.id))
  );

  const activeTariffStatusId = refData.tariffStatusByAlias.get('ACTIVE')?.id;
  const tariffCoverageStatusIds = ['ACTIVE', 'RETIRED']
    .map((alias) => refData.tariffStatusByAlias.get(alias)?.id)
    .filter(Boolean);
  const activeTravelStatusId =
    refData.travelRateStatusByAlias.get('ACTIVE')?.id;
  const travelCoverageStatusIds = ['ACTIVE', 'RETIRED']
    .map((alias) => refData.travelRateStatusByAlias.get(alias)?.id)
    .filter(Boolean);
  const draftDocumentStatusId =
    refData.documentStatusByAlias.get('DRAFT')?.id || null;

  const tariffRows = await RefereeTariffRule.findAll({
    where: { tournament_id: tournamentId },
    attributes: [
      'id',
      'stage_group_id',
      'referee_role_id',
      'valid_from',
      'valid_to',
      'tariff_status_id',
    ],
  });

  const tariffActiveAnyMap = new Map();
  const tariffActiveByDateMap = new Map();
  const activeTariffRules = tariffRows.filter(
    (row) => String(row.tariff_status_id || '') === String(activeTariffStatusId)
  );
  const tariffCoverageRules = tariffRows.filter((row) =>
    tariffCoverageStatusIds.includes(row.tariff_status_id)
  );

  for (const row of tariffCoverageRules) {
    const key = `${row.stage_group_id}:${row.referee_role_id}`;
    if (!tariffActiveAnyMap.has(key)) tariffActiveAnyMap.set(key, []);
    tariffActiveAnyMap.get(key)?.push(row);

    const from = String(row.valid_from || '0000-01-01');
    const to = row.valid_to ? String(row.valid_to) : '9999-12-31';
    if (from <= coverageDate && to >= coverageDate) {
      if (!tariffActiveByDateMap.has(key)) tariffActiveByDateMap.set(key, []);
      tariffActiveByDateMap.get(key)?.push(row);
    }
  }

  const tariffMatrix = coverageGroups.map((group) => {
    const roleStates = coverageRoles.map((role) =>
      buildTariffCoverageState({
        group,
        role,
        activeRowsByDate:
          tariffActiveByDateMap.get(`${group.id}:${role.id}`) || [],
        activeRowsAny: tariffActiveAnyMap.get(`${group.id}:${role.id}`) || [],
      })
    );

    return {
      stage_group: {
        id: String(group.id),
        name: group.name || null,
      },
      role_states: roleStates,
    };
  });

  const tariffIssues = tariffMatrix
    .flatMap((row) => row.role_states || [])
    .filter((row) => row.state !== 'ok');
  const tariffCoverageRows = tariffMatrix.flatMap(
    (row) => row.role_states || []
  );

  const scheduleGroundIds = [...coverageGroundIds];
  const grounds = scheduleGroundIds.length
    ? await Ground.findAll({
        where: { id: { [Op.in]: scheduleGroundIds } },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      })
    : [];

  const travelRateRows = scheduleGroundIds.length
    ? await GroundRefereeTravelRate.findAll({
        where: {
          ground_id: { [Op.in]: scheduleGroundIds },
        },
        attributes: [
          'id',
          'ground_id',
          'valid_from',
          'valid_to',
          'travel_rate_status_id',
        ],
      })
    : [];

  const travelActiveAnyMap = new Map();
  const travelActiveByDateMap = new Map();
  const activeTravelRates = travelRateRows.filter(
    (row) =>
      String(row.travel_rate_status_id || '') === String(activeTravelStatusId)
  );
  const travelCoverageRates = travelRateRows.filter((row) =>
    travelCoverageStatusIds.includes(row.travel_rate_status_id)
  );

  for (const row of travelCoverageRates) {
    const groundKey = String(row.ground_id || '');
    if (!travelActiveAnyMap.has(groundKey))
      travelActiveAnyMap.set(groundKey, []);
    travelActiveAnyMap.get(groundKey)?.push(row);

    const from = String(row.valid_from || '0000-01-01');
    const to = row.valid_to ? String(row.valid_to) : '9999-12-31';
    if (from <= coverageDate && to >= coverageDate) {
      if (!travelActiveByDateMap.has(groundKey)) {
        travelActiveByDateMap.set(groundKey, []);
      }
      travelActiveByDateMap.get(groundKey)?.push(row);
    }
  }

  const travelCoverageRows = grounds.map((ground) =>
    buildTravelCoverageState({
      ground,
      activeRowsByDate: travelActiveByDateMap.get(String(ground.id)) || [],
      activeRowsAny: travelActiveAnyMap.get(String(ground.id)) || [],
    })
  );
  const travelIssues = travelCoverageRows.filter((row) => row.state !== 'ok');

  const draftAccruals = draftDocumentStatusId
    ? await RefereeAccrualDocument.count({
        where: {
          tournament_id: tournamentId,
          document_status_id: draftDocumentStatusId,
        },
      })
    : 0;

  return {
    summary: {
      active_tariff_rules: activeTariffRules.length,
      active_travel_rates: activeTravelRates.length,
      draft_accruals: Number(draftAccruals || 0),
      tariff_issue_count: tariffIssues.length,
      travel_issue_count: travelIssues.length,
    },
    schedule_dates: scheduleDates,
    coverage_date: coverageDate,
    tariff_coverage_summary: countStates(tariffCoverageRows),
    tariff_coverage_issues: tariffIssues,
    tariff_coverage_matrix: tariffMatrix,
    travel_coverage_summary: countStates(travelCoverageRows),
    travel_coverage_rows: travelCoverageRows,
    travel_coverage_issues: travelIssues,
  };
}

function buildGenerationDefaults(input = {}, sourceAlias = 'MANUAL') {
  const defaultDaysBack =
    sourceAlias === 'CRON'
      ? REFEREE_ACCRUAL_GENERATION_LOOKBACK_DAYS
      : DEFAULT_ACCRUAL_LOOKBACK_DAYS;
  return normalizeDateRange({
    fromDate: input.fromDate,
    toDate: input.toDate,
    defaultDaysBack,
  });
}

async function generateAccruals({
  tournamentId = null,
  fromDate = null,
  toDate = null,
  apply = false,
  source = 'MANUAL',
  actorId = null,
}) {
  const refData = await loadRefData();
  const sourceRef =
    normalizeSourceAlias(refData, source || 'MANUAL') ||
    requireRefAlias(refData.sourceByAlias, 'MANUAL', 'invalid_accrual_source');

  if (tournamentId) {
    await ensureTournamentExists(tournamentId);
  }

  const { from, to } = buildGenerationDefaults(
    { fromDate, toDate },
    sourceRef.alias
  );
  const { start, endExclusive } = toMoscowDayRange(from, to);
  const eligibleStatusIds = await resolvePublishedAssignmentStatusIds();

  const matches = await Match.findAll({
    attributes: [
      'id',
      'tournament_id',
      'tournament_group_id',
      'ground_id',
      'date_start',
    ],
    where: {
      ...(tournamentId ? { tournament_id: tournamentId } : {}),
      date_start: {
        [Op.gte]: start,
        [Op.lt]: endExclusive,
      },
    },
    include: [
      {
        model: GameStatus,
        attributes: ['id', 'alias'],
        where: { alias: 'FINISHED' },
        required: true,
      },
    ],
  });

  if (!matches.length) {
    return {
      from_date: from,
      to_date: to,
      mode: apply ? 'apply' : 'preview',
      summary: {
        eligible_matches: 0,
        eligible_assignments: 0,
        calculated: 0,
        created: 0,
        skipped_existing: 0,
        errors: 0,
      },
      errors_by_code: {},
      accruals: [],
      errors: [],
    };
  }

  const matchesById = new Map(
    matches.map((match) => [String(match.id), match])
  );

  const assignments = await MatchReferee.findAll({
    attributes: ['id', 'match_id', 'referee_role_id', 'user_id', 'status_id'],
    where: {
      match_id: { [Op.in]: matches.map((match) => match.id) },
      status_id: { [Op.in]: eligibleStatusIds },
    },
  });

  const assignmentIds = assignments.map((item) => item.id);
  const existingOriginalRows = assignmentIds.length
    ? await RefereeAccrualDocument.findAll({
        where: {
          match_referee_id: { [Op.in]: assignmentIds },
          original_document_id: null,
        },
        attributes: ['match_referee_id'],
        paranoid: false,
      })
    : [];
  const existingOriginalSet = new Set(
    existingOriginalRows.map((item) => String(item.match_referee_id))
  );

  const tariffCache = new Map();
  const travelCache = new Map();
  const errors = [];
  const calculations = [];
  let skippedExisting = 0;

  for (const assignment of assignments) {
    const match = matchesById.get(String(assignment.match_id));
    if (!match) continue;

    if (existingOriginalSet.has(String(assignment.id))) {
      skippedExisting += 1;
      continue;
    }

    const tournamentGroupId = match.tournament_group_id;
    if (!tournamentGroupId) {
      errors.push({
        code: 'missing_stage_group',
        match_id: match.id,
        match_referee_id: assignment.id,
      });
      continue;
    }

    const matchDate = moscowDateKey(match.date_start);
    if (!matchDate) {
      errors.push({
        code: 'invalid_match_date',
        match_id: match.id,
        match_referee_id: assignment.id,
      });
      continue;
    }

    const tariffKey = `${match.tournament_id}:${tournamentGroupId}:${assignment.referee_role_id}:${matchDate}`;
    let tariff = tariffCache.get(tariffKey);
    if (tariff === undefined) {
      tariff = await resolveTariffRuleForMatch({
        tournamentId: match.tournament_id,
        stageGroupId: tournamentGroupId,
        refereeRoleId: assignment.referee_role_id,
        matchDate,
        refData,
      });
      tariffCache.set(tariffKey, tariff || null);
    }
    if (!tariff) {
      errors.push({
        code: 'missing_tariff_rule',
        match_id: match.id,
        match_referee_id: assignment.id,
        referee_role_id: assignment.referee_role_id,
      });
      continue;
    }

    if (!match.ground_id) {
      errors.push({
        code: 'missing_match_ground',
        match_id: match.id,
        match_referee_id: assignment.id,
      });
      continue;
    }

    const travelKey = `${match.ground_id}:${matchDate}`;
    let travelRate = travelCache.get(travelKey);
    if (travelRate === undefined) {
      travelRate = await resolveTravelRateForMatch({
        groundId: match.ground_id,
        matchDate,
        refData,
      });
      travelCache.set(travelKey, travelRate || null);
    }
    if (!travelRate) {
      errors.push({
        code: 'missing_ground_travel_rate',
        match_id: match.id,
        match_referee_id: assignment.id,
        ground_id: match.ground_id,
      });
      continue;
    }

    const baseCents = dbRubToCents(tariff.base_amount_rub);
    const mealCents = dbRubToCents(tariff.meal_amount_rub);
    const travelCents = dbRubToCents(travelRate.travel_amount_rub);
    const amounts = summarizeAmounts(baseCents, mealCents, travelCents);

    calculations.push({
      tournament_id: match.tournament_id,
      match_id: match.id,
      match_referee_id: assignment.id,
      referee_id: assignment.user_id,
      referee_role_id: assignment.referee_role_id,
      stage_group_id: tournamentGroupId,
      ground_id: match.ground_id,
      fare_code_snapshot: tariff.fare_code,
      tariff_rule_id: tariff.id,
      travel_rate_id: travelRate.id,
      match_date_snapshot: matchDate,
      base_amount_rub: amounts.base_amount_rub,
      meal_amount_rub: amounts.meal_amount_rub,
      travel_amount_rub: amounts.travel_amount_rub,
      total_amount_rub: amounts.total_amount_rub,
      currency: 'RUB',
      source_id: sourceRef.id,
      calc_fingerprint: buildAccrualFingerprint({
        match_referee_id: assignment.id,
        tariff_rule_id: tariff.id,
        travel_rate_id: travelRate.id,
        match_date: matchDate,
        amounts: {
          base_amount_rub: amounts.base_amount_rub,
          meal_amount_rub: amounts.meal_amount_rub,
          travel_amount_rub: amounts.travel_amount_rub,
        },
      }),
    });
  }

  const createdDocs = [];
  if (apply && calculations.length) {
    const draftStatus = requireRefAlias(
      refData.documentStatusByAlias,
      'DRAFT',
      'invalid_accrual_status'
    );
    const createdMatchRefereeIds = new Set();

    for (const calc of calculations) {
      if (createdMatchRefereeIds.has(String(calc.match_referee_id))) {
        skippedExisting += 1;
        continue;
      }

      const { created, skippedExisting: skipped } =
        await createGeneratedAccrualDocument({
          calc,
          actorId,
          draftStatusId: draftStatus.id,
          refData,
        });

      if (skipped) {
        skippedExisting += 1;
        continue;
      }

      if (!created) {
        continue;
      }

      createdDocs.push(created);
      createdMatchRefereeIds.add(String(calc.match_referee_id));
    }
  }

  const createdIds = createdDocs.map((item) => item.id);
  const created = createdIds.length
    ? await RefereeAccrualDocument.findAll({
        where: { id: { [Op.in]: createdIds } },
        include: buildAccrualInclude(),
        order: [['created_at', 'DESC']],
      })
    : [];

  const errorsByCode = {};
  for (const item of errors) {
    const key = String(item?.code || 'unknown_error');
    errorsByCode[key] = Number(errorsByCode[key] || 0) + 1;
  }

  return {
    from_date: from,
    to_date: to,
    mode: apply ? 'apply' : 'preview',
    summary: {
      eligible_matches: matches.length,
      eligible_assignments: assignments.length,
      calculated: calculations.length,
      created: created.length,
      skipped_existing: skippedExisting,
      errors: errors.length,
    },
    errors_by_code: errorsByCode,
    accruals: apply
      ? created
      : calculations.slice(0, 200).map((item) => ({
          ...item,
          status: {
            id: refData.documentStatusByAlias.get('DRAFT')?.id || null,
            alias: 'DRAFT',
            name_ru: 'Черновик',
          },
          source: {
            id: sourceRef.id,
            alias: sourceRef.alias,
            name_ru: sourceRef.name_ru,
          },
        })),
    errors,
  };
}

async function listRefereeAccrualDocuments({
  tournamentId = null,
  page = 1,
  limit = 50,
  status,
  source,
  number,
  fareCode,
  refereeRoleId,
  stageGroupId,
  groundId,
  dateFrom,
  dateTo,
  amountFrom,
  amountTo,
  search,
}) {
  const refData = await loadRefData();

  const {
    page: normalizedPage,
    limit: normalizedLimit,
    offset,
  } = parsePagination(page, limit, 50, 1000);

  const where = {};
  if (tournamentId) where.tournament_id = tournamentId;
  const deletedStatusId = refData.documentStatusByAlias.get('DELETED')?.id;
  if (status) {
    where.document_status_id = normalizeDocumentStatusAlias(refData, status).id;
  } else if (deletedStatusId) {
    where.document_status_id = { [Op.ne]: deletedStatusId };
  }
  if (source) {
    where.source_id = normalizeSourceAlias(refData, source).id;
  }
  if (number) {
    where.accrual_number = { [Op.iLike]: `%${normalizeString(number)}%` };
  }
  if (fareCode) {
    where.fare_code_snapshot = normalizeFareCode(fareCode);
  }
  if (refereeRoleId) where.referee_role_id = refereeRoleId;
  if (stageGroupId) where.stage_group_id = stageGroupId;
  if (groundId) where.ground_id = groundId;

  const normalizedDateFrom = normalizeOptionalDateOnly(dateFrom);
  const normalizedDateTo = normalizeOptionalDateOnly(dateTo);
  ensureDateOrder(normalizedDateFrom || '1900-01-01', normalizedDateTo || null);
  if (normalizedDateFrom || normalizedDateTo) {
    where.match_date_snapshot = {};
    if (normalizedDateFrom) {
      where.match_date_snapshot[Op.gte] = normalizedDateFrom;
    }
    if (normalizedDateTo) {
      where.match_date_snapshot[Op.lte] = normalizedDateTo;
    }
  }

  if (amountFrom !== undefined && amountFrom !== null && amountFrom !== '') {
    where.total_amount_rub = {
      ...(where.total_amount_rub || {}),
      [Op.gte]: centsToRub(
        normalizeRubToCents(amountFrom, {
          code: 'invalid_amount_from',
          allowNegative: true,
        })
      ),
    };
  }
  if (amountTo !== undefined && amountTo !== null && amountTo !== '') {
    where.total_amount_rub = {
      ...(where.total_amount_rub || {}),
      [Op.lte]: centsToRub(
        normalizeRubToCents(amountTo, {
          code: 'invalid_amount_to',
          allowNegative: true,
        })
      ),
    };
  }

  const term = normalizeString(search);
  if (term) {
    where[Op.or] = [
      { accrual_number: { [Op.iLike]: `%${term}%` } },
      { '$OriginalDocument.accrual_number$': { [Op.iLike]: `%${term}%` } },
      { fare_code_snapshot: { [Op.iLike]: `%${term.toUpperCase()}%` } },
      { '$Referee.last_name$': { [Op.iLike]: `%${term}%` } },
      { '$Referee.first_name$': { [Op.iLike]: `%${term}%` } },
      { '$Referee.patronymic$': { [Op.iLike]: `%${term}%` } },
      { '$Tournament.name$': { [Op.iLike]: `%${term}%` } },
      { '$RefereeRole.name$': { [Op.iLike]: `%${term}%` } },
      { '$TournamentGroup.name$': { [Op.iLike]: `%${term}%` } },
      { '$Ground.name$': { [Op.iLike]: `%${term}%` } },
      { '$DocumentStatus.name_ru$': { [Op.iLike]: `%${term}%` } },
      { '$Source.name_ru$': { [Op.iLike]: `%${term}%` } },
      { '$Match.HomeTeam.name$': { [Op.iLike]: `%${term}%` } },
      { '$Match.AwayTeam.name$': { [Op.iLike]: `%${term}%` } },
    ];
  }

  const data = await RefereeAccrualDocument.findAndCountAll({
    where,
    include: buildAccrualInclude({ withOriginal: true }),
    order: [
      ['match_date_snapshot', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit: normalizedLimit,
    offset,
    distinct: true,
  });

  const summaryRows = await RefereeAccrualDocument.findAll({
    where,
    include: buildAccrualInclude({ withOriginal: true }),
    attributes: ['id', 'total_amount_rub'],
    order: [],
  });

  return {
    rows: data.rows,
    count: data.count,
    page: normalizedPage,
    limit: normalizedLimit,
    summary: {
      total_amount_rub: summaryRows
        .reduce((acc, row) => {
          const value = Number(String(row?.total_amount_rub ?? 0));
          return Number.isFinite(value) ? acc + value : acc;
        }, 0)
        .toFixed(2),
    },
  };
}

function normalizeBulkSelectionPayload(payload = {}) {
  const selectionMode = normalizeString(
    payload.selectionMode || payload.selection_mode || 'explicit'
  ).toLowerCase();
  if (!['explicit', 'filtered'].includes(selectionMode)) {
    throw new ServiceError('invalid_accrual_selection_mode', 400);
  }

  const filters =
    payload?.filters && typeof payload.filters === 'object'
      ? {
          tournamentId:
            normalizeString(
              payload.filters.tournament_id ||
                payload.filters.tournamentId ||
                ''
            ) || null,
          status: normalizeString(payload.filters.status || '') || null,
          source: normalizeString(payload.filters.source || '') || null,
          number: normalizeString(payload.filters.number || '') || null,
          fareCode:
            normalizeString(
              payload.filters.fare_code || payload.filters.fareCode || ''
            ) || null,
          refereeRoleId:
            normalizeString(
              payload.filters.referee_role_id ||
                payload.filters.refereeRoleId ||
                ''
            ) || null,
          stageGroupId:
            normalizeString(
              payload.filters.stage_group_id ||
                payload.filters.stageGroupId ||
                ''
            ) || null,
          groundId:
            normalizeString(
              payload.filters.ground_id || payload.filters.groundId || ''
            ) || null,
          dateFrom:
            normalizeString(
              payload.filters.date_from || payload.filters.dateFrom || ''
            ) || null,
          dateTo:
            normalizeString(
              payload.filters.date_to || payload.filters.dateTo || ''
            ) || null,
          amountFrom:
            normalizeString(
              payload.filters.amount_from || payload.filters.amountFrom || ''
            ) || null,
          amountTo:
            normalizeString(
              payload.filters.amount_to || payload.filters.amountTo || ''
            ) || null,
          search: normalizeString(payload.filters.search || '') || null,
        }
      : {};

  const ids = Array.isArray(payload?.ids)
    ? [...new Set(payload.ids.map((id) => normalizeString(id)).filter(Boolean))]
    : [];

  return {
    selectionMode,
    ids,
    filters,
  };
}

async function loadFilteredAccrualIds(filters = {}) {
  const ids = [];
  let page = 1;
  let total = 0;

  do {
    const response = await listRefereeAccrualDocuments({
      tournamentId: filters.tournamentId || null,
      page,
      limit: FILTERED_ACCRUAL_SELECTION_PAGE_LIMIT,
      status: filters.status,
      source: filters.source,
      number: filters.number,
      fareCode: filters.fareCode,
      refereeRoleId: filters.refereeRoleId,
      stageGroupId: filters.stageGroupId,
      groundId: filters.groundId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      amountFrom: filters.amountFrom,
      amountTo: filters.amountTo,
      search: filters.search,
    });
    total = Number(response.count || 0);
    ids.push(...(response.rows || []).map((row) => normalizeString(row?.id)));
    if (!(response.rows || []).length) break;
    page += 1;
  } while (ids.length < total);

  return [...new Set(ids.filter(Boolean))];
}

async function resolveBulkAccrualIds(payload = {}) {
  const selection = normalizeBulkSelectionPayload(payload);
  if (selection.selectionMode === 'filtered') {
    return loadFilteredAccrualIds(selection.filters);
  }
  if (!selection.ids.length) {
    throw new ServiceError('bulk_ids_required', 400);
  }
  return selection.ids;
}

async function getRefereeAccrualDocument(documentId) {
  const doc = await RefereeAccrualDocument.findByPk(documentId, {
    include: buildAccrualInclude({ withPostings: true, withChain: true }),
    order: [
      [{ model: RefereeAccrualPosting, as: 'Postings' }, 'line_no', 'ASC'],
      [
        { model: RefereeAccrualDocument, as: 'Adjustments' },
        'created_at',
        'DESC',
      ],
    ],
  });
  if (!doc) throw new ServiceError('accrual_document_not_found', 404);

  const auditEvents = await AccountingAuditEvent.findAll({
    where: {
      entity_type: 'REFEREE_ACCRUAL_DOCUMENT',
      entity_id: documentId,
    },
    include: [
      {
        model: User,
        as: 'Actor',
        attributes: ['id', 'first_name', 'last_name', 'patronymic'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
    limit: 200,
  });

  return {
    document: doc,
    audit_events: auditEvents,
  };
}

async function resolveAccrualTransition({
  doc,
  actionAlias,
  comment = null,
  actorId,
  transaction,
}) {
  const refData = await loadRefData(transaction);
  const action = requireRefAlias(
    refData.actionByAlias,
    actionAlias,
    'invalid_accrual_action'
  );
  if (String(action.scope) !== 'ACCRUAL') {
    throw new ServiceError('invalid_accrual_action', 400);
  }
  const normalizedComment = trimString(comment, 1000);
  if (action.requires_comment && !normalizedComment) {
    throw new ServiceError('action_comment_required', 400);
  }

  const transition = await RefereeAccrualStatusTransition.findOne({
    where: {
      from_status_id: doc.document_status_id,
      action_id: action.id,
      is_enabled: true,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!transition) {
    throw new ServiceError('invalid_accrual_transition', 409);
  }

  if (
    shouldEnforceAccrualMakerChecker(action) &&
    doc.created_by &&
    actorId &&
    String(doc.created_by) === String(actorId)
  ) {
    throw new ServiceError('maker_checker_violation', 409);
  }

  return {
    action,
    transition,
    refData,
    comment: normalizedComment,
  };
}

async function applyRefereeAccrualAction(
  documentId,
  actionAlias,
  actorId = null,
  comment = null
) {
  const result = await sequelize.transaction(async (tx) => {
    const doc = await RefereeAccrualDocument.findByPk(documentId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!doc) throw new ServiceError('accrual_document_not_found', 404);

    const {
      action,
      transition,
      refData,
      comment: actionComment,
    } = await resolveAccrualTransition({
      doc,
      actionAlias,
      comment,
      actorId,
      transaction: tx,
    });

    const before = doc.get({ plain: true });
    const updates = {
      document_status_id: transition.to_status_id,
      updated_by: actorId,
    };

    const nextStatus = refData.documentStatusById.get(
      String(transition.to_status_id)
    );
    const nextAlias = String(nextStatus?.alias || '').toUpperCase();
    if (nextAlias === 'ACCRUED') updates.approved_by = actorId;

    await doc.update(updates, { transaction: tx, returning: false });

    await writeAuditEvent({
      entityType: 'REFEREE_ACCRUAL_DOCUMENT',
      entityId: doc.id,
      action: `ACTION_${action.alias}`,
      before,
      after: {
        ...doc.get({ plain: true }),
        action_comment: actionComment,
      },
      actorId,
      transaction: tx,
    });

    return doc.id;
  });

  return getRefereeAccrualDocument(result);
}

async function applyRefereeAccrualActionBulk({
  ids = [],
  selectionMode = 'explicit',
  filters = null,
  actionAlias,
  actorId = null,
  comment = null,
}) {
  const uniqueIds = await resolveBulkAccrualIds({
    ids,
    selectionMode,
    filters,
  });

  const results = [];
  for (const id of uniqueIds) {
    try {
      const data = await applyRefereeAccrualAction(
        id,
        actionAlias,
        actorId,
        comment
      );
      results.push({
        id,
        ok: true,
        status: data?.document?.DocumentStatus?.alias || null,
      });
    } catch (error) {
      results.push({
        id,
        ok: false,
        error: error?.code || 'bulk_action_failed',
        message: error?.message || null,
      });
    }
  }

  return {
    action_alias: normalizeString(actionAlias).toUpperCase(),
    total: uniqueIds.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

async function deleteRefereeAccrualDocument(
  documentId,
  payload = {},
  actorId = null
) {
  const reasonCode = trimString(payload.reason_code, 64);
  if (!reasonCode) throw new ServiceError('reason_code_required', 400);
  const comment = trimString(payload.comment, 1000);

  await sequelize.transaction(async (tx) => {
    const refData = await loadRefData(tx);
    const draftStatus = requireRefAlias(
      refData.documentStatusByAlias,
      'DRAFT',
      'invalid_accrual_status'
    );
    const accruedStatus = requireRefAlias(
      refData.documentStatusByAlias,
      'ACCRUED',
      'invalid_accrual_status'
    );
    const deletedStatus = requireRefAlias(
      refData.documentStatusByAlias,
      'DELETED',
      'invalid_accrual_status'
    );

    const doc = await RefereeAccrualDocument.findByPk(documentId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!doc) throw new ServiceError('accrual_document_not_found', 404);
    const allowedStatusIds = new Set([
      String(draftStatus.id),
      String(accruedStatus.id),
    ]);
    if (!allowedStatusIds.has(String(doc.document_status_id))) {
      throw new ServiceError('accrual_delete_forbidden_status', 409);
    }

    const activeAdjustments = await RefereeAccrualDocument.count({
      where: {
        original_document_id: doc.id,
        document_status_id: { [Op.ne]: deletedStatus.id },
      },
      transaction: tx,
    });
    if (activeAdjustments > 0) {
      throw new ServiceError('accrual_delete_has_adjustments', 409);
    }

    const before = doc.get({ plain: true });
    const postingRows = await listDocumentPostingRows(doc.id, tx);
    const hasAdjustmentPostings = postingRows.some((row) => {
      const postingType = refData.postingTypeById.get(
        String(row.posting_type_id || '')
      );
      return String(postingType?.alias || '').toUpperCase() === 'ADJUSTMENT';
    });
    if (hasAdjustmentPostings) {
      throw new ServiceError('accrual_delete_has_adjustments', 409);
    }
    const currentTotals = sumPostingComponents(postingRows, refData);
    const maxLineNo = postingRows.reduce(
      (max, row) => Math.max(max, Number(row.line_no || 0)),
      0
    );

    if (
      currentTotals.baseCents !== 0 ||
      currentTotals.mealCents !== 0 ||
      currentTotals.travelCents !== 0
    ) {
      await createPostingRows({
        documentId: doc.id,
        postingTypeAlias: 'REVERSAL',
        baseCents: -currentTotals.baseCents,
        mealCents: -currentTotals.mealCents,
        travelCents: -currentTotals.travelCents,
        actorId,
        reasonCode,
        comment,
        transaction: tx,
        refData,
        startLineNo: maxLineNo + 1,
      });
    }

    await doc.update(
      {
        document_status_id: deletedStatus.id,
        base_amount_rub: '0.00',
        meal_amount_rub: '0.00',
        travel_amount_rub: '0.00',
        total_amount_rub: '0.00',
        updated_by: actorId,
      },
      { transaction: tx, returning: false }
    );

    await writeAuditEvent({
      entityType: 'REFEREE_ACCRUAL_DOCUMENT',
      entityId: doc.id,
      action: 'ACTION_DELETE',
      before,
      after: {
        ...doc.get({ plain: true }),
        reason_code: reasonCode,
        comment: comment || null,
      },
      actorId,
      transaction: tx,
    });
  });

  return getRefereeAccrualDocument(documentId);
}

async function bulkDeleteRefereeAccrualDocuments({
  ids = [],
  selectionMode = 'explicit',
  filters = null,
  reasonCode,
  comment = null,
  actorId = null,
}) {
  const uniqueIds = await resolveBulkAccrualIds({
    ids,
    selectionMode,
    filters,
  });

  const results = [];
  for (const id of uniqueIds) {
    try {
      await deleteRefereeAccrualDocument(
        id,
        {
          reason_code: reasonCode,
          comment,
        },
        actorId
      );
      results.push({ id, ok: true });
    } catch (error) {
      results.push({
        id,
        ok: false,
        error: error?.code || 'bulk_delete_failed',
        message: error?.message || null,
      });
    }
  }

  return {
    total: uniqueIds.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

async function createRefereeAccrualAdjustment(
  documentId,
  payload = {},
  actorId = null
) {
  const baseCents = normalizeRubToCents(payload.base_amount_rub || 0, {
    allowNegative: true,
    code: 'invalid_base_amount',
  });
  const mealCents = normalizeRubToCents(payload.meal_amount_rub || 0, {
    allowNegative: true,
    code: 'invalid_meal_amount',
  });
  const travelCents = normalizeRubToCents(payload.travel_amount_rub || 0, {
    allowNegative: true,
    code: 'invalid_travel_amount',
  });
  if (baseCents === 0 && mealCents === 0 && travelCents === 0) {
    throw new ServiceError('empty_adjustment', 400);
  }

  const reasonCode = trimString(payload.reason_code, 64);
  if (!reasonCode) throw new ServiceError('reason_code_required', 400);
  const comment = trimString(payload.comment, 1000);

  await sequelize.transaction(async (tx) => {
    const refData = await loadRefData(tx);
    const accruedStatus = requireRefAlias(
      refData.documentStatusByAlias,
      'ACCRUED',
      'invalid_accrual_status'
    );

    const document = await RefereeAccrualDocument.findByPk(documentId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!document) {
      throw new ServiceError('accrual_document_not_found', 404);
    }
    if (String(document.document_status_id) !== String(accruedStatus.id)) {
      throw new ServiceError('accrual_adjustment_forbidden_status', 409);
    }

    const before = document.get({ plain: true });
    const postingRows = await listDocumentPostingRows(document.id, tx);
    const maxLineNo = postingRows.reduce(
      (max, row) => Math.max(max, Number(row.line_no || 0)),
      0
    );

    await createPostingRows({
      documentId: document.id,
      postingTypeAlias: 'ADJUSTMENT',
      baseCents,
      mealCents,
      travelCents,
      actorId,
      reasonCode,
      comment,
      transaction: tx,
      refData,
      startLineNo: maxLineNo + 1,
    });

    const nextPostingRows = [
      ...postingRows,
      {
        line_no: maxLineNo + 1,
        component_id: refData.componentByAlias.get('BASE')?.id,
        amount_rub: centsToRub(baseCents),
      },
      {
        line_no: maxLineNo + 2,
        component_id: refData.componentByAlias.get('MEAL')?.id,
        amount_rub: centsToRub(mealCents),
      },
      {
        line_no: maxLineNo + 3,
        component_id: refData.componentByAlias.get('TRAVEL')?.id,
        amount_rub: centsToRub(travelCents),
      },
    ].filter((row) => row.component_id);

    await syncAccrualDocumentAmounts({
      document,
      postingRows: nextPostingRows,
      actorId,
      transaction: tx,
      refData,
      documentStatusId: accruedStatus.id,
    });

    await writeAuditEvent({
      entityType: 'REFEREE_ACCRUAL_DOCUMENT',
      entityId: document.id,
      action: 'CREATE_ADJUSTMENT',
      before,
      after: {
        ...document.get({ plain: true }),
        reason_code: reasonCode,
        comment: comment || null,
      },
      actorId,
      transaction: tx,
    });
  });

  return getRefereeAccrualDocument(documentId);
}

async function exportRefereeAccrualsCsv(filters = {}) {
  const data = await listRefereeAccrualDocuments({
    ...filters,
    page: 1,
    limit: Math.min(Number(filters.limit || 5000), 5000),
  });

  const headers = [
    'Номер начисления',
    'Статус',
    'Источник',
    'Дата матча',
    'Турнир',
    'Матч',
    'Судья',
    'Амплуа',
    'Группа этапа',
    'Арена',
    'Код тарифа',
    'База (₽)',
    'Питание (₽)',
    'Проезд (₽)',
    'Итого (₽)',
  ];

  const rows = data.rows.map((row) => {
    const homeTeam = row.Match?.HomeTeam?.name || '';
    const awayTeam = row.Match?.AwayTeam?.name || '';
    const referee = [
      row.Referee?.last_name,
      row.Referee?.first_name,
      row.Referee?.patronymic,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return [
      row.accrual_number || '',
      row.DocumentStatus?.name_ru || row.DocumentStatus?.alias || '',
      row.Source?.name_ru || row.Source?.alias || '',
      row.match_date_snapshot || '',
      row.Tournament?.name || '',
      [homeTeam, awayTeam].filter(Boolean).join(' - '),
      referee,
      row.RefereeRole?.name || '',
      row.TournamentGroup?.name || '',
      row.Ground?.name || '',
      row.fare_code_snapshot || '',
      row.base_amount_rub ?? '',
      row.meal_amount_rub ?? '',
      row.travel_amount_rub ?? '',
      row.total_amount_rub ?? '',
    ];
  });

  return {
    headers,
    rows,
  };
}

async function fetchTournamentPaymentRegistryRows({
  tournamentId,
  dateFrom = null,
  dateTo = null,
  taxationTypeAlias = null,
}) {
  await ensureTournamentExists(tournamentId);

  const normalizedDateFrom = normalizeOptionalDateOnly(
    dateFrom,
    'invalid_date_from'
  );
  const normalizedDateTo = normalizeOptionalDateOnly(dateTo, 'invalid_date_to');
  ensureDateOrder(
    normalizedDateFrom || '1900-01-01',
    normalizedDateTo || null,
    'invalid_date_range'
  );

  const normalizedTaxationTypeAlias =
    normalizeTaxationTypeAlias(taxationTypeAlias);

  const taxationTypes = await sequelize.query(
    `SELECT alias, name
       FROM taxation_types
      WHERE deleted_at IS NULL
      ORDER BY name ASC`,
    { type: QueryTypes.SELECT }
  );
  const taxationTypeOptions = taxationTypes.map((item) => ({
    alias: String(item.alias || ''),
    name: String(item.name || ''),
  }));

  if (
    normalizedTaxationTypeAlias &&
    !taxationTypeOptions.some(
      (item) => item.alias === normalizedTaxationTypeAlias
    )
  ) {
    throw new ServiceError('invalid_taxation_type_alias', 400);
  }

  const whereSql = [
    'd.deleted_at IS NULL',
    'd.tournament_id = :tournamentId',
    'status.alias = \'ACCRUED\'',
  ];
  const replacements = { tournamentId };

  if (normalizedDateFrom) {
    whereSql.push('d.match_date_snapshot >= :dateFrom');
    replacements.dateFrom = normalizedDateFrom;
  }
  if (normalizedDateTo) {
    whereSql.push('d.match_date_snapshot <= :dateTo');
    replacements.dateTo = normalizedDateTo;
  }
  if (normalizedTaxationTypeAlias) {
    whereSql.push('tax_type.alias = :taxationTypeAlias');
    replacements.taxationTypeAlias = normalizedTaxationTypeAlias;
  }

  const rawRows = await sequelize.query(
    `SELECT
       d.referee_id,
       COALESCE(u.last_name, '') AS last_name,
       COALESCE(u.first_name, '') AS first_name,
       COALESCE(u.patronymic, '') AS patronymic,
       inn.number AS inn,
       u.phone AS phone,
       bank.number AS bank_account_number,
       bank.bic AS bic,
       bank.correspondent_account AS correspondent_account,
       tax_type.alias AS taxation_type_alias,
       tax_type.name AS taxation_type,
       CAST(SUM(CAST(d.total_amount_rub AS numeric(14, 2))) AS numeric(14, 2)) AS total_amount_rub
     FROM referee_accrual_documents d
     INNER JOIN referee_accrual_document_statuses status
       ON status.id = d.document_status_id
     LEFT JOIN users u
       ON u.id = d.referee_id
      AND u.deleted_at IS NULL
     LEFT JOIN inns inn
       ON inn.user_id = d.referee_id
      AND inn.deleted_at IS NULL
     LEFT JOIN bank_accounts bank
       ON bank.user_id = d.referee_id
      AND bank.deleted_at IS NULL
     LEFT JOIN taxations tax
       ON tax.user_id = d.referee_id
      AND tax.deleted_at IS NULL
     LEFT JOIN taxation_types tax_type
       ON tax_type.id = tax.taxation_type_id
      AND tax_type.deleted_at IS NULL
    WHERE ${whereSql.join('\n      AND ')}
    GROUP BY
      d.referee_id,
      u.last_name,
      u.first_name,
      u.patronymic,
      inn.number,
      u.phone,
      bank.number,
      bank.bic,
      bank.correspondent_account,
      tax_type.alias,
      tax_type.name
    ORDER BY
      COALESCE(u.last_name, '') ASC,
      COALESCE(u.first_name, '') ASC,
      COALESCE(u.patronymic, '') ASC`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  const rows = rawRows.map((row) => {
    const normalizedRow = {
      referee_id: row.referee_id,
      last_name: normalizeString(row.last_name) || null,
      first_name: normalizeString(row.first_name) || null,
      patronymic: normalizeString(row.patronymic) || null,
      inn: normalizeString(row.inn) || null,
      phone: normalizeString(row.phone) || null,
      bank_account_number: normalizeString(row.bank_account_number) || null,
      bic: normalizeString(row.bic) || null,
      correspondent_account: normalizeString(row.correspondent_account) || null,
      total_amount_rub: centsToRub(dbRubToCents(row.total_amount_rub || '0')),
      taxation_type_alias: normalizeString(row.taxation_type_alias) || null,
      taxation_type: normalizeString(row.taxation_type) || null,
    };
    normalizedRow.missing_fields =
      buildPaymentRegistryMissingFields(normalizedRow);
    return normalizedRow;
  });

  return {
    rows,
    taxationTypes: taxationTypeOptions,
  };
}

async function listTournamentPaymentRegistry({
  tournamentId,
  page = 1,
  limit = 50,
  dateFrom = null,
  dateTo = null,
  taxationTypeAlias = null,
}) {
  const {
    page: normalizedPage,
    limit: normalizedLimit,
    offset,
  } = parsePagination(page, limit, 50, 500);
  const { rows, taxationTypes } = await fetchTournamentPaymentRegistryRows({
    tournamentId,
    dateFrom,
    dateTo,
    taxationTypeAlias,
  });

  const summary = rows.reduce(
    (acc, row) => {
      const hasMissingFields = row.missing_fields.length > 0;
      acc.referees_total += 1;
      if (hasMissingFields) {
        acc.incomplete_total += 1;
      } else {
        acc.ready_total += 1;
      }
      acc.total_amount_cents += dbRubToCents(row.total_amount_rub);
      return acc;
    },
    {
      referees_total: 0,
      ready_total: 0,
      incomplete_total: 0,
      total_amount_cents: 0,
    }
  );

  return {
    rows: rows.slice(offset, offset + normalizedLimit),
    total: rows.length,
    page: normalizedPage,
    limit: normalizedLimit,
    summary: {
      referees_total: summary.referees_total,
      ready_total: summary.ready_total,
      incomplete_total: summary.incomplete_total,
      total_amount_rub: centsToRub(summary.total_amount_cents),
    },
    filter_options: {
      taxation_types: taxationTypes,
    },
  };
}

async function exportTournamentPaymentRegistryXlsx(filters = {}) {
  const { rows } = await fetchTournamentPaymentRegistryRows(filters);
  const tournament = await Tournament.findByPk(filters.tournamentId, {
    attributes: ['id', 'name'],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Реестр', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Фамилия', key: 'last_name', width: 18 },
    { header: 'Имя', key: 'first_name', width: 18 },
    { header: 'Отчество', key: 'patronymic', width: 20 },
    { header: 'ИНН', key: 'inn', width: 16 },
    { header: 'Телефон', key: 'phone', width: 16 },
    {
      header: 'Номер банковского счета',
      key: 'bank_account_number',
      width: 24,
    },
    { header: 'БИК', key: 'bic', width: 14 },
    { header: 'Корр. счет', key: 'correspondent_account', width: 24 },
    { header: 'Сумма', key: 'total_amount_rub', width: 14 },
    { header: 'Тип налогообложения', key: 'taxation_type', width: 28 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 10 },
  };

  for (const row of rows) {
    const added = sheet.addRow({
      ...row,
      total_amount_rub: Number(row.total_amount_rub),
    });
    added.getCell('total_amount_rub').numFmt = '0.00';
  }

  const totalAmountCents = rows.reduce(
    (sum, row) => sum + dbRubToCents(row.total_amount_rub),
    0
  );
  const totalRow = sheet.addRow({
    last_name: 'Итого',
    total_amount_rub: Number(centsToRub(totalAmountCents)),
  });
  totalRow.font = { bold: true };
  totalRow.getCell('total_amount_rub').numFmt = '0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: buildPaymentRegistryFilename(
      tournament?.name || filters.tournamentId,
      moscowTodayDateKey()
    ),
  };
}

async function getAccountingRefData() {
  const refData = await loadRefData();
  const statusTransitions = (refData.statusTransitions || []).map((item) => ({
    id: item.id,
    is_enabled: Boolean(item.is_enabled),
    from_status: item.FromStatus
      ? {
          id: item.FromStatus.id,
          alias: item.FromStatus.alias,
          name_ru: item.FromStatus.name_ru,
        }
      : null,
    to_status: item.ToStatus
      ? {
          id: item.ToStatus.id,
          alias: item.ToStatus.alias,
          name_ru: item.ToStatus.name_ru,
        }
      : null,
    action: item.Action
      ? {
          id: item.Action.id,
          alias: item.Action.alias,
          scope: item.Action.scope,
          name_ru: item.Action.name_ru,
          requires_comment: Boolean(item.Action.requires_comment),
        }
      : null,
  }));

  return {
    tariff_statuses: refData.tariffStatuses,
    travel_rate_statuses: refData.travelRateStatuses,
    document_statuses: refData.documentStatuses,
    accrual_sources: refData.sources,
    posting_types: refData.postingTypes,
    components: refData.components,
    actions: refData.actions,
    status_transitions: statusTransitions,
    generation_error_codes: [
      {
        alias: 'missing_stage_group',
        name_ru: 'У матча не указана группа этапа',
      },
      { alias: 'invalid_match_date', name_ru: 'Некорректная дата матча' },
      {
        alias: 'missing_tariff_rule',
        name_ru: 'Нет активного тарифа на дату матча',
      },
      { alias: 'missing_match_ground', name_ru: 'У матча не указана арена' },
      {
        alias: 'missing_ground_travel_rate',
        name_ru: 'Нет ставки проезда арены на дату матча',
      },
    ],
  };
}

export default {
  getTournamentPaymentsDashboard,
  listRefereeTariffRules,
  createRefereeTariffRule,
  updateRefereeTariffRule,
  fileRefereeTariffRule,
  activateRefereeTariffRule,
  retireRefereeTariffRule,

  listGroundTravelRates,
  createGroundTravelRate,
  updateGroundTravelRate,

  generateAccruals,
  listRefereeAccrualDocuments,
  getRefereeAccrualDocument,
  applyRefereeAccrualAction,
  applyRefereeAccrualActionBulk,
  deleteRefereeAccrualDocument,
  bulkDeleteRefereeAccrualDocuments,
  createRefereeAccrualAdjustment,
  exportRefereeAccrualsCsv,
  listTournamentPaymentRegistry,
  exportTournamentPaymentRegistryXlsx,
  getAccountingRefData,
};
