<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const results = ref([]);
const trainings = ref([]);
const types = ref([]);
const units = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const total = ref(0);
const isLoading = ref(false);
const error = ref('');

const form = ref({
  training_id: '',
  type_id: '',
  value: '',
});
const season_id = ref('');
const value_type_id = ref('');
const unit_id = ref('');
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const currentUnit = computed(() => units.value.find((u) => u.id === unit_id.value) || null);

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadAux();
});

watch(currentPage, load);

watch(
  () => form.value.training_id,
  (val) => {
    const tr = trainings.value.find((t) => t.id === val);
    if (tr) {
      season_id.value = tr.season_id;
      loadTypes(tr.season_id);
    } else {
      season_id.value = '';
      types.value = [];
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
    const params = new URLSearchParams({ page: currentPage.value, limit: pageSize });
    const data = await apiFetch(`/normative-results/me?${params}`);
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
    const [trData, unitData] = await Promise.all([
      apiFetch('/camp-trainings/me/past?limit=100'),
      apiFetch('/measurement-units'),
    ]);
    trainings.value = trData.trainings || [];
    units.value = unitData.units || [];
  } catch (_e) {
    trainings.value = [];
    units.value = [];
  }
}

async function loadTypes(seasonId) {
  try {
    const params = new URLSearchParams({ season_id: seasonId });
    const data = await apiFetch(`/normative-types/available?${params}`);
    types.value = data.types || [];
  } catch (_e) {
    types.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = { training_id: '', type_id: '', value: '' };
  season_id.value = '';
  value_type_id.value = '';
  unit_id.value = '';
  formError.value = '';
  modal.show();
}

function openEdit(r) {
  editing.value = r;
  form.value = {
    training_id: r.training_id || '',
    type_id: r.type_id,
    value: r.value,
  };
  season_id.value = r.season_id;
  value_type_id.value = r.value_type_id;
  unit_id.value = r.unit_id;
  loadTypes(r.season_id);
  formError.value = '';
  modal.show();
}

async function save() {
  const payload = {
    ...form.value,
    season_id: season_id.value,
    value_type_id: value_type_id.value,
    unit_id: unit_id.value,
  };
  try {
    if (editing.value) {
      await apiFetch(`/normative-results/me/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/normative-results/me', {
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
    await apiFetch(`/normative-results/me/${r.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="mb-4">
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="h5 mb-0">Мои результаты нормативов</h2>
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
                <th>Тренировка</th>
                <th>Тип</th>
                <th>Значение</th>
                <th>Зона</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.id">
                <td>
                  {{ trainings.find((t) => t.id === r.training_id)?.start_at || '' }}
                </td>
                <td>{{ types.find((t) => t.id === r.type_id)?.name || r.type_id }}</td>
                <td>{{ r.value }}</td>
                <td>{{ r.zone?.name }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-secondary me-2" @click="openEdit(r)">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" @click="removeResult(r)">
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
          <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">Пред</button>
        </li>
        <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: currentPage === p }">
          <button class="page-link" @click="currentPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">След</button>
        </li>
      </ul>
    </nav>
    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">{{ editing ? 'Изменить результат' : 'Добавить результат' }}</h5>
              <button type="button" class="btn-close" @click="modal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div class="form-floating mb-3">
                <select id="resTraining" v-model="form.training_id" class="form-select" required>
                  <option value="" disabled>Тренировка</option>
                  <option v-for="t in trainings" :key="t.id" :value="t.id">
                    {{ new Date(t.start_at).toLocaleString('ru-RU') }}
                  </option>
                </select>
                <label for="resTraining">Тренировка</label>
              </div>
              <div class="form-floating mb-3">
                <select id="resType" v-model="form.type_id" class="form-select" required>
                  <option value="" disabled>Тип</option>
                  <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <label for="resType">Тип</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="resValue"
                  :type="currentUnit?.alias === 'MIN_SEC' ? 'text' : 'number'"
                  :step="currentUnit?.alias === 'SECONDS' && currentUnit.fractional ? '0.01' : '1'"
                  :pattern="currentUnit?.alias === 'MIN_SEC' ? '\\d{1,2}:\\d{2}' : null"
                  v-model="form.value"
                  class="form-control"
                  placeholder="Значение"
                  required
                />
                <label for="resValue">Значение</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
