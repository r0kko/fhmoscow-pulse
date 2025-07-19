function sanitize(obj) {
  const { id, user_id, season_id, training_id, type_id, value_type_id, unit_id, value } = obj;
  return { id, user_id, season_id, training_id, type_id, value_type_id, unit_id, value };
}

function toPublic(result) {
  if (!result) return null;
  const plain = typeof result.get === 'function' ? result.get({ plain: true }) : result;
  return sanitize(plain);
}

export default { toPublic };
