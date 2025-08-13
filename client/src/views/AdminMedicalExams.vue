<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import Pagination from '../components/Pagination.vue';
import PageNav from '../components/PageNav.vue';
import { toDateTimeLocal, fromDateTimeLocal } from '../utils/time.js';

const exams = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminMedExamsPageSize', 8));
const isLoading = ref(false);
const error = ref('');

const centers = ref([]);
const form = ref({
  medical_center_id: '',
  start_at: '',
  end_at: '',
  capacity: '',
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadCenters();
});

onBeforeUnmount(() => {
  try {
    modal?.hide?.();
    modal?.dispose?.();
  } catch {}
});

watch(currentPage, load);
watch(pageSize, (val) => {
  currentPage.value = 1;
  savePageSize('adminMedExamsPageSize', val);
  load();
});

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
}

function formatPhone(digits) {
  if (!digits) return '';
  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += '-' + digits.slice(7, 9);
  if (digits.length >= 9) out += '-' + digits.slice(9, 11);
  return out;
}

function toInputValue(str) {
  return toDateTimeLocal(str);
}

async function loadCenters() {
  try {
    const data = await apiFetch('/medical-centers?page=1&limit=100');
    centers.value = data.centers;
  } catch (_e) {
    centers.value = [];
  }
}

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(`/medical-exams?${params}`);
    exams.value = data.exams;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form.value, {
    medical_center_id: '',
    start_at: '',
    end_at: '',
    capacity: '',
  });
  formError.value = '';
  modal.show();
}

function openEdit(exam) {
  editing.value = exam;
  form.value.medical_center_id = exam.center?.id || '';
  form.value.start_at = toInputValue(exam.start_at);
  form.value.end_at = toInputValue(exam.end_at);
  form.value.capacity = exam.capacity || '';
  formError.value = '';
  modal.show();
}

async function save() {
  try {
    formError.value = '';
    const body = {
      medical_center_id: form.value.medical_center_id,
      start_at: fromDateTimeLocal(form.value.start_at),
      end_at: fromDateTimeLocal(form.value.end_at),
      capacity: form.value.capacity,
    };
    if (editing.value) {
      await apiFetch(`/medical-exams/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } else {
      await apiFetch('/medical-exams', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  }
}

async function removeExam(exam) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/medical-exams/${exam.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  }
}

const router = useRouter();

function openRegistrations(exam) {
  router.push(`/admin/medical-exams/${exam.id}/registrations`);
}
</script>

<template>
  <div>
    <div class="card section-card tile fade-in shadow-sm mb-4">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Расписание медосмотров</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div
            class="spinner-border spinner-brand"
            role="status"
            aria-label="Загрузка"
          ></div>
        </div>
        <div v-if="exams.length" class="table-responsive d-none d-sm-block">
          <table class="table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Центр</th>
                <th>Период</th>
                <th>Места</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ex in exams" :key="ex.id">
                <td>{{ ex.center?.name }}</td>
                <td>
                  {{ formatDateTime(ex.start_at) }} -
                  {{ formatDateTime(ex.end_at) }}
                </td>
                <td>{{ ex.capacity }}</td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-primary me-2"
                    aria-label="Заявки на медосмотр"
                    @click="openRegistrations(ex)"
                  >
                    <i class="bi bi-people"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать запись"
                    @click="openEdit(ex)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить запись"
                    @click="removeExam(ex)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="exams.length" class="d-block d-sm-none">
          <div v-for="ex in exams" :key="ex.id" class="card mb-2">
            <div class="card-body p-2">
              <h3 class="h6 mb-1">{{ ex.center?.name }}</h3>
              <p class="mb-1 small">
                {{ formatDateTime(ex.start_at) }} —
                {{ formatDateTime(ex.end_at) }}
              </p>
              <p class="mb-2 small">Места: {{ ex.capacity }}</p>
              <div class="text-end">
                <button
                  class="btn btn-sm btn-primary me-2"
                  aria-label="Заявки на медосмотр"
                  @click="openRegistrations(ex)"
                >
                  <i class="bi bi-people"></i>
                </button>
                <button
                  class="btn btn-sm btn-secondary me-2"
                  aria-label="Редактировать запись"
                  @click="openEdit(ex)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  aria-label="Удалить запись"
                  @click="removeExam(ex)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <PageNav
      v-if="totalPages > 1"
      v-model:page="currentPage"
      v-model:page-size="pageSize"
      :total-pages="totalPages"
      :sizes="[5, 8, 10, 20]"
    />

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h2 class="modal-title h5">
                {{ editing ? 'Изменить запись' : 'Добавить запись' }}
              </h2>
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
                <label class="form-label">Медицинский центр</label>
                <select
                  v-model.number="form.medical_center_id"
                  class="form-select"
                  required
                >
                  <option value="" disabled>Выберите центр</option>
                  <option v-for="c in centers" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </option>
                </select>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exStart"
                  v-model="form.start_at"
                  type="datetime-local"
                  class="form-control"
                  required
                />
                <label for="exStart">Начало</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exEnd"
                  v-model="form.end_at"
                  type="datetime-local"
                  class="form-control"
                  required
                />
                <label for="exEnd">Окончание</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exCap"
                  v-model="form.capacity"
                  type="number"
                  min="0"
                  class="form-control"
                />
                <label for="exCap">Количество мест</label>
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
