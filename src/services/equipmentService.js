import { Op, fn, col, where as whereFn } from 'sequelize';

import {
  Equipment,
  EquipmentType,
  EquipmentManufacturer,
  EquipmentSize,
  User,
  Role,
  Document,
  DocumentType,
  DocumentStatus,
  SignType,
  UserSignType,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import { hasRole } from '../utils/roles.js';

import buildEquipmentTransferPdf from './docBuilders/equipmentTransfer.js';
import * as emailService from './emailService.js';
import fileService from './fileService.js';

const SEARCH_TOKEN_LIMIT = 5;
const SEARCHABLE_ASSOC_COLUMNS = [
  '$EquipmentType.name$',
  '$EquipmentManufacturer.name$',
  '$EquipmentSize.name$',
  '$AssignmentDocument.number$',
  '$Owner.last_name$',
  '$Owner.first_name$',
  '$Owner.patronymic$',
  '$Owner.email$',
];

function normalizeEquipmentNumber(input, { required = false } = {}) {
  if (input == null || input === '') {
    if (required) throw new ServiceError('invalid_equipment_number', 400);
    return null;
  }
  const parsed = Number.parseInt(String(input).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 999) {
    throw new ServiceError('invalid_equipment_number', 400);
  }
  return parsed;
}

function escapeSearchTerm(term = '') {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function tokenizeSearch(searchInput = '') {
  return searchInput
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, SEARCH_TOKEN_LIMIT);
}

function buildSearchConditions(searchTokens = []) {
  if (!searchTokens.length) return [];
  return searchTokens.map((token) => {
    const sanitized = escapeSearchTerm(token);
    const like = `%${sanitized}%`;
    const orConditions = SEARCHABLE_ASSOC_COLUMNS.map((column) => ({
      [column]: { [Op.iLike]: like },
    }));

    const fullNameCondition = whereFn(
      fn(
        'concat_ws',
        ' ',
        col('Owner.last_name'),
        col('Owner.first_name'),
        col('Owner.patronymic')
      ),
      { [Op.iLike]: like }
    );
    orConditions.push(fullNameCondition);

    const numeric = Number.parseInt(token, 10);
    if (Number.isFinite(numeric)) {
      orConditions.push({ number: numeric });
    }

    return { [Op.or]: orConditions };
  });
}

function buildInclude({ minimal = false } = {}) {
  const baseAttributes = minimal ? [] : ['id', 'name'];
  return [
    {
      model: EquipmentType,
      attributes: baseAttributes,
      required: false,
    },
    {
      model: EquipmentManufacturer,
      attributes: baseAttributes,
      required: false,
    },
    {
      model: EquipmentSize,
      attributes: baseAttributes,
      required: false,
    },
    {
      model: Document,
      as: 'AssignmentDocument',
      attributes: minimal ? [] : ['id', 'number'],
      required: false,
      include: [
        {
          model: DocumentStatus,
          attributes: minimal ? [] : ['alias', 'name'],
          required: false,
        },
      ],
    },
    {
      model: User,
      as: 'Owner',
      attributes: minimal
        ? []
        : ['id', 'last_name', 'first_name', 'patronymic', 'email', 'phone'],
      required: false,
    },
  ];
}

function buildBaseFilters(options = {}, { minimal = false } = {}) {
  const where = {};
  const include = buildInclude({ minimal });

  if (options.type_id) where.type_id = options.type_id;
  if (options.manufacturer_id) where.manufacturer_id = options.manufacturer_id;
  if (options.size_id) where.size_id = options.size_id;

  if (options.number) {
    const number = Number.parseInt(options.number, 10);
    if (Number.isFinite(number) && number >= 1 && number <= 999) {
      where.number = number;
    }
  }

  const tokens = tokenizeSearch(options.search || '');
  if (tokens.length) {
    const searchConditions = buildSearchConditions(tokens);
    if (searchConditions.length) {
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push(...searchConditions);
    }
  }

  return { where, include };
}

function applyStatusFilter(baseWhere = {}, status) {
  const where = { ...baseWhere };
  if (!status) return where;
  if (status === 'issued') {
    where.owner_id = { [Op.ne]: null };
  } else if (status === 'awaiting') {
    where.owner_id = null;
    where.assignment_document_id = { [Op.ne]: null };
  } else if (status === 'free') {
    where.owner_id = null;
    where.assignment_document_id = null;
  }
  return where;
}

function buildOrderClause(orderBy, order) {
  const direction =
    String(order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  if (orderBy === 'number') return [['number', direction]];
  if (orderBy === 'created_at') return [['createdAt', direction]];
  if (orderBy === 'updated_at') return [['updatedAt', direction]];
  return [
    [EquipmentType, 'name', 'ASC'],
    ['number', 'ASC'],
  ];
}

async function buildSummary(options = {}) {
  async function countByStatus(status) {
    const { where, include } = buildBaseFilters(options, { minimal: true });
    return Equipment.count({
      where: applyStatusFilter(where, status),
      include,
      distinct: true,
      col: 'id',
    });
  }

  const [free, awaiting, issued] = await Promise.all([
    countByStatus('free'),
    countByStatus('awaiting'),
    countByStatus('issued'),
  ]);

  const { where: baseWhere, include } = buildBaseFilters(options, {
    minimal: true,
  });

  const [lastUpdated, lastCreated] = await Promise.all([
    Equipment.findOne({
      where: baseWhere,
      include,
      order: [['updatedAt', 'DESC']],
      attributes: ['updatedAt'],
      paranoid: true,
      subQuery: false,
    }),
    Equipment.findOne({
      where: baseWhere,
      include,
      order: [['createdAt', 'DESC']],
      attributes: ['createdAt'],
      paranoid: true,
      subQuery: false,
    }),
  ]);

  return {
    total: free + awaiting + issued,
    free,
    awaiting,
    issued,
    lastUpdatedAt: lastUpdated?.updatedAt
      ? new Date(lastUpdated.updatedAt).toISOString()
      : null,
    lastCreatedAt: lastCreated?.createdAt
      ? new Date(lastCreated.createdAt).toISOString()
      : null,
  };
}

async function listAll(options = {}) {
  const page = Math.max(1, Number.parseInt(options.page ?? '1', 10) || 1);
  const requestedLimit = Number.parseInt(options.limit ?? '20', 10);
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 20)
  );
  const offset = (page - 1) * limit;

  const { where: baseWhere, include } = buildBaseFilters(options, {
    minimal: false,
  });
  const where = applyStatusFilter(baseWhere, options.status);
  const order = buildOrderClause(options.orderBy, options.order);

  const [result, summary] = await Promise.all([
    Equipment.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order,
      distinct: true,
      col: 'id',
      subQuery: false,
    }),
    buildSummary(options),
  ]);

  return {
    rows: result.rows,
    count: result.count,
    summary,
  };
}

