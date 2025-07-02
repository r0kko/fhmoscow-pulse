function sanitize(obj) {
  const { id, inn, organization, certificate_number, issue_date, valid_until } =
    obj;
  return {
    id,
    inn,
    organization,
    certificate_number,
    issue_date,
    valid_until,
  };
}

function toPublic(cert) {
  if (!cert) return null;
  const plain =
    typeof cert.get === 'function' ? cert.get({ plain: true }) : cert;
  const result = sanitize(plain);
  if (plain.user_id) result.user_id = plain.user_id;
  if (plain.User) {
    result.user = {
      id: plain.User.id,
      last_name: plain.User.last_name,
      first_name: plain.User.first_name,
      patronymic: plain.User.patronymic,
      birth_date: plain.User.birth_date,
    };
  }
  return result;
}

export default { toPublic };
