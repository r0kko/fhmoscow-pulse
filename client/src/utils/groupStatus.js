export function calculateGroupStatus(group) {
  let required = 0;
  let doneRequired = 0;
  let optional = 0;
  let doneOptional = 0;
  for (const t of group.types || []) {
    const map = (t.groups || []).find((g) => g.group_id === group.id);
    const isRequired = Boolean(map ? map.required : t.required);
    const passed = t.result && ['GREEN', 'YELLOW'].includes(t.result.zone?.alias);
    if (isRequired) {
      required++;
      if (passed) doneRequired++;
    } else {
      optional++;
      if (passed) doneOptional++;
    }
  }
  let total = required;
  let done = doneRequired;
  if (optional > 1) {
    total += 1;
    if (doneOptional > 0) done += 1;
  }
  if (total === 0 || done >= total)
    return { icon: 'bi-check-circle text-success', text: 'Все сдано' };
  if (done === 0)
    return { icon: 'bi-x-circle text-danger', text: 'Нет сданных нормативов' };
  const left = total - done;
  return {
    icon: 'bi-exclamation-triangle text-warning',
    text: `Осталось сдать ${left} / ${total} нормативов`,
  };
}

export default { calculateGroupStatus };
