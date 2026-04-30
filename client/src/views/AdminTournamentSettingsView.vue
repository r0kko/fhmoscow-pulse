<script setup lang="ts">
// @ts-nocheck
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';
import { useSettingsRouteState } from '../composables/useTournamentRouteState';
import TournamentSettingsPanels from '../components/admin-tournament/TournamentSettingsPanels.vue';

const props = defineProps<{
  tournament: any;
  tournamentId: string;
  competitionTypeOptions: any[];
  scheduleManagementOptions: any[];
  matchFormatOptions: any[];
  refereePaymentOptions: any[];
}>();

const emit = defineEmits<{ refreshTournament: [] }>();

const route = useRoute();
const router = useRouter();
const routeStateRefs = useSettingsRouteState(route, router);
const routeState = reactive(routeStateRefs);
const { showToast } = useToast();

const settingsLoading = ref(false);
const settingsError = ref('');
const settingsStages = ref<any[]>([]);
const settingsGroups = ref<any[]>([]);
const settingsEdits = ref<Record<string, any>>({});

const refereeRoleGroups = ref<any[]>([]);
const refereeEdits = ref<Record<string, any>>({});
const iasEvents = ref<any[]>([]);
const iasOriginalIds = ref<string[]>([]);
const iasAvailableEvents = ref<any[]>([]);
const iasSearch = ref('');
const iasLoading = ref(false);
const iasSaving = ref(false);
const iasError = ref('');
let iasSearchTimer: number | null = null;

const mainSettings = ref({
  competition_type_id: '',
  schedule_management_type_id: '',
  match_format: '',
  referee_payment_type: '',
  dirty: false,
  saving: false,
  error: '',
});

const sectionTabs = [
  { key: 'main', label: 'Основные' },
  { key: 'groups', label: 'Параметры групп' },
  { key: 'referees', label: 'Судейство' },
  { key: 'ias', label: 'Мероприятия ИАС' },
];

const stageOptions = computed(() => [
  { id: '', name: 'Все этапы' },
  ...settingsStages.value.map((stage) => ({
    id: String(stage.id),
    name: stage.name || 'Этап без названия',
  })),
]);

const settingsGroupsByStage = computed(() => {
  const buckets = new Map<string, { stage: any; groups: any[] }>();
  for (const stage of settingsStages.value) {
    buckets.set(String(stage.id), { stage, groups: [] });
  }
  const unassigned = {
    stage: { id: 'unassigned', name: 'Без этапа' },
    groups: [] as any[],
  };

  const selected = routeStateRefs.stageId.value;
  for (const group of settingsGroups.value) {
    const stageKey = String(group.stage_id || 'unassigned');
    if (selected && selected !== stageKey) continue;
    const bucket = buckets.get(stageKey) || unassigned;
    bucket.groups.push(group);
  }

  const list = [...buckets.values()].filter((bucket) => bucket.groups.length);
  if (unassigned.groups.length) list.push(unassigned);
  return list;
});

const hasUnsavedChanges = computed(() => {
  if (mainSettings.value.dirty) return true;
  if (Object.values(settingsEdits.value).some((row: any) => row?.dirty))
    return true;
  if (Object.values(refereeEdits.value).some((row: any) => row?.dirty))
    return true;
  if (iasDirty.value) return true;
  return false;
});

const iasDirty = computed(() => {
  const current = iasEvents.value.map((event) => String(event.id)).sort();
  const original = [...iasOriginalIds.value].sort();
  return current.join('|') !== original.join('|');
});

function splitDurationMinutes(total: unknown): {
  hours: string;
  minutes: string;
} {
  if (total == null) return { hours: '', minutes: '' };
  const value = Number(total);
  if (!Number.isFinite(value) || value < 0) return { hours: '', minutes: '' };
  return {
    hours: String(Math.floor(value / 60)),
    minutes: String(value % 60),
  };
}

function parseDurationInput(
  hoursRaw: unknown,
  minutesRaw: unknown
): {
  value?: number | null;
  error?: string;
} {
  const hValue = String(hoursRaw || '').trim();
  const mValue = String(minutesRaw || '').trim();
  if (!hValue && !mValue) return { value: null };
  const hours = Number.parseInt(hValue || '0', 10);
  const minutes = Number.parseInt(mValue || '0', 10);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return { error: 'Некорректные часы' };
  }
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return { error: 'Некорректные минуты' };
  }
  if (hours === 24 && minutes > 0) {
    return { error: 'Максимум 24:00' };
  }
  return { value: hours * 60 + minutes };
}

function resetMainSettings(): void {
  const tournament = props.tournament;
  mainSettings.value = {
    competition_type_id: tournament?.competition_type_id || '',
    schedule_management_type_id: tournament?.schedule_management_type_id || '',
    match_format: tournament?.match_format || '',
    referee_payment_type: tournament?.referee_payment_type || '',
    dirty: false,
    saving: false,
    error: '',
  };
}

