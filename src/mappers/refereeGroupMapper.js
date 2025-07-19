function sanitize(obj) {
  const { id, name, season_id, Season } = obj;
  const res = { id, name, season_id };
  if (Season) {
    res.season = { id: Season.id, name: Season.name, alias: Season.alias };
  }
  return res;
}

function toPublic(group) {
  if (!group) return null;
  const plain =
    typeof group.get === 'function' ? group.get({ plain: true }) : group;
  return sanitize(plain);
}

export default { toPublic };
