function sanitize(obj) {
  const {
    id,
    start_at,
    end_at,
    capacity,
    MedicalCenter,
    available,
    user_registered,
  } = obj;
  const out = { id, start_at, end_at, capacity };
  if (typeof available !== 'undefined') out.available = available;
  if (typeof user_registered !== 'undefined') out.registered = user_registered;
  if (MedicalCenter) {
    out.center = { id: MedicalCenter.id, name: MedicalCenter.name };
  }
  return out;
}

function toPublic(exam) {
  if (!exam) return null;
  const plain =
    typeof exam.get === 'function' ? exam.get({ plain: true }) : exam;
  return sanitize(plain);
}

export default { toPublic };
