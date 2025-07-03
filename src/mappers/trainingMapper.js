function sanitize(obj) {
  const {
    id,
    start_at,
    end_at,
    capacity,
    camp_stadium_id,
    season_id,
    TrainingType,
    CampStadium,
    Season,
    RefereeGroups,
  } = obj;
  const res = {
    id,
    start_at,
    end_at,
    capacity,
    camp_stadium_id,
    season_id,
    registration_open: obj.registration_open,
  };
  if (TrainingType) {
    res.type = {
      id: TrainingType.id,
      name: TrainingType.name,
      alias: TrainingType.alias,
    };
  }
  if (CampStadium) {
    res.stadium = {
      id: CampStadium.id,
      name: CampStadium.name,
    };
  }
  if (Season) {
    res.season = {
      id: Season.id,
      name: Season.name,
      alias: Season.alias,
    };
  }
  if (RefereeGroups) {
    res.groups = RefereeGroups.map((g) => ({ id: g.id, name: g.name }));
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
