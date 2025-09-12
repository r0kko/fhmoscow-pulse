import { Op } from 'sequelize';

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

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;

  const where = {};
  if (options.type_id) where.type_id = options.type_id;
  if (options.manufacturer_id) where.manufacturer_id = options.manufacturer_id;
  if (options.size_id) where.size_id = options.size_id;
  if (options.number) {
    const n = parseInt(options.number, 10);
    if (Number.isFinite(n)) where.number = n;
  }
  if (options.status === 'issued') where.owner_id = { [Op.ne]: null };
  if (options.status === 'free') {
    where.owner_id = null;
    where.assignment_document_id = null;
  }
  if (options.status === 'awaiting') {
    where.owner_id = null;
    where.assignment_document_id = { [Op.ne]: null };
  }

  const include = [
    { model: EquipmentType },
    { model: EquipmentManufacturer },
    { model: EquipmentSize },
    {
      model: User,
      as: 'Owner',
      attributes: ['id', 'last_name', 'first_name', 'patronymic'],
    },
  ];

  // Sorting
  const order = [];
  const orderDir =
    String(options.order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  if (options.orderBy === 'number') {
    order.push(['number', orderDir]);
  } else if (options.orderBy === 'created_at') {
    order.push(['createdAt', orderDir]);
  } else {
    order.push([EquipmentType, 'name', 'ASC']);
    order.push(['number', 'ASC']);
  }

  return Equipment.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order,
  });
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
    number: data.number,
    created_by: actorId,
    updated_by: actorId,
  };
  const item = await Equipment.create(payload);
  return getById(item.id);
}

async function update(id, data, actorId) {
  const item = await Equipment.findByPk(id);
  if (!item) throw new ServiceError('equipment_not_found', 404);
  await item.update({ ...data, updated_by: actorId });
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
