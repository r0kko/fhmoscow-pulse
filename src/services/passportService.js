import { Passport, DocumentType, Country } from '../models/index.js';

async function getByUser(userId) {
  return Passport.findOne({
    where: { user_id: userId },
    include: [DocumentType, Country],
  });
}

export default { getByUser };
