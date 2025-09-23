<script setup>
import { ref, onMounted, watch, computed, reactive } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch, apiFetchBlob } from '../api';
import { loadPageSize, savePageSize } from '../utils/pageSize';
import PageNav from '../components/PageNav.vue';

const route = useRoute();
const exam = ref(null);
const examError = ref('');
const loadingExam = ref(false);

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(loadPageSize('adminExamRegsPageSize', 8));
const downloading = ref(false);
const loading = ref(false);
const error = ref('');
const search = ref('');
const approvedBefore = ref(0);
const statusLoading = reactive({});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

const approvedIndices = computed(() => {
  let num = approvedBefore.value;
  return list.value.map((r) => {
    if (r.status === 'APPROVED') {
      num += 1;
      return num;
    }
    return null;
  });
});

onMounted(() => {
  loadExam();
  loadRegistrations();
});

watch([page, pageSize], loadRegistrations);
watch(pageSize, (val) => {
  savePageSize('adminExamRegsPageSize', val);
});
watch(pageSize, (val) => {
  localStorage.setItem('adminExamRegsPageSize', String(val));
});
let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadRegistrations();
  }, 300);
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

async function loadExam() {
  loadingExam.value = true;
  try {
    const data = await apiFetch(`/medical-exams/${route.params.id}`);
    exam.value = data.exam;
    examError.value = '';
  } catch (e) {
    exam.value = null;
    examError.value = e.message;
  } finally {
    loadingExam.value = false;
  }
}

