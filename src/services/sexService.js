import { Sex } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function list() {
  return Sex.findAll();
}

async function getByAlias(alias) {
  const sex = await Sex.findOne({ where: { alias } });
  if (!sex) throw new ServiceError('sex_not_found', 404);
  return sex;
}

export default { list, getByAlias };
