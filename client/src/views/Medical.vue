<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const certificate = ref(null);
const history = ref([]);
const files = ref([]);
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


onMounted(async () => {
  try {
    const [current, hist] = await Promise.all([
      apiFetch('/medical-certificates/me').catch((e) => {
        if (e.message.includes('не найден')) return null;
        throw e;
      }),
      apiFetch('/medical-certificates/me/history'),
    ]);
    certificate.value = current ? current.certificate : null;
    history.value = hist.certificates || [];
    if (certificate.value) {
      const data = await apiFetch('/medical-certificates/me/files').catch(() => ({ files: [] }));
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
});
</script>

<template>
  <div class="py-3 medical-page">
    <div class="container">
    <nav aria-label="breadcrumb" class="mb-2">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
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
            <h5 class="card-title mb-0 text-brand">Действующее заключение</h5>
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
                >
                  <i class="bi bi-file-earmark"></i>
                  <span class="text-break">{{ f.name }}</span>
                </a>
              </div>
            </div>
            <p v-else class="text-muted mb-0">Нет файлов</p>
          </div>
          </template>
          <div v-else class="alert alert-warning mb-0" role="alert">
            Действующее медицинское заключение отсутствует
          </div>
        </div>
      </div>
      <div v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</div>
    </div>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body">
        <h5 class="card-title mb-3 text-brand">Архив медицинских заключений</h5>
        <div v-if="history.length">
          <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
            <div v-for="item in history" :key="item.id" class="col">
              <div class="card tile h-100">
                <div class="card-body d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="fw-semibold">{{ item.certificate_number }}</span>
                    <span class="text-muted small text-nowrap">{{ formatDate(item.issue_date) }} - {{ formatDate(item.valid_until) }}</span>
                  </div>
                  <p class="mb-2">{{ item.organization }}</p>
                  <div class="mt-auto">
                    <div v-if="item.files && item.files.length" class="d-flex flex-wrap gap-2">
                      <a
                        v-for="f in item.files"
                        :key="f.id"
                        :href="f.url"
                        target="_blank"
                        rel="noopener"
                        class="file-tile small d-flex align-items-center gap-1 text-decoration-none text-body p-1 border rounded"
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
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}
.file-tile {
  background-color: #f8f9fa;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@media (max-width: 575.98px) {
  .medical-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .medical-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
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
