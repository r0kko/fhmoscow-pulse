/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
export type TournamentUiEventName =
  | 'tournament_ui_opened'
  | 'tournament_schedule_filter_changed'
  | 'tournament_match_updated'
  | 'tournament_match_update_failed';

export interface TournamentUiEventPayload {
  event: TournamentUiEventName;
  tournamentId: string;
  mode?: string;
  status?: 'success' | 'error';
  detail?: string;
}

export function trackTournamentUiEvent(
  payload: TournamentUiEventPayload
): void {
  if (
    typeof window === 'undefined' ||
    typeof window.dispatchEvent !== 'function'
  )
    return;
  window.dispatchEvent(
    new CustomEvent('fhmo:tournament-ui', {
      detail: payload,
    })
  );
}
