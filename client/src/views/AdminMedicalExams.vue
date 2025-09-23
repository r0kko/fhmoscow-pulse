<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import { loadPageSize, savePageSize } from '../utils/pageSize';
import PageNav from '../components/PageNav.vue';
import { toDateTimeLocal, fromDateTimeLocal } from '../utils/time';
import {
  endAfterStart,
  required,
  nonNegativeNumber,
} from '../utils/validation';
import InlineError from '../components/InlineError.vue';
import { useToast } from '../utils/toast';
import ConfirmModal from '../components/ConfirmModal.vue';
import { formatRussianPhone } from '../utils/personal';
import type {
  AdminMedicalExam,
  AdminMedicalExamListResponse,
  AdminMedicalCenter,
  AdminMedicalCenterListResponse,
} from '../types/admin';

interface ConfirmModalInstance {
  open: () => void;
}

interface MedicalExamForm {
  medical_center_id: string;
  start_at: string;
  end_at: string;
  capacity: string;
}

const exams = ref<AdminMedicalExam[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref<number>(loadPageSize('adminMedExamsPageSize', 8));
const isLoading = ref(false);
const error = ref('');

const centers = ref<AdminMedicalCenter[]>([]);
const form = ref<MedicalExamForm>({
  medical_center_id: '',
  start_at: '',
  end_at: '',
  capacity: '',
});
const editing = ref<AdminMedicalExam | null>(null);
const modalRef = ref<HTMLDivElement | null>(null);
let modal: InstanceType<typeof Modal> | null = null;
const formError = ref('');

const confirmRef = ref<ConfirmModalInstance | null>(null);
const confirmMessage = ref('');
let confirmAction: (() => Promise<void>) | null = null;

const { showToast } = useToast();
const router = useRouter();

const isCenterMissing = computed(
  () => !required(form.value.medical_center_id)
);
const isStartMissing = computed(() => !required(form.value.start_at));
const isEndMissing = computed(() => !required(form.value.end_at));
const isOrderInvalid = computed(() =>
  !endAfterStart(form.value.start_at || '', form.value.end_at || '')
);
const isCapacityInvalid = computed(
  () => !nonNegativeNumber(form.value.capacity)
);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / Math.max(pageSize.value, 1)))
);

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
}

function formatPhone(value: string | null | undefined): string {
  return formatRussianPhone(value ?? '');
}

function toInputValue(value: string | null | undefined): string {
  return toDateTimeLocal(value ?? '') ?? '';
}

async function loadCenters(): Promise<void> {
  try {
    const data = await apiFetch<AdminMedicalCenterListResponse>(
      '/medical-centers?page=1&limit=100'
    );
    centers.value = data.centers ?? [];
  } catch {
    centers.value = [];
  }
}

async function load(): Promise<void> {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    });
    const data = await apiFetch<AdminMedicalExamListResponse>(
      `/medical-exams?${params}`
    );
    exams.value = data.exams ?? [];
    total.value = Number.isFinite(data.total) ? data.total : 0;
    error.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить';
    exams.value = [];
    total.value = 0;
  } finally {
    isLoading.value = false;
  }
}

function closeFormModal(): void {
  modal?.hide();
}

function openCreate(): void {
  editing.value = null;
  form.value = {
    medical_center_id: '',
    start_at: '',
    end_at: '',
    capacity: '',
  };
  formError.value = '';
  modal?.show();
}

function openEdit(exam: AdminMedicalExam): void {
  editing.value = exam;
  form.value = {
    medical_center_id: exam.center?.id ?? '',
    start_at: toInputValue(exam.start_at),
    end_at: toInputValue(exam.end_at),
    capacity: String(exam.capacity ?? ''),
  };
  formError.value = '';
  modal?.show();
}

