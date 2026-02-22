export type StatusFilterScope = 'all' | 'attention' | 'pending' | 'accepted';

export type TimeScope = 'upcoming' | 'past';

export interface CalendarMatchStatus {
  alias?: string | null;
  name?: string | null;
}

export interface CalendarMatch {
  id: string;
  date: string;
  team1: string | null;
  team2: string | null;
  home_club?: string | null;
  away_club?: string | null;
  stadium?: string | null;
  tournament?: string | null;
  group?: string | null;
  tour?: string | number | null;
  urgent_unagreed?: boolean;
  needs_attention?: boolean;
  agreement_accepted?: boolean;
  agreement_pending?: boolean;
  agreements_allowed?: boolean;
  status?: CalendarMatchStatus | null;
  technical_winner?: string | null;
  score_team1?: number | null;
  score_team2?: number | null;
  is_home?: boolean;
  is_away?: boolean;
  is_both_teams?: boolean;
}

export interface CalendarRange {
  start: string;
  end_exclusive: string;
}

export interface CalendarApiMeta {
  attention_days: number;
  search_max_len: number;
  direction: 'forward' | 'backward' | 'both';
  result_count?: number;
  requested_anchor?: string | null;
  requested_direction?: 'forward' | 'backward' | 'both';
  requested_count?: number;
  requested_horizon?: number;
  constraint_flags?: {
    has_search?: boolean;
    has_structural_filters?: boolean;
  };
}

export interface CalendarDayTab {
  day_key: number;
  count: number;
  attention_count: number;
}

export interface CalendarApiResponse {
  matches?: CalendarMatch[];
  range?: CalendarRange | null;
  day_tabs?: CalendarDayTab[];
  meta?: Partial<CalendarApiMeta> | null;
}

export interface CalendarPersistedState {
  anchorDate: string;
  timeScope: TimeScope;
  statusScope: StatusFilterScope;
  search: string;
  selectedHomeClubs: string[];
  selectedAwayClubs: string[];
  selectedTournaments: string[];
  selectedGroups: string[];
  selectedStadiums: string[];
  activeDayKey: number | null;
}
