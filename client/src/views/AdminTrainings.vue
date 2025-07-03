<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const trainings = ref([]);
const total = ref(0);
const trainingTypes = ref([]);
const stadiums = ref([]);
const seasons = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');
const form = ref({
  type_id: '',
  camp_stadium_id: '',
  season_id: '',
  start_at: '',
  end_at: '',
  capacity: '',
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
);

onMounted(() => {
  modal = new Modal(modalRef.value);
  loadTrainings();
  loadTrainingTypes();
  loadStadiums();
  loadSeasons();
});

watch(currentPage, loadTrainings);

async function loadTrainings() {
  isLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/camp-trainings?${params}`);
    trainings.value = data.trainings;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

async function loadTrainingTypes() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/camp-training-types?${params}`);
    trainingTypes.value = data.types;
  } catch (_) {
    trainingTypes.value = [];
  }
}

async function loadStadiums() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/camp-stadiums?${params}`);
    stadiums.value = data.stadiums;
  } catch (_) {
    stadiums.value = [];
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

function openCreate() {
  editing.value = null;
  if (!trainingTypes.value.length) loadTrainingTypes();
  if (!stadiums.value.length) loadStadiums();
  if (!seasons.value.length) loadSeasons();
  form.value = {
    type_id: '',
    camp_stadium_id: '',
    season_id: '',
    start_at: '',
    end_at: '',
    capacity: '',
  };
  formError.value = '';
  modal.show();
}

function toInputValue(str) {
  if (!str) return '';
  const d = new Date(str);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function formatDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} ${time}`;
}

function openEdit(t) {
  editing.value = t;
  if (!trainingTypes.value.length) loadTrainingTypes();
  if (!stadiums.value.length) loadStadiums();
  if (!seasons.value.length) loadSeasons();
  form.value = {
    type_id: t.type?.id || '',
    camp_stadium_id: t.stadium?.id || '',
    season_id: t.season?.id || '',
    start_at: toInputValue(t.start_at),
    end_at: toInputValue(t.end_at),
    capacity: t.capacity || '',
  };
  formError.value = '';
  modal.show();
}

async function save() {
  if (new Date(form.value.end_at) <= new Date(form.value.start_at)) {
    formError.value = 'Время окончания должно быть позже начала';
    return;
  }
  const payload = {
    type_id: form.value.type_id,
    camp_stadium_id: form.value.camp_stadium_id,
    season_id: form.value.season_id,
    start_at: new Date(form.value.start_at).toISOString(),
    end_at: new Date(form.value.end_at).toISOString(),
    capacity: form.value.capacity || undefined,
  };
  try {
    if (editing.value) {
      await apiFetch(`/camp-trainings/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/camp-trainings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await loadTrainings();
  } catch (e) {
    formError.value = e.message;
  }
}

async function removeTraining(t) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/camp-trainings/${t.id}`, { method: 'DELETE' });
    await loadTrainings();
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Тренировки</li>
      </ol>
    </nav>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">Тренировки</h1>
      <button class="btn btn-brand" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Добавить
      </button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="isLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div v-if="trainings.length" class="table-responsive">
      <table class="table table-striped align-middle">
        <thead>
          <tr>
            <th>Сезон</th>
            <th>Тип</th>
            <th>Стадион</th>
            <th>Начало</th>
            <th>Окончание</th>
            <th class="text-center">Вместимость</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in trainings" :key="t.id">
            <td>{{ t.season?.name }}</td>
            <td>{{ t.type?.name }}</td>
            <td>{{ t.stadium?.name }}</td>
            <td>{{ formatDateTime(t.start_at) }}</td>
            <td>{{ formatDateTime(t.end_at) }}</td>
            <td class="text-center">{{ t.capacity }}</td>
            <td class="text-end">
              <button
                class="btn btn-sm btn-secondary me-2"
                @click="openEdit(t)"
              >
                Изменить
              </button>
              <button class="btn btn-sm btn-danger" @click="removeTraining(t)">
                Удалить
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="!isLoading" class="text-muted">Записей нет.</p>
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
                {{ editing ? 'Изменить тренировку' : 'Добавить тренировку' }}
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
              <div class="mb-3">
                <label class="form-label">Сезон</label>
                <select v-model="form.season_id" class="form-select" required>
                  <option value="" disabled>Выберите сезон</option>
                  <option v-for="s in seasons" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Тип</label>
                <select v-model="form.type_id" class="form-select" required>
                  <option value="" disabled>Выберите тип</option>
                  <option
                    v-for="tt in trainingTypes"
                    :key="tt.id"
                    :value="tt.id"
                  >
                    {{ tt.name }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Стадион</label>
                <select
                  v-model="form.camp_stadium_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Выберите стадион</option>
                  <option v-for="s in stadiums" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="trStart"
                  v-model="form.start_at"
                  type="datetime-local"
                  class="form-control"
                  required
                />
                <label for="trStart">Начало</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="trEnd"
                  v-model="form.end_at"
                  type="datetime-local"
                  class="form-control"
                  required
                />
                <label for="trEnd">Окончание</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="trCap"
                  v-model="form.capacity"
                  type="number"
                  min="0"
                  class="form-control"
                />
                <label for="trCap">Вместимость</label>
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
              <button type="submit" class="btn btn-brand">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
