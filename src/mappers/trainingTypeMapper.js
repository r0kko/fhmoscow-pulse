function sanitize(obj) {
  const { id, name, alias, default_capacity } = obj;
  return { id, name, alias, default_capacity };
}

function toPublic(type) {
  if (!type) return null;
  const plain = typeof type.get === 'function' ? type.get({ plain: true }) : type;
  return sanitize(plain);
}

export default { toPublic };
