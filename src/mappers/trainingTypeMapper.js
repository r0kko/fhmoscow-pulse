function sanitize(obj) {
  const { id, name, alias, default_capacity, online } = obj;
  return { id, name, alias, default_capacity, online };
}

function toPublic(type) {
  if (!type) return null;
  const plain =
    typeof type.get === 'function' ? type.get({ plain: true }) : type;
  return sanitize(plain);
}

export default { toPublic };
