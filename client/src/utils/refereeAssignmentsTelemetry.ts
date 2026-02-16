type RefereeAssignmentsEventStatus = 'success' | 'error';

export interface RefereeAssignmentsTelemetryPayload {
  action: 'confirm_day';
  status: RefereeAssignmentsEventStatus;
  durationMs: number;
  date: string;
  confirmedCount?: number;
  errorCode?: string | null;
}

export function trackRefereeAssignmentsTelemetry(
  payload: RefereeAssignmentsTelemetryPayload
): void {
  if (
    typeof window === 'undefined' ||
    typeof window.dispatchEvent !== 'function'
  )
    return;
  window.dispatchEvent(
    new CustomEvent('fhmo:referee-assignments', {
      detail: payload,
    })
  );
}
