function sanitize(obj) {
  const { id, external_id, name, yandex_url, Address, Clubs, Teams, ...rest } =
    obj;
  void rest.createdAt;
  void rest.updatedAt;
  void rest.deletedAt;
  void rest.created_at;
  void rest.updated_at;
  void rest.deleted_at;
  const res = { id, external_id, name, yandex_url };
  if (Address) {
    res.address = {
      id: Address.id,
      result: Address.result,
      geo_lat: Address.geo_lat,
      geo_lon: Address.geo_lon,
      metro: Address.metro,
    };
  }
  if (Array.isArray(Clubs)) {
    res.clubs = Clubs.map((c) => ({ id: c.id, name: c.name }));
  }
  if (Array.isArray(Teams)) {
    res.teams = Teams.map((t) => ({
      id: t.id,
      name: t.name,
      birth_year: t.birth_year,
      club_id: t.club_id || null,
    }));
  }
  return res;
}

function toPublic(ground) {
  if (!ground) return null;
  const plain =
    typeof ground.get === 'function' ? ground.get({ plain: true }) : ground;
  return sanitize(plain);
}

export default { toPublic };
