import {
  Training,
  TrainingType,
  CampStadium,
  Season,
  RefereeGroup,
  RefereeGroupUser,
  TrainingRegistration,
  TrainingRole,
  Role,
  User,
  Address,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import trainingService from './trainingService.js';
import emailService from './emailService.js';

async function upsertRegistration(trainingId, userId, roleId, actorId) {
  const existing = await TrainingRegistration.findOne({
    where: { training_id: trainingId, user_id: userId },
    paranoid: false,
  });

  if (existing) {
    if (!existing.deletedAt) {
      throw new ServiceError('already_registered');
    }
    await existing.restore();
    await existing.update({ training_role_id: roleId, updated_by: actorId });
    return existing;
  }

  return TrainingRegistration.create({
    training_id: trainingId,
    user_id: userId,
    training_role_id: roleId,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function listAvailable(userId, options = {}) {
  const link = await RefereeGroupUser.findOne({ where: { user_id: userId } });
  if (!link) return { rows: [], count: 0 };
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const { rows, count } = await Training.findAndCountAll({
    include: [
      TrainingType,
      { model: CampStadium, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        where: { id: link.group_id },
      },
      {
        model: TrainingRegistration,
        include: [User, TrainingRole],
      },
    ],
    where: { start_at: { [Op.between]: [now, horizon] } },
    order: [['start_at', 'DESC']],
    distinct: true,
    limit,
    offset,
  });
  return {
    rows: rows.map((t) => {
      const participantRegs = t.TrainingRegistrations.filter(
        (r) => r.TrainingRole?.alias === 'PARTICIPANT'
      );
      const registeredCount = participantRegs.length;
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
        { model: TrainingRegistration, include: [TrainingRole] },
        { model: CampStadium, include: [Address] },
        { model: Season, where: { active: true }, required: true },
      ],
    }),
    RefereeGroupUser.findOne({ where: { user_id: userId } }),
  ]);
  if (!training) throw new ServiceError('training_not_found', 404);
  if (!link) throw new ServiceError('referee_group_not_found');
  if (!training.RefereeGroups.some((g) => g.id === link.group_id)) {
    throw new ServiceError('access_denied');
  }
  const participantRegs = training.TrainingRegistrations.filter(
    (r) => r.TrainingRole?.alias === 'PARTICIPANT'
  );
  const registeredCount = participantRegs.length;
  if (training.capacity && registeredCount >= training.capacity) {
    throw new ServiceError('training_full');
  }
  if (!trainingService.isRegistrationOpen(training, registeredCount)) {
    throw new ServiceError('registration_closed');
  }
  const role = await TrainingRole.findOne({ where: { alias: 'PARTICIPANT' } });
  if (!role) throw new ServiceError('training_role_not_found');

  await upsertRegistration(trainingId, userId, role.id, actorId);

  const user = await User.findByPk(userId);
  if (user) {
    await emailService.sendTrainingRegistrationEmail(user, training, role);
  }
}

async function unregister(userId, trainingId, actorId = null) {
  const registration = await TrainingRegistration.findOne({
    where: { training_id: trainingId, user_id: userId },
    include: [TrainingRole],
  });
  if (!registration) throw new ServiceError('registration_not_found', 404);
  if (registration.TrainingRole?.alias !== 'PARTICIPANT') {
    throw new ServiceError('cancellation_forbidden');
  }
  const training = await Training.findByPk(trainingId, {
    include: [{ model: Season, where: { active: true }, required: true }],
  });
  if (!training) throw new ServiceError('training_not_found', 404);

  const start = new Date(training.start_at);
  const tooLate = Date.now() > start.getTime() - 48 * 60 * 60 * 1000;
  if (tooLate) {
    throw new ServiceError('cancellation_deadline_passed');
  }
  const count = await TrainingRegistration.count({
    where: { training_id: trainingId },
    include: [{ model: TrainingRole, where: { alias: 'PARTICIPANT' } }],
  });
  if (!training || !trainingService.isRegistrationOpen(training, count)) {
    throw new ServiceError('registration_closed');
  }
  await registration.update({ updated_by: actorId });
  await registration.destroy();

  const user = await User.findByPk(userId);
  if (user) {
    await emailService.sendTrainingRegistrationSelfCancelledEmail(
      user,
      training
    );
  }
}

async function add(trainingId, userId, roleId, actorId) {
  const [training, user, role] = await Promise.all([
    Training.findByPk(trainingId, {
      include: [
        { model: TrainingRegistration },
        { model: CampStadium, include: [Address] },
        { model: Season, where: { active: true }, required: true },
      ],
    }),
    User.findByPk(userId, { include: [Role] }),
    TrainingRole.findByPk(roleId),
  ]);
  if (!training) throw new ServiceError('training_not_found', 404);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!role) throw new ServiceError('training_role_not_found', 404);
  if (!user.Roles.some((r) => r.alias === 'REFEREE')) {
    throw new ServiceError('user_not_referee');
  }

  await upsertRegistration(trainingId, userId, roleId, actorId);
  await emailService.sendTrainingRegistrationEmail(user, training, role);
}

async function updateRole(trainingId, userId, roleId, actorId) {
  const [registration, role, training, user] = await Promise.all([
    TrainingRegistration.findOne({
      where: { training_id: trainingId, user_id: userId },
    }),
    TrainingRole.findByPk(roleId),
    Training.findByPk(trainingId, {
      include: [{ model: CampStadium, include: [Address] }, { model: Season }],
    }),
    User.findByPk(userId),
  ]);
  if (!registration) throw new ServiceError('registration_not_found', 404);
  if (!role) throw new ServiceError('training_role_not_found', 404);
  if (!training) throw new ServiceError('training_not_found', 404);
  await registration.update({ training_role_id: roleId, updated_by: actorId });
  if (user) {
    await emailService.sendTrainingRoleChangedEmail(user, training, role);
  }
}

async function updatePresence(trainingId, userId, present, actorId) {
  const registration = await TrainingRegistration.findOne({
    where: { training_id: trainingId, user_id: userId },
  });
  if (!registration) throw new ServiceError('registration_not_found', 404);

  const actor = await User.findByPk(actorId, { include: [Role] });
  if (!actor) throw new ServiceError('user_not_found', 404);
  const isAdmin = actor.Roles.some((r) => r.alias === 'ADMIN');

  if (!isAdmin) {
    if (!actor.Roles.some((r) => r.alias === 'REFEREE')) {
      throw new ServiceError('access_denied');
    }
    const coachReg = await TrainingRegistration.findOne({
      where: { training_id: trainingId, user_id: actorId },
      include: [TrainingRole],
    });
    if (coachReg?.TrainingRole?.alias !== 'COACH') {
      throw new ServiceError('access_denied');
    }
  }

  await registration.update({ present, updated_by: actorId });
}

async function listForAttendance(trainingId, actorId) {
  const actor = await User.findByPk(actorId, { include: [Role] });
  if (!actor) throw new ServiceError('user_not_found', 404);
  const isAdmin = actor.Roles.some((r) => r.alias === 'ADMIN');

  if (!isAdmin) {
    if (!actor.Roles.some((r) => r.alias === 'REFEREE')) {
      throw new ServiceError('access_denied');
    }
    const coachReg = await TrainingRegistration.findOne({
      where: { training_id: trainingId, user_id: actorId },
      include: [TrainingRole],
    });
    if (coachReg?.TrainingRole?.alias !== 'COACH') {
      throw new ServiceError('access_denied');
    }
  }

  const { rows } = await listByTraining(trainingId, {
    page: 1,
    limit: 1000,
  });

  const filtered = isAdmin
    ? rows
    : rows.filter((r) => r.TrainingRole?.alias !== 'COACH');
  const training = await Training.findByPk(trainingId, {
    include: [
      TrainingType,
      { model: CampStadium, include: [Address] },
      { model: Season, where: { active: true }, required: true },
    ],
  });
  return {
    rows: filtered,
    count: filtered.length,
    training: training ? training.get() : null,
  };
}

async function listUpcomingByUser(userId, options = {}) {
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { rows } = await Training.findAndCountAll({
    include: [
      TrainingType,
      { model: CampStadium, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: TrainingRegistration,
        include: [User, TrainingRole],
      },
    ],
    where: {
      [Op.or]: [
        { start_at: { [Op.between]: [now, end] } },
        {
          attendance_marked: false,
          start_at: { [Op.lt]: now },
        },
      ],
    },
    order: [['start_at', 'ASC']],
    limit,
    offset,
    distinct: true,
  });
  const mine = rows.filter((t) =>
    t.TrainingRegistrations.some((r) => r.user_id === userId)
  );
  return {
    rows: mine.map((t) => {
      const participantRegs = t.TrainingRegistrations.filter(
        (r) => r.TrainingRole?.alias === 'PARTICIPANT'
      );
      const registeredCount = participantRegs.length;
      const plain = t.get();
      const available =
        typeof plain.capacity === 'number'
          ? Math.max(0, plain.capacity - registeredCount)
          : null;
      const myReg = t.TrainingRegistrations.find((r) => r.user_id === userId);
      const myRole = myReg?.TrainingRole
        ? {
            id: myReg.TrainingRole.id,
            name: myReg.TrainingRole.name,
            alias: myReg.TrainingRole.alias,
          }
        : null;
      return {
        ...plain,
        available,
        registration_open: trainingService.isRegistrationOpen(
          t,
          registeredCount
        ),
        user_registered: true,
        my_role: myRole,
      };
    }),
    count: mine.length,
  };
}

async function listPastByUser(userId, options = {}) {
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const now = new Date();
  const { rows } = await Training.findAndCountAll({
    include: [
      TrainingType,
      { model: CampStadium, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: TrainingRegistration,
        include: [User, TrainingRole],
      },
    ],
    where: {
      end_at: { [Op.lt]: now },
      attendance_marked: true,
    },
    order: [['start_at', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  const mine = rows.filter((t) =>
    t.TrainingRegistrations.some((r) => r.user_id === userId)
  );
  return {
    rows: mine.map((t) => {
      const participantRegs = t.TrainingRegistrations.filter(
        (r) => r.TrainingRole?.alias === 'PARTICIPANT'
      );
      const registeredCount = participantRegs.length;
      const plain = t.get();
      const available =
        typeof plain.capacity === 'number'
          ? Math.max(0, plain.capacity - registeredCount)
          : null;
      const myReg = t.TrainingRegistrations.find((r) => r.user_id === userId);
      const myRole = myReg?.TrainingRole
        ? {
            id: myReg.TrainingRole.id,
            name: myReg.TrainingRole.name,
            alias: myReg.TrainingRole.alias,
          }
        : null;
      return {
        ...plain,
        available,
        registration_open: trainingService.isRegistrationOpen(
          t,
          registeredCount
        ),
        user_registered: true,
        my_role: myRole,
      };
    }),
    count: mine.length,
  };
}

async function listByTraining(trainingId, options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return TrainingRegistration.findAndCountAll({
    where: { training_id: trainingId },
    include: [{ model: User }, { model: TrainingRole }],
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
    ],
    limit,
    offset,
  });
}

async function remove(trainingId, userId, actorId = null) {
  const registration = await TrainingRegistration.findOne({
    where: { training_id: trainingId, user_id: userId },
  });
  if (!registration) throw new ServiceError('registration_not_found', 404);
  await registration.update({ updated_by: actorId });
  await registration.destroy();
  const [training, user] = await Promise.all([
    Training.findByPk(trainingId, {
      include: [{ model: Season, where: { active: true }, required: true }],
    }),
    User.findByPk(userId),
  ]);
  if (user && training) {
    await emailService.sendTrainingRegistrationCancelledEmail(user, training);
  }
}

export default {
  listAvailable,
  register,
  add,
  unregister,
  listUpcomingByUser,
  listPastByUser,
  listByTraining,
  listForAttendance,
  updateRole,
  updatePresence,
  remove,
};
