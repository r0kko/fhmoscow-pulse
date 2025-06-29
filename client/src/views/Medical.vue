<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const certificate = ref(null);
const error = ref('');
const loading = ref(true);

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

onMounted(async () => {
  try {
    const data = await apiFetch('/medical-certificates/me');
    certificate.value = data.certificate;
    error.value = '';
  } catch (e) {
    error.value = e.message;
    certificate.value = null;
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
    <h1 class="mb-4">Медицинская справка</h1>
    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else-if="certificate">
      <div class="card tile fade-in">
        <div class="card-body">
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
                <input id="certDates" type="text" class="form-control" :value="formatDate(certificate.issue_date) + ' - ' + formatDate(certificate.valid_until)" readonly placeholder="Срок" />
                <label for="certDates">Срок действия</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="text-muted">{{ error || 'Справка не найдена.' }}</p>
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
