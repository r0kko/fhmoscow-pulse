function sanitize(obj) {
  const { id, name, alias } = obj;
  return { id, name, alias };
}

function toPublic(role) {
  if (!role) return null;
  const plain = typeof role.get === 'function' ? role.get({ plain: true }) : role;
  return sanitize(plain);
}

export default { toPublic };
