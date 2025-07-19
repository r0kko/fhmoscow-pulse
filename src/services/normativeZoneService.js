import { NormativeZone } from '../models/index.js';

async function list(options = {}) {
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  return NormativeZone.findAll({ where, order: [['name', 'ASC']] });
}

export default { list };
