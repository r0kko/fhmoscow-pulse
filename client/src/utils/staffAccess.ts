const STAFF_POSITION_LABELS = {
  COACH: 'Тренер',
  ACCOUNTANT: 'Бухгалтер',
  MEDIA_MANAGER: 'Медиа-менеджер',
} as const;

type StaffAlias = keyof typeof STAFF_POSITION_LABELS;

type StaffInput = string | null | undefined;

export function getStaffPositionLabel(alias: StaffInput): string {
  if (!alias) return '';
  const key = String(alias).toUpperCase() as StaffAlias;
  return STAFF_POSITION_LABELS[key] ?? '';
}

export function formatStaffPositionList(aliases: StaffInput[] = []): string {
  const normalized = Array.from(
    new Set(aliases.filter(Boolean).map((item) => String(item).toUpperCase()))
  );

  const labels = normalized
    .map((alias) => getStaffPositionLabel(alias))
    .filter(Boolean);

  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} и ${labels.at(-1)}`;
}
