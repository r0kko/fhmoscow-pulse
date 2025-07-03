<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Carousel from 'bootstrap/js/dist/carousel';
import { apiFetch } from '../api.js';
import TrainingCard from '../components/TrainingCard.vue';

const trainings = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(true);
const error = ref('');

const types = [
  ['ICE', 'Ледовая подготовка'],
  ['BASIC_FIT', 'Физическая подготовка'],
  ['THEORY', 'Теоретическая подготовка'],
];

const carouselRefs = {
  ICE: ref(null),
  BASIC_FIT: ref(null),
  THEORY: ref(null),
};

const grouped = computed(() => {
  return trainings.value.reduce(
    (acc, t) => {
      const key = t.type?.alias;
      if (key && acc[key]) acc[key].push(t);
      return acc;
    },
    { ICE: [], BASIC_FIT: [], THEORY: [] }
  );
});

function formatDateTimeRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (
    s.toLocaleDateString() +
    ' ' +
    s.toLocaleTimeString().slice(0, 5) +
    ' - ' +
    e.toLocaleDateString() +
    ' ' +
    e.toLocaleTimeString().slice(0, 5)
  );
}

async function load() {
  loading.value = true;
  try {
    const data = await apiFetch(
      `/camp-trainings/available?page=${page.value}&limit=${pageSize}`
    );
    trainings.value = data.trainings || [];
    total.value = data.total || 0;
    error.value = '';
    await nextTick();
    initCarousels();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function register(id) {
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function unregister(id) {
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

function initCarousels() {
  for (const key of Object.keys(carouselRefs)) {
    const el = carouselRefs[key].value;
    if (el) Carousel.getOrCreateInstance(el, { interval: false });
  }
}

onMounted(load);
</script>

<template>
  <div class="container my-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Сборы</li>
      </ol>
    </nav>
    <h1 class="mb-4">Запись на сборы</h1>
    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-for="[alias, label] in types" :key="alias" class="mb-5">
        <h2 class="h5 mb-3">{{ label }}</h2>
        <div v-if="grouped[alias].length" :id="`car-${alias}`" class="carousel slide" :ref="carouselRefs[alias]">
          <div class="carousel-inner">
            <div
              v-for="(t, idx) in grouped[alias]"
              :key="t.id"
              class="carousel-item"
              :class="{ active: idx === 0 }"
            >
              <TrainingCard :training="t" @register="register" @unregister="unregister" />
            </div>
          </div>
          <button
            class="carousel-control-prev"
            type="button"
            :data-bs-target="`#car-${alias}`"
            data-bs-slide="prev"
          >
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Предыдущая</span>
          </button>
          <button
            class="carousel-control-next"
            type="button"
            :data-bs-target="`#car-${alias}`"
            data-bs-slide="next"
          >
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Следующая</span>
          </button>
        </div>
        <p v-else class="text-muted">Нет доступных тренировок</p>
      </div>
      <nav class="mt-3" v-if="Math.ceil(total / pageSize) > 1">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: page === 1 }">
            <button class="page-link" @click="page--; load()" :disabled="page === 1">Пред</button>
          </li>
          <li
            class="page-item"
            v-for="p in Math.max(1, Math.ceil(total / pageSize))"
            :key="p"
            :class="{ active: page === p }"
          >
            <button class="page-link" @click="page = p; load()">{{ p }}</button>
          </li>
          <li
            class="page-item"
            :class="{ disabled: page === Math.max(1, Math.ceil(total / pageSize)) }"
          >
            <button
              class="page-link"
              @click="page++; load()"
              :disabled="page === Math.max(1, Math.ceil(total / pageSize))"
            >
              След
            </button>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.carousel-item {
  padding: 0.5rem;
}
</style>
