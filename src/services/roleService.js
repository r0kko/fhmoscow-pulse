import { Role } from '../models/index.js';

async function listRoles() {
  return Role.findAll({
    order: [
      ['groupAlias', 'ASC'],
      ['departmentAlias', 'ASC'],
      ['displayOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

export default { listRoles };
