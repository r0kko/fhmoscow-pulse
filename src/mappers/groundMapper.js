function sanitize(obj) {
  const { id, name, yandex_url, capacity, phone, website, Address, ...rest } =
    obj;
  void rest.createdAt;
  void rest.updatedAt;
  void rest.deletedAt;
  void rest.created_at;
  void rest.updated_at;
  void rest.deleted_at;
  const res = { id, name, yandex_url, capacity, phone, website };
  if (Address) {
    res.address = {
      id: Address.id,
      result: Address.result,
      geo_lat: Address.geo_lat,
      geo_lon: Address.geo_lon,
      metro: Address.metro,
    };
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