async function loadRegistrations() {
  loading.value = true;
  try {
    Object.keys(statusLoading).forEach((k) => delete statusLoading[k]);
    const params = new URLSearchParams({
      page: page.value,
      limit: pageSize.value,
      search: search.value,
    });
    const data = await apiFetch(
      `/medical-exams/${route.params.id}/registrations?${params}`
    );
    list.value = data.registrations;
    total.value = data.total;
    approvedBefore.value = data.approved_before || 0;
    error.value = '';
  } catch (e) {
    list.value = [];
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function setStatus(userId, status) {
  if (statusLoading[userId]) return;
  statusLoading[userId] = true;
  try {
    await apiFetch(
      `/medical-exams/${route.params.id}/registrations/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
    await loadRegistrations();
  } catch (e) {
    alert(e.message);
  } finally {
    statusLoading[userId] = false;
  }
}

async function exportPdf() {
  downloading.value = true;
  try {
    const blob = await apiFetchBlob(
      `/medical-exams/${route.params.id}/registrations/export`
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registrations.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <div class="py-3 admin-exam-registrations-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/admin/medical">Медицина</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Заявки</li>
        </ol>
      </nav>
      <h1 class="mb-3">Заявки на медосмотр</h1>
      <p v-if="exam" class="mb-3">
        <strong>{{ exam.center?.name }}</strong
        >, {{ formatDateTime(exam.start_at) }} -
        {{ formatDateTime(exam.end_at) }}
      </p>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-sm">
          <input
            v-model="search"
            type="text"
            class="form-control"
            placeholder="Поиск"
          />
        </div>
        <div class="col-auto">
          <select v-model.number="pageSize" class="form-select">
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="20">20</option>
          </select>
        </div>
        <div class="col-auto">
          <button
            class="btn btn-secondary"
            :disabled="downloading"
            @click="exportPdf"
          >
            <span
              v-if="downloading"
              class="spinner-border spinner-border-sm spinner-brand me-2"
            ></span>
            PDF
          </button>
        </div>
      </div>
      <div v-if="examError" class="alert alert-danger mb-3">
        {{ examError }}
      </div>
      <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
      <div v-if="loading || loadingExam" class="text-center my-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        ></div>
      </div>
      <div v-if="list.length" class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="table-responsive d-none d-sm-block">
            <table class="table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Пользователь</th>
                  <th>Дата заявки</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in list" :key="r.user.id">
                  <td>
                    {{
                      approvedIndices[idx] !== null ? approvedIndices[idx] : ''
                    }}
                  </td>
                  <td>
                    {{ r.user.last_name }} {{ r.user.first_name }}
                    {{ r.user.patronymic }}
                  </td>
                  <td>{{ formatDateTime(r.created_at) }}</td>
                  <td>{{ r.user.email }}</td>
                  <td>{{ formatPhone(r.user.phone) }}</td>
                  <td>
                    {{
                      r.status === 'PENDING'
                        ? 'На рассмотрении'
                        : r.status === 'APPROVED'
                          ? 'Подтверждена'
                          : r.status === 'COMPLETED'
                            ? 'Завершена'
                            : 'Отменена'
                    }}
                  </td>
                  <td class="text-end">
                    <button
                      v-if="r.status === 'PENDING'"
                      class="btn btn-sm btn-success me-2"
                      :disabled="statusLoading[r.user.id]"
                      aria-label="Подтвердить"
                      @click="setStatus(r.user.id, 'APPROVED')"
                    >
                      <span
                        v-if="statusLoading[r.user.id]"
                        class="spinner-border spinner-border-sm spinner-brand me-2"
                      ></span>
                      ✓
                    </button>
                    <button
                      v-if="r.status === 'APPROVED'"
                      class="btn btn-sm btn-primary me-2"
                      :disabled="statusLoading[r.user.id]"
                      aria-label="Завершить"
                      @click="setStatus(r.user.id, 'COMPLETED')"
                    >
                      <span
                        v-if="statusLoading[r.user.id]"
                        class="spinner-border spinner-border-sm spinner-brand me-2"
                      ></span>
                      <i class="bi bi-check2-all"></i>
                    </button>
                    <button
                      v-if="r.status !== 'COMPLETED' && r.status !== 'CANCELED'"
                      class="btn btn-sm btn-danger"
                      :disabled="statusLoading[r.user.id]"
                      aria-label="Отменить"
                      @click="setStatus(r.user.id, 'CANCELED')"
                    >
                      <span
                        v-if="statusLoading[r.user.id]"
                        class="spinner-border spinner-border-sm spinner-brand me-2"
                      ></span>
                      ✕
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="d-block d-sm-none">
            <div v-for="(r, idx) in list" :key="r.user.id" class="card mb-2">
              <div class="card-body p-2">
                <div
                  class="d-flex justify-content-between align-items-start mb-1"
                >
                  <div class="me-2">
                    <h3 class="h6 mb-1">
                      {{ r.user.last_name }} {{ r.user.first_name }}
                      {{ r.user.patronymic }}
                    </h3>
                    <p class="mb-1 small">
                      № {{ approvedIndices[idx] || '—' }}
                    </p>
                    <p class="mb-1 small">
                      Заявка: {{ formatDateTime(r.created_at) }}
                    </p>
                    <p class="mb-1 small">Email: {{ r.user.email || '—' }}</p>
                    <p class="mb-1 small">
                      Телефон: {{ formatPhone(r.user.phone) }}
                    </p>
                    <p class="mb-1 small">
                      Статус:
                      {{
                        r.status === 'PENDING'
                          ? 'На рассмотрении'
                          : r.status === 'APPROVED'
                            ? 'Подтверждена'
                            : r.status === 'COMPLETED'
                              ? 'Завершена'
                              : 'Отменена'
                      }}
                    </p>
                  </div>
                  <div class="text-end">
                    <button
                      v-if="r.status === 'PENDING'"
                      class="btn btn-sm btn-success mb-1 w-100"
                      :disabled="statusLoading[r.user.id]"
                      @click="setStatus(r.user.id, 'APPROVED')"
                    >
                      <span
                        v-if="statusLoading[r.user.id]"
                        class="spinner-border spinner-border-sm spinner-brand me-2"
                      ></span>
                      Подтвердить
                    </button>
                    <button
                      v-if="r.status === 'APPROVED'"
                      class="btn btn-sm btn-primary mb-1 w-100"
                      :disabled="statusLoading[r.user.id]"
                      @click="setStatus(r.user.id, 'COMPLETED')"
                    >
                      <span
                        v-if="statusLoading[r.user.id]"
                        class="spinner-border spinner-border-sm spinner-brand me-2"
                      ></span>
                      Завершить
                    </button>
                    <button
                      v-if="r.status !== 'COMPLETED' && r.status !== 'CANCELED'"
                      class="btn btn-sm btn-danger w-100"
                      :disabled="statusLoading[r.user.id]"
                      @click="setStatus(r.user.id, 'CANCELED')"
                    >
                      <span
                        v-if="statusLoading[r.user.id]"
                        class="spinner-border spinner-border-sm me-2"
                      ></span>
                      Отменить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-else-if="!loading && !loadingExam" class="text-muted mb-0">
        Нет заявок.
      </p>
      <PageNav
        v-if="totalPages > 1"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total-pages="totalPages"
        :sizes="[5, 8, 10, 20]"
      />
    </div>
  </div>
</template>

<style scoped>
/* Mobile spacing handled globally */
</style>
