<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import TournamentCalendarGrid from '../components/admin-tournament/TournamentCalendarGrid.vue';
import TournamentMatchEditorModal from '../components/admin-tournament/TournamentMatchEditorModal.vue';
import { apiFetch } from '../api';
import { useScheduleRouteState } from '../composables/useTournamentRouteState';
import { useTournamentSchedule } from '../composables/useTournamentSchedule';

const props = defineProps<{
  tournamentId: string;
  isImportedTournament: boolean;
  groundOptions: Array<{ id: string; name: string }>;
}>();

const route = useRoute();
const router = useRouter();

const now = new Date();
const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
const defaultDay = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
  now.getUTCDate()
).padStart(2, '0')}`;

const routeStateRefs = useScheduleRouteState(route, router, {
  view: 'month',
  month: defaultMonth,
  day: defaultDay,
  limit: 20,
});
const routeState = reactive(routeStateRefs);

const stages = ref<any[]>([]);
const tournamentTeams = ref<any[]>([]);

const scheduleRefs = useTournamentSchedule(
  computed(() => props.tournamentId),
  computed(() => props.isImportedTournament),
  routeStateRefs,
  {
    stages: computed(() => stages.value),
    grounds: computed(() => props.groundOptions || []),
    tournamentTeams: computed(() => tournamentTeams.value),
  }
);
const schedule = reactive(scheduleRefs);

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

async function loadReferences(): Promise<void> {
  const [stagesRes, teamsRes] = await Promise.all([
    apiFetch(
      `/tournaments/stages?page=1&limit=1000&tournament_id=${props.tournamentId}`
    ),
    apiFetch(
      `/tournaments/teams?page=1&limit=1000&tournament_id=${props.tournamentId}`
    ),
  ]);
  stages.value = stagesRes.stages || [];
  tournamentTeams.value = teamsRes.teams || [];
  if (!schedule.createForm.value.stage_id && stages.value.length) {
    schedule.createForm.value.stage_id = String(stages.value[0].id || '');
  }
}

function openMatchCard(match: any): void {
  if (!match?.id) return;
  void router.push(`/admin/matches/${match.id}`);
}

function canEditMatch(match: any): boolean {
  if (props.isImportedTournament) return false;
  const alias = String(match?.game_status?.alias || '').toUpperCase();
  return alias !== 'FINISHED' && alias !== 'LIVE';
}

function canDeleteMatch(match: any): boolean {
  if (props.isImportedTournament) return false;
  const alias = String(match?.game_status?.alias || '').toUpperCase();
  return alias !== 'FINISHED';
}

function moveSelectedDay(delta: number): void {
  const current = new Date(`${routeStateRefs.day.value}T00:00:00Z`);
  if (Number.isNaN(current.getTime())) return;
  current.setUTCDate(current.getUTCDate() + delta);
  const day = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(
    current.getUTCDate()
  ).padStart(2, '0')}`;
  routeStateRefs.day.value = day;
  routeStateRefs.month.value = `${current.getUTCFullYear()}-${String(
    current.getUTCMonth() + 1
  ).padStart(2, '0')}`;
}