async function save(): Promise<void> {
  formError.value = '';
  const payload = {
    medical_center_id: form.value.medical_center_id,
    start_at: fromDateTimeLocal(form.value.start_at) || '',
    end_at: fromDateTimeLocal(form.value.end_at) || '',
    capacity: form.value.capacity,
  };

  if (!payload.medical_center_id) {
    formError.value = 'Выберите медицинский центр';
    return;
  }
  if (!payload.start_at) {
    formError.value = 'Укажите дату и время начала';
    return;
  }
  if (!payload.end_at) {
    formError.value = 'Укажите дату и время окончания';
    return;
  }
  if (new Date(payload.end_at) < new Date(payload.start_at)) {
    formError.value = 'Время окончания должно быть позже начала';
    return;
  }
  if (isCapacityInvalid.value) {
    formError.value = 'Вместимость должна быть неотрицательным числом';
    return;
  }

  try {
    if (editing.value) {
      await apiFetch(`/medical-exams/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Запись обновлена');
    } else {
      await apiFetch('/medical-exams', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Запись добавлена');
    }
    closeFormModal();
    await load();
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Не удалось сохранить';
  }
}

function confirmRemove(exam: AdminMedicalExam): void {
  confirmMessage.value = 'Удалить запись медосмотра?';
  confirmAction = async () => {
    try {
      await apiFetch(`/medical-exams/${exam.id}`, { method: 'DELETE' });
      showToast('Запись удалена');
      await load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Не удалось удалить запись'
      );
    }
  };
  confirmRef.value?.open();
}

function onConfirm(): void {
  const action = confirmAction;
  confirmAction = null;
  if (action) void action();
}

function openRegistrations(exam: AdminMedicalExam): void {
  router.push(`/admin/medical-exams/${exam.id}/registrations`);
}

onMounted(() => {
  modal = new Modal(modalRef.value);
  void load();
  void loadCenters();
});

onBeforeUnmount(() => {
  modal?.hide();
  modal?.dispose();
  modal = null;
});

watch(currentPage, () => {
  void load();
});

watch(pageSize, (val) => {
  currentPage.value = 1;
  savePageSize('adminMedExamsPageSize', val);
  void load();
});
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
      <div class="card-body">
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
                    @click="confirmRemove(ex)"
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
                  @click="confirmRemove(ex)"
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

    <div
      ref="modalRef"
      class="modal fade"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      data-bs-backdrop="static"
      data-bs-keyboard="false"
    >
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h2 class="modal-title h5">
                {{ editing ? 'Изменить запись' : 'Добавить запись' }}
              </h2>
              <button
                type="button"
                class="btn-close"
                @click="closeFormModal"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">
                {{ formError }}
              </div>
              <div class="mb-3">
                <label class="form-label">Медицинский центр</label>
                <select
                  v-model="form.medical_center_id"
                  class="form-select"
                  :class="{ 'is-invalid': isCenterMissing }"
                  required
                >
                  <option value="" disabled>Выберите центр</option>
                  <option v-for="c in centers" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </option>
                </select>
                <InlineError
                  v-if="isCenterMissing"
                  message="Выберите медицинский центр"
                />
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exStart"
                  v-model="form.start_at"
                  type="datetime-local"
                  class="form-control"
                  :class="{ 'is-invalid': isStartMissing }"
                  required
                />
                <label for="exStart">Начало</label>
                <InlineError
                  v-if="isStartMissing"
                  message="Укажите дату и время начала"
                />
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exEnd"
                  v-model="form.end_at"
                  type="datetime-local"
                  class="form-control"
                  :class="{ 'is-invalid': isEndMissing || isOrderInvalid }"
                  required
                />
                <label for="exEnd">Окончание</label>
                <InlineError
                  v-if="isEndMissing"
                  message="Укажите дату и время окончания"
                />
                <InlineError
                  v-else-if="isOrderInvalid"
                  message="Время окончания должно быть позже начала"
                />
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exCap"
                  v-model="form.capacity"
                  type="number"
                  min="0"
                  class="form-control"
                  :class="{ 'is-invalid': isCapacityInvalid }"
                />
                <label for="exCap">Количество мест</label>
                <InlineError
                  v-if="isCapacityInvalid"
                  message="Введите неотрицательное число"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeFormModal"
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

  <ConfirmModal
    ref="confirmRef"
    confirm-text="Удалить"
    confirm-variant="danger"
    @confirm="onConfirm"
  >
    <p class="mb-0">{{ confirmMessage }}</p>
  </ConfirmModal>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Mobile gutters for section cards are defined globally */

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
