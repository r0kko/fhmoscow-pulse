function sanitize(obj) {
  const { id, name, alias, active } = obj;
  return { id, name, alias, active };
}

function toPublic(season) {
  if (!season) return null;
  const plain =
    typeof season.get === 'function' ? season.get({ plain: true }) : season;
  return sanitize(plain);
}

export default { toPublic };
