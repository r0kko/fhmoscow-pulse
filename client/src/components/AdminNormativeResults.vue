<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import Pagination from './Pagination.vue';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds } from '../utils/time.js';

const results = ref([]);
const total = ref(0);
const trainings = ref([]);
const types = ref([]);
const groups = ref([]);
const units = ref([]);
const currentPage = ref(1);
const pageSize = ref(
  parseInt(localStorage.getItem('normativeResultsPageSize') || '15', 10)
);
const search = ref('');
const typeFilter = ref('');
const groupFilter = ref('');
const isLoading = ref(false);
const error = ref('');
const deletingId = ref(null);
const saving = ref(false);

const form = ref({
  user_id: '',
  season_id: '',
  training_id: '',
  type_id: '',
  value: '',
  online: false,
  retake: false,
});
const value_type_id = ref('');
const unit_id = ref('');
const step = ref(1);
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const userQuery = ref('');
const userSuggestions = ref([]);
let userTimeout;
let skipWatch = false;
const minutes = ref('');
const seconds = ref('');
const mode = ref('training');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

const currentUnit = computed(
  () => units.value.find((u) => u.id === unit_id.value) || null
);

const filteredTrainings = computed(() => {
  if (!form.value.season_id) return trainings.value;
  return trainings.value.filter((t) => t.season_id === form.value.season_id);
});

onMounted(async () => {
  modal = new Modal(modalRef.value);
  await loadAux();
  await load();
});

watch(currentPage, load);

let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    load();
  }, 300);
});

watch([typeFilter, groupFilter, pageSize], () => {
  currentPage.value = 1;
  load();
});

watch(pageSize, (val) => {
  localStorage.setItem('normativeResultsPageSize', val);
});

watch(mode, (val) => {
  form.value.online = val === 'online';
  form.value.retake = val === 'retake';
  if (val !== 'training') {
    form.value.training_id = '';
  }
});

watch(userQuery, () => {
  clearTimeout(userTimeout);
  if (skipWatch) {
    skipWatch = false;
    return;
  }
  form.value.user_id = '';
  if (!userQuery.value) {
    userSuggestions.value = [];
    return;
  }
  const query = userQuery.value.trim();
  userTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ search: query });
      const data = await apiFetch(`/referee-group-users?${params}`);
      userSuggestions.value = data.judges.map((j) => j.user).slice(0, 5);
    } catch (_) {
      userSuggestions.value = [];
    }
  }, 200);
});

