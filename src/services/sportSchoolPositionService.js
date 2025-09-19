import SportSchoolPosition from '../models/sportSchoolPosition.js';

async function listAll() {
  return SportSchoolPosition.findAll();
}

async function getById(id) {
  if (!id) return null;
  return SportSchoolPosition.findByPk(id);
}

export default {
  listAll,
  getById,
};