async function getById(id) {
  const item = await Equipment.findByPk(id, {
    include: [EquipmentType, EquipmentManufacturer, EquipmentSize],
  });
  if (!item) throw new ServiceError('equipment_not_found', 404);
  return item;
}

async function create(data, actorId) {
  const payload = {
    type_id: data.type_id,
    manufacturer_id: data.manufacturer_id,
    size_id: data.size_id,
    number: normalizeEquipmentNumber(data.number, { required: true }),
    created_by: actorId,
    updated_by: actorId,
  };
  const item = await Equipment.create(payload);
  return getById(item.id);
}

async function update(id, data, actorId) {
  const item = await Equipment.findByPk(id);
  if (!item) throw new ServiceError('equipment_not_found', 404);
  const updatePayload = { ...data, updated_by: actorId };
  if (Object.hasOwn(updatePayload, 'number')) {
    updatePayload.number = normalizeEquipmentNumber(updatePayload.number, {
      required: false,
    });
    if (updatePayload.number == null) delete updatePayload.number;
  }
  await item.update(updatePayload);
  return getById(item.id);
}

async function remove(id, _actorId = null) {
  const item = await Equipment.findByPk(id);
  if (!item) throw new ServiceError('equipment_not_found', 404);
  await item.destroy();
}

async function listTypes() {
  return EquipmentType.findAll({ order: [['name', 'ASC']] });
}

async function listManufacturers() {
  return EquipmentManufacturer.findAll({ order: [['name', 'ASC']] });
}

async function listSizes() {
  return EquipmentSize.findAll({ order: [['name', 'ASC']] });
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  listTypes,
  listManufacturers,
  listSizes,
  assign,
};

