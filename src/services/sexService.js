import { Sex } from '../models/index.js';

async function list() {
  return Sex.findAll();
}

export default { list };
