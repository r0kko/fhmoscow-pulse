import { MeasurementUnit } from '../models/index.js';

async function list() {
  return MeasurementUnit.findAll({ order: [['name', 'ASC']] });
}

export default { list };
