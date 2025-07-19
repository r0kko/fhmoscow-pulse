<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const results = ref([]);
const total = ref(0);
const seasons = ref([]);
const types = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');

const form = ref({ user_id: '', season_id: '', training_id: '', type_id: '', value: '' });
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

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadSeasons();
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
      const params = new URLSearchParams({ season_id: val, page: 1, limit: 100 });
      const data = await apiFetch(`/normative-types?${params}`);
      types.value = data.types;
    } catch (_err) {
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

async function loadSeasons() {
  try {
    const data = await apiFetch('/camp-seasons?page=1&limit=100');
    seasons.value = data.seasons;
  } catch (_e) {
    seasons.value = [];
  }
}

function openCreate() {
  editing.value = null;
  form.value = { user_id: '', season_id: '', training_id: '', type_id: '', value: '' };
  value_type_id.value = '';
  unit_id.value = '';
  userQuery.value = '';
  userSuggestions.value = [];
  formError.value = '';
  modal.show();
}

function openEdit(r) {
  editing.value = r;
  form.value = { user_id: r.user_id, season_id: r.season_id, training_id: r.training_id || '', type_id: r.type_id, value: r.value };
  value_type_id.value = r.value_type_id;
  unit_id.value = r.unit_id;
  skipWatch = true;
  userQuery.value = r.user_id;
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

async function save() {
  const payload = {
    ...form.value,
    value_type_id: value_type_id.value,
    unit_id: unit_id.value,
  };
  try {
    if (editing.value) {
      await apiFetch(`/normative-results/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await apiFetch('/normative-results', { method: 'POST', body: JSON.stringify(payload) });
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
  loadSeasons();
};

defineExpose({ refresh });
</script>

<template>
  <div class="mb-4">
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
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
          <table class="table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>User</th>
                <th>Сезон</th>
                <th>Тип</th>
                <th>Значение</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.id">
                <td>{{ r.user_id }}</td>
                <td>{{ seasons.find(s => s.id === r.season_id)?.name || r.season_id }}</td>
                <td>{{ types.find(t => t.id === r.type_id)?.name || r.type_id }}</td>
                <td>{{ r.value }}</td>
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
              <div class="mb-3 position-relative">
                <div class="form-floating">
                  <input id="userId" v-model="userQuery" class="form-control" placeholder="Пользователь" />
                  <label for="userId">Пользователь</label>
                </div>
                <ul v-if="userSuggestions.length" class="list-group position-absolute w-100" style="z-index: 1050">
                  <li v-for="u in userSuggestions" :key="u.id" class="list-group-item list-group-item-action" @mousedown.prevent="selectUser(u)">
                    {{ u.last_name }} {{ u.first_name }}
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <select id="resSeason" v-model="form.season_id" class="form-select" required>
                  <option value="" disabled>Выберите сезон</option>
                  <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
                <label for="resSeason">Сезон</label>
              </div>
              <div class="form-floating mb-3">
                <select id="resType" v-model="form.type_id" class="form-select" required>
                  <option value="" disabled>Тип</option>
                  <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <label for="resType">Тип</label>
              </div>
              <div class="form-floating mb-3">
                <input id="resTraining" v-model="form.training_id" class="form-control" placeholder="Тренировка" />
                <label for="resTraining">Тренировка</label>
              </div>
              <div class="form-floating mb-3">
                <input id="resValue" type="number" step="any" v-model="form.value" class="form-control" placeholder="Значение" required />
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