async function loadSettings(): Promise<void> {
  settingsLoading.value = true;
  settingsError.value = '';
  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: props.tournamentId,
    });
    const [stagesRes, groupsRes, rolesRes, assignmentsRes] = await Promise.all([
      apiFetch(`/tournaments/stages?${params.toString()}`),
      apiFetch(`/tournaments/groups?${params.toString()}`),
      apiFetch('/tournaments/referee-roles'),
      apiFetch(`/tournaments/groups/referees?${params.toString()}`),
    ]);

    settingsStages.value = stagesRes.stages || [];
    settingsGroups.value = groupsRes.groups || [];
    refereeRoleGroups.value = rolesRes.groups || [];

    const nextSettingsEdits: Record<string, any> = {};
    for (const group of settingsGroups.value) {
      const parts = splitDurationMinutes(group.match_duration_minutes);
      nextSettingsEdits[group.id] = {
        hours: parts.hours,
        minutes: parts.minutes,
        saving: false,
        error: '',
        dirty: false,
      };
    }
    settingsEdits.value = nextSettingsEdits;

    const roleIds = refereeRoleGroups.value.flatMap((roleGroup: any) =>
      (roleGroup.roles || []).map((role: any) => role.id)
    );
    const nextRefereeEdits: Record<string, any> = {};
    for (const group of settingsGroups.value) {
      nextRefereeEdits[group.id] = {
        counts: Object.fromEntries(
          roleIds.map((roleId: string) => [roleId, 0])
        ),
        saving: false,
        error: '',
        dirty: false,
      };
    }

    for (const assignment of assignmentsRes.assignments || []) {
      const groupId = assignment.tournament_group_id;
      const roleId = assignment.referee_role_id;
      if (!nextRefereeEdits[groupId]) continue;
      nextRefereeEdits[groupId].counts[roleId] = assignment.count ?? 0;
    }
    refereeEdits.value = nextRefereeEdits;
  } catch (error: any) {
    settingsError.value = error?.message || 'Ошибка загрузки настроек';
  } finally {
    settingsLoading.value = false;
  }
}

async function loadIasEvents(): Promise<void> {
  iasLoading.value = true;
  iasError.value = '';
  try {
    const [linkedRes, availableRes] = await Promise.all([
      apiFetch(`/tournaments/${props.tournamentId}/ias-events`),
      apiFetch(`/tournaments/${props.tournamentId}/ias-events/available`),
    ]);
    iasEvents.value = linkedRes.events || [];
    iasOriginalIds.value = iasEvents.value.map((event: any) =>
      String(event.id)
    );
    iasAvailableEvents.value = availableRes.events || [];
  } catch (error: any) {
    iasError.value = error?.message || 'Ошибка загрузки мероприятий ИАС';
  } finally {
    iasLoading.value = false;
  }
}

async function searchIasEvents(value: string): Promise<void> {
  iasSearch.value = value;
  if (iasSearchTimer) window.clearTimeout(iasSearchTimer);
  iasSearchTimer = window.setTimeout(async () => {
    try {
      const params = new URLSearchParams();
      if (iasSearch.value.trim()) params.set('search', iasSearch.value.trim());
      const res = await apiFetch(
        `/tournaments/${props.tournamentId}/ias-events/available?${params.toString()}`
      );
      iasAvailableEvents.value = res.events || [];
    } catch (error: any) {
      iasError.value = error?.message || 'Ошибка поиска мероприятий ИАС';
    }
  }, 250);
}

function addIasEvent(event: any): void {
  if (!event?.id) return;
  if (iasEvents.value.some((item) => String(item.id) === String(event.id))) {
    return;
  }
  iasEvents.value = [...iasEvents.value, event];
}

function removeIasEvent(eventId: string): void {
  iasEvents.value = iasEvents.value.filter(
    (event) => String(event.id) !== String(eventId)
  );
}

async function saveIasEvents(): Promise<void> {
  if (iasSaving.value) return;
  iasSaving.value = true;
  iasError.value = '';
  try {
    const response = await apiFetch(
      `/tournaments/${props.tournamentId}/ias-events`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_ids: iasEvents.value.map((event) => event.id),
        }),
      }
    );
    iasEvents.value = response.events || [];
    iasOriginalIds.value = iasEvents.value.map((event: any) =>
      String(event.id)
    );
    showToast('Привязки мероприятий ИАС сохранены');
    await searchIasEvents(iasSearch.value);
  } catch (error: any) {
    iasError.value = error?.message || 'Ошибка сохранения мероприятий ИАС';
  } finally {
    iasSaving.value = false;
  }
}

function markMainDirty(): void {
  mainSettings.value.dirty = true;
  mainSettings.value.error = '';
}

function updateMainField(field: string, value: string): void {
  if (!Object.hasOwn(mainSettings.value, field)) return;
  (mainSettings.value as Record<string, any>)[field] = value;
}

