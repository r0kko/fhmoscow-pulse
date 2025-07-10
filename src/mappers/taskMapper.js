function sanitize(obj) {
  const { id, title, description, TaskType, TaskStatus } = obj;
  const res = { id, title, description };
  if (TaskType) {
    res.type = {
      id: TaskType.id,
      name: TaskType.name,
      alias: TaskType.alias,
    };
  }
  if (TaskStatus) {
    res.status = {
      id: TaskStatus.id,
      name: TaskStatus.name,
      alias: TaskStatus.alias,
    };
  }
  return res;
}

function toPublic(task) {
  if (!task) return null;
  const plain = typeof task.get === 'function' ? task.get({ plain: true }) : task;
  return sanitize(plain);
}

export default { toPublic };
