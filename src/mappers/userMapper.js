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
  return sanitize(plain);
}

function toPublicArray(users = []) {
  return users.map(toPublic);
}

export default {
  toPublic,
  toPublicArray,
};
