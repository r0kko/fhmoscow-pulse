/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { ref, watch, type Ref } from 'vue';
import type {
  LocationQuery,
  Router,
  RouteLocationNormalizedLoaded,
} from 'vue-router';

function queryString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || '');
  return typeof value === 'string' ? value : '';
}

function cloneQuery(query: LocationQuery): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const normalized = queryString(value);
    if (normalized) next[key] = normalized;
  }
  return next;
}

function isSameQuery(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function getStorageKey(
  prefix: string,
  route: RouteLocationNormalizedLoaded
): string {
  return `${prefix}:${String(route.params.tournamentId || 'global')}`;
}

function readSessionState(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeSessionState(key: string, payload: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

function syncRouteQuery(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  patch: Record<string, string>
): void {
  const current = cloneQuery(route.query);
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value) next[key] = value;
    else delete next[key];
  }
  if (isSameQuery(current, next)) return;
  void router.replace({ query: next });
}

export interface StructureRouteState {
  stageId: Ref<string>;
  groupId: Ref<string>;
  teamSearch: Ref<string>;
}

export function useStructureRouteState(
  route: RouteLocationNormalizedLoaded,
  router: Router
): StructureRouteState {
  const storageKey = getStorageKey('admin-tournament-structure', route);
  const cached = readSessionState(storageKey);
  const stageId = ref(queryString(route.query.stage) || cached.stage || '');
  const groupId = ref(queryString(route.query.group) || cached.group || '');
  const teamSearch = ref(
    queryString(route.query.team_q) || cached.team_q || ''
  );

  watch(
    () => route.query,
    (query) => {
      const stage = queryString(query.stage);
      const group = queryString(query.group);
      const teamQ = queryString(query.team_q);
      if (stage !== stageId.value) stageId.value = stage;
      if (group !== groupId.value) groupId.value = group;
      if (teamQ !== teamSearch.value) teamSearch.value = teamQ;
    }
  );

  watch([stageId, groupId, teamSearch], ([stage, group, teamQ]) => {
    writeSessionState(storageKey, {
      stage,
      group,
      team_q: teamQ,
    });
    syncRouteQuery(route, router, {
      stage,
      group,
      team_q: teamQ,
      month: '',
      day: '',
      view: '',
      section: '',
      stage_id: '',
      status: '',
      q: '',
      page: '',
      limit: '',
    });
  });

  return { stageId, groupId, teamSearch };
}

export interface ScheduleRouteState {
  view: Ref<string>;
  month: Ref<string>;
  day: Ref<string>;
  stageId: Ref<string>;
  status: Ref<string>;
  search: Ref<string>;
  page: Ref<number>;
  limit: Ref<number>;
}

export function useScheduleRouteState(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  defaults: { view: string; month: string; day: string; limit: number }
): ScheduleRouteState {
  const storageKey = getStorageKey('admin-tournament-schedule', route);
  const cached = readSessionState(storageKey);
  const view = ref(
    queryString(route.query.view) || cached.view || defaults.view
  );
  const month = ref(
    queryString(route.query.month) || cached.month || defaults.month
  );
  const day = ref(queryString(route.query.day) || cached.day || defaults.day);
  const stageId = ref(
    queryString(route.query.stage_id) || cached.stage_id || ''
  );
  const status = ref(queryString(route.query.status) || cached.status || '');
  const search = ref(queryString(route.query.q) || cached.q || '');
  const page = ref(
    Number.parseInt(queryString(route.query.page) || cached.page || '', 10) || 1
  );
  const limit = ref(
    Number.parseInt(queryString(route.query.limit) || cached.limit || '', 10) ||
      defaults.limit
  );

  watch(
    () => route.query,
    (query) => {
      const nextView = queryString(query.view) || defaults.view;
      const nextMonth = queryString(query.month) || defaults.month;
      const nextDay = queryString(query.day) || defaults.day;
      const nextStage = queryString(query.stage_id);
      const nextStatus = queryString(query.status);
      const nextSearch = queryString(query.q);
      const nextPage = Number.parseInt(queryString(query.page), 10) || 1;
      const nextLimit =
        Number.parseInt(queryString(query.limit), 10) || defaults.limit;

      if (nextView !== view.value) view.value = nextView;
      if (nextMonth !== month.value) month.value = nextMonth;
      if (nextDay !== day.value) day.value = nextDay;
      if (nextStage !== stageId.value) stageId.value = nextStage;
      if (nextStatus !== status.value) status.value = nextStatus;
      if (nextSearch !== search.value) search.value = nextSearch;
      if (nextPage !== page.value) page.value = nextPage;
      if (nextLimit !== limit.value) limit.value = nextLimit;
    }
  );

  watch([view, month, day, stageId, status, search, page, limit], () => {
    writeSessionState(storageKey, {
      view: view.value,
      month: month.value,
      day: day.value,
      stage_id: stageId.value,
      status: status.value,
      q: search.value,
      page: String(page.value || 1),
      limit: String(limit.value || defaults.limit),
    });
    syncRouteQuery(route, router, {
      view: view.value,
      month: month.value,
      day: day.value,
      stage_id: stageId.value,
      status: status.value,
      q: search.value,
      page: String(page.value || 1),
      limit: String(limit.value || defaults.limit),
      stage: '',
      group: '',
      team_q: '',
      section: '',
    });
  });

  return {
    view,
    month,
    day,
    stageId,
    status,
    search,
    page,
    limit,
  };
}

export interface SettingsRouteState {
  section: Ref<string>;
  stageId: Ref<string>;
}

export function useSettingsRouteState(
  route: RouteLocationNormalizedLoaded,
  router: Router
): SettingsRouteState {
  const storageKey = getStorageKey('admin-tournament-settings', route);
  const cached = readSessionState(storageKey);
  const section = ref(
    queryString(route.query.section) || cached.section || 'main'
  );
  const stageId = ref(queryString(route.query.stage) || cached.stage || '');

  watch(
    () => route.query,
    (query) => {
      const nextSection = queryString(query.section) || 'main';
      const nextStage = queryString(query.stage);
      if (nextSection !== section.value) section.value = nextSection;
      if (nextStage !== stageId.value) stageId.value = nextStage;
    }
  );

  watch([section, stageId], () => {
    writeSessionState(storageKey, {
      section: section.value,
      stage: stageId.value,
    });
    syncRouteQuery(route, router, {
      section: section.value,
      stage: stageId.value,
      month: '',
      day: '',
      view: '',
      stage_id: '',
      status: '',
      q: '',
      page: '',
      limit: '',
      group: '',
      team_q: '',
    });
  });

  return { section, stageId };
}
