const STAFF_POSITION_LABELS = {
  COACH: 'Тренер',
  ACCOUNTANT: 'Бухгалтер',
  MEDIA_MANAGER: 'Медиа-менеджер',
};

export function getStaffPositionLabel(alias) {
  if (!alias) return '';
  const key = String(alias).toUpperCase();
  return STAFF_POSITION_LABELS[key] || '';
}

export function formatStaffPositionList(aliases = []) {
  const normalized = Array.from(
    new Set(
      (aliases || [])
        .filter(Boolean)
        .map((alias) => String(alias).toUpperCase())
    )
  );
  const labels = normalized
    .map((alias) => getStaffPositionLabel(alias))
    .filter(Boolean);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} и ${labels.at(-1)}`;
}
