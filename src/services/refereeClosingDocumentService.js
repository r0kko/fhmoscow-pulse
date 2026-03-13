import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import {
  Tournament,
  User,
  Role,
  UserStatus,
  SignType,
  UserSignType,
  DocumentType,
  DocumentStatus,
  Document,
  DocumentUserSign,
  File,
  Team,
  Match,
  Ground,
  RefereeRole,
  TournamentGroup,
  RefereeAccrualDocument,
  RefereeAccrualDocumentStatus,
  RefereeClosingDocumentProfile,
  RefereeClosingDocument,
  RefereeClosingDocumentItem,
  Address,
  AddressType,
  Inn,
  Taxation,
  TaxationType,
  UserAddress,
  AccountingAuditEvent,
} from '../models/index.js';

import fileService from './fileService.js';
import accountingService from './refereeAccountingService.js';

const CLOSING_DOC_ALIAS = 'REFEREE_CLOSING_ACT';
const REFEREE_CONTRACT_ALIAS = 'REFEREE_CONTRACT_APPLICATION';
const SIMPLE_SIGN_ALIAS = 'SIMPLE_ELECTRONIC';
const FHMO_SIGNER_ROLE_ALIASES = [
  'FHMO_JUDGING_LEAD_SPECIALIST',
  'FHMO_JUDGING_HEAD',
  'FHMO_JUDGING_SPECIALIST',
];
const ACTIVE_ACT_STATUSES = ['DRAFT', 'AWAITING_SIGNATURE', 'POSTED'];
const MUTABLE_ACT_STATUSES = ['DRAFT', 'AWAITING_SIGNATURE'];
const VAT_LABEL = 'Без налога (НДС)';
const SERVICE_UNIT_LABEL = 'усл.';
const FILTERED_SELECTION_PAGE_LIMIT = 1000;

function normalizeString(value) {
  return String(value ?? '').trim();
}

