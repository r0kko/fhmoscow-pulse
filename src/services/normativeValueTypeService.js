import { NormativeValueType } from '../models/index.js';

async function list() {
  return NormativeValueType.findAll({ order: [['name', 'ASC']] });
}

export default { list };
