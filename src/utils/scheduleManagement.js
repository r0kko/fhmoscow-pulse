export const SCHEDULE_MANAGEMENT_ALIASES = Object.freeze({
  PARTICIPANTS: 'PARTICIPANTS',
  ORGANIZER: 'ORGANIZER',
});

export function normalizeScheduleManagementAlias(alias) {
  if (!alias) return null;
  const normalized = String(alias).trim();
  return normalized ? normalized.toUpperCase() : null;
}

export function resolveScheduleManagementAlias(match) {
  const alias =
    match?.Tournament?.ScheduleManagementType?.alias ||
    match?.ScheduleManagementType?.alias ||
    match?.schedule_management_type?.alias ||
    null;
  return normalizeScheduleManagementAlias(alias);
}

export function isAgreementsBlockedBySchedule(match) {
  const alias = resolveScheduleManagementAlias(match);
  return alias === SCHEDULE_MANAGEMENT_ALIASES.ORGANIZER;
}