watch(
  () => form.value.type_id,
  (val) => {
    const t = types.value.find((x) => x.id === val);
    if (t) {
      value_type_id.value = t.value_type_id;
      unit_id.value = t.unit_id;
      form.value.season_id = t.season_id;
      if (!editing.value) {
        form.value.training_id = '';
        form.value.user_id = '';
        userQuery.value = '';
        userSuggestions.value = [];
      }
      minutes.value = '';
      seconds.value = '';
    }
  }
);

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      search: search.value,
      type_id: typeFilter.value,
      group_id: groupFilter.value,
      page: currentPage.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(`/normative-results?${params}`);
    results.value = data.results;
    total.value = data.total;
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (currentPage.value > pages) {
      currentPage.value = pages;
    }
    error.value = '';
  } catch (e) {
    error.value = e.message;
    results.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadAux() {
  try {
    const [trainingData, typeData, groupData, unitData] = await Promise.all([
      apiFetch('/camp-trainings/past?limit=100'),
      apiFetch('/normative-types?limit=100'),
      apiFetch('/normative-groups?limit=100'),
      apiFetch('/measurement-units'),
    ]);
    trainings.value = trainingData.trainings;
    types.value = typeData.types;
    groups.value = groupData.groups;
    units.value = unitData.units;
  } catch (_e) {
    trainings.value = [];
    types.value = [];
    groups.value = [];
    units.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = {
    user_id: '',
    season_id: '',
    training_id: '',
    type_id: '',
    value: '',
    online: false,
    retake: false,
  };
  minutes.value = '';
  seconds.value = '';
  value_type_id.value = '';
  unit_id.value = '';
  userQuery.value = '';
  userSuggestions.value = [];
  formError.value = '';
  step.value = 1;
  mode.value = 'training';
  modal.show();
}

function openEdit(r) {
  editing.value = r;
  const unit = units.value.find((u) => u.id === r.unit_id);
  let val = r.value;
  if (unit?.alias === 'MIN_SEC') {
    minutes.value = Math.floor(val / 60);
    seconds.value = Math.round(val % 60);
    val = '';
  } else if (unit?.alias === 'SECONDS') {
    val = Number(val).toFixed(2);
  }
  form.value = {
    user_id: r.user_id,
    season_id: r.season_id,
    training_id: r.training_id || '',
    type_id: r.type_id,
    value: val,
    online: r.online,
    retake: r.retake,
  };
  value_type_id.value = r.value_type_id;
  unit_id.value = r.unit_id;
  skipWatch = true;
  userQuery.value =
    `${r.user?.last_name || ''} ${r.user?.first_name || ''}`.trim();
  userSuggestions.value = [];
  formError.value = '';
  step.value = 2;
  mode.value = r.retake ? 'retake' : r.online ? 'online' : 'training';
  modal.show();
}

function selectUser(u) {
  form.value.user_id = u.id;
  skipWatch = true;
  userQuery.value = `${u.last_name} ${u.first_name}`;
  userSuggestions.value = [];
}

function formatValue(r) {
  const unit = units.value.find((u) => u.id === r.unit_id);
  if (unit?.alias === 'MIN_SEC') {
    return formatMinutesSeconds(r.value);
  }
  if (unit?.alias === 'SECONDS') {
    return Number(r.value).toFixed(2);
  }
  return r.value;
}

function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

function goNext() {
  if (!form.value.user_id || !form.value.type_id) {
    formError.value = 'Заполните все поля';
    return;
  }
  if (mode.value === 'training' && !form.value.training_id) {
    formError.value = 'Заполните все поля';
    return;
  }
  formError.value = '';
  step.value = 2;
}

function goBack() {
  if (editing.value) return;
  step.value = 1;
}

async function save() {
  if (saving.value) return;
  const unit = currentUnit.value;
  let val;
  if (unit?.alias === 'MIN_SEC') {
    const m = parseInt(minutes.value || '0', 10);
    const s = parseInt(seconds.value || '0', 10);
    if (Number.isNaN(m) || Number.isNaN(s) || s < 0 || s > 59) {
      formError.value = 'Неверное значение';
      return;
    }
    val = `${m}:${String(s).padStart(2, '0')}`;
  } else {
    val = parseFloat(form.value.value);
    if (!Number.isNaN(val)) {
      if (unit?.alias === 'SECONDS') val = Math.round(val * 100) / 100;
      else if (!unit?.fractional) val = Math.round(val);
    }
  }
  if (val == null || Number.isNaN(val)) {
    formError.value = 'Неверное значение';
    return;
  }
  const payload = {
    ...form.value,
    training_id: form.value.training_id || undefined,
    value: val,
    value_type_id: value_type_id.value,
    unit_id: unit_id.value,
  };
  try {
    saving.value = true;
    if (editing.value) {
      await apiFetch(`/normative-results/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/normative-results', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function removeResult(r) {
  if (!confirm('Удалить запись?')) return;
  try {
    deletingId.value = r.id;
    await apiFetch(`/normative-results/${r.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    deletingId.value = null;
  }
}

const refresh = () => {
  load();
  loadAux();
};

defineExpose({ refresh });
</script>

<template>
  <div class="mb-4">
    <div class="card section-card tile fade-in shadow-sm">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Результаты нормативов</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div class="row g-2 align-items-end mb-3">
          <div class="col-12 col-sm">
            <input
              type="text"
              class="form-control"
              placeholder="ФИО судьи"
              v-model="search"
            />
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model="typeFilter" class="form-select">
              <option value="">Все типы</option>
              <option v-for="t in types" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model="groupFilter" class="form-select">
              <option value="">Все группы</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="results.length" class="table-responsive">
          <table
            class="table table-sm admin-table auto-cols table-striped align-middle mb-0"
          >
            <thead>
              <tr>
                <th class="text-center">ФИО</th>
                <th class="text-center">Группа</th>
                <th class="text-center">Тип</th>
                <th class="text-center">Значение</th>
                <th class="text-center">Дата и время</th>
                <th class="text-center">Стадион</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.id">
                <td class="fio-col">
                  {{ r.user?.last_name }}
                  {{ r.user?.first_name }}
                  {{ r.user?.patronymic }}
                </td>
                <td>{{ r.group?.name || '-' }}</td>
                <td>
                  {{ types.find((t) => t.id === r.type_id)?.name || r.type_id }}
                </td>
                <td :class="['zone-cell', `zone-${r.zone?.alias}`]">
                  {{ formatValue(r) }}
                </td>
                <td class="text-nowrap">
                  {{
                    r.retake
                      ? 'Перезачет'
                      : r.online
                        ? 'Онлайн'
                        : formatDateTime(r.training?.start_at)
                  }}
                </td>
                <td>
                  {{
                    r.training?.Ground?.name || r.training?.ground?.name || '-'
                  }}
                </td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    @click="openEdit(r)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    @click="removeResult(r)"
                    :disabled="deletingId === r.id"
                  >
                    <span
                      v-if="deletingId === r.id"
                      class="spinner-border spinner-border-sm"
                    ></span>
                    <i v-else class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <nav
      class="mt-3 d-flex align-items-center justify-content-between"
      v-if="results.length"
    >
      <select
        v-model.number="pageSize"
        class="form-select form-select-sm w-auto"
      >
        <option :value="15">15</option>
        <option :value="30">30</option>
        <option :value="50">50</option>
      </select>
      <Pagination v-model="currentPage" :total-pages="totalPages" />
    </nav>
    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="step === 1 ? goNext() : save()">
            <div class="modal-header">
              <h5 class="modal-title">
                {{ editing ? 'Изменить результат' : 'Добавить результат' }}
              </h5>
              <button
                type="button"
                class="btn-close"
                @click="modal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">
                {{ formError }}
              </div>
              <template v-if="step === 1">
                <div class="form-floating mb-3">
                  <select
                    id="resType"
                    v-model="form.type_id"
                    class="form-select"
                    required
                  >
                    <option value="" disabled>Тип</option>
                    <option v-for="t in types" :key="t.id" :value="t.id">
                      {{ t.name }}
                    </option>
                  </select>
                  <label for="resType">Тип</label>
                </div>
                <div class="form-floating mb-3">
                  <select id="resMode" v-model="mode" class="form-select">
                    <option value="training">Тренировка</option>
                    <option value="online">Онлайн</option>
                    <option value="retake">Перезачет</option>
                  </select>
                  <label for="resMode">Способ</label>
                </div>
                <div v-if="mode === 'training'" class="form-floating mb-3">
                  <select
                    id="resTraining"
                    v-model="form.training_id"
                    class="form-select"
                  >
                    <option value="" disabled>Тренировка</option>
                    <option
                      v-for="t in filteredTrainings"
                      :key="t.id"
                      :value="t.id"
                    >
                      {{
                        new Date(t.start_at).toLocaleString('ru-RU', {
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </option>
                  </select>
                  <label for="resTraining">Тренировка</label>
                </div>
                <div class="mb-3 position-relative">
                  <div class="form-floating">
                    <input
                      id="userId"
                      v-model="userQuery"
                      class="form-control"
                      placeholder="Пользователь"
                    />
                    <label for="userId">Пользователь</label>
                  </div>
                  <ul
                    v-if="userSuggestions.length"
                    class="list-group position-absolute w-100"
                    style="z-index: 1050"
                  >
                    <li
                      v-for="u in userSuggestions"
                      :key="u.id"
                      class="list-group-item list-group-item-action"
                      @mousedown.prevent="selectUser(u)"
                    >
                      {{ u.last_name }} {{ u.first_name }}
                    </li>
                  </ul>
                </div>
              </template>
              <template v-else>
                <div
                  v-if="currentUnit?.alias === 'MIN_SEC'"
                  class="row g-2 mb-3"
                >
                  <div class="col">
                    <div class="form-floating">
                      <input
                        id="resMin"
                        type="number"
                        min="0"
                        v-model.number="minutes"
                        class="form-control"
                        placeholder="Минуты"
                        required
                      />
                      <label for="resMin">Минуты</label>
                    </div>
                  </div>
                  <div class="col">
                    <div class="form-floating">
                      <input
                        id="resSec"
                        type="number"
                        min="0"
                        max="59"
                        v-model.number="seconds"
                        class="form-control"
                        placeholder="Секунды"
                        required
                      />
                      <label for="resSec">Секунды</label>
                    </div>
                  </div>
                </div>
                <div v-else class="form-floating mb-3">
                  <input
                    id="resValue"
                    type="number"
                    v-model="form.value"
                    :step="
                      currentUnit?.alias === 'SECONDS' && currentUnit.fractional
                        ? '0.01'
                        : '1'
                    "
                    class="form-control"
                    placeholder="Значение"
                    required
                  />
                  <label for="resValue">Значение</label>
                </div>
              </template>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="step === 1 ? modal.hide() : goBack()"
              >
                {{ step === 1 ? 'Отмена' : 'Назад' }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span
                  v-if="step === 2 && saving"
                  class="spinner-border spinner-border-sm me-1"
                ></span>
                {{ step === 1 ? 'Далее' : 'Сохранить' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
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
