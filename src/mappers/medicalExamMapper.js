function sanitize(obj) {
  const { id, start_at, end_at, capacity, MedicalCenter, MedicalExamStatus } =
    obj;
  const out = { id, start_at, end_at, capacity };
  if (MedicalCenter) {
    out.center = { id: MedicalCenter.id, name: MedicalCenter.name };
  }
  if (MedicalExamStatus) {
    out.status = {
      id: MedicalExamStatus.id,
      name: MedicalExamStatus.name,
      alias: MedicalExamStatus.alias,
    };
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
