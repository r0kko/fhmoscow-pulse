function sanitize(obj) {
  const {
    id,
    number,
    bic,
    bank_name,
    correspondent_account,
    swift,
    inn,
    kpp,
    address,
  } = obj;
  return {
    id,
    number,
    bic,
    bank_name,
    correspondent_account,
    swift,
    inn,
    kpp,
    address,
  };
}

function toPublic(acc) {
  if (!acc) return null;
  const plain = typeof acc.get === 'function' ? acc.get({ plain: true }) : acc;
  return sanitize(plain);
}

export default { toPublic };
