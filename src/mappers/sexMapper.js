function sanitize(obj) {
  const { id, name, alias } = obj;
  return { id, name, alias };
}

function toPublic(sex) {
  if (!sex) return null;
  const plain = typeof sex.get === 'function' ? sex.get({ plain: true }) : sex;
  return sanitize(plain);
}

export default { toPublic };
