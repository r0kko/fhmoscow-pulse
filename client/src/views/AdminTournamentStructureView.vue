<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BrandSpinner from '../components/BrandSpinner.vue';
import { useStructureRouteState } from '../composables/useTournamentRouteState';
import { useTournamentStructure } from '../composables/useTournamentStructure';

const props = defineProps<{
  tournament: any;
  tournamentId: string;
  isImportedTournament: boolean;
}>();

const route = useRoute();
const router = useRouter();
const routeStateRefs = useStructureRouteState(route, router);
const routeState = reactive(routeStateRefs);

const structureRefs = useTournamentStructure(
  computed(() => props.tournamentId),
  computed(() => props.isImportedTournament),
  routeStateRefs
);
const structure = reactive(structureRefs);
const stagesVisible = computed<any[]>(
  () => structureRefs.stagesVisible.value || []
);
const groupsVisible = computed<any[]>(
  () => structureRefs.groupsVisible.value || []
);
const teamsVisible = computed<any[]>(
  () => structureRefs.teamsVisible.value || []
);
const clubTeamsVisible = computed<any[]>(
  () => structureRefs.clubTeamsVisible.value || []
);

watch(
  () => structureRefs.stagesVisible.value,
  (list) => {
    if (!routeStateRefs.stageId.value && list.length) {
      routeStateRefs.stageId.value = String(list[0].id || '');
      return;
    }
    if (
      routeStateRefs.stageId.value &&
      !list.some(
        (item: any) => String(item.id) === String(routeStateRefs.stageId.value)
      )
    ) {
      routeStateRefs.stageId.value = String(list[0]?.id || '');
    }
  }
);

watch(
  () => structureRefs.groupsVisible.value,
  (list) => {
    if (!routeStateRefs.groupId.value) return;
    if (
      !list.some(
        (item: any) => String(item.id) === String(routeStateRefs.groupId.value)
      )
    ) {
      routeStateRefs.groupId.value = '';
    }
  }
);

