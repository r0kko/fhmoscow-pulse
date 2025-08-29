<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch, apiFetchForm } from '../api.js';
import MedicalExamCard from '../components/MedicalExamCard.vue';
import Tooltip from 'bootstrap/js/dist/tooltip';
import Modal from 'bootstrap/js/dist/modal';

const certificate = ref(null);
const history = ref([]);
const files = ref([]);
const error = ref('');
const loading = ref(true);
const exams = ref([]);
const examsError = ref('');
const examsLoading = ref(true);
const registering = ref(null);
const ticketModalRef = ref(null);
const fileInput = ref(null);
const ticketError = ref('');
const fileError = ref('');
const selectedFile = ref(null);
const uploadSuccess = ref(false);
const uploading = ref(false);
const hasActiveTicket = ref(false);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['application/pdf'];
const DEFAULT_DESCRIPTION =
  'Прошу приобщить к материалам личного дела мое медицинское заключение-допуск к обслуживанию соревнований. Подтверждаю, что направляемый документ является подлинным.';
let ticketModal;
const activeExamId = computed(() => {
  const e = exams.value.find(
    (ex) =>
      ex.registered &&
      (ex.registration_status === 'PENDING' ||
        ex.registration_status === 'APPROVED')
  );
  return e ? e.id : null;
});
const isValid = (cert) => {
  const today = new Date();
  return (
    new Date(cert.issue_date) <= today && new Date(cert.valid_until) >= today
  );
};

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

