import { SignType, UserSignType } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailVerificationService from './emailVerificationService.js';

async function list() {
  const types = await SignType.findAll({ attributes: ['name', 'alias'] });
  return types;
}

async function getByUser(userId) {
  const record = await UserSignType.findOne({
    where: { user_id: userId },
    include: [{ model: SignType, attributes: ['name', 'alias'] }],
  });
  return record ? record.SignType : null;
}

async function select(user, alias, code) {
  await emailVerificationService.verifyCode(user, code, 'ACTIVE');
  const signType = await SignType.findOne({ where: { alias } });
  if (!signType) {
    throw new ServiceError('sign_type_not_found', 404);
  }
  const [record] = await UserSignType.findOrCreate({
    where: { user_id: user.id },
    defaults: {
      user_id: user.id,
      sign_type_id: signType.id,
      created_by: user.id,
      updated_by: user.id,
    },
  });
  if (record.sign_type_id !== signType.id) {
    await record.update({ sign_type_id: signType.id, updated_by: user.id });
  }
  return signType;
}

export default { list, getByUser, select };
