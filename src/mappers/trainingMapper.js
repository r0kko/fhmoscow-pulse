function sanitize(obj) {
  const {
    id,
    start_at,
    end_at,
    capacity,
    camp_stadium_id,
    TrainingType,
    TrainingStatus,
    CampStadium,
  } = obj;
  const res = { id, start_at, end_at, capacity, camp_stadium_id };
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
  if (CampStadium) {
    res.stadium = {
      id: CampStadium.id,
      name: CampStadium.name,
    };
  }
  return res;
}

function toPublic(training) {
  if (!training) return null;
  const plain =
    typeof training.get === 'function'
      ? training.get({ plain: true })
      : training;
  return sanitize(plain);
}

export default { toPublic };
