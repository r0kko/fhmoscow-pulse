<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import TrainingCalendar from '../components/TrainingCalendar.vue';
import { toDayKey } from '../utils/time.js';

const course = ref(null);
const error = ref('');
const loading = ref(true);
const trainings = ref([]);
const trainingsError = ref('');
const trainingsLoading = ref(false);

async function loadTrainings() {
  trainingsLoading.value = true;
  try {
    const data = await apiFetch('/course-trainings/available');
    trainings.value = (data.trainings || []).sort(
      (a, b) => new Date(a.start_at) - new Date(b.start_at)
    );
  } catch (err) {
    trainingsError.value = err.message;
  } finally {
    trainingsLoading.value = false;
  }
}

async function register(id) {
  const target = trainings.value.find((t) => t.id === id);
  if (target) {
    const dayKey = toDayKey(target.start_at);
    const conflict = trainings.value.some(
      (t) => t.id !== id && t.registered && toDayKey(t.start_at) === dayKey
    );
    if (conflict) return;
  }
  await apiFetch(`/course-trainings/${id}/register`, { method: 'POST' });
  await loadTrainings();
}

async function unregister(id) {
  await apiFetch(`/course-trainings/${id}/register`, { method: 'DELETE' });
  await loadTrainings();
}

onMounted(async () => {
  try {
    const data = await apiFetch('/courses/me').catch((e) => {
      if (e.message === 'Курс не назначен') return null;
      throw e;
    });
    course.value = data ? data.course : null;
    if (course.value) await loadTrainings();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="py-3 qualification-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Повышение квалификации
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Повышение квалификации</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <div v-if="loading" class="text-center py-3">
            <div class="spinner-border text-brand" role="status">
              <span class="visually-hidden">Загрузка...</span>
            </div>
          </div>
          <div v-else-if="error" class="alert alert-danger mb-0">
            {{ error }}
          </div>
          <div v-else-if="course">
            <h2 class="h5 mb-3">{{ course.name }}</h2>
            <p v-if="course.description" class="mb-3">
              {{ course.description }}
            </p>
            <p v-if="course.responsible" class="mb-1">
              <strong>Ответственный:</strong>
              {{ course.responsible.last_name }}
              {{ course.responsible.first_name }}
            </p>
            <p v-if="course.telegram_url">
              <a
                :href="course.telegram_url"
                target="_blank"
                rel="noopener"
                class="link-primary"
                >Чат в Telegram</a
              >
            </p>
          </div>
          <div v-else class="alert alert-info mb-0">Курс не назначен</div>
        </div>
      </div>
      <div v-if="course" class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <h2 class="h5 mb-3">Ближайшие тренировки</h2>
          <div v-if="trainingsLoading" class="text-center py-3">
            <div class="spinner-border text-brand" role="status">
              <span class="visually-hidden">Загрузка...</span>
            </div>
          </div>
          <div v-else-if="trainingsError" class="alert alert-danger mb-0">
            {{ trainingsError }}
          </div>
          <TrainingCalendar
            v-else-if="trainings.length"
            :trainings="trainings"
            @register="register"
            @unregister="unregister"
          />
          <div v-else class="alert alert-info mb-0">
            Нет доступных тренировок
          </div>
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

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@media (max-width: 575.98px) {
  .qualification-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
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
