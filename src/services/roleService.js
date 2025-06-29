import { Role } from '../models/index.js';

async function listRoles() {
  return Role.findAll();
}

export default { listRoles };