async function saveMainSettings(): Promise<void> {
  if (mainSettings.value.saving) return;
  if (!mainSettings.value.schedule_management_type_id) {
    mainSettings.value.error = 'Укажите управление расписанием';
    return;
  }

  mainSettings.value.saving = true;
  mainSettings.value.error = '';
  try {
    await apiFetch(`/tournaments/${props.tournamentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition_type_id: mainSettings.value.competition_type_id || null,
        schedule_management_type_id:
          mainSettings.value.schedule_management_type_id || null,
        match_format: mainSettings.value.match_format || null,
        referee_payment_type: mainSettings.value.referee_payment_type || null,
      }),
    });
    mainSettings.value.dirty = false;
    showToast('Основные настройки сохранены');
    emit('refreshTournament');
  } catch (error: any) {
    mainSettings.value.error = error?.message || 'Ошибка сохранения';
  } finally {
    mainSettings.value.saving = false;
  }
}

function updateDuration(
  groupId: string,
  field: 'hours' | 'minutes',
  value: string
): void {
  if (!settingsEdits.value[groupId]) return;
  settingsEdits.value[groupId][field] = value;
  settingsEdits.value[groupId].dirty = true;
  settingsEdits.value[groupId].error = '';
}

async function saveGroupSettings(group: any): Promise<void> {
  const edit = settingsEdits.value[group.id];
  if (!edit || edit.saving) return;
  const parsed = parseDurationInput(edit.hours, edit.minutes);
  if (parsed.error) {
    edit.error = parsed.error;
    return;
  }
  edit.saving = true;
  edit.error = '';
  try {
    const response = await apiFetch(`/tournaments/groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_duration_minutes: parsed.value,
      }),
    });
    group.match_duration_minutes =
      response.group?.match_duration_minutes ?? parsed.value;
    edit.dirty = false;
    showToast('Параметры группы сохранены');
  } catch (error: any) {
    edit.error = error?.message || 'Ошибка сохранения';
  } finally {
    edit.saving = false;
  }
}

function setRefereeCount(groupId: string, roleId: string, value: string): void {
  const edit = refereeEdits.value[groupId];
  if (!edit) return;
  const parsed = Number.parseInt(value, 10);
  edit.counts[roleId] = Number.isFinite(parsed)
    ? Math.min(2, Math.max(0, parsed))
    : 0;
  edit.dirty = true;
  edit.error = '';
}

async function saveGroupReferees(group: any): Promise<void> {
  const edit = refereeEdits.value[group.id];
  if (!edit || edit.saving) return;
  edit.saving = true;
  edit.error = '';
  try {
    const roles = Object.entries(edit.counts || {}).map(([roleId, count]) => ({
      role_id: roleId,
      count: Number(count),
    }));
    await apiFetch(`/tournaments/groups/${group.id}/referees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    });
    edit.dirty = false;
    showToast('Судейский состав сохранён');
  } catch (error: any) {
    edit.error = error?.message || 'Ошибка сохранения';
  } finally {
    edit.saving = false;
  }
}

watch(
  () => props.tournament,
  () => {
    resetMainSettings();
  },
  { immediate: true }
);

onMounted(async () => {
  await Promise.all([loadSettings(), loadIasEvents()]);
});

onBeforeUnmount(() => {
  if (iasSearchTimer) window.clearTimeout(iasSearchTimer);
});

onBeforeRouteLeave((_to, _from, next) => {
  if (!hasUnsavedChanges.value) {
    next();
    return;
  }
  const confirmed =
    typeof window === 'undefined' ||
    window.confirm('Есть несохранённые изменения. Покинуть страницу?');
  if (confirmed) next();
  else next(false);
});
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm">
    <div class="card-body">
      <div
        class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2"
      >
        <div class="fw-semibold">Настройки турнира</div>
        <span v-if="hasUnsavedChanges" class="badge text-bg-warning"
          >Есть несохранённые изменения</span
        >
      </div>

      <TournamentSettingsPanels
        :section="routeState.section"
        :section-tabs="sectionTabs"
        :stage-filter="routeState.stageId"
        :stage-options="stageOptions"
        :loading="settingsLoading"
        :error="settingsError"
        :main-settings="mainSettings"
        :competition-type-options="props.competitionTypeOptions"
        :schedule-management-options="props.scheduleManagementOptions"
        :match-format-options="props.matchFormatOptions"
        :referee-payment-options="props.refereePaymentOptions"
        :settings-groups-by-stage="settingsGroupsByStage"
        :settings-edits="settingsEdits"
        :referee-role-groups="refereeRoleGroups"
        :referee-edits="refereeEdits"
        :ias-events="iasEvents"
        :ias-available-events="iasAvailableEvents"
        :ias-search="iasSearch"
        :ias-loading="iasLoading"
        :ias-saving="iasSaving"
        :ias-error="iasError"
        :ias-dirty="iasDirty"
        @update-section="(section) => (routeState.section = section)"
        @update-stage="(stage) => (routeState.stageId = stage)"
        @update-main-field="updateMainField"
        @mark-main-dirty="markMainDirty"
        @save-main="saveMainSettings"
        @update-duration="updateDuration"
        @save-group-settings="saveGroupSettings"
        @set-referee-count="setRefereeCount"
        @save-group-referees="saveGroupReferees"
        @search-ias-events="searchIasEvents"
        @add-ias-event="addIasEvent"
        @remove-ias-event="removeIasEvent"
        @save-ias-events="saveIasEvents"
      />
    </div>
  </div>
</template>

<style scoped></style>