onMounted(async () => {
  await Promise.all([
    structureRefs.loadStages(),
    structureRefs.loadGroups(),
    structureRefs.loadTournamentTeams(),
    structureRefs.loadClubTeamsCatalog(),
  ]);
  if (
    !routeStateRefs.stageId.value &&
    structureRefs.stagesVisible.value.length
  ) {
    routeStateRefs.stageId.value = String(
      structureRefs.stagesVisible.value[0].id || ''
    );
  }
});
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm">
    <div class="card-body">
      <div
        v-if="props.isImportedTournament"
        class="alert alert-info small mb-3"
      >
        Турнир импортирован. Изменение структуры и составов команд недоступно.
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-5">
          <div class="card section-card shadow-sm h-100">
            <div class="card-body d-flex flex-column gap-3">
              <div>
                <div
                  class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                >
                  <div>
                    <div class="fw-semibold">Этапы</div>
                    <div class="small text-muted">
                      {{ stagesVisible.length }} этапов
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-brand btn-sm icon-action"
                    :disabled="props.isImportedTournament"
                    :title="
                      structure.createStageOpen
                        ? 'Скрыть форму этапа'
                        : 'Добавить этап'
                    "
                    :aria-label="
                      structure.createStageOpen
                        ? 'Скрыть форму этапа'
                        : 'Добавить этап'
                    "
                    @click="
                      structure.createStageOpen = !structure.createStageOpen
                    "
                  >
                    <i
                      class="bi"
                      :class="
                        structure.createStageOpen ? 'bi-dash-lg' : 'bi-plus-lg'
                      "
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    v-model="structure.stageSearch"
                    type="search"
                    class="form-control"
                    placeholder="Поиск этапа"
                  />
                </div>
              </div>

              <div
                v-if="structure.createStageOpen && !props.isImportedTournament"
                class="border rounded-3 p-2 bg-light-subtle"
              >
                <div
                  v-if="structure.createStageError"
                  class="text-danger small mb-1"
                >
                  {{ structure.createStageError }}
                </div>
                <label class="form-label small">Название этапа</label>
                <input
                  v-model="structure.createStageForm.name"
                  type="text"
                  class="form-control form-control-sm mb-2"
                  placeholder="Название этапа"
                />
                <button
                  type="button"
                  class="btn btn-brand btn-sm w-100 icon-action"
                  :disabled="structure.createStageLoading"
                  title="Создать этап"
                  aria-label="Создать этап"
                  @click="structure.createStage"
                >
                  <i class="bi bi-check2" aria-hidden="true"></i>
                </button>
              </div>

              <div v-if="structure.stageError" class="text-danger small">
                {{ structure.stageError }}
              </div>
              <BrandSpinner
                v-if="structure.stagesLoading"
                label="Загрузка этапов"
              />
              <div v-else class="list-group list-group-flush">
                <button
                  v-for="stage in stagesVisible"
                  :key="stage.id"
                  type="button"
                  class="list-group-item list-group-item-action hierarchy-item"
                  :class="{ active: routeState.stageId === String(stage.id) }"
                  @click="routeState.stageId = String(stage.id || '')"
                >
                  <div
                    class="d-flex justify-content-between gap-2 align-items-center"
                  >
                    <span class="fw-semibold">{{
                      stage.name || 'Этап без названия'
                    }}</span>
                    <span class="badge bg-light text-muted border">{{
                      structure.groupsByStage.get(String(stage.id))?.length || 0
                    }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <div class="card section-card shadow-sm h-100">
            <div class="card-body d-flex flex-column gap-3">
              <div>
                <div
                  class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                >
                  <div>
                    <div class="fw-semibold">Группы и команды</div>
                    <div class="small text-muted">
                      Выберите группу для работы с составом
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-brand btn-sm icon-action"
                    :disabled="
                      props.isImportedTournament ||
                      !routeState.stageId ||
                      routeState.stageId === 'unassigned'
                    "
                    :title="
                      structure.createGroupOpen
                        ? 'Скрыть форму группы'
                        : 'Добавить группу'
                    "
                    :aria-label="
                      structure.createGroupOpen
                        ? 'Скрыть форму группы'
                        : 'Добавить группу'
                    "
                    @click="
                      structure.createGroupOpen = !structure.createGroupOpen
                    "
                  >
                    <i
                      class="bi"
                      :class="
                        structure.createGroupOpen ? 'bi-dash-lg' : 'bi-plus-lg'
                      "
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    v-model="structure.groupSearch"
                    type="search"
                    class="form-control"
                    placeholder="Поиск группы"
                  />
                </div>
              </div>

              <div
                v-if="structure.createGroupOpen && !props.isImportedTournament"
                class="border rounded-3 p-2 bg-light-subtle"
              >
                <div
                  v-if="structure.createGroupError"
                  class="text-danger small mb-1"
                >
                  {{ structure.createGroupError }}
                </div>
                <label class="form-label small">Название группы</label>
                <input
                  v-model="structure.createGroupForm.name"
                  type="text"
                  class="form-control form-control-sm mb-2"
                  placeholder="Название группы"
                />
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label small">Часы</label>
                    <input
                      v-model="structure.createGroupForm.hours"
                      type="number"
                      class="form-control form-control-sm"
                      min="0"
                      max="24"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label small">Минуты</label>
                    <input
                      v-model="structure.createGroupForm.minutes"
                      type="number"
                      class="form-control form-control-sm"
                      min="0"
                      max="59"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-brand btn-sm w-100 mt-2 icon-action"
                  :disabled="structure.createGroupLoading"
                  title="Создать группу"
                  aria-label="Создать группу"
                  @click="structure.createGroup"
                >
                  <i class="bi bi-check2" aria-hidden="true"></i>
                </button>
              </div>

              <div class="list-group list-group-flush mb-1">
                <button
                  v-for="group in groupsVisible"
                  :key="group.id"
                  type="button"
                  class="list-group-item list-group-item-action hierarchy-item"
                  :class="{ active: routeState.groupId === String(group.id) }"
                  @click="routeState.groupId = String(group.id || '')"
                >
                  <div
                    class="d-flex justify-content-between gap-2 align-items-center"
                  >
                    <div>
                      <div class="fw-semibold">
                        {{ group.name || 'Группа' }}
                      </div>
                      <div class="small text-muted">
                        Длительность:
                        {{
                          structure.formatDurationMinutes(
                            group.match_duration_minutes
                          )
                        }}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <div
                v-if="routeState.groupId && !props.isImportedTournament"
                class="border rounded-3 p-2 bg-light-subtle"
              >
                <div class="small fw-semibold mb-1">Добавить команду</div>
                <div
                  v-if="structure.addTeamError"
                  class="text-danger small mb-1"
                >
                  {{ structure.addTeamError }}
                </div>
                <div class="input-group input-group-sm mb-2">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    v-model="structure.addTeamSearch"
                    type="search"
                    class="form-control"
                    placeholder="Поиск команды или клуба"
                  />
                </div>
                <select
                  v-model="structure.addTeamForm.team_id"
                  class="form-select form-select-sm mb-2"
                >
                  <option value="">Выберите команду</option>
                  <option
                    v-for="team in clubTeamsVisible"
                    :key="team.id"
                    :value="team.id"
                  >
                    {{ structure.formatTeamForSelect(team) }}
                  </option>
                </select>
                <button
                  type="button"
                  class="btn btn-brand btn-sm w-100 icon-action"
                  :disabled="
                    structure.addTeamLoading || !structure.addTeamForm.team_id
                  "
                  title="Добавить команду в группу"
                  aria-label="Добавить команду в группу"
                  @click="structure.assignTeamToGroup"
                >
                  <i class="bi bi-person-plus" aria-hidden="true"></i>
                </button>
              </div>

              <div>
                <div
                  class="d-flex align-items-center justify-content-between mb-2"
                >
                  <div class="fw-semibold">Состав группы</div>
                  <div class="small text-muted">
                    {{ teamsVisible.length }} команд
                  </div>
                </div>
                <div class="input-group input-group-sm mb-2">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    v-model="routeState.teamSearch"
                    type="search"
                    class="form-control"
                    placeholder="Поиск команды"
                    :disabled="!routeState.groupId"
                  />
                </div>
                <BrandSpinner
                  v-if="structure.teamsLoading"
                  label="Загрузка команд"
                />
                <div
                  v-else-if="teamsVisible.length"
                  class="list-group list-group-flush"
                >
                  <div
                    v-for="item in teamsVisible"
                    :key="item.id"
                    class="list-group-item px-0"
                  >
                    <div class="fw-semibold">
                      {{ item.team?.name || 'Команда' }}
                    </div>
                  </div>
                </div>
                <div v-else class="small text-muted">Команды не найдены.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hierarchy-item {
  border: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.hierarchy-item:last-child {
  border-bottom: 0;
}

.hierarchy-item.active {
  background-color: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}

.hierarchy-item.active .text-muted {
  color: rgba(255, 255, 255, 0.75) !important;
}

.icon-action {
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
