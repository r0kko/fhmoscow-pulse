<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import TrainingCard from '../components/TrainingCard.vue';
import metroIcon from '../assets/metro.svg';
import yandexLogo from '../assets/yandex-maps.svg';
import { typeBadgeClass } from '../utils/training.js';

function shortName(u) {
  const initials = [u.first_name, u.patronymic]
    .filter(Boolean)
    .map((n) => n.charAt(0) + '.')
    .join(' ');
  return `${u.last_name} ${initials}`.trim();
}

const trainings = ref([]);
const mine = ref([]);
const page = ref(1);
const pageSize = 50;
const loading = ref(true);
const error = ref('');
const activeTab = ref('mine');
const registering = ref(null);

onMounted(loadAll);

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([loadAvailable(), loadMine()]);
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadAvailable() {
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

async function loadMine() {
  try {
    const data = await apiFetch(
      `/camp-trainings/me/upcoming?page=${page.value}&limit=${pageSize}`
    );
    mine.value = data.trainings || [];
  } catch (e) {
    // ignore, handled by caller
  }
}

async function register(id) {
  if (registering.value) return;
  registering.value = id;
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'POST' });
    await loadAll();
  } catch (e) {
    error.value = e.message;
  } finally {
    registering.value = null;
  }
}

async function unregister(id) {
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'DELETE' });
    await loadAll();
  } catch (e) {
    error.value = e.message;
  }
}

const myTrainings = computed(() => mine.value);

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
    .slice(0, 2)
    .map((m) => m.name)
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

function groupByDay(list) {
  const map = {};
  list.forEach((t) => {
    const d = new Date(t.start_at);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const idx = key.toISOString();
    if (!map[idx]) map[idx] = { date: key, trainings: [] };
    map[idx].trainings.push(t);
  });
  return Object.values(map)
    .sort((a, b) => a.date - b.date)
    .map((g) => {
      g.trainings.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
      return g;
    });
}

const weekTrainings = computed(() => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return myTrainings.value.filter((t) => {
    const start = new Date(t.start_at);
    return start >= now && start < end;
  });
});

const groupedMine = computed(() => groupByDay(weekTrainings.value));

function formatDay(date) {
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
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
        <p v-if="!groupedMine.length" class="text-muted">
          У вас нет тренировок. Перейдите во вкладку
          <button
            class="btn btn-link p-0"
            @click="activeTab = 'register'"
          >
            Запись на тренировки
          </button>
          , чтобы записаться
        </p>
        <div v-else class="card tile">
          <div class="card-body">
            <div v-for="g in groupedMine" :key="g.date" class="mb-3">
              <h2 class="h6 mb-2">{{ formatDay(g.date) }}</h2>
              <ul class="list-group">
                <li
                  v-for="t in g.trainings"
                  :key="t.id"
                  class="list-group-item"
                >
                  <div class="d-flex flex-column flex-sm-row justify-content-between">
                    <div>
                      <i class="bi bi-clock me-1" aria-hidden="true"></i>
                      {{ formatTime(t.start_at) }}
                      <span class="badge badge-training-type ms-2" :class="typeBadgeClass(t.type?.alias)">
                        {{ t.type?.name }}
                      </span>
                    </div>
                    <div class="text-sm-end">
                      <div class="fw-semibold">{{ t.stadium?.name }}</div>
                      <div class="small text-muted">
                        {{ t.stadium?.address?.result }}
                      </div>
                    </div>
                  </div>
                  <div class="small mt-1">
                    Тренер<span v-if="t.coaches && t.coaches.length > 1">(-ы)</span>:
                    <template v-if="t.coaches && t.coaches.length">
                      <span v-for="(c, i) in t.coaches" :key="c.id">
                        <a :href="`tel:+${c.phone}`" class="text-reset text-decoration-none">{{ shortName(c) }}</a><span v-if="i < t.coaches.length - 1">, </span>
                      </span>
                    </template>
                    <span v-else>не назначен</span>
                  </div>
                  <div class="small">
                    Инвентарь:
                    <template v-if="t.equipment_managers && t.equipment_managers.length">
                      <span v-for="(m, i) in t.equipment_managers" :key="m.id">
                        <a :href="`tel:+${m.phone}`" class="text-reset text-decoration-none">{{ shortName(m) }}</a><span v-if="i < t.equipment_managers.length - 1">, </span>
                      </span>
                    </template>
                    <span v-else>не назначен</span>
                  </div>
                </li>
              </ul>
            </div>
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
              <div class="card-body stadium-body">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <h2 class="h6 mb-1">{{ g.stadium.name }}</h2>
                  <a
                    v-if="g.stadium.yandex_url"
                    :href="g.stadium.yandex_url"
                    target="_blank"
                    rel="noopener"
                    aria-label="Открыть в Яндекс.Картах"
                    class="ms-2"
                  >
                    <img :src="yandexLogo" alt="Яндекс.Карты" height="20" />
                  </a>
                </div>
                <p class="text-muted mb-1 small d-flex align-items-center">
                  <span>{{ g.stadium.address?.result }}</span>
                </p>
                <p v-if="metroNames(g.stadium.address)" class="text-muted mb-3 small d-flex align-items-center">
                  <img :src="metroIcon" alt="Метро" height="14" class="me-1" />
                  <span>{{ metroNames(g.stadium.address) }}</span>
                </p>
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
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  gap: 0.75rem;
  padding-bottom: 0.25rem;
  justify-content: flex-start;
}

.training-scroll .training-card {
  margin: 0;
}

.stadium-body {
  min-width: 0;
}
</style>
