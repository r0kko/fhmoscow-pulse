<script setup>
import {ref, onMounted, computed} from 'vue';
import {RouterLink} from 'vue-router';
import {apiFetch} from '../api.js';
import TrainingCard from '../components/TrainingCard.vue';
import metroIcon from '../assets/metro.svg';
import yandexLogo from '../assets/yandex-maps.svg';
import Toast from 'bootstrap/js/dist/toast';
import { withHttp } from '../utils/url.js';

const selectedDates = ref({});

const trainings = ref([]);
const mine = ref([]);
const page = ref(1);
const pageSize = 50;
const loading = ref(true);
const error = ref('');
const activeTab = ref('mine');
const registering = ref(null);
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

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
    await apiFetch(`/camp-trainings/${id}/register`, {method: 'POST'});
    await loadAll();
    showToast('Регистрация успешна. Тренировка доступна в разделе «Мои тренировки»');
  } catch (e) {
    error.value = e.message;
  } finally {
    registering.value = null;
  }
}

async function unregister(id) {
  try {
    await apiFetch(`/camp-trainings/${id}/register`, {method: 'DELETE'});
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
    if (!map[s.id]) map[s.id] = {stadium: s, trainings: []};
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

const groupedAllByDay = computed(() =>
    groupedAll.value.map((g) => ({
      stadium: g.stadium,
      days: groupByDay(g.trainings),
    }))
);

function groupByDay(list) {
  const map = {};
  list.forEach((t) => {
    const d = new Date(t.start_at);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const idx = key.toISOString();
    if (!map[idx]) map[idx] = {date: key, trainings: []};
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
    const finish = new Date(t.end_at);
    // show only trainings that have not finished yet
    // and start within the next week
    return finish > now && start < end;
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


function formatShortDate(date) {
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const formatted = text.charAt(0).toUpperCase() + text.slice(1);
  return formatted.replace(/\.$/, '');
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showToast(message) {
  toastMessage.value = message;
  if (!toast) {
    toast = new Toast(toastRef.value);
  }
  toast.show();
}

function selectDate(id, iso) {
  const current = selectedDates.value[id];
  const next = current === iso ? undefined : iso;
  const copy = {...selectedDates.value};
  if (next) copy[id] = next;
  else delete copy[id];
  selectedDates.value = copy;
}

function dayTrainings(id) {
  const group = groupedAllByDay.value.find((g) => g.stadium.id === id);
  if (!group || !group.days.length) return [];
  const iso = selectedDates.value[id];
  if (!iso) return [];
  const day = group.days.find((d) => d.date.toISOString() === iso);
  return day ? day.trainings : [];
}

function dayOpen(day) {
  return day.trainings.some((t) => t.registration_open);
}

</script>

<template>
  <div class="py-3 camps-page">
    <div class="container">
    <nav aria-label="breadcrumb" class="mb-2">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/">Главная</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Сборы</li>
      </ol>
    </nav>
    <h1 class="mb-3">Сборы</h1>
    <div class="card section-card tile fade-in shadow-sm mb-3 stadium-card">
      <div class="card-body p-2">
        <ul class="nav nav-pills nav-fill mb-0 tab-selector">
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
        <div v-else class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <div v-for="g in groupedMine" :key="g.date" class="mb-3 schedule-day">
              <h2 class="h6 mb-3">{{ formatDay(g.date) }}</h2>
              <ul class="list-unstyled mb-0">
                <li
                    v-for="t in g.trainings"
                    :key="t.id"
                    class="schedule-item d-flex justify-content-between align-items-start"
                >
                  <div>
                    <div>
                      <strong>{{ formatTime(t.start_at) }}–{{ formatTime(t.end_at) }}</strong>
                      <span class="ms-2">{{ t.stadium?.name }}</span>
                    </div>
                    <div class="text-muted small">{{ t.type?.name }}</div>
                  </div>
                  <button class="btn btn-sm btn-secondary" @click="unregister(t.id)">
                    Отменить
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'register'">
        <p v-if="!groupedAllByDay.length" class="text-muted">Нет доступных тренировок</p>
        <div v-else class="stadium-list">
          <div
              v-for="g in groupedAllByDay"
              :key="g.stadium.id"
              class="stadium-card card section-card tile fade-in shadow-sm"
          >
            <div class="card-body stadium-body">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <h2 class="h6 mb-1">{{ g.stadium.name }}</h2>
                <a
                    v-if="g.stadium.yandex_url"
                    :href="withHttp(g.stadium.yandex_url)"
                    target="_blank"
                    rel="noopener"
                    aria-label="Открыть в Яндекс.Картах"
                    class="ms-2"
                >
                  <img :src="yandexLogo" alt="Яндекс.Карты" height="20"/>
                </a>
              </div>
              <p class="text-muted mb-1 small d-flex align-items-center">
                <span>{{ g.stadium.address?.result }}</span>
              </p>
              <p v-if="metroNames(g.stadium.address)" class="text-muted mb-3 small d-flex align-items-center">
                <img :src="metroIcon" alt="Метро" height="14" class="me-1"/>
                <span>{{ metroNames(g.stadium.address) }}</span>
              </p>
              <div class="date-scroll mb-3">
                <button
                    v-for="d in g.days"
                    :key="d.date"
                    class="btn btn-sm"
                    :class="[
                      selectedDates[g.stadium.id] === d.date.toISOString()
                        ? dayOpen(d)
                          ? 'btn-brand text-white'
                          : 'btn-secondary text-white'
                        : dayOpen(d)
                        ? 'btn-outline-brand'
                        : 'btn-outline-secondary',
                    ]"
                    @click="selectDate(g.stadium.id, d.date.toISOString())"
                >
                  <span class="d-block">{{ formatShortDate(d.date) }}</span>
                </button>
              </div>
              <div v-if="selectedDates[g.stadium.id]" class="training-scroll d-flex flex-nowrap gap-3">
                <TrainingCard
                    v-for="t in dayTrainings(g.stadium.id)"
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
      <div class="toast-container position-fixed bottom-0 end-0 p-3">
        <div
            ref="toastRef"
            class="toast text-bg-secondary"
            role="status"
            data-bs-delay="1500"
            data-bs-autohide="true"
        >
          <div class="toast-body">{{ toastMessage }}</div>
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

.training-scroll {
  margin: 0;
}

.stadium-body {
  min-width: 0;
}

.date-scroll {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
}

.date-scroll .btn {
  flex-shrink: 0;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.stadium-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stadium-card {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 0;
}

.schedule-day {
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.schedule-day:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.schedule-item + .schedule-item {
  margin-top: 0.5rem;
}

.tab-selector {
  gap: 0.5rem;
}

.tab-selector .nav-link {
  border-radius: 0.5rem;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

/* tighter layout on small screens */
@media (max-width: 575.98px) {
  .camps-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .camps-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .camps-page h1 {
    margin-bottom: 1rem !important;
  }

  .stadium-card {
    margin-left: -1rem;
    margin-right: -1rem;
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
