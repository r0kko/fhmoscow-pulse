function sanitize(obj) {
  const {
    id,
    series,
    number,
    issue_date,
    valid_until,
    issuing_authority,
    issuing_authority_code,
    place_of_birth,
    DocumentType,
    Country,
    ...tech
  } = obj;

  void tech.createdAt;
  void tech.updatedAt;
  void tech.deletedAt;
  void tech.created_at;
  void tech.updated_at;
  void tech.deleted_at;

  const out = {
    id,
    series,
    number,
    issue_date,
    valid_until,
    issuing_authority,
    issuing_authority_code,
    place_of_birth,
  };

  if (DocumentType) {
    out.document_type = DocumentType.alias;
    out.document_type_name = DocumentType.name;
  }
  if (Country) {
    out.country = Country.alias;
    out.country_name = Country.name;
  }
  return out;
}

function toPublic(passport) {
  if (!passport) return null;
  const plain =
    typeof passport.get === 'function' ? passport.get({ plain: true }) : passport;
  return sanitize(plain);
}

export default { toPublic };
