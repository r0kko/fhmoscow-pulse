/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { computed, ref, type Ref, watch } from 'vue';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';
import { trackTournamentUiEvent } from '../utils/tournamentUiTelemetry';

interface ScheduleStateRefs {
  view: Ref<string>;
  month: Ref<string>;
  day: Ref<string>;
  stageId: Ref<string>;
  status: Ref<string>;
  search: Ref<string>;
  page: Ref<number>;
  limit: Ref<number>;
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toDayKey(dateLike: string | Date): string {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`;
}

function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Выберите день';
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  });
}

function getMonthDateRange(
  monthKey: string
): { from: string; to: string } | null {
  const [yearRaw, monthRaw] = String(monthKey || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(monthLastDay).padStart(2, '0')}`;
  return { from, to };
}

function getWeekDateRange(day: string): { from: string; to: string } | null {
  const selected = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(selected.getTime())) return null;
  const weekday = selected.getUTCDay();
  const mondayShift = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() + mondayShift);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toDayKey(monday), to: toDayKey(sunday) };
}

export function useTournamentSchedule(
  tournamentId: Ref<string>,
  isImportedTournament: Ref<boolean>,
  routeState: ScheduleStateRefs,
  options: {
    stages: Ref<any[]>;
    grounds: Ref<any[]>;
    tournamentTeams: Ref<any[]>;
  }
) {
  const { showToast } = useToast();

  const loading = ref(false);
  const error = ref('');
  const matches = ref<any[]>([]);
  const total = ref(0);
  const summary = ref({ total: 0, upcoming: 0, past: 0, cancelled: 0 });
  const days = ref<Array<{ day: string; count: number }>>([]);
  const requestToken = ref(0);

  const createForm = ref({
    date_start: '',
    stage_id: '',
    ground_id: '',
    home_team_id: '',
    away_team_id: '',
  });
  const createLoading = ref(false);
  const createError = ref('');

  const editOpen = ref(false);
  const editLoading = ref(false);
  const editError = ref('');
  const editForm = ref({ id: '', date_start: '', ground_id: '' });

  const deleteLoading = ref<string | null>(null);

  const searchInput = ref(routeState.search.value);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const dayCountMap = computed(() => {
    const map = new Map<string, number>();
    for (const row of days.value || []) {
      map.set(row.day, Number(row.count || 0));
    }
    return map;
  });

  const selectedDay = computed(() => {
    const day = routeState.day.value;
    if (day) return day;
    const first = days.value[0]?.day;
    if (first) return first;
    return toDayKey(new Date());
  });

  const dayMatches = computed(() => {
    const key = selectedDay.value;
    return (matches.value || []).filter(
      (match) => toDayKey(match.date_start) === key
    );
  });

  const matchIsPast = (match: any): boolean => {
    const startedAt = new Date(match?.date_start || '').getTime();
    return Number.isFinite(startedAt) && startedAt < Date.now();
  };

  const weekDays = computed(() => {
    const key = selectedDay.value;
    const selected = new Date(`${key}T00:00:00Z`);
    if (Number.isNaN(selected.getTime())) return [];
    const day = selected.getUTCDay();
    const mondayShift = day === 0 ? -6 : 1 - day;
    const monday = new Date(selected);
    monday.setUTCDate(selected.getUTCDate() + mondayShift);
    return Array.from({ length: 7 }).map((_, index) => {
      const current = new Date(monday);
      current.setUTCDate(monday.getUTCDate() + index);
      const dayKey = toDayKey(current);
      return {
        day: dayKey,
        label: current.toLocaleDateString('ru-RU', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Europe/Moscow',
        }),
        count: dayCountMap.value.get(dayKey) || 0,
      };
    });
  });

  const listMatches = computed(() => {
    return [...matches.value].sort(
      (a, b) =>
        new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );
  });

  const listUpcomingMatches = computed(() =>
    listMatches.value.filter((match) => !matchIsPast(match))
  );
  const listPastMatches = computed(() =>
    listMatches.value.filter((match) => matchIsPast(match))
  );

  const pagesTotal = computed(() => {
    const size = Math.max(1, routeState.limit.value || 20);
    return Math.max(1, Math.ceil((total.value || 0) / size));
  });

  const monthLabel = computed(() => {
    const [yearRaw, monthRaw] = String(routeState.month.value).split('-');
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return 'Календарь';
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Moscow',
    });
  });

  const stageOptions = computed(() => [
    { id: '', name: 'Все этапы' },
    ...options.stages.value.map((stage) => ({
      id: String(stage.id),
      name: stage.name || 'Этап без названия',
    })),
  ]);

  const statusOptions = [
    { value: '', label: 'Все матчи' },
    { value: 'upcoming', label: 'Предстоящие' },
    { value: 'past', label: 'Прошедшие' },
    { value: 'cancelled', label: 'Отменённые' },
  ];

  const scheduleTeamOptions = computed(() =>
    [...(options.tournamentTeams.value || [])]
      .filter((row) => row.team?.id)
      .sort((a, b) =>
        String(a.team?.name || '').localeCompare(String(b.team?.name || ''))
      )
  );

  const calendarMonthCells = computed(() => {
    const [yearRaw, monthRaw] = String(routeState.month.value).split('-');
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
    const firstDate = new Date(Date.UTC(year, month - 1, 1));
    const firstWeekday = (firstDate.getUTCDay() + 6) % 7;
    const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = toDayKey(new Date());
    const cells: Array<Record<string, any>> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ key: `pad-${i}`, inMonth: false });
    }

    for (let day = 1; day <= monthDays; day += 1) {
      const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        key: dayKey,
        inMonth: true,
        day,
        dayKey,
        count: dayCountMap.value.get(dayKey) || 0,
        isToday: dayKey === today,
        isSelected: dayKey === selectedDay.value,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: `tail-${cells.length}`, inMonth: false });
    }
    return cells;
  });

  async function loadMatches(): Promise<void> {
    if (!tournamentId.value) return;
    const token = requestToken.value + 1;
    requestToken.value = token;
    loading.value = true;
    error.value = '';

    const params = new URLSearchParams({
      tournament_id: tournamentId.value,
      page: String(routeState.page.value || 1),
      limit: String(routeState.limit.value || 20),
      sort: 'ASC',
    });
    if (routeState.view.value === 'month') {
      const range = getMonthDateRange(routeState.month.value);
      if (range) {
        params.set('date_from', range.from);
        params.set('date_to', range.to);
      }
    }
    if (routeState.view.value === 'week') {
      const range = getWeekDateRange(routeState.day.value);
      if (range) {
        params.set('date_from', range.from);
        params.set('date_to', range.to);
      }
    }
    if (routeState.stageId.value)
      params.set('stage_id', routeState.stageId.value);
    if (routeState.status.value) params.set('status', routeState.status.value);
    if (routeState.search.value.trim())
      params.set('q', routeState.search.value.trim());

    try {
      const response = await apiFetch(
        `/tournaments/matches?${params.toString()}`
      );
      if (token !== requestToken.value) return;
      matches.value = response.matches || [];
      total.value = Number(response.total || 0);
      summary.value =
        response.summary ||
        ({
          total: matches.value.length,
          upcoming: matches.value.length,
          past: 0,
          cancelled: 0,
        } as any);
      days.value = response.days || [];
      if (!days.value.some((item) => item.day === routeState.day.value)) {
        routeState.day.value = days.value[0]?.day || toDayKey(new Date());
      }
      trackTournamentUiEvent({
        event: 'tournament_schedule_filter_changed',
        tournamentId: tournamentId.value,
        mode: routeState.view.value,
      });
    } catch (err: any) {
      if (token !== requestToken.value) return;
      matches.value = [];
      total.value = 0;
      days.value = [];
      error.value = err?.message || 'Не удалось загрузить расписание';
    } finally {
      if (token === requestToken.value) {
        loading.value = false;
      }
    }
  }

  function shiftMonth(delta: number): void {
    const [yearRaw, monthRaw] = String(routeState.month.value).split('-');
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const date = new Date(
      Date.UTC(
        Number.isFinite(year) ? year : new Date().getUTCFullYear(),
        Number.isFinite(month)
          ? month - 1 + delta
          : new Date().getUTCMonth() + delta,
        1
      )
    );
    routeState.month.value = toMonthKey(date);
  }

  async function createMatch(): Promise<void> {
    if (
      createLoading.value ||
      isImportedTournament.value ||
      !tournamentId.value
    )
      return;
    if (!createForm.value.stage_id) {
      createError.value = 'Выберите этап';
      return;
    }
    if (!createForm.value.date_start) {
      createError.value = 'Укажите дату и время матча';
      return;
    }
    if (!createForm.value.home_team_id || !createForm.value.away_team_id) {
      createError.value = 'Выберите обе команды';
      return;
    }
    if (createForm.value.home_team_id === createForm.value.away_team_id) {
      createError.value = 'Команды должны отличаться';
      return;
    }

    createLoading.value = true;
    createError.value = '';
    try {
      await apiFetch('/tournaments/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId.value,
          stage_id: createForm.value.stage_id,
          ground_id: createForm.value.ground_id || null,
          home_team_id: createForm.value.home_team_id,
          away_team_id: createForm.value.away_team_id,
          date_start: new Date(
            `${createForm.value.date_start}:00+03:00`
          ).toISOString(),
        }),
      });
      showToast('Матч создан');
      createForm.value = {
        date_start: '',
        stage_id: createForm.value.stage_id,
        ground_id: '',
        home_team_id: '',
        away_team_id: '',
      };
      await loadMatches();
    } catch (err: any) {
      createError.value = err?.message || 'Не удалось создать матч';
    } finally {
      createLoading.value = false;
    }
  }

  function openEdit(match: any): void {
    const date = match?.date_start ? new Date(match.date_start) : null;
    const dateLocal =
      date && !Number.isNaN(date.getTime())
        ? new Date(date.getTime() + 3 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 16)
        : '';
    editForm.value = {
      id: String(match?.id || ''),
      date_start: dateLocal,
      ground_id: String(match?.ground_id || ''),
    };
    editError.value = '';
    editOpen.value = true;
  }

  async function saveEdit(): Promise<void> {
    if (editLoading.value || !editForm.value.id) return;
    editLoading.value = true;
    editError.value = '';
    try {
      await apiFetch(`/tournaments/matches/${editForm.value.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_start: editForm.value.date_start
            ? new Date(`${editForm.value.date_start}:00+03:00`).toISOString()
            : undefined,
          ground_id: editForm.value.ground_id || null,
        }),
      });
      trackTournamentUiEvent({
        event: 'tournament_match_updated',
        tournamentId: tournamentId.value,
        status: 'success',
      });
      showToast('Матч обновлён');
      editOpen.value = false;
      await loadMatches();
    } catch (err: any) {
      trackTournamentUiEvent({
        event: 'tournament_match_update_failed',
        tournamentId: tournamentId.value,
        status: 'error',
        detail: err?.message || null || undefined,
      });
      editError.value = err?.message || 'Не удалось обновить матч';
    } finally {
      editLoading.value = false;
    }
  }

  async function deleteMatch(match: any): Promise<void> {
    if (deleteLoading.value) return;
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm('Удалить матч из расписания? Действие необратимо.');
    if (!confirmed) return;

    deleteLoading.value = String(match.id);
    try {
      await apiFetch(`/tournaments/matches/${match.id}`, {
        method: 'DELETE',
      });
      showToast('Матч удалён');
      await loadMatches();
    } catch (err: any) {
      showToast(err?.message || 'Не удалось удалить матч', 'danger');
    } finally {
      deleteLoading.value = null;
    }
  }

  watch(
    () => [routeState.view.value, routeState.month.value, routeState.day.value],
    () => {
      routeState.page.value = 1;
    }
  );

  watch(
    () => [
      routeState.stageId.value,
      routeState.status.value,
      routeState.search.value,
    ],
    () => {
      routeState.page.value = 1;
    }
  );

  watch(
    () => [
      routeState.view.value,
      routeState.month.value,
      routeState.day.value,
      routeState.stageId.value,
      routeState.status.value,
      routeState.page.value,
      routeState.limit.value,
      routeState.search.value,
      tournamentId.value,
    ],
    () => {
      void loadMatches();
    },
    { immediate: true }
  );

  watch(
    () => searchInput.value,
    (value) => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        routeState.search.value = value;
        routeState.page.value = 1;
      }, 350);
    }
  );

  return {
    loading,
    error,
    matches,
    total,
    summary,
    days,
    selectedDay,
    dayMatches,
    weekDays,
    listMatches,
    listUpcomingMatches,
    listPastMatches,
    monthLabel,
    stageOptions,
    statusOptions,
    scheduleTeamOptions,
    calendarMonthCells,
    pagesTotal,
    searchInput,
    createForm,
    createLoading,
    createError,
    editOpen,
    editLoading,
    editError,
    editForm,
    deleteLoading,
    matchIsPast,
    formatDayLabel,
    loadMatches,
    shiftMonth,
    createMatch,
    openEdit,
    saveEdit,
    deleteMatch,
  };
}
