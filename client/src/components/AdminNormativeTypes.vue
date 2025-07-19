<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const types = ref([]);
const total = ref(0);
const seasons = ref([]);
const units = ref([]);
const valueTypes = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');

const form = ref({ season_id: '', name: '', required: false, value_type_id: '', unit_id: '' });
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadDictionaries();
});

watch(currentPage, load);

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({ page: currentPage.value, limit: pageSize });
    const data = await apiFetch(`/normative-types?${params}`);
    types.value = data.types;
    total.value = data.total;
    error.value = '';
  } catch (e) {
    error.value = e.message;
    types.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadDictionaries() {
  try {
    const [seasonData, unitData, valueData] = await Promise.all([
      apiFetch('/camp-seasons?page=1&limit=100'),
      apiFetch('/measurement-units'),
      apiFetch('/normative-value-types'),
    ]);
    seasons.value = seasonData.seasons;
    units.value = unitData.units;
    valueTypes.value = valueData.valueTypes;
  } catch (_) {
    seasons.value = [];
    units.value = [];
    valueTypes.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = { season_id: '', name: '', required: false, value_type_id: '', unit_id: '' };
  formError.value = '';
  modal.show();
}

function openEdit(t) {
  editing.value = t;
  form.value = { season_id: t.season_id, name: t.name, required: t.required, value_type_id: t.value_type_id, unit_id: t.unit_id };
  formError.value = '';
  modal.show();
}

async function save() {
  const payload = { ...form.value };
  payload.required = !!payload.required;
  try {
    if (editing.value) {
      await apiFetch(`/normative-types/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await apiFetch('/normative-types', { method: 'POST', body: JSON.stringify(payload) });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  }
}

async function removeType(t) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/normative-types/${t.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  }
}

const refresh = () => {
  load();
  loadDictionaries();
};

defineExpose({ refresh });
</script>

<template>
  <div class="mb-4">
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="h5 mb-0">Типы нормативов</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-0">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="types.length" class="table-responsive">
          <table class="table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Сезон</th>
                <th>Название</th>
                <th>Обязательный</th>
                <th class="d-none d-md-table-cell">Тип значения</th>
                <th class="d-none d-md-table-cell">Ед. изм.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in types" :key="t.id">
                <td>{{ seasons.find(s => s.id === t.season_id)?.name || t.season_id }}</td>
                <td>{{ t.name }}</td>
                <td>{{ t.required ? 'Да' : 'Нет' }}</td>
                <td class="d-none d-md-table-cell">{{ valueTypes.find(v => v.id === t.value_type_id)?.name || t.value_type_id }}</td>
                <td class="d-none d-md-table-cell">{{ units.find(u => u.id === t.unit_id)?.name || t.unit_id }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-secondary me-2" @click="openEdit(t)">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" @click="removeType(t)">
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
              <h5 class="modal-title">{{ editing ? 'Изменить тип' : 'Добавить тип' }}</h5>
              <button type="button" class="btn-close" @click="modal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div class="form-floating mb-3">
                <select id="typeSeason" v-model="form.season_id" class="form-select" required>
                  <option value="" disabled>Выберите сезон</option>
                  <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
                <label for="typeSeason">Сезон</label>
              </div>
              <div class="form-floating mb-3">
                <input id="typeName" v-model="form.name" class="form-control" placeholder="Название" required />
                <label for="typeName">Наименование</label>
              </div>
              <div class="form-check mb-3">
                <input id="typeReq" type="checkbox" class="form-check-input" v-model="form.required" />
                <label for="typeReq" class="form-check-label">Обязательный</label>
              </div>
              <div class="form-floating mb-3">
                <select id="typeValue" v-model="form.value_type_id" class="form-select" required>
                  <option value="" disabled>Тип значения</option>
                  <option v-for="v in valueTypes" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
                <label for="typeValue">Тип значения</label>
              </div>
              <div class="form-floating mb-3">
                <select id="typeUnit" v-model="form.unit_id" class="form-select" required>
                  <option value="" disabled>Единица измерения</option>
                  <option v-for="u in units" :key="u.id" :value="u.id">{{ u.name }}</option>
                </select>
                <label for="typeUnit">Ед. измерения</label>
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
