function sanitize(obj) {
  const {
    id,
    season_id,
    name,
    alias,
    required,
    online_available,
    value_type_id,
    unit_id,
    zones,
    groups,
  } = obj;
  const res = {
    id,
    season_id,
    name,
    alias,
    required,
    online_available,
    value_type_id,
    unit_id,
  };
  if (Array.isArray(zones)) res.zones = zones;
  if (Array.isArray(groups)) res.groups = groups;
  return res;
}

function toPublic(type) {
  if (!type) return null;
  const plain =
    typeof type.get === 'function' ? type.get({ plain: true }) : type;
  if (plain.NormativeTypeZones) {
    plain.zones = plain.NormativeTypeZones.map((z) => ({
      id: z.id,
      zone_id: z.zone_id,
      sex_id: z.sex_id,
      min_value: z.min_value,
      max_value: z.max_value,
    }));
  }
  if (plain.NormativeGroupTypes) {
    plain.groups = plain.NormativeGroupTypes.map((g) => ({
      id: g.id,
      group_id: g.group_id,
      required: g.required,
    }));
  }
  return sanitize(plain);
}

export default { toPublic };
