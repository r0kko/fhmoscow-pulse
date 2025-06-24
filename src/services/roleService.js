import { Role } from '../models/index.js';

async function listRoles() {
  return Role.findAll({ order: [['name', 'ASC']] });
}

export default { listRoles };
