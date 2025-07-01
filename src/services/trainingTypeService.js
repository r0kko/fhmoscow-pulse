import { TrainingType } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

function generateAlias(name) {
  const map = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ы: 'y',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  const translit = String(name)
    .split('')
    .map((c) => map[c.toLowerCase()] || c)
    .join('');
  return translit
    .replace(/[^0-9a-zA-Z]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return TrainingType.findAndCountAll({
    order: [['name', 'ASC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const type = await TrainingType.findByPk(id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  return type;
}

async function create(data, actorId) {
  const type = await TrainingType.create({
    name: data.name,
    alias: generateAlias(data.name),
    default_capacity: data.default_capacity,
    created_by: actorId,
    updated_by: actorId,
  });
  return type;
}

async function update(id, data, actorId) {
  const type = await TrainingType.findByPk(id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  await type.update(
    {
      // name cannot be changed after creation
      default_capacity: data.default_capacity ?? type.default_capacity,
      updated_by: actorId,
    },
    { returning: false }
  );
  return type;
}

async function remove(id) {
  const type = await TrainingType.findByPk(id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  await type.destroy();
}

export default { listAll, getById, create, update, remove };
