function toPublic(entry) {
  if (!entry) return null;
  const plain =
    typeof entry.get === 'function' ? entry.get({ plain: true }) : entry;
  return {
    id: plain.id,
    first_name: plain.first_name,
    last_name: plain.last_name,
    patronymic: plain.patronymic,
    birth_date: plain.birth_date,
    passport: !!plain.Passport,
    inn: !!plain.Inn,
    snils: !!(plain.Snils || plain.Snil),
    bank_account: !!plain.BankAccount,
    addresses: plain.UserAddresses && plain.UserAddresses.length > 0,
    taxation_type: plain.Taxation?.TaxationType?.name || null,
  };
}

function toPublicArray(arr = []) {
  return arr.map(toPublic);
}

export default { toPublic, toPublicArray };
