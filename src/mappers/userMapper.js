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
    ...rest
  } = userObj;

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
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  return sanitize(plain);
}

function toPublicArray(users = []) {
  return users.map(toPublic);
}

export default {
  toPublic,
  toPublicArray,
};
