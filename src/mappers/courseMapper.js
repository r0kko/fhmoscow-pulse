import userMapper from './userMapper.js';

function sanitize(obj) {
  const {
    id,
    name,
    description,
    responsible_id,
    telegram_url,
    Responsible,
    Users,
  } = obj;
  const res = { id, name, description, responsible_id, telegram_url };
  if (Responsible) {
    res.responsible = userMapper.toPublic(Responsible);
  }
  if (Users) {
    res.users = Users.map((u) => userMapper.toPublic(u));
  }
  return res;
}

function toPublic(course) {
  if (!course) return null;
  const plain =
    typeof course.get === 'function' ? course.get({ plain: true }) : course;
  return sanitize(plain);
}

export default { toPublic };
