import { Task, TaskType, TaskStatus, User } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listByUser(userId) {
  return Task.findAll({
    where: { user_id: userId },
    include: [TaskType, TaskStatus],
    order: [['created_at', 'ASC']],
  });
}

async function createForUser(userId, data, actorId) {
  const [user, type, status] = await Promise.all([
    User.findByPk(userId),
    TaskType.findOne({ where: { alias: data.type_alias } }),
    TaskStatus.findOne({ where: { alias: 'PENDING' } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!type) throw new ServiceError('task_type_not_found', 404);
  if (!status) throw new ServiceError('task_status_not_found', 404);
  const task = await Task.create({
    user_id: userId,
    type_id: type.id,
    status_id: status.id,
    title: data.title,
    description: data.description,
    created_by: actorId,
    updated_by: actorId,
  });
  return Task.findByPk(task.id, { include: [TaskType, TaskStatus] });
}

async function updateForUser(userId, taskId, data, actorId) {
  const task = await Task.findOne({
    where: { id: taskId, user_id: userId },
  });
  if (!task) throw new ServiceError('task_not_found', 404);

  let typeId = task.type_id;
  if (data.type_alias) {
    const type = await TaskType.findOne({ where: { alias: data.type_alias } });
    if (!type) throw new ServiceError('task_type_not_found', 404);
    typeId = type.id;
  }

  let statusId = task.status_id;
  if (data.status_alias) {
    const status = await TaskStatus.findOne({
      where: { alias: data.status_alias },
    });
    if (!status) throw new ServiceError('task_status_not_found', 404);
    statusId = status.id;
  }

  await task.update({
    title: data.title ?? task.title,
    description: data.description ?? task.description,
    type_id: typeId,
    status_id: statusId,
    updated_by: actorId,
  });

  return Task.findByPk(task.id, { include: [TaskType, TaskStatus] });
}

async function removeForUser(userId, taskId, actorId = null) {
  const task = await Task.findOne({ where: { id: taskId, user_id: userId } });
  if (!task) throw new ServiceError('task_not_found', 404);
  await task.update({ updated_by: actorId });
  await task.destroy();
}

export default { listByUser, createForUser, updateForUser, removeForUser };
