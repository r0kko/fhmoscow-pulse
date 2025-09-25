export type StatusFilterScope = 'all' | 'attention' | 'pending' | 'accepted';

export type TimeScope = 'upcoming' | 'past';

export interface CalendarFilterChip {
  key: string;
  type: string;
  value: string;
  label: string;
  icon?: string;
}

export interface CalendarFilterDraft {
  homeClubs: string[];
  awayClubs: string[];
  tournaments: string[];
  groups: string[];
  stadiums: string[];
  homeCand: string;
  awayCand: string;
  tournamentCand: string;
  groupCand: string;
  stadiumCand: string;
  statusScope: StatusFilterScope;
  timeScope: TimeScope;
  dayWindow: number;
  anchorDate: string;
}

export interface StatusOption {
  value: StatusFilterScope;
  label: string;
  icon?: string;
}

export interface TabItem {
  key: string | number;
  label: string;
  subLabel?: string;
  badge?: number | string;
}
