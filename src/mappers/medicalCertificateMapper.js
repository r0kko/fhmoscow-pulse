function sanitize(obj) {
  const { id, inn, organization, certificate_number, issue_date, valid_until } =
    obj;
  return { id, inn, organization, certificate_number, issue_date, valid_until };
}

function toPublic(cert) {
  if (!cert) return null;
  const plain =
    typeof cert.get === 'function' ? cert.get({ plain: true }) : cert;
  return sanitize(plain);
}

export default { toPublic };
