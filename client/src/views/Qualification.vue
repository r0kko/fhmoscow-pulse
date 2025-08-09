<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const course = ref(null);
const error = ref('');
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await apiFetch('/courses/me').catch((e) => {
      if (e.message === 'Курс не назначен') return null;
      throw e;
    });
    course.value = data ? data.course : null;
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
