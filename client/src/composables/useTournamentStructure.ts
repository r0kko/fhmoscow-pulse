/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { computed, ref, type Ref, watch } from 'vue';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';

function normalizeTerm(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function matchByTerm(value: unknown, term: string): boolean {
  if (!term) return true;
  return String(value || '')
    .toLowerCase()
    .includes(term);
}

export interface StructureStateRefs {
  stageId: Ref<string>;
  groupId: Ref<string>;
  teamSearch: Ref<string>;
}

export function useTournamentStructure(
  tournamentId: Ref<string>,
  isImportedTournament: Ref<boolean>,
  state: StructureStateRefs
) {
  const { showToast } = useToast();

  const stages = ref<any[]>([]);
  const groups = ref<any[]>([]);
  const teams = ref<any[]>([]);
  const tournamentTeams = ref<any[]>([]);
  const clubTeamsCatalog = ref<any[]>([]);

  const stagesLoading = ref(false);
  const groupsLoading = ref(false);
  const teamsLoading = ref(false);
  const stageError = ref('');
  const groupError = ref('');
  const teamError = ref('');

  const stageSearch = ref('');
  const groupSearch = ref('');
  const addTeamSearch = ref('');
  const addTeamError = ref('');
  const addTeamLoading = ref(false);

  const createStageOpen = ref(false);
  const createGroupOpen = ref(false);
  const createStageLoading = ref(false);
  const createGroupLoading = ref(false);
  const createStageError = ref('');
  const createGroupError = ref('');
  const createStageForm = ref({ name: '' });
  const createGroupForm = ref({ name: '', hours: '', minutes: '' });
  const addTeamForm = ref({ team_id: '' });

  const groupsByStage = computed(() => {
    const map = new Map<string, any[]>();
    for (const group of groups.value) {
      const key = String(group.stage_id || 'unassigned');
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(group);
    }
    return map;
  });

  const stagesVisible = computed(() => {
    const term = normalizeTerm(stageSearch.value);
    const list = [...stages.value];
    if (groups.value.some((group) => !group.stage_id)) {
      list.push({ id: 'unassigned', name: 'Без этапа' });
    }
    return list.filter(
      (stage) =>
        matchByTerm(stage.name || '', term) ||
        matchByTerm(stage.external_id || stage.id || '', term)
    );
  });

  const selectedStage = computed(() => {
    const id = state.stageId.value;
    if (!id) return null;
    if (id === 'unassigned') return { id: 'unassigned', name: 'Без этапа' };
    return (
      stages.value.find((stage) => String(stage.id) === String(id)) || null
    );
  });

  const groupsVisible = computed(() => {
    if (!selectedStage.value) return [];
    const term = normalizeTerm(groupSearch.value);
    const stageValue = selectedStage.value.id;
    const filtered = groups.value.filter((group) => {
      if (stageValue === 'unassigned') return !group.stage_id;
      return String(group.stage_id) === String(stageValue);
    });
    return filtered.filter(
      (group) =>
        matchByTerm(group.name || '', term) ||
        matchByTerm(group.external_id || group.id || '', term)
    );
  });

  const selectedGroup = computed(
    () =>
      groups.value.find(
        (group) => String(group.id) === String(state.groupId.value)
      ) || null
  );

  const teamsVisible = computed(() => {
    const term = normalizeTerm(state.teamSearch.value);
    return teams.value.filter((item) =>
      matchByTerm(item.team?.name || '', term)
    );
  });

  const clubTeamsVisible = computed(() => {
    const term = normalizeTerm(addTeamSearch.value);
    return clubTeamsCatalog.value
      .filter((team) =>
        matchByTerm(`${team.name || ''} ${team.club?.name || ''}`, term)
      )
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  });

  const tournamentAssignmentsByTeamId = computed(() => {
    const map = new Map<string, any>();
    for (const assignment of tournamentTeams.value || []) {
      if (assignment.team?.id) map.set(String(assignment.team.id), assignment);
    }
    return map;
  });

  function formatDurationMinutes(total: unknown): string {
    if (total == null) return '—';
    const minutes = Number(total);
    if (!Number.isFinite(minutes) || minutes < 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h} ч ${m} мин`;
    if (h) return `${h} ч`;
    return `${m} мин`;
  }

  function parseDurationToMinutes(
    hoursRaw: unknown,
    minutesRaw: unknown
  ): {
    value?: number | null;
    error?: string;
  } {
    const hText = String(hoursRaw || '').trim();
    const mText = String(minutesRaw || '').trim();
    if (!hText && !mText) return { value: null };
    const h = Number.parseInt(hText || '0', 10);
    const m = Number.parseInt(mText || '0', 10);
    if (!Number.isFinite(h) || h < 0 || h > 24)
      return { error: 'Некорректные часы' };
    if (!Number.isFinite(m) || m < 0 || m > 59)
      return { error: 'Некорректные минуты' };
    if (h === 24 && m > 0) return { error: 'Максимум 24:00' };
    return { value: h * 60 + m };
  }

  function formatTeamForSelect(team: any): string {
    const assignment = tournamentAssignmentsByTeamId.value.get(String(team.id));
    if (!assignment) {
      return team.club?.name
        ? `${team.name} (${team.club.name})`
        : String(team.name || 'Команда');
    }
    const groupName = assignment.group?.name || 'без названия';
    if (
      selectedGroup.value?.id &&
      String(assignment.tournament_group_id) === String(selectedGroup.value.id)
    ) {
      return `${team.name} (уже в выбранной группе)`;
    }
    return `${team.name} (в группе: ${groupName})`;
  }

  async function loadStages(): Promise<void> {
    if (!tournamentId.value) return;
    stagesLoading.value = true;
    stageError.value = '';
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
        tournament_id: tournamentId.value,
      });
      const response = await apiFetch(
        `/tournaments/stages?${params.toString()}`
      );
      stages.value = response.stages || [];
    } catch (error: any) {
      stages.value = [];
      stageError.value = error?.message || 'Ошибка загрузки этапов';
    } finally {
      stagesLoading.value = false;
    }
  }

  async function loadGroups(): Promise<void> {
    if (!tournamentId.value) return;
    groupsLoading.value = true;
    groupError.value = '';
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
        tournament_id: tournamentId.value,
      });
      const response = await apiFetch(
        `/tournaments/groups?${params.toString()}`
      );
      groups.value = response.groups || [];
    } catch (error: any) {
      groups.value = [];
      groupError.value = error?.message || 'Ошибка загрузки групп';
    } finally {
      groupsLoading.value = false;
    }
  }

  async function loadTeams(): Promise<void> {
    if (!tournamentId.value || !state.groupId.value) {
      teams.value = [];
      return;
    }
    teamsLoading.value = true;
    teamError.value = '';
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
        tournament_id: tournamentId.value,
        group_id: state.groupId.value,
      });
      const response = await apiFetch(
        `/tournaments/teams?${params.toString()}`
      );
      teams.value = response.teams || [];
    } catch (error: any) {
      teams.value = [];
      teamError.value = error?.message || 'Ошибка загрузки команд';
    } finally {
      teamsLoading.value = false;
    }
  }

  async function loadTournamentTeams(): Promise<void> {
    if (!tournamentId.value) return;
    const params = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: tournamentId.value,
    });
    const response = await apiFetch(`/tournaments/teams?${params.toString()}`);
    tournamentTeams.value = response.teams || [];
  }

  async function loadClubTeamsCatalog(): Promise<void> {
    const params = new URLSearchParams({
      page: '1',
      limit: '1000',
      status: 'ACTIVE',
    });
    const response = await apiFetch(`/teams?${params.toString()}`);
    clubTeamsCatalog.value = response.teams || [];
  }

  async function createStage(): Promise<void> {
    if (
      createStageLoading.value ||
      isImportedTournament.value ||
      !tournamentId.value
    )
      return;
    createStageLoading.value = true;
    createStageError.value = '';
    try {
      const payload: Record<string, string> = {
        tournament_id: tournamentId.value,
      };
      if (createStageForm.value.name.trim()) {
        payload.name = createStageForm.value.name.trim();
      }
      const response = await apiFetch('/tournaments/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('Этап создан');
      createStageForm.value.name = '';
      createStageOpen.value = false;
      await loadStages();
      if (response.stage?.id) state.stageId.value = String(response.stage.id);
    } catch (error: any) {
      createStageError.value = error?.message || 'Ошибка создания этапа';
    } finally {
      createStageLoading.value = false;
    }
  }

  async function createGroup(): Promise<void> {
    if (
      createGroupLoading.value ||
      isImportedTournament.value ||
      !tournamentId.value ||
      !state.stageId.value ||
      state.stageId.value === 'unassigned'
    ) {
      return;
    }

    const parsed = parseDurationToMinutes(
      createGroupForm.value.hours,
      createGroupForm.value.minutes
    );
    if (parsed.error) {
      createGroupError.value = parsed.error;
      return;
    }

    createGroupLoading.value = true;
    createGroupError.value = '';
    try {
      const payload: Record<string, string | number | null> = {
        tournament_id: tournamentId.value,
        stage_id: state.stageId.value,
      };
      if (createGroupForm.value.name.trim()) {
        payload.name = createGroupForm.value.name.trim();
      }
      if (parsed.value != null) payload.match_duration_minutes = parsed.value;
      const response = await apiFetch('/tournaments/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('Группа создана');
      createGroupForm.value = { name: '', hours: '', minutes: '' };
      createGroupOpen.value = false;
      await loadGroups();
      if (response.group?.id) state.groupId.value = String(response.group.id);
    } catch (error: any) {
      createGroupError.value = error?.message || 'Ошибка создания группы';
    } finally {
      createGroupLoading.value = false;
    }
  }

  async function assignTeamToGroup(): Promise<void> {
    if (
      addTeamLoading.value ||
      isImportedTournament.value ||
      !tournamentId.value ||
      !state.groupId.value ||
      !addTeamForm.value.team_id
    ) {
      return;
    }
    addTeamLoading.value = true;
    addTeamError.value = '';
    try {
      await apiFetch('/tournaments/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId.value,
          group_id: state.groupId.value,
          team_id: addTeamForm.value.team_id,
        }),
      });
      showToast('Команда добавлена в группу');
      addTeamForm.value.team_id = '';
      await Promise.all([loadTeams(), loadTournamentTeams()]);
    } catch (error: any) {
      addTeamError.value = error?.message || 'Ошибка добавления команды';
    } finally {
      addTeamLoading.value = false;
    }
  }

  watch(
    () => state.groupId.value,
    () => {
      if (!state.groupId.value) {
        teams.value = [];
        return;
      }
      void loadTeams();
    }
  );

  return {
    stages,
    groups,
    teams,
    stagesLoading,
    groupsLoading,
    teamsLoading,
    stageError,
    groupError,
    teamError,
    stageSearch,
    groupSearch,
    addTeamSearch,
    addTeamError,
    addTeamLoading,
    createStageOpen,
    createGroupOpen,
    createStageLoading,
    createGroupLoading,
    createStageError,
    createGroupError,
    createStageForm,
    createGroupForm,
    addTeamForm,
    stagesVisible,
    selectedStage,
    selectedGroup,
    groupsVisible,
    teamsVisible,
    clubTeamsVisible,
    groupsByStage,
    formatDurationMinutes,
    formatTeamForSelect,
    loadStages,
    loadGroups,
    loadTeams,
    loadTournamentTeams,
    loadClubTeamsCatalog,
    createStage,
    createGroup,
    assignTeamToGroup,
  };
}
