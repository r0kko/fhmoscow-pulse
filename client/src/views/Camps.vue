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
const registering = ref(null);

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
  if (registering.value) return;
  registering.value = id;
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    registering.value = null;
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

function groupDetailed(list) {
  const map = {};
  list.forEach((t) => {
    const s = t.stadium;
    if (!s) return;
    if (!map[s.id]) map[s.id] = { stadium: s, trainings: [] };
    map[s.id].trainings.push(t);
  });
  return Object.values(map).map((g) => {
    g.trainings.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    return g;
  });
}

function metroNames(address) {
  if (!address || !Array.isArray(address.metro) || !address.metro.length) {
    return '';
  }
  return address.metro
    .map((m) =>
      m.distance ? `${m.name} (${m.distance} км)` : m.name
    )
    .join(', ');
}

const upcoming = computed(() => {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return trainings.value
    .filter((t) => {
      const start = new Date(t.start_at);
      return start >= now && start <= cutoff;
    })
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
});

const availableTrainings = computed(() =>
  upcoming.value.filter((t) => !t.registered)
);

const groupedAll = computed(() => groupDetailed(availableTrainings.value));
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
              Мои тренировки
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
          <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xxl-5 g-3">
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
        <p v-if="!groupedAll.length" class="text-muted">Нет доступных тренировок</p>
        <div v-else class="row gy-4">
          <div
            v-for="g in groupedAll"
            :key="g.stadium.id"
            class="col-12"
          >
            <div class="card tile h-100">
              <div class="card-body">
                <h2 class="h6 mb-1">{{ g.stadium.name }}</h2>
                <p class="text-muted mb-1 small">{{ g.stadium.address?.result }}</p>
                <p class="text-muted mb-3 small">{{ metroNames(g.stadium.address) }}</p>
                <div class="training-scroll d-flex flex-nowrap gap-3">
                  <TrainingCard
                    v-for="t in g.trainings"
                    :key="t.id"
                    :training="t"
                    :loading="registering === t.id"
                    class="flex-shrink-0"
                    @register="register"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.training-scroll {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 0.75rem;
  padding-bottom: 0.25rem;
}
</style>
