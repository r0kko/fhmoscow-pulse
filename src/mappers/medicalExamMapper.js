function sanitize(obj) {
  const {
    id,
    start_at,
    end_at,
    capacity,
    MedicalCenter,
    available,
    user_registered,
    registration_status,
    registration_count,
    approved_count,
  } = obj;
  const out = { id, start_at, end_at, capacity };
  if (typeof available !== 'undefined') out.available = available;
  if (typeof user_registered !== 'undefined') out.registered = user_registered;
  if (typeof registration_status !== 'undefined')
    out.registration_status = registration_status;
  if (typeof registration_count !== 'undefined')
    out.registration_count = registration_count;
  if (typeof approved_count !== 'undefined')
    out.approved_count = approved_count;
  if (MedicalCenter) {
    out.center = { id: MedicalCenter.id, name: MedicalCenter.name };
    if (MedicalCenter.Address) {
      out.center.address = {
        result: MedicalCenter.Address.result,
        metro: MedicalCenter.Address.metro,
      };
    }
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