onMounted(async () => {
  if (window.matchMedia('(max-width: 991.98px)').matches && !route.query.view) {
    routeStateRefs.view.value = 'list';
  }
  await loadReferences();
});
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm">
    <div class="card-body">
      <div
        class="d-flex justify-content-between align-items-end flex-wrap gap-2 mb-3"
      >
        <div class="d-flex gap-2 flex-wrap align-items-end">
          <div>
            <label class="form-label">Режим</label>
            <select v-model="routeState.view" class="form-select">
              <option value="month">Месяц</option>
              <option value="week">Неделя</option>
              <option value="list">Список</option>
            </select>
          </div>
          <div>
            <label class="form-label">Этап</label>
            <select v-model="routeState.stageId" class="form-select">
              <option
                v-for="stage in schedule.stageOptions"
                :key="stage.id || 'all'"
                :value="stage.id"
              >
                {{ stage.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="form-label">Статус</label>
            <select v-model="routeState.status" class="form-select">
              <option
                v-for="status in schedule.statusOptions"
                :key="status.value || 'all'"
                :value="status.value"
              >
                {{ status.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="search-wrap">
          <label class="form-label">Поиск</label>
          <div class="input-group">
            <span class="input-group-text"
              ><i class="bi bi-search" aria-hidden="true"></i
            ></span>
            <input
              v-model="schedule.searchInput"
              type="search"
              class="form-control"
              placeholder="Команды, стадионы"
            />
          </div>
        </div>
      </div>

      <div aria-live="polite" class="visually-hidden">
        Загружено матчей: {{ schedule.total }}
      </div>

      <div class="row g-2 mb-3">
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Всего</div>
            <div class="h5 mb-0">{{ schedule.summary.total }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Предстоящие</div>
            <div class="h5 mb-0">{{ schedule.summary.upcoming }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Прошедшие</div>
            <div class="h5 mb-0">{{ schedule.summary.past }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Отменённые</div>
            <div class="h5 mb-0">{{ schedule.summary.cancelled }}</div>
          </div>
        </div>
      </div>

      <div v-if="schedule.error" class="alert alert-danger">
        {{ schedule.error }}
      </div>

      <BrandSpinner v-if="schedule.loading" label="Загрузка расписания" />
      <template v-else>
        <div v-if="routeState.view === 'month'" class="row g-3">
          <div class="col-12 col-lg-5">
            <div class="border rounded-3 p-3">
              <div
                class="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap"
              >
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="schedule.shiftMonth(-1)"
                >
                  <i class="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <div class="fw-semibold text-center flex-grow-1">
                  {{ schedule.monthLabel }}
                </div>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="schedule.shiftMonth(1)"
                >
                  <i class="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
              </div>
              <TournamentCalendarGrid
                :weekday-labels="weekdayLabels"
                :cells="schedule.calendarMonthCells"
                @select-day="(day) => (routeState.day = day)"
                @move-day="moveSelectedDay"
              />
            </div>
          </div>
          <div class="col-12 col-lg-7">
            <div class="border rounded-3 p-3 h-100">
              <div
                class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2"
              >
                <div>
                  <div class="fw-semibold">
                    {{ schedule.formatDayLabel(schedule.selectedDay) }}
                  </div>
                  <div class="small text-muted">
                    Матчей за день: {{ schedule.dayMatches.length }}
                  </div>
                </div>
              </div>
              <div
                v-if="schedule.dayMatches.length"
                class="list-group list-group-flush"
              >
                <div
                  v-for="match in schedule.dayMatches"
                  :key="`day-${match.id}`"
                  class="list-group-item px-0"
                >
                  <div
                    class="d-flex justify-content-between align-items-start gap-2 flex-wrap"
                  >
                    <div>
                      <div class="fw-semibold">
                        {{ match.home_team?.name || '—' }} —
                        {{ match.away_team?.name || '—' }}
                      </div>
                      <div class="small text-muted">
                        {{ match.stage?.name || 'Этап не указан' }} ·
                        {{ match.ground?.name || 'Стадион не указан' }}
                      </div>
                    </div>
                    <div class="d-flex gap-1">
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm icon-action"
                        :disabled="!canEditMatch(match)"
                        title="Редактировать матч"
                        aria-label="Редактировать матч"
                        @click="schedule.openEdit(match)"
                      >
                        <i class="bi bi-pencil-square" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm icon-action"
                        title="Открыть карточку матча"
                        aria-label="Открыть карточку матча"
                        @click="openMatchCard(match)"
                      >
                        <i
                          class="bi bi-box-arrow-up-right"
                          aria-hidden="true"
                        ></i>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-danger btn-sm icon-action"
                        :disabled="
                          schedule.deleteLoading === String(match.id) ||
                          !canDeleteMatch(match)
                        "
                        title="Удалить матч"
                        aria-label="Удалить матч"
                        @click="schedule.deleteMatch(match)"
                      >
                        <i class="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="small text-muted">
                На выбранный день матчей нет.
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="routeState.view === 'week'"
          class="border rounded-3 p-3"
        >
          <div class="fw-semibold mb-2">
            Неделя {{ schedule.formatDayLabel(schedule.selectedDay) }}
          </div>
          <div class="row g-2">
            <div
              v-for="day in schedule.weekDays"
              :key="day.day"
              class="col-12 col-md-6 col-xl-4"
            >
              <button
                type="button"
                class="btn btn-outline-secondary w-100 text-start"
                :class="{ active: routeState.day === day.day }"
                @click="routeState.day = day.day"
              >
                <span class="fw-semibold">{{ day.label }}</span>
                <span class="small text-muted ms-2"
                  >{{ day.count }} матчей</span
                >
              </button>
            </div>
          </div>
          <div class="mt-3">
            <div class="small text-muted mb-1">Матчи выбранного дня</div>
            <div v-if="schedule.dayMatches.length" class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Матч</th>
                    <th>Стадион</th>
                    <th class="text-end">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="match in schedule.dayMatches"
                    :key="`week-${match.id}`"
                  >
                    <td>
                      {{
                        new Date(match.date_start).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </td>
                    <td>
                      {{ match.home_team?.name || '—' }} —
                      {{ match.away_team?.name || '—' }}
                    </td>
                    <td>{{ match.ground?.name || '—' }}</td>
                    <td class="text-end">
                      <button
                        class="btn btn-outline-secondary btn-sm icon-action me-1"
                        :disabled="!canEditMatch(match)"
                        title="Редактировать матч"
                        aria-label="Редактировать матч"
                        @click="schedule.openEdit(match)"
                      >
                        <i class="bi bi-pencil-square" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm icon-action me-1"
                        title="Открыть карточку матча"
                        aria-label="Открыть карточку матча"
                        @click="openMatchCard(match)"
                      >
                        <i
                          class="bi bi-box-arrow-up-right"
                          aria-hidden="true"
                        ></i>
                      </button>
                      <button
                        class="btn btn-outline-danger btn-sm icon-action"
                        :disabled="
                          schedule.deleteLoading === String(match.id) ||
                          !canDeleteMatch(match)
                        "
                        title="Удалить матч"
                        aria-label="Удалить матч"
                        @click="schedule.deleteMatch(match)"
                      >
                        <i class="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="small text-muted">Матчей нет.</div>
          </div>
        </div>

        <div v-else class="border rounded-3 p-3">
          <div
            class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2"
          >
            <div class="fw-semibold">Лента матчей</div>
            <PageNav
              v-model:page="routeState.page"
              v-model:page-size="routeState.limit"
              :total-pages="schedule.pagesTotal"
              :sizes="[10, 20, 50]"
            />
          </div>
          <template v-if="schedule.listMatches.length">
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Дата и время</th>
                    <th>Этап</th>
                    <th>Матч</th>
                    <th>Стадион</th>
                    <th>Статус</th>
                    <th class="text-end">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="match in schedule.listUpcomingMatches"
                    :key="`list-up-${match.id}`"
                  >
                    <td>
                      {{
                        new Date(match.date_start).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </td>
                    <td>{{ match.stage?.name || '—' }}</td>
                    <td>
                      {{ match.home_team?.name || '—' }} —
                      {{ match.away_team?.name || '—' }}
                    </td>
                    <td>{{ match.ground?.name || '—' }}</td>
                    <td><span class="badge badge-brand">Предстоящий</span></td>
                    <td class="text-end">
                      <button
                        class="btn btn-outline-secondary btn-sm icon-action me-1"
                        :disabled="!canEditMatch(match)"
                        title="Редактировать матч"
                        aria-label="Редактировать матч"
                        @click="schedule.openEdit(match)"
                      >
                        <i class="bi bi-pencil-square" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm icon-action me-1"
                        title="Открыть карточку матча"
                        aria-label="Открыть карточку матча"
                        @click="openMatchCard(match)"
                      >
                        <i
                          class="bi bi-box-arrow-up-right"
                          aria-hidden="true"
                        ></i>
                      </button>
                      <button
                        class="btn btn-outline-danger btn-sm icon-action"
                        :disabled="
                          schedule.deleteLoading === String(match.id) ||
                          !canDeleteMatch(match)
                        "
                        title="Удалить матч"
                        aria-label="Удалить матч"
                        @click="schedule.deleteMatch(match)"
                      >
                        <i class="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-3">
              <div class="fw-semibold mb-2">Прошедшие матчи</div>
              <div
                v-if="schedule.listPastMatches.length"
                class="table-responsive"
              >
                <table class="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Дата и время</th>
                      <th>Этап</th>
                      <th>Матч</th>
                      <th>Стадион</th>
                      <th>Статус</th>
                      <th class="text-end">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="match in schedule.listPastMatches"
                      :key="`list-past-${match.id}`"
                    >
                      <td>
                        {{
                          new Date(match.date_start).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Moscow',
                          })
                        }}
                      </td>
                      <td>{{ match.stage?.name || '—' }}</td>
                      <td>
                        {{ match.home_team?.name || '—' }} —
                        {{ match.away_team?.name || '—' }}
                      </td>
                      <td>{{ match.ground?.name || '—' }}</td>
                      <td>
                        <span class="badge text-bg-secondary">Прошедший</span>
                      </td>
                      <td class="text-end">
                        <button
                          class="btn btn-outline-secondary btn-sm icon-action me-1"
                          title="Открыть карточку матча"
                          aria-label="Открыть карточку матча"
                          @click="openMatchCard(match)"
                        >
                          <i
                            class="bi bi-box-arrow-up-right"
                            aria-hidden="true"
                          ></i>
                        </button>
                        <button
                          class="btn btn-outline-danger btn-sm icon-action"
                          :disabled="
                            schedule.deleteLoading === String(match.id) ||
                            !canDeleteMatch(match)
                          "
                          title="Удалить матч"
                          aria-label="Удалить матч"
                          @click="schedule.deleteMatch(match)"
                        >
                          <i class="bi bi-trash3" aria-hidden="true"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="small text-muted">Прошедших матчей нет.</div>
            </div>
          </template>
          <div v-else class="small text-muted">Матчи не найдены.</div>
        </div>
      </template>

      <div
        v-if="!props.isImportedTournament"
        class="border rounded-3 p-3 mt-3 bg-light-subtle"
      >
        <div class="fw-semibold mb-2">Планирование матча</div>
        <div v-if="schedule.createError" class="text-danger small mb-2">
          {{ schedule.createError }}
        </div>
        <div class="row g-2 align-items-end">
          <div class="col-12 col-lg-3">
            <label class="form-label">Этап</label>
            <select
              v-model="schedule.createForm.stage_id"
              class="form-select"
              :disabled="schedule.createLoading"
            >
              <option value="">Выберите этап</option>
              <option
                v-for="stage in schedule.stageOptions"
                :key="stage.id || 'all'"
                :value="stage.id"
              >
                {{ stage.name }}
              </option>
            </select>
          </div>
          <div class="col-12 col-lg-3">
            <label class="form-label">Дата и время</label>
            <input
              v-model="schedule.createForm.date_start"
              type="datetime-local"
              class="form-control"
              :disabled="schedule.createLoading"
            />
          </div>
          <div class="col-12 col-lg-2">
            <label class="form-label">Стадион</label>
            <select
              v-model="schedule.createForm.ground_id"
              class="form-select"
              :disabled="schedule.createLoading"
            >
              <option value="">Не указан</option>
              <option
                v-for="ground in props.groundOptions"
                :key="ground.id"
                :value="ground.id"
              >
                {{ ground.name }}
              </option>
            </select>
          </div>
          <div class="col-12 col-lg-2">
            <label class="form-label">Команда 1</label>
            <select
              v-model="schedule.createForm.home_team_id"
              class="form-select"
              :disabled="schedule.createLoading"
            >
              <option value="">Выберите команду</option>
              <option
                v-for="assignment in schedule.scheduleTeamOptions"
                :key="assignment.id"
                :value="assignment.team.id"
              >
                {{ assignment.team.name }}
              </option>
            </select>
          </div>
          <div class="col-12 col-lg-2">
            <label class="form-label">Команда 2</label>
            <select
              v-model="schedule.createForm.away_team_id"
              class="form-select"
              :disabled="schedule.createLoading"
            >
              <option value="">Выберите команду</option>
              <option
                v-for="assignment in schedule.scheduleTeamOptions"
                :key="`away-${assignment.id}`"
                :value="assignment.team.id"
              >
                {{ assignment.team.name }}
              </option>
            </select>
          </div>
          <div class="col-12 d-grid d-lg-flex justify-content-end">
            <button
              type="button"
              class="btn btn-brand icon-action"
              :disabled="schedule.createLoading"
              title="Создать матч"
              aria-label="Создать матч"
              @click="schedule.createMatch"
            >
              <i class="bi bi-calendar-plus" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="small text-muted mt-3">
        Для импортированных турниров ручное создание матчей недоступно.
      </div>
    </div>

    <TournamentMatchEditorModal
      v-model:open="schedule.editOpen"
      :loading="schedule.editLoading"
      :error="schedule.editError"
      :form="schedule.editForm"
      :grounds="props.groundOptions"
      @change="(patch) => Object.assign(schedule.editForm, patch)"
      @save="schedule.saveEdit"
    />
  </div>
</template>

<style scoped>
.metric-card {
  background: rgba(17, 56, 103, 0.03);
}

.search-wrap {
  width: min(420px, 100%);
}

.icon-action {
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
