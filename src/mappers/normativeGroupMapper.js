function sanitize(obj) {
  const { id, season_id, name, alias } = obj;
  return { id, season_id, name, alias };
}

function toPublic(group) {
  if (!group) return null;
  const plain = typeof group.get === 'function' ? group.get({ plain: true }) : group;
  return sanitize(plain);
}

export default { toPublic };
