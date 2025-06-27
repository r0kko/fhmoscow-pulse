function sanitize(obj) {
  const {
    id,
    source,
    result,
    postal_code,
    country,
    region_with_type,
    city_with_type,
    street_with_type,
    house,
    flat,
    geo_lat,
    geo_lon,
    AddressType,
    ...rest
  } = obj;
  void rest.createdAt;
  void rest.updatedAt;
  void rest.deletedAt;
  void rest.created_at;
  void rest.updated_at;
  void rest.deleted_at;
  const out = {
    id,
    source,
    result,
    postal_code,
    country,
    region_with_type,
    city_with_type,
    street_with_type,
    house,
    flat,
    geo_lat,
    geo_lon,
  };
  if (AddressType) {
    out.address_type = AddressType.alias;
    out.address_type_name = AddressType.name;
  }
  return out;
}

function toPublic(address) {
  if (!address) return null;
  const plain =
    typeof address.get === 'function' ? address.get({ plain: true }) : address;
  return sanitize(plain);
}

export default { toPublic };
