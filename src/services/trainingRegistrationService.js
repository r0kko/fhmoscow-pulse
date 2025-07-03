import {
  Training,
  TrainingType,
  CampStadium,
  Season,
  RefereeGroup,
  RefereeGroupUser,
  TrainingRegistration,
  User,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import trainingService from './trainingService.js';

async function listAvailable(userId, options = {}) {
  const link = await RefereeGroupUser.findOne({ where: { user_id: userId } });
  if (!link) return { rows: [], count: 0 };
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const { rows, count } = await Training.findAndCountAll({
    include: [
      TrainingType,
      CampStadium,
      Season,
      {
        model: RefereeGroup,
        through: { attributes: [] },
        where: { id: link.group_id },
      },
      { model: TrainingRegistration },
    ],
    order: [['start_at', 'DESC']],
    distinct: true,
    limit,
    offset,
  });
  return {
    rows: rows.map((t) => {
      const registeredCount = t.TrainingRegistrations.length;
      const userRegistered = t.TrainingRegistrations.some(
        (r) => r.user_id === userId
      );
      const plain = t.get();
      const available =
        typeof plain.capacity === 'number'
          ? Math.max(0, plain.capacity - registeredCount)
          : null;
      return {
        ...plain,
        available,
        registration_open: trainingService.isRegistrationOpen(
          t,
          registeredCount
        ),
        user_registered: userRegistered,
      };
    }),
    count,
  };
}

async function register(userId, trainingId, actorId) {
  const [training, link] = await Promise.all([
    Training.findByPk(trainingId, {
      include: [
        { model: RefereeGroup, through: { attributes: [] } },
        { model: TrainingRegistration },
      ],
    }),
    RefereeGroupUser.findOne({ where: { user_id: userId } }),
  ]);
  if (!training) throw new ServiceError('training_not_found', 404);
  if (!link) throw new ServiceError('referee_group_not_found');
  if (!training.RefereeGroups.some((g) => g.id === link.group_id)) {
    throw new ServiceError('access_denied');
  }
  const registeredCount = training.TrainingRegistrations.length;
  if (!trainingService.isRegistrationOpen(training, registeredCount)) {
    throw new ServiceError('registration_closed');
  }
  if (training.TrainingRegistrations.some((r) => r.user_id === userId)) {
    throw new ServiceError('already_registered');
  }
  await TrainingRegistration.create({
    training_id: trainingId,
    user_id: userId,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function unregister(userId, trainingId) {
  const registration = await TrainingRegistration.findOne({
    where: { training_id: trainingId, user_id: userId },
  });
  if (!registration) throw new ServiceError('registration_not_found', 404);
  const training = await Training.findByPk(trainingId);
  const count = await TrainingRegistration.count({
    where: { training_id: trainingId },
  });
  if (!training || !trainingService.isRegistrationOpen(training, count)) {
    throw new ServiceError('registration_closed');
  }
  await registration.destroy();
}

async function listByTraining(trainingId, options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return TrainingRegistration.findAndCountAll({
    where: { training_id: trainingId },
    include: [{ model: User }],
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
    ],
    limit,
    offset,
  });
}

async function remove(trainingId, userId) {
  const registration = await TrainingRegistration.findOne({
    where: { training_id: trainingId, user_id: userId },
  });
  if (!registration) throw new ServiceError('registration_not_found', 404);
  await registration.destroy();
}

export default {
  listAvailable,
  register,
  unregister,
  listByTraining,
  remove,
};
