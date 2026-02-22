import { onUnmounted } from 'vue';

import { apiFetch } from '../api';
import type { CalendarApiResponse } from '../types/adminSportsCalendar';

export interface AdminCalendarLoadParams {
  dayWindow: number;
  horizonDays: number;
  direction: 'forward' | 'backward';
  anchorDate: string;
  search: string;
  homeClubs: string[];
  awayClubs: string[];
  tournaments: string[];
  groups: string[];
  stadiums: string[];
}

function appendMulti(params: URLSearchParams, key: string, values: string[]) {
  for (const value of values || []) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    params.append(key, normalized);
  }
}

export function useAdminCalendarData() {
  let abortController: AbortController | null = null;

  async function loadCalendar(
    input: AdminCalendarLoadParams
  ): Promise<CalendarApiResponse> {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    const controller = new AbortController();
    abortController = controller;
    const params = new URLSearchParams();
    params.set('game_days', 'true');
    params.set('count', String(input.dayWindow));
    params.set('horizon', String(input.horizonDays));
    params.set('direction', input.direction);
    if (input.anchorDate) params.set('anchor', input.anchorDate);
    if (input.search.trim()) params.set('q', input.search.trim());
    appendMulti(params, 'home_club', input.homeClubs);
    appendMulti(params, 'away_club', input.awayClubs);
    appendMulti(params, 'tournament', input.tournaments);
    appendMulti(params, 'group', input.groups);
    appendMulti(params, 'stadium', input.stadiums);
    try {
      return (await apiFetch(`/matches/admin/calendar?${params.toString()}`, {
        signal: controller.signal,
      })) as CalendarApiResponse;
    } finally {
      if (abortController === controller) {
        abortController = null;
      }
    }
  }

  function cancelPending() {
    if (!abortController) return;
    abortController.abort();
    abortController = null;
  }

  onUnmounted(() => {
    cancelPending();
  });

  return {
    loadCalendar,
    cancelPending,
  };
}
