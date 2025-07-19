function sanitize(obj) {
  const { id, season_id, name, alias, required, value_type_id, unit_id } = obj;
  return { id, season_id, name, alias, required, value_type_id, unit_id };
}

function toPublic(type) {
  if (!type) return null;
  const plain =
    typeof type.get === 'function' ? type.get({ plain: true }) : type;
  if (plain.NormativeTypeZones) {
    plain.zones = plain.NormativeTypeZones.map((z) => ({
      id: z.id,
      zone_id: z.zone_id,
      min_value: z.min_value,
      max_value: z.max_value,
    }));
  }
  return sanitize(plain);
}

export default { toPublic };
