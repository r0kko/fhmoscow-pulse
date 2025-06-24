function sanitize(obj) {
  const { id, check_date, registration_date, ogrn, okved, TaxationType } = obj;
  return {
    id,
    check_date,
    registration_date,
    ogrn,
    okved,
    type: TaxationType
      ? { id: TaxationType.id, name: TaxationType.name, alias: TaxationType.alias }
      : undefined,
  };
}

function toPublic(taxation) {
  if (!taxation) return null;
  const plain = typeof taxation.get === 'function' ? taxation.get({ plain: true }) : taxation;
  return sanitize(plain);
}

export default { toPublic };
