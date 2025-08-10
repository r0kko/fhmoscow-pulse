<script setup>
import { ref, onMounted, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const judges = ref([]);
const groups = ref([]);
const seasons = ref([]);
const loading = ref(false);
const error = ref('');
const search = ref('');
const filterGroup = ref('');
const filterSeason = ref('');
let searchTimeout;

const history = ref([]);
const historyLoading = ref(false);
const historyError = ref('');
const historyJudgeName = ref('');
const historyModalRef = ref(null);
let historyModal;

async function loadJudges() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    if (search.value) params.append('search', search.value);
    if (filterGroup.value) params.append('group_id', filterGroup.value);
    if (filterSeason.value) params.append('season_id', filterSeason.value);
    const query = params.toString();
    const url = query
      ? `/referee-group-users?${query}`
      : '/referee-group-users';
    const data = await apiFetch(url);
    judges.value = data.judges.map((j) => ({
      ...j,
      group_id: j.group ? j.group.id : '',
    }));
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadGroups() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    if (filterSeason.value) params.append('season_id', filterSeason.value);
    const data = await apiFetch(`/referee-groups?${params}`);
    groups.value = data.groups;
  } catch (_) {
    groups.value = [];
  }
}

async function loadSeasons() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/camp-seasons?${params}`);
    seasons.value = data.seasons;
  } catch (_) {
    seasons.value = [];
  }
}

async function setGroup(judge) {
  try {
    if (!judge.group_id) {
      await apiFetch(`/referee-group-users/${judge.user.id}`, {
        method: 'DELETE',
      });
    } else {
      await apiFetch(`/referee-group-users/${judge.user.id}`, {
        method: 'POST',
        body: JSON.stringify({ group_id: judge.group_id }),
      });
    }
  } catch (e) {
    alert(e.message);
  }
}

function formatName(u) {
  return `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim();
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function formatDateTimeRange(start, end) {
  if (!start) return '';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const startDate = new Date(start);
  const endDate = new Date(end);
  const date = `${pad(startDate.getDate())}.${pad(startDate.getMonth() + 1)}.${startDate.getFullYear()}`;
  const startTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
  const endTime = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  return `${date} ${startTime} - ${endTime}`;
}

function presenceIcon(val) {
  if (val === true) return 'bi-check-lg text-success';
  if (val === false) return 'bi-x-lg text-danger';
  return 'bi-question-lg text-muted';
}

function presenceTitle(val) {
  if (val === true) return 'Присутствовал';
  if (val === false) return 'Отсутствовал';
  return 'Не отмечено';
}

async function openHistory(judge) {
  historyJudgeName.value = formatName(judge.user);
  history.value = [];
  historyLoading.value = true;
  historyError.value = '';
  historyModal.show();
  try {
    const params = new URLSearchParams({ page: 1, limit: 50 });
    const data = await apiFetch(
      `/camp-trainings/users/${judge.user.id}/history?${params}`
    );
    history.value = data.trainings || [];
  } catch (e) {
    historyError.value = e.message;
  } finally {
    historyLoading.value = false;
  }
}

onMounted(() => {
  historyModal = new Modal(historyModalRef.value);
  loadSeasons();
  loadGroups();
  loadJudges();
});

watch(filterSeason, () => {
  loadGroups();
  loadJudges();
});

watch(filterGroup, loadJudges);

watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadJudges, 300);
});

const refresh = () => {
  loadSeasons();
  loadGroups();
  loadJudges();
};

