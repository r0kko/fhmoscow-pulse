function toPublic(zone) {
  if (!zone) return null;
  const plain = typeof zone.get === 'function' ? zone.get({ plain: true }) : zone;
  const { id, season_id, name, alias, color } = plain;
  return { id, season_id, name, alias, color };
}

export default { toPublic };
