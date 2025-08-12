import {
  Course,
  User,
  UserCourse,
  Training,
  TrainingRegistration,
  TrainingType,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return Course.findAndCountAll({
    include: [{ model: User, as: 'Responsible' }],
    order: [['name', 'ASC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const course = await Course.findByPk(id, {
    include: [{ model: User, as: 'Responsible' }, { model: User }],
  });
  if (!course) throw new ServiceError('course_not_found', 404);
  return course;
}

async function create(data, actorId) {
  const responsible = await User.findByPk(data.responsible_id);
  if (!responsible) throw new ServiceError('user_not_found', 404);
  return Course.create({
    name: data.name,
    description: data.description,
    responsible_id: data.responsible_id,
    telegram_url: data.telegram_url,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function update(id, data, actorId) {
  const course = await Course.findByPk(id);
  if (!course) throw new ServiceError('course_not_found', 404);
  if (data.responsible_id) {
    const responsible = await User.findByPk(data.responsible_id);
    if (!responsible) throw new ServiceError('user_not_found', 404);
  }
  await course.update(
    {
      name: data.name ?? course.name,
      description: data.description ?? course.description,
      responsible_id: data.responsible_id ?? course.responsible_id,
      telegram_url: data.telegram_url ?? course.telegram_url,
      updated_by: actorId,
    },
    { returning: false }
  );
  return getById(id);
}

async function remove(id, actorId = null) {
  const course = await Course.findByPk(id);
  if (!course) throw new ServiceError('course_not_found', 404);
  await course.update({ updated_by: actorId });
  await course.destroy();
}

async function setUserCourse(userId, courseId, actorId) {
  const [user, course] = await Promise.all([
    User.findByPk(userId),
    Course.findByPk(courseId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!course) throw new ServiceError('course_not_found', 404);
  let link = await UserCourse.findOne({
    where: { user_id: userId },
    paranoid: false,
  });
  if (link) {
    if (link.deletedAt) {
      await link.restore();
    }
    await link.update({ course_id: courseId, updated_by: actorId });
  } else {
    link = await UserCourse.create({
      user_id: userId,
      course_id: courseId,
      created_by: actorId,
      updated_by: actorId,
    });
  }
  return link;
}

async function removeUser(userId, actorId = null) {
  const link = await UserCourse.findOne({ where: { user_id: userId } });
  if (link) {
    await link.update({ updated_by: actorId });
    await link.destroy();
  }
}

async function getUserWithCourse(userId) {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: UserCourse,
        include: [
          {
            model: Course,
            include: [{ model: User, as: 'Responsible' }],
          },
        ],
      },
    ],
  });
  if (!user) throw new ServiceError('user_not_found', 404);
  const course = user.UserCourse ? user.UserCourse.Course : null;
  return { user, course };
}

async function getTrainingStats(userId, courseId) {
  const { Op } = await import('sequelize');
  const [visited, total] = await Promise.all([
    TrainingRegistration.count({
      where: { user_id: userId, present: true },
      include: [
        {
          model: Training,
          required: true,
          where: { start_at: { [Op.lte]: new Date() } },
          include: [
            {
              model: Course,
              through: { attributes: [] },
              where: { id: courseId },
              required: true,
            },
            { model: TrainingType, where: { for_camp: false }, required: true },
          ],
        },
      ],
    }),
    Training.count({
      include: [
        {
          model: Course,
          through: { attributes: [] },
          where: { id: courseId },
          required: true,
        },
        { model: TrainingType, where: { for_camp: false }, required: true },
      ],
    }),
  ]);
  return { visited, total };
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  setUserCourse,
  removeUser,
  getUserWithCourse,
  getTrainingStats,
};