defineExpose({ refresh });
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="loading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div class="card section-card ground-card tile fade-in shadow-sm">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Назначение судей</h2>
      </div>
      <div class="card-body p-3">
        <div class="row g-2 mb-3">
          <div class="col-sm">
            <input
              v-model="search"
              class="form-control"
              placeholder="Поиск судьи"
            />
          </div>
          <div class="col-sm">
            <select v-model="filterSeason" class="form-select">
              <option value="">Все сезоны</option>
              <option v-for="s in seasons" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>
          <div class="col-sm">
            <select v-model="filterGroup" class="form-select">
              <option value="">Все группы</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="judges.length" class="table-responsive d-none d-sm-block">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th class="text-center">Дата рождения</th>
                <th class="text-center">Группа</th>
                <th class="text-center">Тренировки</th>
                <th class="text-center">История</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in judges" :key="j.user.id">
                <td>{{ formatName(j.user) }}</td>
                <td class="text-center">{{ formatDate(j.user.birth_date) }}</td>
                <td class="text-center">
                  <select
                    v-model="j.group_id"
                    class="form-select"
                    @change="setGroup(j)"
                  >
                    <option value="">Без группы</option>
                    <option v-for="g in groups" :key="g.id" :value="g.id">
                      {{ g.name }}
                    </option>
                  </select>
                </td>
                <td class="text-center">
                  {{ j.training_stats.visited }} / {{ j.training_stats.total }}
                  <span v-if="j.training_stats.total">
                    ({{
                      Math.round(
                        (j.training_stats.visited / j.training_stats.total) *
                          100
                      )
                    }}%)
                  </span>
                </td>
                <td class="text-center">
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    aria-label="История посещений"
                    @click="openHistory(j)"
                  >
                    <i class="bi bi-clock-history"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="judges.length" class="d-block d-sm-none">
          <div
            v-for="j in judges"
            :key="j.user.id"
            class="card training-card mb-2"
          >
            <div class="card-body p-2">
              <p class="mb-1 fw-semibold">{{ formatName(j.user) }}</p>
              <p class="mb-1 text-muted">{{ formatDate(j.user.birth_date) }}</p>
              <select
                v-model="j.group_id"
                class="form-select mt-1"
                @change="setGroup(j)"
              >
                <option value="">Без группы</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
              <p class="mb-0 mt-1">
                {{ j.training_stats.visited }} / {{ j.training_stats.total }}
                <span v-if="j.training_stats.total">
                  ({{
                    Math.round(
                      (j.training_stats.visited / j.training_stats.total) * 100
                    )
                  }}%)
                </span>
              </p>
              <div class="text-end mt-1">
                <button
                  class="btn btn-sm btn-outline-secondary"
                  aria-label="История посещений"
                  @click="openHistory(j)"
                >
                  <i class="bi bi-clock-history"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-muted mb-0">Судьи не найдены.</p>
      </div>
    </div>

    <div ref="historyModalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5">
              История посещений — {{ historyJudgeName }}
            </h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="historyModal.hide()"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="historyError" class="alert alert-danger">
              {{ historyError }}
            </div>
            <div v-if="historyLoading" class="text-center my-3">
              <div class="spinner-border" role="status"></div>
            </div>
            <div v-if="history.length">
              <div class="table-responsive d-none d-sm-block">
                <table class="table table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Тренер</th>
                      <th>Тип</th>
                      <th>Стадион</th>
                      <th class="text-center">Факт</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in history" :key="t.id">
                      <td>{{ formatDateTimeRange(t.start_at, t.end_at) }}</td>
                      <td>
                        {{ t.coaches?.length ? formatName(t.coaches[0]) : '' }}
                      </td>
                      <td>{{ t.type?.name }}</td>
                      <td>{{ t.ground?.name }}</td>
                      <td class="text-center">
                        <i
                          :class="presenceIcon(t.my_presence)"
                          :title="presenceTitle(t.my_presence)"
                        ></i>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="d-block d-sm-none">
                <div
                  v-for="t in history"
                  :key="t.id"
                  class="card training-card mb-2"
                >
                  <div class="card-body p-2">
                    <p class="mb-1 fw-semibold">
                      {{ formatDateTimeRange(t.start_at, t.end_at) }}
                    </p>
                    <p class="mb-1">
                      {{ t.coaches?.length ? formatName(t.coaches[0]) : '' }}
                    </p>
                    <p class="mb-1">{{ t.type?.name }}</p>
                    <p class="mb-1">{{ t.ground?.name }}</p>
                    <p class="mb-0 text-end">
                      <i
                        :class="presenceIcon(t.my_presence)"
                        :title="presenceTitle(t.my_presence)"
                      ></i>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p v-else-if="!historyLoading" class="mb-0 text-muted">
              Записей нет.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.ground-card {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 0;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@media (max-width: 575.98px) {
  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }

  .ground-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
