<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const route = useRoute();
const exam = ref(null);
const examError = ref('');
const loadingExam = ref(false);

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 8;
const loading = ref(false);
const error = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const approvedIndices = computed(() => {
  let num = 0;
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

watch(page, loadRegistrations);

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
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
    const params = new URLSearchParams({ page: page.value, limit: pageSize });
    const data = await apiFetch(`/medical-exams/${route.params.id}/registrations?${params}`);
    list.value = data.registrations;
    total.value = data.total;
    error.value = '';
  } catch (e) {
    list.value = [];
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function setStatus(userId, status) {
  try {
    await apiFetch(`/medical-exams/${route.params.id}/registrations/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    await loadRegistrations();
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="py-3 admin-exam-registrations-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/medical-admin">Медицина</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Заявки</li>
        </ol>
      </nav>
      <h1 class="mb-3">Заявки на медосмотр</h1>
      <p v-if="exam" class="mb-3">
        <strong>{{ exam.center?.name }}</strong>,
        {{ formatDateTime(exam.start_at) }} - {{ formatDateTime(exam.end_at) }}
      </p>
      <div v-if="examError" class="alert alert-danger mb-3">{{ examError }}</div>
      <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
      <div v-if="loading || loadingExam" class="text-center my-3">
        <div class="spinner-border" role="status"></div>
      </div>
      <div v-if="list.length" class="card section-card tile fade-in shadow-sm">
        <div class="card-body p-3 table-responsive">
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
                <td>{{ approvedIndices[idx] !== null ? approvedIndices[idx] : '' }}</td>
                <td>{{ r.user.last_name }} {{ r.user.first_name }} {{ r.user.patronymic }}</td>
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
                    @click="setStatus(r.user.id, 'APPROVED')"
                  >✓</button>
                  <button
                    v-if="r.status === 'APPROVED'"
                    class="btn btn-sm btn-primary me-2"
                    @click="setStatus(r.user.id, 'COMPLETED')"
                  >
                    <i class="bi bi-check2-all"></i>
                  </button>
                  <button
                    v-if="r.status !== 'COMPLETED' && r.status !== 'CANCELED'"
                    class="btn btn-sm btn-danger"
                    @click="setStatus(r.user.id, 'CANCELED')"
                  >✕</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p v-else-if="!loading && !loadingExam" class="text-muted mb-0">Нет заявок.</p>
      <nav class="mt-3" v-if="totalPages > 1">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: page === 1 }">
            <button class="page-link" @click="page--" :disabled="page === 1">Пред</button>
          </li>
          <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: page === p }">
            <button class="page-link" @click="page = p">{{ p }}</button>
          </li>
          <li class="page-item" :class="{ disabled: page === totalPages }">
            <button class="page-link" @click="page++" :disabled="page === totalPages">След</button>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@media (max-width: 575.98px) {
  .admin-exam-registrations-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .admin-exam-registrations-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>
