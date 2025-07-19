function toPublic(unit) {
  if (!unit) return null;
  const plain = typeof unit.get === 'function' ? unit.get({ plain: true }) : unit;
  const { id, name, alias, fractional } = plain;
  return { id, name, alias, fractional };
}

export default { toPublic };
