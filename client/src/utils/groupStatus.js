// Determine completion state for a normative group based on the user's results
// `group.types` should contain the best result for the current user in `type.result`
// with zone aliases `GREEN` or `YELLOW` considered as passed
export function calculateGroupStatus(group) {
  const counters = group.types?.reduce(
    (acc, type) => {
      const link = (type.groups || []).find((g) => g.group_id === group.id);
      const required = Boolean(link ? link.required : type.required);
      const passed =
        !!type.result && ['GREEN', 'YELLOW'].includes(type.result.zone?.alias);
      if (required) {
        acc.total++;
        if (passed) acc.done++;
      } else {
        acc.optional++;
        if (passed) acc.doneOptional++;
      }
      return acc;
    },
    { total: 0, done: 0, optional: 0, doneOptional: 0 }
  );

  let { total, done, optional, doneOptional } = counters;
  if (optional > 1) {
    total += 1;
    if (doneOptional > 0) done += 1;
  }

  if (total === 0 || done >= total) {
    return { icon: 'bi-check-circle text-success', text: 'Все сдано' };
  }
  if (done === 0) {
    return { icon: 'bi-x-circle text-danger', text: 'Нет сданных нормативов' };
  }

  const left = total - done;
  return {
    icon: 'bi-exclamation-triangle text-warning',
    text: `Осталось сдать ${left} / ${total} нормативов`,
  };
}

export default { calculateGroupStatus };