function fullName(user) {
  return [user?.last_name, user?.first_name, user?.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function parsePagination(pageRaw, limitRaw, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, Number.parseInt(String(pageRaw || '1'), 10) || 1);
  const limit = Math.max(
    1,
    Math.min(
      maxLimit,
      Number.parseInt(String(limitRaw || ''), 10) || defaultLimit
    )
  );
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function formatRub(value) {
  const number = Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
}

function formatDateLabel(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU');
}

function formatDateTimeLabel(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function capitalizeFirst(text) {
  const value = normalizeString(text);
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getPluralForm(number, forms) {
  const value = Math.abs(Number(number) || 0) % 100;
  const tail = value % 10;
  if (value > 10 && value < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

function numberToWordsRu(value, feminine = false) {
  const number = Math.trunc(Number(value) || 0);
  if (!number) return 'ноль';

  const unitsMale = [
    '',
    'один',
    'два',
    'три',
    'четыре',
    'пять',
    'шесть',
    'семь',
    'восемь',
    'девять',
    'десять',
    'одиннадцать',
    'двенадцать',
    'тринадцать',
    'четырнадцать',
    'пятнадцать',
    'шестнадцать',
    'семнадцать',
    'восемнадцать',
    'девятнадцать',
  ];
  const unitsFemale = [
    '',
    'одна',
    'две',
    'три',
    'четыре',
    'пять',
    'шесть',
    'семь',
    'восемь',
    'девять',
    'десять',
    'одиннадцать',
    'двенадцать',
    'тринадцать',
    'четырнадцать',
    'пятнадцать',
    'шестнадцать',
    'семнадцать',
    'восемнадцать',
    'девятнадцать',
  ];
  const tens = [
    '',
    '',
    'двадцать',
    'тридцать',
    'сорок',
    'пятьдесят',
    'шестьдесят',
    'семьдесят',
    'восемьдесят',
    'девяносто',
  ];
  const hundreds = [
    '',
    'сто',
    'двести',
    'триста',
    'четыреста',
    'пятьсот',
    'шестьсот',
    'семьсот',
    'восемьсот',
    'девятьсот',
  ];
  const ranks = [
    { feminine, forms: ['', '', ''] },
    { feminine: true, forms: ['тысяча', 'тысячи', 'тысяч'] },
    { feminine: false, forms: ['миллион', 'миллиона', 'миллионов'] },
    { feminine: false, forms: ['миллиард', 'миллиарда', 'миллиардов'] },
  ];

  const parts = [];
  let rankIndex = 0;
  let rest = number;
  while (rest > 0) {
    const chunk = rest % 1000;
    if (chunk) {
      const words = [];
      const rank = ranks[rankIndex] || ranks[ranks.length - 1];
      const unitWords = rank.feminine ? unitsFemale : unitsMale;
      const hundred = Math.trunc(chunk / 100);
      const tensUnits = chunk % 100;
      const tensDigit = Math.trunc(tensUnits / 10);
      if (hundred) words.push(hundreds[hundred]);
      if (tensUnits < 20) {
        if (tensUnits) words.push(unitWords[tensUnits]);
      } else {
        words.push(tens[tensDigit]);
        const unit = tensUnits % 10;
        if (unit) words.push(unitWords[unit]);
      }
      if (rankIndex > 0) {
        words.push(getPluralForm(chunk, rank.forms));
      }
      parts.unshift(words.filter(Boolean).join(' '));
    }
    rest = Math.trunc(rest / 1000);
    rankIndex += 1;
  }

  return parts.filter(Boolean).join(' ').trim();
}

function formatRubWords(value) {
  const normalized = Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(normalized)) return 'Ноль рублей 00 копеек';
  let rubles = Math.trunc(normalized);
  let kopeks = Math.round((normalized - rubles) * 100);
  if (kopeks === 100) {
    rubles += 1;
    kopeks = 0;
  }
  const words = numberToWordsRu(rubles);
  const rubleLabel = getPluralForm(rubles, ['рубль', 'рубля', 'рублей']);
  return capitalizeFirst(
    `${words} ${rubleLabel} ${String(kopeks).padStart(2, '0')} копеек`
  );
}

function sumRubAmounts(rows = [], key) {
  const total = rows.reduce((acc, row) => {
    const value = Number(String(row?.[key] ?? 0).replace(',', '.'));
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);
  return total.toFixed(2);
}

function writeAuditEvent({
  entityType,
  entityId,
  action,
  before,
  after,
  actorId,
  transaction,
}) {
  return AccountingAuditEvent.create(
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

async function safeRemoveGeneratedFile(fileId) {
  if (!fileId) return;
  try {
    await fileService.removeFile(fileId);
  } catch (error) {
    console.error('Failed to remove closing document file during rollback', {
      fileId,
      code: error?.code || null,
    });
  }
}

async function rollbackCreatedClosingDocument(actId, actorId) {
  if (!actId) return;
  const act = await RefereeClosingDocument.findOne({
    where: {
      id: actId,
      deleted_at: null,
    },
    include: [
      {
        model: Document,
        as: 'Document',
        attributes: ['id', 'file_id'],
        required: false,
      },
    ],
  });
  if (!act) return;

  const fileId = act.Document?.file_id || null;
  await sequelize.transaction(async (tx) => {
    await RefereeClosingDocumentItem.destroy({
      where: { closing_document_id: act.id },
      transaction: tx,
    });
    if (act.Document) {
      await act.Document.update(
        { updated_by: actorId },
        { transaction: tx, returning: false }
      );
      await act.Document.destroy({ transaction: tx });
    }
    await act.update(
      {
        deleted_by: actorId,
        updated_by: actorId,
      },
      { transaction: tx, returning: false, silent: true }
    );
    await act.destroy({ transaction: tx });
  });

  await safeRemoveGeneratedFile(fileId);
}

async function rollbackCreatedClosingDocumentsBatch(actIds, actorId) {
  const uniqueIds = [...new Set((actIds || []).filter(Boolean))].reverse();
  const results = await Promise.allSettled(
    uniqueIds.map((actId) => rollbackCreatedClosingDocument(actId, actorId))
  );
  const rollbackError = results.find((item) => item.status === 'rejected');
  if (rollbackError?.status === 'rejected') {
    console.error('Failed to rollback created closing document batch', {
      code: rollbackError.reason?.code || null,
      message: rollbackError.reason?.message || null,
    });
  }
}

async function rollbackClosingDocumentSend({
  actId,
  actorId,
  signerId,
  previousDocumentStatusId,
  previousActStatus,
  previousSentAt,
  previousSignerSnapshot,
  accrualIds,
}) {
  const [accruedStatus, act] = await Promise.all([
    ensureAccrualStatus('ACCRUED'),
    RefereeClosingDocument.findOne({
      where: {
        id: actId,
        deleted_at: null,
      },
      include: [
        {
          model: Document,
          as: 'Document',
          attributes: ['id', 'status_id'],
          required: false,
        },
      ],
    }),
  ]);
  if (!act) return;

  await sequelize.transaction(async (tx) => {
    await DocumentUserSign.destroy({
      where: {
        document_id: act.document_id,
        user_id: signerId,
      },
      transaction: tx,
    });
    if (act.Document) {
      await act.Document.update(
        {
          status_id: previousDocumentStatusId,
          updated_by: actorId,
        },
        { transaction: tx, returning: false }
      );
    }
    await act.update(
      {
        status: previousActStatus,
        sent_at: previousSentAt,
        fhmo_signer_snapshot_json: previousSignerSnapshot,
        updated_by: actorId,
      },
      { transaction: tx, returning: false }
    );
    if (accrualIds.length) {
      await RefereeAccrualDocument.update(
        {
          document_status_id: accruedStatus.id,
          updated_by: actorId,
        },
        {
          where: {
            id: { [Op.in]: accrualIds },
          },
          transaction: tx,
        }
      );
    }
  });

  try {
    const { default: documentService } = await import('./documentService.js');
    await documentService.regenerate(act.document_id, actorId);
  } catch (error) {
    console.error(
      'Failed to regenerate draft closing document after rollback',
      {
        actId,
        documentId: act.document_id,
        actorId,
        code: error?.code || null,
      }
    );
  }
}

async function ensureTournamentExists(tournamentId) {
  const tournament = await Tournament.findByPk(tournamentId, {
    attributes: ['id', 'name'],
  });
  if (!tournament) throw new ServiceError('tournament_not_found', 404);
  return tournament;
}

function normalizeOrganizationSuggestion(payload = {}) {
  const suggestion = payload?.organization || payload;
  const inn = normalizeString(
    suggestion?.data?.inn || suggestion?.inn || payload?.inn || ''
  );
  if (!/^\d{10}$/.test(inn)) {
    throw new ServiceError('invalid_organizer_inn', 400);
  }

  const name =
    normalizeString(suggestion?.data?.name?.full_with_opf) ||
    normalizeString(suggestion?.value) ||
    normalizeString(suggestion?.organization_name);
  if (!name) throw new ServiceError('invalid_organizer_payload', 400);

  const address =
    normalizeString(suggestion?.data?.address?.unrestricted_value) ||
    normalizeString(suggestion?.unrestricted_value) ||
    normalizeString(payload?.organizer_address);

  return {
    organizer_inn: inn,
    organizer_name: name,
    organizer_short_name:
      normalizeString(suggestion?.data?.name?.short_with_opf) || null,
    organizer_kpp: normalizeString(suggestion?.data?.kpp) || null,
    organizer_ogrn: normalizeString(suggestion?.data?.ogrn) || null,
    organizer_address: address || null,
    organizer_json: {
      value: suggestion?.value || null,
      unrestricted_value: suggestion?.unrestricted_value || null,
      data: suggestion?.data || null,
    },
    dadata_payload: suggestion,
  };
}

async function ensureDocumentType(alias, transaction = null) {
  const documentType = await DocumentType.findOne({
    where: { alias },
    transaction,
  });
  if (!documentType) throw new ServiceError('document_type_not_found', 500);
  return documentType;
}

async function ensureDocumentStatus(alias, transaction = null) {
  const status = await DocumentStatus.findOne({
    where: { alias },
    transaction,
  });
  if (!status) throw new ServiceError('document_status_not_found', 500);
  return status;
}

async function ensureAccrualStatus(alias, transaction = null) {
  const status = await RefereeAccrualDocumentStatus.findOne({
    where: { alias, is_active: true },
    transaction,
  });
  if (!status) throw new ServiceError('accrual_status_not_found', 500);
  return status;
}

async function ensureSimpleSignType(transaction = null) {
  const signType = await SignType.findOne({
    where: { alias: SIMPLE_SIGN_ALIAS },
    transaction,
  });
  if (!signType) throw new ServiceError('sign_type_not_found', 500);
  return signType;
}

async function findActiveFhmoSigner(transaction = null) {
  const signs = await UserSignType.findAll({
    where: {},
    include: [
      {
        model: SignType,
        attributes: ['id', 'alias', 'name'],
        where: { alias: SIMPLE_SIGN_ALIAS },
        required: true,
      },
      {
        model: User,
        attributes: ['id', 'email', 'last_name', 'first_name', 'patronymic'],
        required: true,
        include: [
          {
            model: Role,
            attributes: ['alias', 'name', 'departmentName', 'displayOrder'],
            through: { attributes: [] },
            where: { alias: { [Op.in]: FHMO_SIGNER_ROLE_ALIASES } },
            required: true,
          },
          {
            model: UserStatus,
            attributes: ['alias'],
            where: { alias: 'ACTIVE' },
            required: true,
          },
        ],
      },
    ],
    order: [['sign_created_date', 'DESC']],
    subQuery: false,
    transaction,
  });

  const candidates = signs
    .map((sign) => {
      const signer = sign.User;
      const role = (signer?.Roles || [])
        .filter((item) => FHMO_SIGNER_ROLE_ALIASES.includes(item.alias))
        .sort((left, right) => {
          const leftPriority = FHMO_SIGNER_ROLE_ALIASES.indexOf(left.alias);
          const rightPriority = FHMO_SIGNER_ROLE_ALIASES.indexOf(right.alias);
          if (leftPriority !== rightPriority)
            return leftPriority - rightPriority;
          return (left.displayOrder || 999999) - (right.displayOrder || 999999);
        })[0];
      if (!signer?.id || !role) return null;
      return {
        signer,
        signerRole: role,
        signerSign: sign,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftPriority = FHMO_SIGNER_ROLE_ALIASES.indexOf(
        left.signerRole.alias
      );
      const rightPriority = FHMO_SIGNER_ROLE_ALIASES.indexOf(
        right.signerRole.alias
      );
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return fullName(left.signer).localeCompare(fullName(right.signer), 'ru');
    });

  return candidates[0] || null;
}

function buildProfileSnapshot(profile) {
  return {
    inn: profile?.organizer_inn || null,
    name: profile?.organizer_name || null,
    short_name: profile?.organizer_short_name || null,
    kpp: profile?.organizer_kpp || null,
    ogrn: profile?.organizer_ogrn || null,
    address: profile?.organizer_address || null,
  };
}

function buildPostalAddress(address) {
  const result = normalizeString(address?.result || '');
  if (!result) return null;
  const postalCode = normalizeString(address?.postal_code || '');
  return postalCode ? `${postalCode}, ${result}` : result;
}

function pickPrimaryAddress(addresses = []) {
  const registration = addresses.find(
    (item) => item.AddressType?.alias === 'REGISTRATION'
  );
  if (registration?.Address) return registration;
  const residence = addresses.find(
    (item) => item.AddressType?.alias === 'RESIDENCE'
  );
  if (residence?.Address) return residence;
  return null;
}

function buildContractSnapshot(contractDocument) {
  if (!contractDocument) return null;
  return {
    document_id: contractDocument.id || null,
    number: contractDocument.number || null,
    document_date:
      contractDocument.document_date || contractDocument.created_at || null,
    title:
      contractDocument.name ||
      contractDocument.DocumentType?.name ||
      'Заявление о присоединении к условиям договора',
  };
}

function normalizeSelectionPayload(payload = {}) {
  const selectionMode =
    normalizeString(payload.selection_mode || 'explicit').toLowerCase() ||
    'explicit';
  if (!['explicit', 'filtered'].includes(selectionMode)) {
    throw new ServiceError('invalid_closing_selection_mode', 400);
  }

  const filters =
    payload?.filters && typeof payload.filters === 'object'
      ? {
          status:
            normalizeString(payload.filters.status || 'ACCRUED') || 'ACCRUED',
          search: normalizeString(payload.filters.search || '') || undefined,
          number: normalizeString(payload.filters.number || '') || undefined,
          fareCode:
            normalizeString(
              payload.filters.fare_code || payload.filters.fareCode || ''
            ) || undefined,
          refereeRoleId:
            normalizeString(
              payload.filters.referee_role_id ||
                payload.filters.refereeRoleId ||
                ''
            ) || undefined,
          stageGroupId:
            normalizeString(
              payload.filters.stage_group_id ||
                payload.filters.stageGroupId ||
                ''
            ) || undefined,
          groundId:
            normalizeString(
              payload.filters.ground_id || payload.filters.groundId || ''
            ) || undefined,
          dateFrom:
            normalizeString(
              payload.filters.date_from || payload.filters.dateFrom || ''
            ) || undefined,
          dateTo:
            normalizeString(
              payload.filters.date_to || payload.filters.dateTo || ''
            ) || undefined,
          amountFrom:
            normalizeString(
              payload.filters.amount_from || payload.filters.amountFrom || ''
            ) || undefined,
          amountTo:
            normalizeString(
              payload.filters.amount_to || payload.filters.amountTo || ''
            ) || undefined,
        }
      : {
          status: 'ACCRUED',
        };

  const accrualIds = [
    ...new Set(
      (Array.isArray(payload.accrual_ids) ? payload.accrual_ids : [])
        .map((id) => normalizeString(id))
        .filter(Boolean)
    ),
  ];

  if (selectionMode === 'explicit' && !accrualIds.length) {
    throw new ServiceError('closing_document_ids_required', 400);
  }

  return {
    selectionMode,
    filters,
    accrualIds,
  };
}

function normalizeDocumentSelectionPayload(payload = {}) {
  const selectionMode =
    normalizeString(payload.selection_mode || 'explicit').toLowerCase() ||
    'explicit';
  if (!['explicit', 'filtered'].includes(selectionMode)) {
    throw new ServiceError('invalid_closing_selection_mode', 400);
  }

  const filters =
    payload?.filters && typeof payload.filters === 'object'
      ? {
          status: normalizeString(payload.filters.status || '') || undefined,
          search: normalizeString(payload.filters.search || '') || undefined,
        }
      : {};

  const documentIds = [
    ...new Set(
      (Array.isArray(payload.closing_document_ids)
        ? payload.closing_document_ids
        : []
      )
        .map((id) => normalizeString(id))
        .filter(Boolean)
    ),
  ];

  if (selectionMode === 'explicit' && !documentIds.length) {
    throw new ServiceError('closing_document_ids_required', 400);
  }

  return {
    selectionMode,
    filters,
    documentIds,
  };
}

async function loadFilteredSelectionAccrualIds(tournamentId, filters = {}) {
  const selectedIds = [];
  let page = 1;
  let total = 0;
  let totalAmountRub = '0.00';

  while (true) {
    const response = await accountingService.listRefereeAccrualDocuments({
      tournamentId,
      page,
      limit: FILTERED_SELECTION_PAGE_LIMIT,
      status: filters.status || 'ACCRUED',
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
    if (!total) {
      total = Number(response.count || 0);
      totalAmountRub = String(response.summary?.total_amount_rub || '0.00');
    }
    for (const row of response.rows || []) {
      selectedIds.push(row.id);
    }
    if (selectedIds.length >= total || !(response.rows || []).length) break;
    page += 1;
  }

  if (!selectedIds.length) {
    throw new ServiceError('closing_document_ids_required', 400);
  }

  return {
    accrualIds: selectedIds,
    total,
    totalAmountRub,
  };
}

async function resolveSelectionAccrualIds(tournamentId, payload = {}) {
  const selection = normalizeSelectionPayload(payload);
  if (selection.selectionMode === 'filtered') {
    const filtered = await loadFilteredSelectionAccrualIds(
      tournamentId,
      selection.filters
    );
    return {
      ...selection,
      accrualIds: filtered.accrualIds,
      total: filtered.total,
      totalAmountRub: filtered.totalAmountRub,
    };
  }
  return {
    ...selection,
    total: selection.accrualIds.length,
    totalAmountRub: null,
  };
}

function buildClosingDocumentWhere(tournamentId, filters = {}, extra = {}) {
  const where = {
    tournament_id: tournamentId,
    deleted_at: null,
  };

  if (extra.ids?.length) {
    where.id = { [Op.in]: extra.ids };
  }

  const status = normalizeString(extra.statusOverride ?? filters.status ?? '');
  if (status) {
    where.status = status;
  }

  const search = normalizeString(filters.search || '');
  if (search) {
    where[Op.or] = [
      {
        '$Referee.last_name$': {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        '$Referee.first_name$': {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        '$Document.number$': {
          [Op.iLike]: `%${search}%`,
        },
      },
    ];
  }

  return where;
}

async function loadFilteredSelectionClosingDocumentIds(
  tournamentId,
  filters = {}
) {
  const selectedIds = [];
  let page = 1;
  let total = 0;

  while (true) {
    const data = await listClosingDocuments(tournamentId, {
      page,
      limit: FILTERED_SELECTION_PAGE_LIMIT,
      search: filters.search,
      status: filters.status || 'DRAFT',
    });
    if (!total) {
      total = Number(data.total || 0);
    }
    for (const row of data.rows || []) {
      if (row.status === 'DRAFT') {
        selectedIds.push(row.id);
      }
    }
    if (selectedIds.length >= total || !(data.rows || []).length) break;
    page += 1;
  }

  if (!selectedIds.length) {
    throw new ServiceError('closing_document_no_draft_documents', 409);
  }

  return {
    documentIds: selectedIds,
    total,
  };
}

async function resolveSelectionClosingDocumentIds(tournamentId, payload = {}) {
  const selection = normalizeDocumentSelectionPayload(payload);
  if (selection.selectionMode === 'filtered') {
    const filtered = await loadFilteredSelectionClosingDocumentIds(
      tournamentId,
      selection.filters
    );
    return {
      ...selection,
      documentIds: filtered.documentIds,
      total: filtered.total,
    };
  }
  return {
    ...selection,
    total: selection.documentIds.length,
  };
}

function buildRefereeSnapshot(user, innRecord, taxation, addressRecord) {
  const address = addressRecord?.Address || null;
  return {
    id: user?.id || null,
    full_name: fullName(user) || null,
    email: user?.email || null,
    inn: innRecord?.number || null,
    address: buildPostalAddress(address),
    address_type_alias: addressRecord?.AddressType?.alias || null,
    taxation_type_alias: taxation?.TaxationType?.alias || null,
    taxation_type_name: taxation?.TaxationType?.name || null,
    vat_label: VAT_LABEL,
  };
}

function buildSignerSnapshot(candidate) {
  if (!candidate?.signer) return null;
  return {
    id: candidate.signer.id,
    full_name: fullName(candidate.signer) || null,
    email: candidate.signer.email || null,
    position: candidate.signerRole?.name || null,
    department: candidate.signerRole?.departmentName || null,
    organization: 'РОО "Федерация хоккея Москвы"',
    role_alias: candidate.signerRole?.alias || null,
  };
}

function resolveTariffLabel(accrual) {
  return (
    normalizeString(accrual?.RefereeTariffRule?.fare_code || '') ||
    normalizeString(accrual?.fare_code_snapshot || '') ||
    'Тариф не указан'
  );
}

function buildServiceDescription(accrual) {
  const date = formatDateLabel(accrual?.match_date_snapshot);
  const matchLabel = normalizeString(
    [accrual?.Match?.HomeTeam?.name, accrual?.Match?.AwayTeam?.name]
      .filter(Boolean)
      .join(' - ')
  );
  const tournamentName = normalizeString(accrual?.Tournament?.name || '');
  const roleName = normalizeString(accrual?.RefereeRole?.name || '');
  const fragments = [
    'Оказание услуг по судейству хоккейного матча',
    matchLabel ? `«${matchLabel}»` : null,
    tournamentName ? `в рамках турнира «${tournamentName}»` : null,
    date ? `от ${date}` : null,
    roleName ? `в роли «${roleName}»` : null,
  ].filter(Boolean);
  return fragments.join(' ');
}

function buildAccrualItemSnapshot(accrual, lineNo) {
  const competitionName = accrual.Tournament?.name || null;
  const matchLabel = [
    accrual.Match?.HomeTeam?.name,
    accrual.Match?.AwayTeam?.name,
  ]
    .filter(Boolean)
    .join(' - ');
  return {
    line_no: lineNo,
    accrual_id: accrual.id,
    accrual_number: accrual.accrual_number,
    match_date_snapshot: accrual.match_date_snapshot,
    fare_code_snapshot: accrual.fare_code_snapshot,
    total_amount_rub: formatRub(accrual.total_amount_rub),
    base_amount_rub: formatRub(accrual.base_amount_rub),
    meal_amount_rub: formatRub(accrual.meal_amount_rub),
    travel_amount_rub: formatRub(accrual.travel_amount_rub),
    tournament_name: accrual.Tournament?.name || null,
    referee_role_name: accrual.RefereeRole?.name || null,
    stage_group_name: accrual.TournamentGroup?.name || null,
    ground_name: accrual.Ground?.name || null,
    match_label: matchLabel,
    service_datetime:
      formatDateTimeLabel(accrual.Match?.date_start) ||
      formatDateLabel(accrual.match_date_snapshot),
    competition_name: competitionName,
    role_name: accrual.RefereeRole?.name || null,
    tariff_label: resolveTariffLabel(accrual),
    amount_rub: formatRub(accrual.total_amount_rub),
    service_name: buildServiceDescription(accrual),
    quantity: 1,
    unit_label: SERVICE_UNIT_LABEL,
    price_rub: formatRub(accrual.total_amount_rub),
  };
}

function buildTotalsFromAccruals(accruals = []) {
  const totalAmountRub = sumRubAmounts(accruals, 'total_amount_rub');
  return {
    items_count: accruals.length,
    base_amount_rub: sumRubAmounts(accruals, 'base_amount_rub'),
    meal_amount_rub: sumRubAmounts(accruals, 'meal_amount_rub'),
    travel_amount_rub: sumRubAmounts(accruals, 'travel_amount_rub'),
    total_amount_rub: totalAmountRub,
    vat_label: VAT_LABEL,
    total_amount_words: formatRubWords(totalAmountRub),
  };
}

async function getRefereeSupportData(userIds = [], transaction = null) {
  const ids = [
    ...new Set(userIds.map((id) => normalizeString(id)).filter(Boolean)),
  ];
  if (!ids.length) {
    return {
      signByUserId: new Map(),
      agreementByUserId: new Map(),
      addressByUserId: new Map(),
      contractByUserId: new Map(),
      innByUserId: new Map(),
      taxationByUserId: new Map(),
    };
  }

  const [signs, agreements, contracts, addresses, inns, taxations] =
    await Promise.all([
      UserSignType.findAll({
        where: { user_id: { [Op.in]: ids } },
        include: [
          {
            model: SignType,
            attributes: ['id', 'alias', 'name'],
            where: { alias: SIMPLE_SIGN_ALIAS },
            required: true,
          },
        ],
        order: [['sign_created_date', 'DESC']],
        transaction,
      }),
      Document.findAll({
        where: { recipient_id: { [Op.in]: ids } },
        include: [
          {
            model: DocumentType,
            attributes: ['alias'],
            where: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT' },
            required: true,
          },
          {
            model: DocumentStatus,
            attributes: ['alias'],
            where: { alias: 'SIGNED' },
            required: true,
          },
        ],
        order: [['created_at', 'DESC']],
        transaction,
      }),
      Document.findAll({
        where: { recipient_id: { [Op.in]: ids } },
        include: [
          {
            model: DocumentType,
            attributes: ['alias', 'name'],
            where: { alias: REFEREE_CONTRACT_ALIAS },
            required: true,
          },
        ],
        order: [['created_at', 'DESC']],
        transaction,
      }),
      UserAddress.findAll({
        where: { user_id: { [Op.in]: ids } },
        include: [
          {
            model: Address,
            attributes: ['result', 'postal_code'],
            required: true,
          },
          {
            model: AddressType,
            attributes: ['alias', 'name'],
            required: true,
          },
        ],
        transaction,
      }),
      Inn.findAll({
        where: { user_id: { [Op.in]: ids } },
        transaction,
      }),
      Taxation.findAll({
        where: { user_id: { [Op.in]: ids } },
        include: [{ model: TaxationType, attributes: ['alias', 'name'] }],
        transaction,
      }),
    ]);

  const signByUserId = new Map();
  for (const sign of signs) {
    const key = String(sign.user_id);
    if (!signByUserId.has(key)) signByUserId.set(key, sign);
  }
  const agreementByUserId = new Map();
  for (const document of agreements) {
    const key = String(document.recipient_id);
    if (!agreementByUserId.has(key)) agreementByUserId.set(key, document);
  }
  const contractByUserId = new Map();
  for (const document of contracts) {
    const key = String(document.recipient_id);
    if (!contractByUserId.has(key)) contractByUserId.set(key, document);
  }
  const addressRowsByUserId = new Map();
  for (const row of addresses) {
    const key = String(row.user_id);
    if (!addressRowsByUserId.has(key)) addressRowsByUserId.set(key, []);
    addressRowsByUserId.get(key).push(row);
  }
  const addressByUserId = new Map();
  for (const [key, rows] of addressRowsByUserId.entries()) {
    addressByUserId.set(key, pickPrimaryAddress(rows));
  }
  const innByUserId = new Map(inns.map((item) => [String(item.user_id), item]));
  const taxationByUserId = new Map(
    taxations.map((item) => [String(item.user_id), item])
  );
  return {
    signByUserId,
    agreementByUserId,
    addressByUserId,
    contractByUserId,
    innByUserId,
    taxationByUserId,
  };
}

async function loadAccrualsForSelection(
  tournamentId,
  accrualIds,
  transaction = null
) {
  const ids = [
    ...new Set(
      (accrualIds || []).map((id) => normalizeString(id)).filter(Boolean)
    ),
  ];
  if (!ids.length) throw new ServiceError('closing_document_ids_required', 400);

  const rows = await RefereeAccrualDocument.findAll({
    where: {
      id: { [Op.in]: ids },
      tournament_id: tournamentId,
      deleted_at: null,
    },
    include: [
      {
        model: RefereeAccrualDocumentStatus,
        as: 'DocumentStatus',
        attributes: ['id', 'alias', 'name_ru'],
        required: true,
      },
      {
        model: User,
        as: 'Referee',
        attributes: ['id', 'email', 'last_name', 'first_name', 'patronymic'],
        required: true,
      },
      {
        model: RefereeRole,
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Tournament,
        attributes: ['id', 'name'],
        required: true,
      },
      {
        model: TournamentGroup,
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Ground,
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Match,
        attributes: ['id', 'date_start'],
        required: false,
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
        model: RefereeClosingDocumentItem,
        as: 'ClosingItem',
        required: false,
        include: [
          {
            model: RefereeClosingDocument,
            as: 'ClosingDocument',
            attributes: ['id', 'status'],
            required: true,
          },
        ],
      },
    ],
    order: [
      ['match_date_snapshot', 'ASC'],
      ['accrual_number', 'ASC'],
    ],
    transaction,
  });

  if (rows.length !== ids.length) {
    throw new ServiceError('closing_document_accrual_not_found', 404);
  }

  return rows;
}

async function buildPreviewResult(
  tournamentId,
  accrualIds,
  options = {},
  transaction = null
) {
  const [tournament, profile, signer, accruedStatus, rows] = await Promise.all([
    ensureTournamentExists(tournamentId),
    RefereeClosingDocumentProfile.findOne({
      where: { tournament_id: tournamentId },
      transaction,
    }),
    findActiveFhmoSigner(transaction),
    ensureAccrualStatus('ACCRUED', transaction),
    loadAccrualsForSelection(tournamentId, accrualIds, transaction),
  ]);

  const support = await getRefereeSupportData(
    rows.map((item) => item.referee_id),
    transaction
  );

  const grouped = new Map();
  for (const accrual of rows) {
    const key = String(accrual.referee_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(accrual);
  }

  const ready_groups = [];
  const blocked_groups = [];
  const profileIssues = [];
  if (!profile) profileIssues.push('missing_customer_profile');
  if (!signer) profileIssues.push('missing_fhmo_signer');

  for (const [refereeId, accruals] of grouped.entries()) {
    const referee = accruals[0].Referee;
    const sign = support.signByUserId.get(refereeId);
    const agreement = support.agreementByUserId.get(refereeId);
    const contract = support.contractByUserId.get(refereeId) || null;
    const addressRecord = support.addressByUserId.get(refereeId) || null;
    const innRecord = support.innByUserId.get(refereeId) || null;
    const taxation = support.taxationByUserId.get(refereeId) || null;
    const issues = [];

    if (!profile) issues.push('missing_customer_profile');
    if (!signer) issues.push('missing_fhmo_signer');
    if (!referee?.email) issues.push('missing_referee_email');
    if (!sign) issues.push('missing_simple_esign');
    if (!agreement) issues.push('missing_interaction_agreement');
    if (!addressRecord?.Address) issues.push('missing_referee_address');
    if (!contract) issues.push('missing_referee_contract');

    for (const accrual of accruals) {
      if (String(accrual.document_status_id) !== String(accruedStatus.id)) {
        issues.push('invalid_accrual_status');
        break;
      }
      if (
        accrual.ClosingItem?.ClosingDocument &&
        ACTIVE_ACT_STATUSES.includes(
          String(accrual.ClosingItem.ClosingDocument.status || '')
        )
      ) {
        issues.push('accrual_already_linked');
        break;
      }
    }

    const items = accruals.map((accrual, index) =>
      buildAccrualItemSnapshot(accrual, index + 1)
    );
    const groupPayload = {
      referee: {
        id: referee?.id || null,
        full_name: fullName(referee) || null,
        email: referee?.email || null,
      },
      performer_snapshot: buildRefereeSnapshot(
        referee,
        innRecord,
        taxation,
        addressRecord
      ),
      customer_snapshot: buildProfileSnapshot(profile),
      contract_snapshot: buildContractSnapshot(contract),
      fhmo_signer_snapshot: buildSignerSnapshot(signer),
      totals: buildTotalsFromAccruals(accruals),
      items,
      issues: [...new Set(issues)],
      accrual_ids: accruals.map((item) => item.id),
    };

    if (groupPayload.issues.length) blocked_groups.push(groupPayload);
    else ready_groups.push(groupPayload);
  }

  return {
    tournament: { id: tournament.id, name: tournament.name || null },
    profile: profile
      ? {
          id: profile.id,
          organizer: buildProfileSnapshot(profile),
          last_verified_at: profile.last_verified_at,
        }
      : null,
    fhmo_signer: buildSignerSnapshot(signer),
    ready_groups,
    blocked_groups,
    summary: {
      selection_mode: options.selectionMode || 'explicit',
      selected_total: options.total || rows.length,
      selected_amount_rub:
        options.totalAmountRub || sumRubAmounts(rows, 'total_amount_rub'),
      ready_groups: ready_groups.length,
      blocked_groups: blocked_groups.length,
      blocking_issues: [...new Set(profileIssues)],
    },
  };
}

async function buildActDownloadUrl(document) {
  if (!document?.File) return null;
  try {
    return await fileService.getDownloadUrl(document.File, {
      filename: `${
        document.name || 'Акт об оказании услуг'
      } · №${document.number || ''}.pdf`,
    });
  } catch {
    return null;
  }
}

function mapSignatureTimeline(signs = [], refereeId = null) {
  return signs.map((sign) => ({
    sign_id: sign.id,
    user_id: sign.user_id,
    created_at: sign.created_at,
    type_alias: sign.SignType?.alias || null,
    type_name: sign.SignType?.name || null,
    party: String(sign.user_id) === String(refereeId) ? 'REFEREE' : 'FHMO',
    first_name: sign.User?.first_name || null,
    last_name: sign.User?.last_name || null,
    patronymic: sign.User?.patronymic || null,
  }));
}

async function mapClosingDocument(act) {
  const document = act.Document || null;
  const timeline = mapSignatureTimeline(
    document?.DocumentUserSigns || [],
    act.referee_id
  );
  const refereeSigned = timeline.some((item) => item.party === 'REFEREE');
  return {
    id: act.id,
    status: act.status,
    sent_at: act.sent_at,
    posted_at: act.posted_at,
    canceled_at: act.canceled_at,
    number: document?.number || null,
    document_status: document?.DocumentStatus
      ? {
          alias: document.DocumentStatus.alias,
          name: document.DocumentStatus.name,
        }
      : null,
    tournament: act.Tournament
      ? { id: act.Tournament.id, name: act.Tournament.name || null }
      : null,
    referee: act.Referee
      ? {
          id: act.Referee.id,
          full_name: fullName(act.Referee) || null,
          email: act.Referee.email || null,
        }
      : null,
    customer_snapshot: act.customer_snapshot_json,
    performer_snapshot: act.performer_snapshot_json,
    contract_snapshot: act.contract_snapshot_json,
    fhmo_signer_snapshot: act.fhmo_signer_snapshot_json,
    totals: act.totals_json,
    items: (act.Items || []).map((item) => item.snapshot_json),
    signature_timeline: timeline,
    can_delete:
      ['DRAFT', 'AWAITING_SIGNATURE'].includes(String(act.status || '')) &&
      !refereeSigned,
    download_url: await buildActDownloadUrl(document),
  };
}

async function listClosingTournaments({
  page = 1,
  limit = 20,
  search = '',
} = {}) {
  const pagination = parsePagination(page, limit, 20, 200);
  const where = {
    deleted_at: null,
  };
  if (normalizeString(search)) {
    where.name = { [Op.iLike]: `%${normalizeString(search)}%` };
  }

  const tournaments = await Tournament.findAll({
    where,
    attributes: ['id', 'name'],
    include: [
      {
        model: RefereeClosingDocumentProfile,
        as: 'ClosingProfile',
        attributes: ['id', 'organizer_inn'],
        required: false,
      },
    ],
    order: [['name', 'ASC']],
  });

  const tournamentIds = tournaments.map((item) => item.id);
  if (!tournamentIds.length) {
    return {
      rows: [],
      total: 0,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  const [accruals, acts, signer] = await Promise.all([
    RefereeAccrualDocument.findAll({
      where: {
        tournament_id: { [Op.in]: tournamentIds },
        deleted_at: null,
      },
      include: [
        {
          model: RefereeAccrualDocumentStatus,
          as: 'DocumentStatus',
          attributes: ['alias'],
          required: true,
        },
        {
          model: RefereeClosingDocumentItem,
          as: 'ClosingItem',
          required: false,
          include: [
            {
              model: RefereeClosingDocument,
              as: 'ClosingDocument',
              attributes: ['id', 'status'],
              required: true,
            },
          ],
        },
      ],
      attributes: ['id', 'tournament_id', 'total_amount_rub'],
    }),
    RefereeClosingDocument.findAll({
      where: { tournament_id: { [Op.in]: tournamentIds }, deleted_at: null },
      attributes: ['id', 'tournament_id', 'status'],
    }),
    findActiveFhmoSigner(),
  ]);

  const rows = tournaments.map((tournament) => {
    const tournamentAccruals = accruals.filter(
      (item) => String(item.tournament_id) === String(tournament.id)
    );
    const tournamentActs = acts.filter(
      (item) => String(item.tournament_id) === String(tournament.id)
    );
    const readyAccruals = tournamentAccruals.filter(
      (item) =>
        item.DocumentStatus?.alias === 'ACCRUED' &&
        !(
          item.ClosingItem?.ClosingDocument &&
          ACTIVE_ACT_STATUSES.includes(
            String(item.ClosingItem.ClosingDocument.status || '')
          )
        )
    );
    const awaitingAccruals = tournamentAccruals.filter(
      (item) => item.DocumentStatus?.alias === 'AWAITING_SIGNATURE'
    );
    const postedAccruals = tournamentAccruals.filter(
      (item) => item.DocumentStatus?.alias === 'POSTED'
    );
    const draftActs = tournamentActs.filter((item) => item.status === 'DRAFT');
    const blocking_issues = [];
    if (!tournament.ClosingProfile?.id)
      blocking_issues.push('missing_customer_profile');
    if (!signer) blocking_issues.push('missing_fhmo_signer');
    if (!readyAccruals.length) blocking_issues.push('no_ready_accruals');
    return {
      id: tournament.id,
      name: tournament.name || null,
      has_customer_profile: Boolean(tournament.ClosingProfile?.id),
      ready_accruals: readyAccruals.length,
      awaiting_signature_count: awaitingAccruals.length,
      posted_count: postedAccruals.length,
      draft_act_count: draftActs.length,
      amount_total_rub: sumRubAmounts(tournamentAccruals, 'total_amount_rub'),
      blocking_issues,
    };
  });

  const filtered = rows.filter(
    (row) =>
      row.ready_accruals > 0 ||
      row.awaiting_signature_count > 0 ||
      row.posted_count > 0 ||
      row.draft_act_count > 0
  );

  return {
    rows: filtered.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    ),
    total: filtered.length,
    page: pagination.page,
    limit: pagination.limit,
  };
}

async function getTournamentClosingProfile(tournamentId) {
  await ensureTournamentExists(tournamentId);
  const profile = await RefereeClosingDocumentProfile.findOne({
    where: { tournament_id: tournamentId },
  });
  return {
    profile: profile
      ? {
          id: profile.id,
          organizer: buildProfileSnapshot(profile),
          organizer_json: profile.organizer_json,
          last_verified_at: profile.last_verified_at,
        }
      : null,
  };
}

async function updateTournamentClosingProfile(tournamentId, payload, actorId) {
  await ensureTournamentExists(tournamentId);
  const normalized = normalizeOrganizationSuggestion(payload);
  const [profile] = await RefereeClosingDocumentProfile.findOrCreate({
    where: { tournament_id: tournamentId },
    defaults: {
      tournament_id: tournamentId,
      ...normalized,
      last_verified_at: new Date(),
      created_by: actorId,
      updated_by: actorId,
    },
  });

  await profile.update(
    {
      ...normalized,
      last_verified_at: new Date(),
      updated_by: actorId,
    },
    { returning: false }
  );

  return getTournamentClosingProfile(tournamentId);
}

async function previewClosingDocuments(tournamentId, payload) {
  const selection = await resolveSelectionAccrualIds(tournamentId, payload);
  return buildPreviewResult(tournamentId, selection.accrualIds, selection);
}

async function createClosingDocuments(tournamentId, payload, actorId) {
  const selection = await resolveSelectionAccrualIds(tournamentId, payload);
  const preview = await buildPreviewResult(
    tournamentId,
    selection.accrualIds,
    selection
  );
  if (!preview.ready_groups.length) {
    throw new ServiceError('closing_document_no_ready_groups', 409);
  }

  const [documentType, createdStatus, simpleSignType] = await Promise.all([
    ensureDocumentType(CLOSING_DOC_ALIAS),
    ensureDocumentStatus('CREATED'),
    ensureSimpleSignType(),
  ]);

  const createdActs = [];
  for (const group of preview.ready_groups) {
    const placeholderFile = await fileService.saveGeneratedPdf(
      Buffer.from('closing-act-draft'),
      'referee-closing-act.pdf',
      actorId
    );

    let created = null;
    try {
      created = await sequelize.transaction(async (tx) => {
        const document = await Document.create(
          {
            recipient_id: group.referee.id,
            document_type_id: documentType.id,
            status_id: createdStatus.id,
            file_id: placeholderFile.id,
            sign_type_id: simpleSignType.id,
            name: 'Акт об оказании услуг',
            description: JSON.stringify({
              kind: CLOSING_DOC_ALIAS,
              payload: {
                customer: group.customer_snapshot,
                performer: group.performer_snapshot,
                contract: group.contract_snapshot,
                fhmo_signer: group.fhmo_signer_snapshot,
                totals: group.totals,
                items: group.items,
              },
            }),
            document_date: new Date(),
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );

        const act = await RefereeClosingDocument.create(
          {
            tournament_id: tournamentId,
            referee_id: group.referee.id,
            document_id: document.id,
            status: 'DRAFT',
            customer_snapshot_json: group.customer_snapshot,
            performer_snapshot_json: group.performer_snapshot,
            contract_snapshot_json: group.contract_snapshot,
            fhmo_signer_snapshot_json: group.fhmo_signer_snapshot,
            totals_json: group.totals,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );

        for (const item of group.items) {
          await RefereeClosingDocumentItem.create(
            {
              closing_document_id: act.id,
              accrual_document_id: item.accrual_id,
              line_no: item.line_no,
              snapshot_json: item,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: tx }
          );
        }

        const nextDescription = JSON.stringify({
          kind: CLOSING_DOC_ALIAS,
          closing_document_id: act.id,
          payload: {
            customer: group.customer_snapshot,
            performer: group.performer_snapshot,
            contract: group.contract_snapshot,
            fhmo_signer: group.fhmo_signer_snapshot,
            totals: group.totals,
            items: group.items,
          },
        });
        await document.update(
          { description: nextDescription, updated_by: actorId },
          { transaction: tx, returning: false }
        );

        await writeAuditEvent({
          entityType: 'REFEREE_CLOSING_DOCUMENT',
          entityId: act.id,
          action: 'CREATE',
          before: null,
          after: act.get({ plain: true }),
          actorId,
          transaction: tx,
        });

        return {
          actId: act.id,
          documentId: document.id,
        };
      });

      const { default: documentService } = await import('./documentService.js');
      await documentService.regenerate(created.documentId, actorId);
      createdActs.push(created.actId);
    } catch (error) {
      const rollbackIds = [...createdActs];
      if (created?.actId) {
        rollbackIds.push(created.actId);
      } else {
        await safeRemoveGeneratedFile(placeholderFile.id);
      }
      if (rollbackIds.length) {
        await rollbackCreatedClosingDocumentsBatch(rollbackIds, actorId);
      }
      throw error;
    }
  }

  return listClosingDocuments(tournamentId, {
    ids: createdActs,
    page: 1,
    limit: createdActs.length,
  });
}

async function listClosingDocuments(tournamentId, filters = {}) {
  await ensureTournamentExists(tournamentId);
  const pagination = parsePagination(filters.page, filters.limit, 20, 200);
  const where = buildClosingDocumentWhere(tournamentId, filters, {
    ids: filters.ids,
  });

  const [result, sendableTotal] = await Promise.all([
    RefereeClosingDocument.findAndCountAll({
      where,
      include: [
        {
          model: Tournament,
          attributes: ['id', 'name'],
        },
        {
          model: User,
          as: 'Referee',
          attributes: ['id', 'email', 'last_name', 'first_name', 'patronymic'],
        },
        {
          model: Document,
          as: 'Document',
          attributes: ['id', 'number', 'name', 'document_date'],
          include: [
            { model: DocumentStatus, attributes: ['alias', 'name'] },
            { model: File, attributes: ['id', 'key'], required: false },
            {
              model: DocumentUserSign,
              attributes: ['id', 'user_id', 'created_at'],
              required: false,
              include: [
                {
                  model: User,
                  attributes: ['first_name', 'last_name', 'patronymic'],
                },
                { model: SignType, attributes: ['alias', 'name'] },
              ],
            },
          ],
        },
        {
          model: RefereeClosingDocumentItem,
          as: 'Items',
          attributes: ['id', 'snapshot_json', 'line_no'],
          separate: true,
          order: [['line_no', 'ASC']],
        },
      ],
      distinct: true,
      subQuery: false,
      order: [['created_at', 'DESC']],
      offset: pagination.offset,
      limit: pagination.limit,
    }),
    RefereeClosingDocument.count({
      where: buildClosingDocumentWhere(tournamentId, filters, {
        ids: filters.ids,
        statusOverride:
          normalizeString(filters.status || '') &&
          normalizeString(filters.status || '') !== 'DRAFT'
            ? '__NONE__'
            : 'DRAFT',
      }),
      include: [
        {
          model: User,
          as: 'Referee',
          attributes: [],
        },
        {
          model: Document,
          as: 'Document',
          attributes: [],
        },
      ],
      distinct: true,
      col: 'id',
    }),
  ]);
  const { rows, count } = result;

  return {
    rows: await Promise.all(rows.map(mapClosingDocument)),
    total: count,
    page: pagination.page,
    limit: pagination.limit,
    summary: {
      sendable_total:
        normalizeString(filters.status || '') === 'DRAFT'
          ? count
          : Number(sendableTotal || 0),
    },
  };
}

async function getClosingDocument(tournamentId, closingDocumentId) {
  const data = await listClosingDocuments(tournamentId, {
    ids: [closingDocumentId],
    page: 1,
    limit: 1,
  });
  const row = data.rows[0] || null;
  if (!row) throw new ServiceError('closing_document_not_found', 404);
  return { document: row };
}

async function sendClosingDocumentWithSigner(
  tournamentId,
  closingDocumentId,
  actorId,
  signerCandidate
) {
  const [awaitingDocStatus, awaitingAccrualStatus, act] = await Promise.all([
    ensureDocumentStatus('AWAITING_SIGNATURE'),
    ensureAccrualStatus('AWAITING_SIGNATURE'),
    RefereeClosingDocument.findOne({
      where: {
        id: closingDocumentId,
        tournament_id: tournamentId,
        deleted_at: null,
      },
      include: [
        {
          model: Document,
          as: 'Document',
          attributes: ['id', 'status_id'],
          include: [{ model: DocumentStatus, attributes: ['alias', 'name'] }],
        },
        {
          model: RefereeClosingDocumentItem,
          as: 'Items',
          attributes: ['id', 'accrual_document_id', 'snapshot_json'],
        },
      ],
    }),
  ]);
  if (!act) throw new ServiceError('closing_document_not_found', 404);
  if (act.status !== 'DRAFT') {
    throw new ServiceError('closing_document_send_invalid_status', 409);
  }
  const previousActStatus = act.status;
  const previousSentAt = act.sent_at || null;
  const previousSignerSnapshot = act.fhmo_signer_snapshot_json || null;
  const previousDocumentStatusId = act.Document?.status_id || null;
  const accrualIds = act.Items.map((item) => item.accrual_document_id);

  await sequelize.transaction(async (tx) => {
    const before = act.get({ plain: true });
    await act.update(
      {
        status: 'AWAITING_SIGNATURE',
        sent_at: new Date(),
        fhmo_signer_snapshot_json: buildSignerSnapshot(signerCandidate),
        updated_by: actorId,
      },
      { transaction: tx, returning: false }
    );
    await act.Document.update(
      {
        status_id: awaitingDocStatus.id,
        updated_by: actorId,
      },
      { transaction: tx, returning: false }
    );
    await RefereeAccrualDocument.update(
      {
        document_status_id: awaitingAccrualStatus.id,
        updated_by: actorId,
      },
      {
        where: {
          id: { [Op.in]: act.Items.map((item) => item.accrual_document_id) },
        },
        transaction: tx,
      }
    );
    await writeAuditEvent({
      entityType: 'REFEREE_CLOSING_DOCUMENT',
      entityId: act.id,
      action: 'SEND',
      before,
      after: act.get({ plain: true }),
      actorId,
      transaction: tx,
    });
  });

  try {
    const { default: documentService } = await import('./documentService.js');
    await documentService.sign(
      { id: signerCandidate.signer.id, token_version: 1 },
      act.document_id,
      { notify: false }
    );
    await documentService.regenerate(
      act.document_id,
      signerCandidate.signer.id
    );
    await documentService.sendAwaitingSignatureNotification(act.document_id);
  } catch (error) {
    await rollbackClosingDocumentSend({
      actId: act.id,
      actorId,
      signerId: signerCandidate.signer.id,
      previousDocumentStatusId,
      previousActStatus,
      previousSentAt,
      previousSignerSnapshot,
      accrualIds,
    });
    throw error;
  }

  return getClosingDocument(tournamentId, closingDocumentId);
}

async function sendClosingDocument(tournamentId, closingDocumentId, actorId) {
  const signerCandidate = await findActiveFhmoSigner();
  if (!signerCandidate)
    throw new ServiceError('federation_signer_not_found', 409);

  return sendClosingDocumentWithSigner(
    tournamentId,
    closingDocumentId,
    actorId,
    signerCandidate
  );
}

async function sendClosingDocumentsBatch(tournamentId, payload, actorId) {
  const signerCandidate = await findActiveFhmoSigner();
  if (!signerCandidate)
    throw new ServiceError('federation_signer_not_found', 409);

  const selection = await resolveSelectionClosingDocumentIds(
    tournamentId,
    payload
  );
  const sentIds = [];
  const failures = [];

  for (const documentId of selection.documentIds) {
    try {
      await sendClosingDocumentWithSigner(
        tournamentId,
        documentId,
        actorId,
        signerCandidate
      );
      sentIds.push(documentId);
    } catch (error) {
      failures.push({
        id: documentId,
        code: error?.message || 'closing_document_send_failed',
      });
    }
  }

  const sentDocuments = sentIds.length
    ? await listClosingDocuments(tournamentId, {
        ids: sentIds,
        page: 1,
        limit: sentIds.length,
      })
    : { rows: [] };

  return {
    documents: sentDocuments.rows,
    failures,
    summary: {
      selection_mode: selection.selectionMode,
      selected_total: selection.total,
      sent_total: sentIds.length,
      failed_total: failures.length,
    },
  };
}

async function cancelClosingDocument(tournamentId, closingDocumentId, actorId) {
  const [canceledDocStatus, accruedStatus, act] = await Promise.all([
    ensureDocumentStatus('CANCELED'),
    ensureAccrualStatus('ACCRUED'),
    RefereeClosingDocument.findOne({
      where: {
        id: closingDocumentId,
        tournament_id: tournamentId,
        deleted_at: null,
      },
      include: [
        {
          model: Document,
          as: 'Document',
          attributes: ['id'],
        },
        {
          model: RefereeClosingDocumentItem,
          as: 'Items',
          attributes: ['id', 'accrual_document_id'],
        },
      ],
    }),
  ]);
  if (!act) throw new ServiceError('closing_document_not_found', 404);
  if (!MUTABLE_ACT_STATUSES.includes(act.status)) {
    throw new ServiceError('closing_document_cancel_invalid_status', 409);
  }

  await sequelize.transaction(async (tx) => {
    const before = act.get({ plain: true });
    await act.update(
      {
        status: 'CANCELED',
        canceled_at: new Date(),
        updated_by: actorId,
      },
      { transaction: tx, returning: false }
    );
    await act.Document.update(
      { status_id: canceledDocStatus.id, updated_by: actorId },
      { transaction: tx, returning: false }
    );
    await RefereeAccrualDocument.update(
      {
        document_status_id: accruedStatus.id,
        updated_by: actorId,
      },
      {
        where: {
          id: { [Op.in]: act.Items.map((item) => item.accrual_document_id) },
        },
        transaction: tx,
      }
    );
    await RefereeClosingDocumentItem.destroy({
      where: { closing_document_id: act.id },
      transaction: tx,
    });
    await writeAuditEvent({
      entityType: 'REFEREE_CLOSING_DOCUMENT',
      entityId: act.id,
      action: 'CANCEL',
      before,
      after: act.get({ plain: true }),
      actorId,
      transaction: tx,
    });
  });

  return getClosingDocument(tournamentId, closingDocumentId);
}

async function deleteClosingDocument(tournamentId, closingDocumentId, actorId) {
  const [accruedStatus, act] = await Promise.all([
    ensureAccrualStatus('ACCRUED'),
    RefereeClosingDocument.findOne({
      where: {
        id: closingDocumentId,
        tournament_id: tournamentId,
        deleted_at: null,
      },
      include: [
        {
          model: Document,
          as: 'Document',
          attributes: ['id', 'file_id'],
        },
        {
          model: RefereeClosingDocumentItem,
          as: 'Items',
          attributes: ['id', 'accrual_document_id'],
        },
      ],
    }),
  ]);
  if (!act) throw new ServiceError('closing_document_not_found', 404);
  if (!MUTABLE_ACT_STATUSES.includes(act.status)) {
    throw new ServiceError('closing_document_delete_invalid_status', 409);
  }

  const refereeSignature = await DocumentUserSign.findOne({
    where: {
      document_id: act.document_id,
      user_id: act.referee_id,
    },
    attributes: ['id'],
  });
  if (refereeSignature) {
    throw new ServiceError('closing_document_delete_forbidden_signed', 409);
  }

  const before = act.get({ plain: true });
  const fileId = act.Document?.file_id || null;
  await sequelize.transaction(async (tx) => {
    await RefereeAccrualDocument.update(
      {
        document_status_id: accruedStatus.id,
        updated_by: actorId,
      },
      {
        where: {
          id: { [Op.in]: act.Items.map((item) => item.accrual_document_id) },
        },
        transaction: tx,
      }
    );
    await RefereeClosingDocumentItem.destroy({
      where: { closing_document_id: act.id },
      transaction: tx,
    });
    if (act.Document) {
      await act.Document.update(
        { updated_by: actorId },
        { transaction: tx, returning: false }
      );
      await act.Document.destroy({ transaction: tx });
    }
    await act.update(
      {
        deleted_by: actorId,
        updated_by: actorId,
      },
      { transaction: tx, returning: false, silent: true }
    );
    await act.destroy({ transaction: tx });
    await writeAuditEvent({
      entityType: 'REFEREE_CLOSING_DOCUMENT',
      entityId: act.id,
      action: 'DELETE',
      before,
      after: {
        ...before,
        deleted_at: new Date(),
        deleted_by: actorId || null,
      },
      actorId,
      transaction: tx,
    });
  });

  if (fileId) {
    await safeRemoveGeneratedFile(fileId);
  }

  return {
    deleted: true,
    id: closingDocumentId,
  };
}

async function handleRecipientSigned(documentId, actorId = null) {
  const [postedStatus, act] = await Promise.all([
    ensureAccrualStatus('POSTED'),
    RefereeClosingDocument.findOne({
      where: { document_id: documentId, deleted_at: null },
      include: [
        {
          model: RefereeClosingDocumentItem,
          as: 'Items',
          attributes: ['id', 'accrual_document_id'],
        },
      ],
    }),
  ]);
  if (!act || act.status !== 'AWAITING_SIGNATURE') return null;

  await sequelize.transaction(async (tx) => {
    const before = act.get({ plain: true });
    await act.update(
      {
        status: 'POSTED',
        posted_at: new Date(),
        updated_by: actorId,
      },
      { transaction: tx, returning: false }
    );
    await RefereeAccrualDocument.update(
      {
        document_status_id: postedStatus.id,
        updated_by: actorId,
      },
      {
        where: {
          id: { [Op.in]: act.Items.map((item) => item.accrual_document_id) },
        },
        transaction: tx,
      }
    );
    await writeAuditEvent({
      entityType: 'REFEREE_CLOSING_DOCUMENT',
      entityId: act.id,
      action: 'POST',
      before,
      after: act.get({ plain: true }),
      actorId,
      transaction: tx,
    });
  });

  return act.id;
}

async function isClosingDocumentCanceled(documentId) {
  const act = await RefereeClosingDocument.findOne({
    where: { document_id: documentId, deleted_at: null },
    attributes: ['status'],
  });
  return act?.status === 'CANCELED';
}

export default {
  listClosingTournaments,
  getTournamentClosingProfile,
  updateTournamentClosingProfile,
  previewClosingDocuments,
  createClosingDocuments,
  listClosingDocuments,
  getClosingDocument,
  sendClosingDocument,
  sendClosingDocumentsBatch,
  cancelClosingDocument,
  deleteClosingDocument,
  handleRecipientSigned,
  isClosingDocumentCanceled,
};
