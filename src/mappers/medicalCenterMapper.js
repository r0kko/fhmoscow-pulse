function sanitize(obj) {
  const { id, name, inn, is_legal_entity, phone, email, website, Address } =
    obj;
  const out = { id, name, inn, is_legal_entity, phone, email, website };
  if (Address) {
    out.address = {
      id: Address.id,
      result: Address.result,
    };
  }
  return out;
}

function toPublic(center) {
  if (!center) return null;
  const plain =
    typeof center.get === 'function' ? center.get({ plain: true }) : center;
  return sanitize(plain);
}

export default { toPublic };
