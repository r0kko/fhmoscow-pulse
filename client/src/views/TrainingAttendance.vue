<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import Toast from 'bootstrap/js/dist/toast';

const route = useRoute();
const router = useRouter();
const training = ref(null);
const registrations = ref([]);
const visibleRegistrations = computed(() =>
  registrations.value
    .filter((r) => r.role?.alias !== 'COACH')
    .sort((a, b) => {
      const aName = formatName(a.user);
      const bName = formatName(b.user);
      return aName.localeCompare(bName, 'ru');
    })
);
const allMarked = computed(() =>
  visibleRegistrations.value.every(
    (r) => r.present === true || r.present === false
  )
);
const attendanceMarked = computed(() => training.value?.attendance_marked);
const loading = ref(false);
const error = ref('');
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

function formatName(u) {
  return `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim();
}

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
    timeZone: 'Europe/Moscow',
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
  if (!allMarked.value) {
    alert('Отметьте посещаемость для всех участников');
    return;
  }
  try {
    await apiFetch(`/camp-trainings/${route.params.id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ attendance_marked: true }),
    });
    showToast('Посещаемость отмечена');
    await loadData();
    router.push('/camps');
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
      <nav aria-label="breadcrumb">
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
          {{
            new Date(training.end_at).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Moscow'
            })
          }}
        </p>
        <div v-if="visibleRegistrations.length" class="card section-card tile fade-in shadow-sm">
          <div class="card-body table-responsive p-3">
            <table class="table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Год рождения</th>
                  <th class="text-end">Присутствие</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in visibleRegistrations" :key="r.user.id">
                  <td>{{ formatName(r.user) }}</td>
                  <td>{{ new Date(r.user.birth_date).getFullYear() }}</td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm presence-group" role="group">
                      <input
                        type="radio"
                        class="btn-check"
                        :id="`present-yes-${r.user.id}`"
                        :name="`present-${r.user.id}`"
                        autocomplete="off"
                        :checked="r.present === true"
                        @change="setPresence(r.user.id, true)"
                        :disabled="attendanceMarked"
                      />
                      <label
                        class="btn btn-outline-success presence-btn"
                        :for="`present-yes-${r.user.id}`"
                      >
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                        <span class="visually-hidden">Да</span>
                      </label>
                      <input
                        type="radio"
                        class="btn-check"
                        :id="`present-no-${r.user.id}`"
                        :name="`present-${r.user.id}`"
                        autocomplete="off"
                        :checked="r.present === false"
                        @change="setPresence(r.user.id, false)"
                        :disabled="attendanceMarked"
                      />
                      <label
                        class="btn btn-outline-danger presence-btn"
                        :for="`present-no-${r.user.id}`"
                      >
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                        <span class="visually-hidden">Нет</span>
                      </label>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else class="text-muted">Нет записей</p>
        <button
          v-if="!attendanceMarked"
          class="btn btn-brand mt-3"
          @click="finish"
          :disabled="!visibleRegistrations.length || !allMarked"
        >
          Завершить
        </button>
        <p v-else class="alert alert-success mt-3">Посещаемость отмечена</p>
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

.presence-group .presence-btn {
  width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0;
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
