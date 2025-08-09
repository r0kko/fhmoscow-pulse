import { TrainingRole } from '../models/index.js';

async function list(options = {}) {
  const where = {};
  if (options.forCamp !== undefined) where.for_camp = options.forCamp;
  return TrainingRole.findAll({ where, order: [['name', 'ASC']] });
}

export default { list };
