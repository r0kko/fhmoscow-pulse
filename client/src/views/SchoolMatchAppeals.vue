<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api';

const route = useRoute();
const match = ref(null);
const error = ref('');

onMounted(async () => {
  try {
    const { match: m } = await apiFetch(`/matches/${route.params.id}`);
    match.value = m || null;
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
  }
});
</script>

<template>
  <div class="py-3 school-match-appeals-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Матчи', to: '/school-matches' },
          { label: 'Матч', to: `/school-matches/${route.params.id}` },
          { label: 'Обращения' },
        ]"
      />
      <h1 class="mb-3">Обращения по матчу</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div
          class="card-body d-flex align-items-center justify-content-center text-muted"
          style="min-height: 160px"
        >
          Скоро
        </div>
      </div>
    </div>
  </div>
</template>
