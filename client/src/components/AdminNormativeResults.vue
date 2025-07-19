<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds, parseMinutesSeconds } from '../utils/time.js';

const results = ref([]);
const total = ref(0);
const seasons = ref([]);
const trainings = ref([]);
const types = ref([]);
const units = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');

const form = ref({
  user_id: '',
  season_id: '',
  training_id: '',
  type_id: '',
  value: '',
});
const value_type_id = ref('');
const unit_id = ref('');
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const userQuery = ref('');
const userSuggestions = ref([]);
let userTimeout;
let skipWatch = false;

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
);

const currentUnit = computed(() =>
  units.value.find((u) => u.id === unit_id.value) || null
);

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadAux();
});

watch(currentPage, load);

watch(userQuery, () => {
  clearTimeout(userTimeout);
  if (skipWatch) {
    skipWatch = false;
    return;
  }
  form.value.user_id = '';
  if (!userQuery.value || userQuery.value.length < 2) {
    userSuggestions.value = [];
    return;
  }
  userTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ search: userQuery.value, limit: 5 });
      const data = await apiFetch(`/users?${params}`);
      userSuggestions.value = data.users;
    } catch (_err) {
      userSuggestions.value = [];
    }
  }, 300);
});

watch(
  () => form.value.season_id,
  async (val) => {
    if (!val) {
      types.value = [];
      return;
    }
    try {
      const params = new URLSearchParams({
        season_id: val,
        page: 1,
        limit: 100,
      });
      const data = await apiFetch(`/normative-types?${params}`);
      types.value = data.types;
    } catch (_err) {
      types.value = [];
    }
  }
);

watch(
  () => form.value.training_id,
  (val) => {
    const tr = trainings.value.find((t) => t.id === val);
    if (tr) {
      form.value.season_id = tr.season_id;
    }
  }
);

watch(
  () => form.value.type_id,
  (val) => {
    const t = types.value.find((x) => x.id === val);
    if (t) {
      value_type_id.value = t.value_type_id;
      unit_id.value = t.unit_id;
    }
  }
);

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/normative-results?${params}`);
    results.value = data.results;
    total.value = data.total;
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
    const [seasonData, trainingData, unitData] = await Promise.all([
      apiFetch('/camp-seasons?page=1&limit=100'),
      apiFetch('/camp-trainings/past?limit=100'),
      apiFetch('/measurement-units'),
    ]);
    seasons.value = seasonData.seasons;
    trainings.value = trainingData.trainings;
    units.value = unitData.units;
  } catch (_e) {
    seasons.value = [];
    trainings.value = [];
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
  };
  value_type_id.value = '';
  unit_id.value = '';
  userQuery.value = '';
  userSuggestions.value = [];
  formError.value = '';
  modal.show();
}

function openEdit(r) {
  editing.value = r;
  const unit = units.value.find((u) => u.id === r.unit_id);
  let val = r.value;
  if (unit?.alias === 'MIN_SEC') {
    val = formatMinutesSeconds(val);
  } else if (unit?.alias === 'SECONDS') {
    val = Number(val).toFixed(2);
  }
  form.value = {
    user_id: r.user_id,
    season_id: r.season_id,
    training_id: r.training_id || '',
    type_id: r.type_id,
    value: val,
  };
  value_type_id.value = r.value_type_id;
  unit_id.value = r.unit_id;
  skipWatch = true;
  userQuery.value = `${r.user?.last_name || ''} ${r.user?.first_name || ''}`.trim();
  userSuggestions.value = [];
  formError.value = '';
  modal.show();
}

function selectUser(u) {
  form.value.user_id = u.id;
  skipWatch = true;
  userQuery.value = `${u.last_name} ${u.first_name}`;
  userSuggestions.value = [];
}

function onValueInput(e) {
  if (currentUnit.value?.alias !== 'MIN_SEC') return;
  let val = e.target.value.replace(/[^0-9:]/g, '');
  const colon = val.indexOf(':');
  if (colon === -1) {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) {
      form.value.value = `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
    } else {
      form.value.value = digits;
    }
    return;
  }
  val = val.slice(0, colon + 1) + val.slice(colon + 1).replace(/:/g, '');
  let minutes = val.slice(0, colon).replace(/\D/g, '').slice(0, 2);
  if (!minutes) minutes = '0';
  let seconds = val.slice(colon + 1).replace(/\D/g, '').slice(0, 2);
  form.value.value = `${minutes}:${seconds}`;
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

async function save() {
  const unit = currentUnit.value;
  let val = form.value.value;
  if (unit?.alias === 'MIN_SEC') {
    val = parseMinutesSeconds(val);
  } else {
    val = parseFloat(val);
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
    value: val,
    value_type_id: value_type_id.value,
    unit_id: unit_id.value,
  };
  try {
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
  }
}

async function removeResult(r) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/normative-results/${r.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
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
      <div class="card-body p-0">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="results.length" class="table-responsive">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Группа</th>
                <th>Тип</th>
                <th>Значение</th>
                <th>Зона</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.id">
                <td>
                  {{ r.user?.last_name }} {{ r.user?.first_name }}
                </td>
                <td>{{ r.group?.name || '-' }}</td>
                <td>
                  {{ types.find((t) => t.id === r.type_id)?.name || r.type_id }}
                </td>
                <td>{{ formatValue(r) }}</td>
                <td>{{ r.zone?.name }}</td>
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
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <nav class="mt-3" v-if="totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button
            class="page-link"
            @click="currentPage--"
            :disabled="currentPage === 1"
          >
            Пред
          </button>
        </li>
        <li
          class="page-item"
          v-for="p in totalPages"
          :key="p"
          :class="{ active: currentPage === p }"
        >
          <button class="page-link" @click="currentPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button
            class="page-link"
            @click="currentPage++"
            :disabled="currentPage === totalPages"
          >
            След
          </button>
        </li>
      </ul>
    </nav>
    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
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
              <div class="form-floating mb-3">
                <select
                  id="resSeason"
                  v-model="form.season_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Выберите сезон</option>
                  <option v-for="s in seasons" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
                <label for="resSeason">Сезон</label>
              </div>
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
                <select
                  id="resTraining"
                  v-model="form.training_id"
                  class="form-select"
                >
                  <option value="" disabled>Тренировка</option>
                  <option v-for="t in trainings" :key="t.id" :value="t.id">
                    {{ new Date(t.start_at).toLocaleString('ru-RU') }}
                  </option>
                </select>
                <label for="resTraining">Тренировка</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="resValue"
                  :type="currentUnit?.alias === 'MIN_SEC' ? 'text' : 'number'"
                  :step="currentUnit?.alias === 'SECONDS' && currentUnit.fractional ? '0.01' : '1'"
                  :pattern="currentUnit?.alias === 'MIN_SEC' ? '\\d{1,2}:\\d{2}' : null"
                  v-model="form.value"
                  @input="onValueInput"
                  class="form-control"
                  placeholder="Значение"
                  required
                />
                <label for="resValue">Значение</label>
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="modal.hide()"
              >
                Отмена
              </button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
