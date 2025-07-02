function sanitize(obj) {
  const { id, start_at, end_at, capacity, TrainingType, TrainingStatus } = obj;
  const res = { id, start_at, end_at, capacity };
  if (TrainingType) {
    res.type = {
      id: TrainingType.id,
      name: TrainingType.name,
      alias: TrainingType.alias,
    };
  }
  if (TrainingStatus) {
    res.status = {
      id: TrainingStatus.id,
      name: TrainingStatus.name,
      alias: TrainingStatus.alias,
    };
  }
  return res;
}

function toPublic(training) {
  if (!training) return null;
  const plain = typeof training.get === 'function' ? training.get({ plain: true }) : training;
  return sanitize(plain);
}

export default { toPublic };
