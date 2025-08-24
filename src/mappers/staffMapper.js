function buildFullName(staff) {
  return [staff.surname, staff.name, staff.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export default {
  toPublic(staff) {
    if (!staff) return null;
    return {
      id: staff.id,
      external_id: staff.external_id,
      surname: staff.surname || null,
      name: staff.name || null,
      patronymic: staff.patronymic || null,
      full_name: buildFullName(staff),
      date_of_birth: staff.date_of_birth || null,
    };
  },
  toPublicArray(list = []) {
    return list.map((x) => this.toPublic(x));
  },
};