async function assign(id, userId, actorId) {
  const item = await Equipment.findByPk(id, {
    include: [
      EquipmentType,
      EquipmentManufacturer,
      EquipmentSize,
      { model: User, as: 'Owner' },
    ],
  });
  if (!item) throw new ServiceError('equipment_not_found', 404);
  if (item.assignment_document_id) {
    throw new ServiceError('equipment_assignment_exists', 400);
  }
  if (item.owner_id && item.owner_id !== userId) {
    throw new ServiceError('equipment_already_assigned', 400);
  }
  const user = await User.findByPk(userId, {
    include: [{ model: Role, through: { attributes: [] } }],
  });
  if (!user) throw new ServiceError('user_not_found', 404);
  const allowed = hasRole(
    (user.Roles || []).map((r) => r.alias),
    ['REFEREE', 'BRIGADE_REFEREE']
  );
  if (!allowed) {
    throw new ServiceError('access_denied', 403);
  }
  // Prepare document meta and initial PDF
  const [docType, signType, statusAwait] = await Promise.all([
    DocumentType.findOne({
      where: { alias: 'EQUIPMENT_TRANSFER' },
      attributes: ['id', 'name'],
    }),
    SignType.findOne({
      where: { alias: 'SIMPLE_ELECTRONIC' },
      attributes: ['id'],
    }),
    DocumentStatus.findOne({
      where: { alias: 'AWAITING_SIGNATURE' },
      attributes: ['id'],
    }),
  ]);
  if (!docType) throw new ServiceError('document_type_not_found', 500);
  if (!signType) throw new ServiceError('sign_type_not_found', 500);
  if (!statusAwait) throw new ServiceError('document_status_not_found', 500);

  // Preconditions: user must have SIMPLE_ELECTRONIC signature and a signed agreement
  const hasSimple = await UserSignType.findOne({
    where: { user_id: user.id, sign_type_id: signType.id },
  });
  if (!hasSimple) throw new ServiceError('sign_type_simple_required', 400);

  const agreementSigned = await Document.findOne({
    where: { recipient_id: user.id },
    include: [
      {
        model: DocumentType,
        attributes: ['alias'],
        where: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT' },
      },
      {
        model: DocumentStatus,
        attributes: ['alias'],
        where: { alias: 'SIGNED' },
      },
    ],
  });
  if (!agreementSigned)
    throw new ServiceError('electronic_interaction_agreement_required', 400);

  const equipmentPayload = {
    type: item.EquipmentType
      ? { id: item.EquipmentType.id, name: item.EquipmentType.name }
      : null,
    manufacturer: item.EquipmentManufacturer
      ? {
          id: item.EquipmentManufacturer.id,
          name: item.EquipmentManufacturer.name,
        }
      : null,
    size: item.EquipmentSize
      ? { id: item.EquipmentSize.id, name: item.EquipmentSize.name }
      : null,
    number: item.number,
  };
  const initialPdf = await buildEquipmentTransferPdf(
    user,
    equipmentPayload,
    {}
  );
  const file = await fileService.saveGeneratedPdf(
    initialPdf,
    `${docType.name}.pdf`,
    actorId
  );
  const doc = await Document.create({
    recipient_id: user.id,
    document_type_id: docType.id,
    status_id: statusAwait.id,
    file_id: file.id,
    sign_type_id: signType.id,
    name: docType.name,
    description: JSON.stringify({
      equipment: equipmentPayload,
      equipment_id: item.id,
    }),
    document_date: new Date(),
    created_by: actorId,
    updated_by: actorId,
  });
  // Regenerate with number and barcode
  try {
    const docService = (await import('./documentService.js')).default;
    await docService.regenerate(doc.id, actorId);
  } catch (_) {
    /* noop */
  }
  // Link pending assignment (do not set owner until the document is signed)
  await item.update(
    { assignment_document_id: doc.id, updated_by: actorId },
    { silent: false }
  );
  // Notify user
  try {
    await emailService.sendDocumentCreatedEmail(user, doc);
    await emailService.sendDocumentAwaitingSignatureEmail(user, doc);
  } catch (_) {
    /* noop */
  }
  const updated = await getById(item.id);
  return { item: updated, document: doc };
}
