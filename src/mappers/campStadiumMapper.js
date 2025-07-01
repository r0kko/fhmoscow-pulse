function sanitize(obj) {
  const {
    id,
    name,
    yandex_url,
    capacity,
    phone,
    website,
    Address,
    ParkingTypes,
    ...rest
  } = obj;
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
    };
  }
  if (ParkingTypes) {
    res.parking = ParkingTypes.map((p) => ({
      type: p.alias,
      type_name: p.name,
      price: p.CampStadiumParkingType.price,
    }));
  }
  return res;
}

function toPublic(stadium) {
  if (!stadium) return null;
  const plain =
    typeof stadium.get === 'function' ? stadium.get({ plain: true }) : stadium;
  return sanitize(plain);
}

export default { toPublic };
