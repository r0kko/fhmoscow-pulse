function toPublic(zone) {
  if (!zone) return null;
  const plain =
    typeof zone.get === 'function' ? zone.get({ plain: true }) : zone;
  const { id, name, alias, color } = plain;
  return { id, name, alias, color };
}

export default { toPublic };