function daysLeft(dateStr) {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function pluralDays(n) {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

function validityText(cert) {
  const diff = daysLeft(cert.valid_until);
  const suffix = diff > 0 ? `еще ${diff} ${pluralDays(diff)}` : 'истекло';
  return `${formatDate(cert.issue_date)} - ${formatDate(cert.valid_until)} (${suffix})`;
}

const statusInfo = computed(() => {
  if (!certificate.value || !isValid(certificate.value)) {
    return { label: 'Отсутствует', icon: 'bi-x-circle', class: 'bg-danger' };
  }
  const diff = daysLeft(certificate.value.valid_until);
  if (diff < 30) {
    return {
      label: 'Истекает',
      icon: 'bi-exclamation-circle',
      class: 'bg-warning text-dark',
    };
  }
  return { label: 'OK', icon: 'bi-check-circle', class: 'bg-success' };
});

const showExams = computed(
  () =>
    !certificate.value ||
    !isValid(certificate.value) ||
    daysLeft(certificate.value.valid_until) < 30
);

function applyTooltips() {
  nextTick(() => {
    document
      .querySelectorAll('[data-bs-toggle="tooltip"]')
      .forEach((el) => new Tooltip(el));
  });
}

onMounted(async () => {
  try {
    const [current, hist, tdata] = await Promise.all([
      apiFetch('/medical-certificates/me').catch((e) => {
        if (e.message.includes('не найден')) return null;
        throw e;
      }),
      apiFetch('/medical-certificates/me/history'),
      apiFetch('/tickets/me').catch(() => ({ tickets: [] })),
    ]);
    certificate.value = current ? current.certificate : null;
    history.value = hist.certificates || [];
    hasActiveTicket.value = (tdata.tickets || []).some(
      (t) =>
        t.type?.alias === 'MED_CERT_UPLOAD' &&
        ['CREATED', 'IN_PROGRESS'].includes(t.status?.alias)
    );
    if (certificate.value) {
      const data = await apiFetch('/medical-certificates/me/files').catch(
        () => ({ files: [] })
      );
      files.value = data.files;
    } else {
      files.value = [];
    }
    await Promise.all(
      history.value.map(async (h) => {
        try {
          const data = await apiFetch(`/medical-certificates/${h.id}/files`);
          h.files = data.files;
        } catch (_err) {
          h.files = [];
        }
      })
    );
    error.value = '';
  } catch (e) {
    error.value = e.message;
    certificate.value = null;
    history.value = [];
    files.value = [];
  } finally {
    loading.value = false;
  }
  if (showExams.value) loadExams();
  ticketModal = new Modal(ticketModalRef.value);
});

async function loadExams() {
  examsLoading.value = true;
  try {
    const data = await apiFetch('/medical-exams/available');
    exams.value = data.exams || [];
    examsError.value = '';
    await nextTick();
    applyTooltips();
  } catch (e) {
    exams.value = [];
    examsError.value = e.message;
  } finally {
    examsLoading.value = false;
  }
}

async function toggleExam(exam) {
  if (registering.value) return;
  registering.value = exam.id;
  try {
    if (exam.registered) {
      if (exam.registration_status !== 'PENDING') return;
      await apiFetch(`/medical-exams/${exam.id}/register`, {
        method: 'DELETE',
      });
    } else {
      await apiFetch(`/medical-exams/${exam.id}/register`, { method: 'POST' });
    }
    await loadExams();
  } catch (e) {
    examsError.value = e.message;
  } finally {
    registering.value = null;
  }
}

function openTicketModal() {
  ticketError.value = '';
  fileInput.value.value = '';
  selectedFile.value = null;
  fileError.value = '';
  uploadSuccess.value = false;
  ticketModal.show();
}

async function createTicket() {
  const file = selectedFile.value;
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    fileError.value = 'Файл превышает 5 МБ';
    return;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    fileError.value = 'Недопустимый формат файла';
    return;
  }
  uploading.value = true;
  try {
    const form = new FormData();
    form.append('type_alias', 'MED_CERT_UPLOAD');
    form.append('description', DEFAULT_DESCRIPTION);
    form.append('file', file);
    await apiFetchForm('/tickets', form, { method: 'POST' });
    ticketModal.hide();
    uploadSuccess.value = true;
    selectedFile.value = null;
    hasActiveTicket.value = true;
  } catch (e) {
    ticketError.value = e.message;
  } finally {
    uploading.value = false;
  }
}

function onFileChange(e) {
  fileError.value = '';
  selectedFile.value = e.target.files[0] || null;
}
</script>

<template>
  <div class="py-3 medical-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Медосмотр</li>
        </ol>
      </nav>
      <h1 class="mb-3">Данные медицинских обследований</h1>
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else>
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div
              class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3"
            >
              <h2 class="card-title h5 mb-0 text-brand">
                Действующее заключение
              </h2>
              <span
                class="badge d-flex align-items-center gap-1"
                :class="statusInfo.class"
              >
                <i :class="'bi ' + statusInfo.icon"></i>
                {{ statusInfo.label }}
              </span>
            </div>
            <template v-if="certificate && isValid(certificate)">
              <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
                <div class="col">
                  <div class="form-floating">
                    <input
                      id="certOrg"
                      type="text"
                      class="form-control"
                      :value="certificate.organization"
                      readonly
                      placeholder="Учреждение"
                    />
                    <label for="certOrg">Мед. учреждение</label>
                  </div>
                </div>
                <div class="col">
                  <div class="form-floating">
                    <input
                      id="certNumber"
                      type="text"
                      class="form-control"
                      :value="certificate.certificate_number"
                      readonly
                      placeholder="Номер"
                    />
                    <label for="certNumber">Номер справки</label>
                  </div>
                </div>
                <div class="col">
                  <div class="form-floating">
                    <input
                      id="certDates"
                      type="text"
                      class="form-control"
                      :value="validityText(certificate)"
                      readonly
                      placeholder="Период"
                    />
                    <label for="certDates">Период действия</label>
                  </div>
                </div>
              </div>
              <div class="border-top pt-3 mt-3">
                <p class="mb-2 fw-semibold">Файлы</p>
                <div
                  v-if="files.length"
                  class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2"
                >
                  <div v-for="f in files" :key="f.id" class="col">
                    <a
                      :href="f.url"
                      target="_blank"
                      rel="noopener"
                      class="file-tile d-flex align-items-center gap-2 text-decoration-none text-body p-2 border rounded w-100"
                      :aria-label="`Открыть файл ${f.name} в новой вкладке`"
                    >
                      <i class="bi bi-file-earmark"></i>
                      <span class="text-break">{{ f.name }}</span>
                    </a>
                  </div>
                </div>
                <p v-else class="text-muted mb-0">Нет файлов</p>
              </div>
            </template>
            <div
              v-else
              class="alert alert-warning mb-0 d-flex justify-content-between align-items-center"
              role="alert"
            >
              <span>Действующее медицинское заключение отсутствует</span>
              <RouterLink
                v-if="hasActiveTicket"
                to="/tickets"
                class="btn btn-outline-brand d-flex align-items-center gap-1"
              >
                <i class="bi bi-hourglass"></i>
                <span>Проверка</span>
              </RouterLink>
              <button
                v-else
                class="btn btn-brand d-flex align-items-center gap-1"
                @click="openTicketModal"
              >
                <i class="bi bi-upload"></i>
                <span>Загрузить справку</span>
              </button>
            </div>
          </div>
        </div>
        <div v-if="error" class="alert alert-danger mt-3" role="alert">
          {{ error }}
        </div>
        <div v-if="uploadSuccess" class="alert alert-success mt-3" role="alert">
          Файл отправлен. После проверки он будет добавлен в список.
        </div>
        <div
          v-if="showExams && (examsLoading || exams.length)"
          class="card section-card tile fade-in shadow-sm mb-3 mt-3"
        >
          <div class="card-body">
            <h2 class="card-title h5 mb-3 text-brand">
              Ближайшие запланированные обследования
            </h2>
            <div v-if="examsError" class="alert alert-danger">
              {{ examsError }}
            </div>
            <div v-if="examsLoading" class="text-center my-3">
              <div class="spinner-border" role="status"></div>
            </div>
            <div
              v-if="exams.length"
              class="exam-scroll d-flex flex-nowrap gap-3"
            >
              <MedicalExamCard
                v-for="ex in exams"
                :key="ex.id"
                :exam="ex"
                :loading="registering === ex.id"
                :active-exam-id="activeExamId"
                class="flex-shrink-0"
                @toggle="toggleExam"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <h2 class="card-title h5 mb-3 text-brand">
            Архив медицинских заключений
          </h2>
          <div v-if="history.length">
            <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
              <div v-for="item in history" :key="item.id" class="col">
                <div class="card tile h-100">
                  <div class="card-body d-flex flex-column">
                    <div
                      class="d-flex justify-content-between align-items-start mb-1"
                    >
                      <span class="fw-semibold">{{
                        item.certificate_number
                      }}</span>
                      <span class="text-muted small text-nowrap"
                        >{{ formatDate(item.issue_date) }} -
                        {{ formatDate(item.valid_until) }}</span
                      >
                    </div>
                    <p class="mb-2">{{ item.organization }}</p>
                    <div class="mt-auto">
                      <div
                        v-if="item.files && item.files.length"
                        class="d-flex flex-wrap gap-2"
                      >
                        <a
                          v-for="f in item.files"
                          :key="f.id"
                          :href="f.url"
                          target="_blank"
                          rel="noopener"
                          class="file-tile small d-flex align-items-center gap-1 text-decoration-none text-body p-1 border rounded"
                          :aria-label="`Открыть файл ${f.name} в новой вкладке`"
                        >
                          <i class="bi bi-file-earmark"></i>
                          <span class="text-break">{{ f.name }}</span>
                        </a>
                      </div>
                      <span v-else class="text-muted small">—</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="alert alert-primary mb-0" role="alert">
            Нет медицинских заключений с истекшим сроком действия
          </div>
        </div>
      </div>
    </div>
  </div>
  <div ref="ticketModalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">Загрузка справки</h2>
          <button
            type="button"
            class="btn-close"
            @click="ticketModal.hide()"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="ticketError" class="alert alert-danger">
            {{ ticketError }}
          </div>
          <div class="mb-3">
            <input
              ref="fileInput"
              type="file"
              accept="application/pdf"
              class="form-control"
              @change="onFileChange"
            />
            <div class="form-text">
              Допустимый формат: PDF, размер до 5&nbsp;МБ
            </div>
            <div v-if="fileError" class="text-danger small mt-1">
              {{ fileError }}
            </div>
            <div v-if="selectedFile" class="small mt-2">
              {{ selectedFile.name }}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="ticketModal.hide()"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-brand"
            :disabled="uploading"
            @click="createTicket"
          >
            <span
              v-if="uploading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Отправить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}
.file-tile {
  background-color: #f8f9fa;
}

.exam-scroll {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  gap: 0.75rem;
  padding-bottom: 0.25rem;
  justify-content: flex-start;
  margin: 0;
}

@media (max-width: 575.98px) {
  .medical-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .medical-page h1 {
    margin-bottom: 1rem !important;
  }

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
