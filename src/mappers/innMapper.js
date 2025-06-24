function sanitize(obj) {
  const { id, number } = obj;
  return { id, number };
}

function toPublic(inn) {
  if (!inn) return null;
  const plain = typeof inn.get === 'function' ? inn.get({ plain: true }) : inn;
  return sanitize(plain);
}

export default { toPublic };
