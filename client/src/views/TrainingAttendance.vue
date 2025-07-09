<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import Toast from 'bootstrap/js/dist/toast';

const route = useRoute();
const training = ref(null);
const registrations = ref([]);
const loading = ref(false);
const error = ref('');
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

onMounted(loadData);

async function loadData() {
  loading.value = true;
  try {
    const data = await apiFetch(`/camp-trainings/${route.params.id}/attendance`);
    training.value = data.training;
    registrations.value = data.registrations || [];
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

async function setPresence(userId, value) {
  try {
    await apiFetch(`/camp-trainings/${route.params.id}/registrations/${userId}/presence`, {
      method: 'PUT',
      body: JSON.stringify({ present: value }),
    });
    showToast('Сохранено');
    await loadData();
  } catch (e) {
    alert(e.message);
  }
}

async function finish() {
  try {
    await apiFetch(`/camp-trainings/${route.params.id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ attendance_marked: true }),
    });
    showToast('Посещаемость отмечена');
    await loadData();
  } catch (e) {
    alert(e.message);
  }
}

function showToast(message) {
  toastMessage.value = message;
  if (!toast) {
    toast = new Toast(toastRef.value);
  }
  toast.show();
}
</script>

<template>
  <div class="py-3 training-attendance-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/camps">Мои тренировки</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Посещаемость</li>
        </ol>
      </nav>
      <h1 class="mb-3">Посещаемость</h1>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="loading" class="text-center my-5">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else>
        <p v-if="training" class="mb-3">
          <strong>{{ training.type?.name }}</strong>,
          {{ formatDateTime(training.start_at) }} –
          {{ new Date(training.end_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}
        </p>
        <div v-if="registrations.length" class="card section-card tile fade-in shadow-sm">
          <div class="card-body table-responsive p-3">
            <table class="table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Роль</th>
                  <th class="text-end">Присутствие</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in registrations" :key="r.user.id">
                  <td>{{ r.user.last_name }} {{ r.user.first_name }}</td>
                  <td>{{ r.role?.name }}</td>
                  <td class="text-end">
                    <select
                      class="form-select form-select-sm w-auto d-inline"
                      :value="r.present === null ? '' : r.present"
                      @change="setPresence(r.user.id, $event.target.value === '' ? null : $event.target.value === 'true')"
                    >
                      <option value="">Не отмечено</option>
                      <option :value="true">Да</option>
                      <option :value="false">Нет</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else class="text-muted">Нет записей</p>
        <button class="btn btn-brand mt-3" @click="finish" :disabled="!registrations.length">
          Завершить
        </button>
      </div>
      <div class="toast-container position-fixed bottom-0 end-0 p-3">
        <div ref="toastRef" class="toast text-bg-secondary" role="status" data-bs-delay="1500" data-bs-autohide="true">
          <div class="toast-body">{{ toastMessage }}</div>
        </div>
      </div>
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
  .training-attendance-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>
