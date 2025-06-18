function sanitize(userObj) {
  const {
    id,
    first_name,
    last_name,
    patronymic,
    email,
    phone,
    birth_date,
    status_id,
    ...technical
  } = userObj;

  const {
    password,
    createdAt,
    updatedAt,
    deletedAt,
    created_at,
    updated_at,
    deleted_at,
    ...rest
  } = technical;

  void password;
  void createdAt;
  void updatedAt;
  void deletedAt;
  void created_at;
  void updated_at;
  void deleted_at;

  return {
    id,
    first_name,
    last_name,
    patronymic,
    email,
    phone,
    birth_date,
    status_id,
    ...rest,
  };
}

function toPublic(user) {
  if (!user) return null;
  const plain =
    typeof user.get === 'function' ? user.get({ plain: true }) : user;
  const sanitized = sanitize(plain);
  if (plain.Roles) {
    sanitized.roles = plain.Roles.map((r) => r.alias);
    sanitized.role_names = plain.Roles.map((r) => r.name);
  }
  if (plain.UserStatus) {
    sanitized.status = plain.UserStatus.alias;
    sanitized.status_name = plain.UserStatus.name;
  }
  return sanitized;
}

function toPublicArray(users = []) {
  return users.map(toPublic);
}

export default {
  toPublic,
  toPublicArray,
};
