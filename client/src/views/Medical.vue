<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const certificate = ref(null);
const history = ref([]);
const error = ref('');
const loading = ref(true);
const isValid = (cert) => {
  const today = new Date();
  return new Date(cert.issue_date) <= today && new Date(cert.valid_until) >= today;
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

onMounted(async () => {
  try {
    const [current, hist] = await Promise.all([
      apiFetch('/medical-certificates/me').catch((e) => {
        if (e.message.includes('не найдена')) return null;
        throw e;
      }),
      apiFetch('/medical-certificates/me/history'),
    ]);
    certificate.value = current ? current.certificate : null;
    const allHistory = hist.certificates || [];
    const activeId =
      certificate.value && isValid(certificate.value) ? certificate.value.id : null;
    history.value = activeId ? allHistory.filter((c) => c.id !== activeId) : allHistory;
    error.value = '';
  } catch (e) {
    error.value = e.message;
    certificate.value = null;
    history.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="container my-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Медосмотр</li>
      </ol>
    </nav>
    <h1 class="mb-4">Данные медицинских обследований</h1>
    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else-if="certificate && isValid(certificate)">
      <div class="card tile fade-in shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-3">Действующее заключение</h5>
          <div class="row row-cols-1 row-cols-sm-2 g-3">
            <div class="col">
              <div class="form-floating">
                <input id="certInn" type="text" class="form-control" :value="certificate.inn" readonly placeholder="ИНН" />
                <label for="certInn">ИНН</label>
              </div>
            </div>
            <div class="col">
              <div class="form-floating">
                <input id="certOrg" type="text" class="form-control" :value="certificate.organization" readonly placeholder="Учреждение" />
                <label for="certOrg">Мед. учреждение</label>
              </div>
            </div>
            <div class="col">
              <div class="form-floating">
                <input id="certNumber" type="text" class="form-control" :value="certificate.certificate_number" readonly placeholder="Номер" />
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
                  placeholder="Срок"
                />
                <label for="certDates">Срок действия</label>
              </div>
            </div>
          </div>
          <div class="border-top pt-3 mt-3">
            <p class="mb-2 fw-semibold">Файлы</p>
            <div class="d-flex gap-3 text-muted">
              <i class="bi bi-file-earmark"></i>
              <i class="bi bi-file-earmark"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-else-if="!error" class="text-muted">Действующее медицинское заключение отсутствует</p>
    <p v-else class="text-muted">{{ error }}</p>
    <div class="card tile fade-in shadow-sm mt-4">
      <div class="card-body">
        <h5 class="card-title mb-3">Архив медицинских заключений</h5>
        <div v-if="history.length" class="table-responsive">
          <table class="table table-striped mb-0">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Учреждение</th>
                <th>ИНН</th>
                <th>Период действия</th>
                <th class="text-center">Файлы</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in history" :key="item.id">
                <td>{{ item.certificate_number }}</td>
                <td>{{ item.organization }}</td>
                <td>{{ item.inn }}</td>
                <td>{{ formatDate(item.issue_date) }} - {{ formatDate(item.valid_until) }}</td>
                <td class="text-center text-muted"><i class="bi bi-file-earmark"></i></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-muted mb-0">Нет медицинских заключений с истекшим сроком действия</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.tile:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}
.fade-in {
  animation: fadeIn 0.4s ease-out;
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
