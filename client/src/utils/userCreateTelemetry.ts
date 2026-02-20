export type UserCreateTelemetryEventName =
  | 'user_create_submit'
  | 'user_create_validation_error'
  | 'user_create_delivery_failed';

export interface UserCreateTelemetryPayload {
  event: UserCreateTelemetryEventName;
  field?: string;
  code?: string | null;
}

export function trackUserCreateTelemetry(
  payload: UserCreateTelemetryPayload
): void {
  if (
    typeof window === 'undefined' ||
    typeof window.dispatchEvent !== 'function'
  )
    return;
  window.dispatchEvent(
    new CustomEvent('fhmo:user-create', {
      detail: payload,
    })
  );
}
