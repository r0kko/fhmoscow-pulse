import { TrainingRole } from '../models/index.js';

async function list() {
  return TrainingRole.findAll();
}

export default { list };
