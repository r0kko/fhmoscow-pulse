export type AdminSportsCalendarEventName =
  | 'admin_sports_calendar_opened'
  | 'admin_sports_calendar_filters_applied'
  | 'admin_sports_calendar_filters_reset'
  | 'admin_sports_calendar_day_selected'
  | 'admin_sports_calendar_load_failed';

export interface AdminSportsCalendarEventPayload {
  event: AdminSportsCalendarEventName;
  status?: 'success' | 'error';
  detail?: string;
  direction?: 'forward' | 'backward';
  filtersCount?: number;
}

export function trackAdminSportsCalendarEvent(
  payload: AdminSportsCalendarEventPayload
): void {
  if (
    typeof window === 'undefined' ||
    typeof window.dispatchEvent !== 'function'
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent('fhmo:admin-sports-calendar', {
      detail: payload,
    })
  );
}
