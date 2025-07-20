import { NormativeZone } from '../models/index.js';

async function list() {
  return NormativeZone.findAll({ order: [['name', 'ASC']] });
}

export default { list };
