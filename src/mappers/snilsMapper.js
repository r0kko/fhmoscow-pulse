function sanitize(obj) {
  const { id, number } = obj;
  return { id, number };
}

function toPublic(snils) {
  if (!snils) return null;
  const plain = typeof snils.get === 'function' ? snils.get({ plain: true }) : snils;
  return sanitize(plain);
}

export default { toPublic };
