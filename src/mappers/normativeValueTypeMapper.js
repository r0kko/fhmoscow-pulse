function toPublic(val) {
  if (!val) return null;
  const plain = typeof val.get === 'function' ? val.get({ plain: true }) : val;
  const { id, name, alias } = plain;
  return { id, name, alias };
}

export default { toPublic };
