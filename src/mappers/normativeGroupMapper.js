function sanitize(obj) {
  const { id, season_id, name, alias, required } = obj;
  return { id, season_id, name, alias, required };
}

function toPublic(group) {
  if (!group) return null;
  const plain =
    typeof group.get === 'function' ? group.get({ plain: true }) : group;
  return sanitize(plain);
}

export default { toPublic };
