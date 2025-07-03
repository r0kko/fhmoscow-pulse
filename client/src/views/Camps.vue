<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import TrainingCard from '../components/TrainingCard.vue';

const trainings = ref([]);
const page = ref(1);
const pageSize = 50;
const loading = ref(true);
const error = ref('');
const activeTab = ref('register');

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const data = await apiFetch(
      `/camp-trainings/available?page=${page.value}&limit=${pageSize}`
    );
    trainings.value = data.trainings || [];
    error.value = '';
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

const myTrainings = computed(() => trainings.value.filter((t) => t.registered));

function groupByStadium(list) {
  return list.reduce((acc, t) => {
    const key = t.stadium?.name;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
}

const groupedAll = computed(() => groupByStadium(trainings.value));
const groupedMine = computed(() => groupByStadium(myTrainings.value));
</script>

<template>
  <div class="container my-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Сборы</li>
      </ol>
    </nav>
    <h1 class="mb-4">Сборы</h1>
    <div class="card mb-4">
      <div class="card-body p-2">
        <ul class="nav nav-pills nav-fill justify-content-between mb-0">
          <li class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'mine' }"
              @click="activeTab = 'mine'"
            >
              Мои сборы
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'register' }"
              @click="activeTab = 'register'"
            >
              Запись на тренировки
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-show="activeTab === 'mine'">
        <p v-if="!myTrainings.length" class="text-muted">У вас нет записей</p>
        <div v-for="(items, stadium) in groupedMine" :key="stadium" class="mb-5">
          <h2 class="h5 mb-3">{{ stadium }}</h2>
          <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-5 g-2">
            <TrainingCard
              v-for="t in items"
              :key="t.id"
              :training="t"
              @unregister="unregister"
            />
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'register'">
        <div v-for="(items, stadium) in groupedAll" :key="stadium" class="mb-5">
          <h2 class="h5 mb-3">{{ stadium }}</h2>
          <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-5 g-2">
            <TrainingCard
              v-for="t in items"
              :key="t.id"
              :training="t"
              @register="register"
              @unregister="unregister"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
