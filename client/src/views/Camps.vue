<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import TrainingCard from '../components/TrainingCard.vue';
import metroIcon from '../assets/metro.svg';
import yandexLogo from '../assets/yandex-maps.svg';
import Toast from 'bootstrap/js/dist/toast';
import Tooltip from 'bootstrap/js/dist/tooltip';
import { withHttp } from '../utils/url.js';

const selectedDates = ref({});

const trainings = ref([]);
const mineUpcoming = ref([]);
const minePast = ref([]);
const mineView = ref('upcoming');
const page = ref(1);
const pageSize = 50;
const loading = ref(true);
const error = ref('');
const activeTab = ref('mine');
const registering = ref(null);
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

function shortName(u) {
  const initials = [u.first_name, u.patronymic]
    .filter(Boolean)
    .map((n) => n.charAt(0) + '.')
    .join(' ');
  return `${u.last_name} ${initials}`.trim();
}

onMounted(loadAll);

watch(mineView, (val) => {
  if (val === 'past' && !minePast.value.length) {
    loadMinePast();
  } else if (val === 'upcoming' && !mineUpcoming.value.length) {
    loadMineUpcoming();
  }
});

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([loadAvailable(), loadMineUpcoming()]);
    error.value = '';
    await nextTick();
    applyTooltips();
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

async function loadMineUpcoming() {
  try {
    const data = await apiFetch(
      `/camp-trainings/me/upcoming?page=${page.value}&limit=${pageSize}`
    );
    mineUpcoming.value = data.trainings || [];
    await nextTick();
    applyTooltips();
  } catch (e) {
    // ignore, handled by caller
  }
}

async function loadMinePast() {
  try {
    loading.value = true;
    const data = await apiFetch(
      `/camp-trainings/me/past?page=${page.value}&limit=${pageSize}`
    );
    minePast.value = data.trainings || [];
    await nextTick();
    applyTooltips();
  } catch (e) {
    // ignore, handled by caller
  } finally {
    loading.value = false;
  }
}

async function register(id) {
  if (registering.value) return;
  registering.value = id;
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'POST' });
    await loadAll();
    showToast(
      'Регистрация успешна. Тренировка доступна в разделе «Мои тренировки»'
    );
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

function confirmUnregister(id) {
  if (!confirm('Отменить запись на тренировку?')) return;
  unregister(id);
}

function canCancel(t) {
  if (t.my_role?.alias !== 'PARTICIPANT') return false;
  return new Date(t.start_at).getTime() - Date.now() > 48 * 60 * 60 * 1000;
}

function cancelTooltip(t) {
  if (t.my_role?.alias !== 'PARTICIPANT') {
    return 'Отменять запись могут только участники';
  }
  return 'Отменить можно не позднее чем за 48 часов';
}

const myTrainings = computed(() =>
  mineView.value === 'past' ? minePast.value : mineUpcoming.value
);

function groupDetailed(list) {
  const map = {};
  list.forEach((t) => {
    if (t.type?.online && t.url) {
      map[t.id] = {
        ground: { id: t.id, name: 'Онлайн', url: t.url, online: true },
        trainings: [t],
      };
      return;
    }
    const s = t.ground;
    if (!s) return;
    if (!map[s.id]) map[s.id] = { ground: s, trainings: [] };
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
    ground: g.ground,
    days: groupByDay(g.trainings),
  }))
);

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

const upcomingWeekTrainings = computed(() => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return mineUpcoming.value.filter((t) => {
    const start = new Date(t.start_at);
    const finish = new Date(t.end_at);
    // show trainings that have not finished yet
    // and start within the next week
    return finish > now && start < end;
  });
});

const pastTrainings = computed(() => minePast.value);

const pastSeasons = computed(() => {
  const map = {};
  minePast.value.forEach((t) => {
    const s = t.season;
    if (s && !map[s.id]) map[s.id] = s;
  });
  return Object.values(map);
});

const pastSeason = computed(() =>
  pastSeasons.value.length === 1 ? pastSeasons.value[0] : null
);

function groupBySeason(list) {
  const map = {};
  list.forEach((t) => {
    const s = t.season;
    if (!s) return;
    if (!map[s.id]) map[s.id] = { season: s, trainings: [] };
    map[s.id].trainings.push(t);
  });
  return Object.values(map).map((g) => ({
    season: g.season,
    days: groupByDay(g.trainings),
  }));
}

const groupedPastBySeason = computed(() => {
  if (pastSeasons.value.length <= 1) return [];
  return groupBySeason(minePast.value);
});

const groupedMine = computed(() =>
  groupByDay(
    mineView.value === 'past'
      ? pastTrainings.value
      : upcomingWeekTrainings.value
  )
);

function formatDay(date) {
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatShortDate(date) {
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Moscow',
  });
  const formatted = text.charAt(0).toUpperCase() + text.slice(1);
  return formatted.replace(/\.$/, '');
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

function showToast(message) {
  toastMessage.value = message;
  if (!toast) {
    toast = new Toast(toastRef.value);
  }
  toast.show();
}

function applyTooltips() {
  nextTick(() => {
    document
      .querySelectorAll('[data-bs-toggle="tooltip"]')
      .forEach((el) => new Tooltip(el));
  });
}

function selectDate(id, iso) {
  const current = selectedDates.value[id];
  const next = current === iso ? undefined : iso;
  const copy = { ...selectedDates.value };
  if (next) copy[id] = next;
  else delete copy[id];
  selectedDates.value = copy;
}

function dayTrainings(id) {
  const group = groupedAllByDay.value.find((g) => g.ground.id === id);
  if (!group || !group.days.length) return [];
  const iso = selectedDates.value[id];
  if (!iso) return [];
  const day = group.days.find((d) => d.date.toISOString() === iso);
  return day ? day.trainings : [];
}

function attendanceAlertType(t) {
  if (t.my_role?.alias !== 'COACH') return null;
  if (t.attendance_marked) return null;
  const now = new Date();
  const start = new Date(t.start_at);
  const end = new Date(t.end_at);
  const diffMinutes = (start.getTime() - now.getTime()) / 60000;
  if (now < end && diffMinutes <= 45) {
    return 'primary';
  }
  if (now >= end) {
    return 'warning';
  }
  return null;
}

function dayOpen(day) {
  return day.trainings.some((t) => t.registration_open);
}

function attendanceStatus(t) {
  if (!t.attendance_marked) {
    return { icon: 'bi-clock', text: 'Уточняется', class: 'text-muted' };
  }
  if (t.my_presence) {
    return {
      icon: 'bi-check-circle-fill',
      text: 'Посещено',
      class: 'text-success',
    };
  }
  return {
    icon: 'bi-x-circle-fill',
    text: 'Не посещено',
    class: 'text-danger',
  };
}
</script>

<template>
  <div class="py-3 camps-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Сборы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Сборы</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3 ground-card">
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
          <ul class="nav nav-pills nav-fill mb-3 tab-selector">
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: mineView === 'upcoming' }"
                @click="mineView = 'upcoming'"
              >
                Будущие
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: mineView === 'past' }"
                @click="mineView = 'past'"
              >
                Прошедшие
              </button>
            </li>
          </ul>
          <p
            v-if="mineView === 'past' && pastSeason && pastSeasons.length === 1"
            class="text-muted small mb-3"
          >
            Сезон: {{ pastSeason.name }}
            <span v-if="pastSeason.active" class="badge bg-brand ms-1"
              >Текущий</span
            >
          </p>
          <div v-if="!groupedMine.length" class="alert alert-warning">
            У вас нет тренировок. Перейдите во вкладку
            <button class="btn btn-link p-0" @click="activeTab = 'register'">
              Запись на тренировки
            </button>
            , чтобы записаться
          </div>
          <div v-else class="card section-card tile fade-in shadow-sm">
            <div class="card-body">
              <template v-if="mineView === 'past' && pastSeasons.length > 1">
                <div
                  v-for="sg in groupedPastBySeason"
                  :key="sg.season.id"
                  class="mb-4"
                >
                  <p class="text-muted small mb-3">
                    Сезон: {{ sg.season.name }}
                    <span v-if="sg.season.active" class="badge bg-brand ms-1"
                      >Текущий</span
                    >
                  </p>
                  <div
                    v-for="g in sg.days"
                    :key="g.date"
                    class="mb-3 schedule-day"
                  >
                    <h2 class="h6 mb-3">{{ formatDay(g.date) }}</h2>
                    <ul class="list-unstyled mb-0">
                      <li
                        v-for="t in g.trainings"
                        :key="t.id"
                        class="schedule-item"
                      >
                        <div
                          class="d-flex justify-content-between align-items-start"
                        >
                          <div class="me-3 flex-grow-1">
                            <div>
                              <strong
                                >{{ formatTime(t.start_at) }}–{{
                                  formatTime(t.end_at)
                                }}</strong
                              >
                              <span class="ms-2">{{ t.ground?.name }}</span>
                            </div>
                            <div class="text-muted small">
                              {{ t.type?.name }}
                            </div>
                          </div>
                          <div class="d-flex align-items-center">
                            <RouterLink
                              v-if="
                                t.my_role?.alias === 'COACH' &&
                                !t.attendance_marked
                              "
                              :to="`/trainings/${t.id}/attendance`"
                              class="btn btn-link p-0"
                              :class="
                                t.attendance_marked
                                  ? 'text-success'
                                  : 'text-secondary'
                              "
                              :title="
                                t.attendance_marked
                                  ? 'Посещаемость отмечена'
                                  : 'Отметить посещаемость'
                              "
                            >
                              <i
                                class="bi bi-check2-square"
                                aria-hidden="true"
                              ></i>
                              <span class="visually-hidden">Посещаемость</span>
                            </RouterLink>
                          </div>
                        </div>
                        <div
                          v-if="
                            mineView === 'past' && t.my_role?.alias !== 'COACH'
                          "
                          class="small d-flex align-items-center mb-1"
                        >
                          <i
                            :class="[
                              'bi',
                              attendanceStatus(t).icon,
                              attendanceStatus(t).class,
                              'me-1',
                            ]"
                            aria-hidden="true"
                          ></i>
                          <span :class="attendanceStatus(t).class">{{
                            attendanceStatus(t).text
                          }}</span>
                        </div>
                        <div
                          v-if="attendanceAlertType(t)"
                          :class="[
                            'alert',
                            `alert-${attendanceAlertType(t)}`,
                            'py-1',
                            'px-2',
                            'small',
                            'my-2',
                            'd-flex',
                            'align-items-center',
                          ]"
                        >
                          <i
                            class="bi bi-exclamation-triangle-fill me-2"
                            aria-hidden="true"
                          ></i>
                          <span>Отметьте посещаемость</span>
                        </div>
                        <p class="text-muted small mb-1 d-flex mt-1">
                          <i
                            class="bi bi-pin-angle me-1"
                            aria-hidden="true"
                          ></i>
                          <span>
                            Роль: {{ t.my_role?.name || '—' }}<br />
                            Тренеры:
                            <span v-if="t.coaches && t.coaches.length">
                              {{ t.coaches.map(shortName).join(', ') }}
                            </span>
                            <span v-else>не назначены</span><br />
                            Инвентарь:
                            <span
                              v-if="
                                t.equipment_managers &&
                                t.equipment_managers.length
                              "
                            >
                              {{
                                t.equipment_managers.map(shortName).join(', ')
                              }}
                            </span>
                            <span v-else>не назначен</span><br />
                            Адрес: {{ t.ground?.address?.result || '—' }}
                          </span>
                        </p>
                      </li>
                    </ul>
                  </div>
                </div>
              </template>
              <template v-else>
                <div
                  v-for="g in groupedMine"
                  :key="g.date"
                  class="mb-3 schedule-day"
                >
                  <h2 class="h6 mb-3">{{ formatDay(g.date) }}</h2>
                  <ul class="list-unstyled mb-0">
                    <li
                      v-for="t in g.trainings"
                      :key="t.id"
                      class="schedule-item"
                    >
                      <div
                        class="d-flex justify-content-between align-items-start"
                      >
                        <div class="me-3 flex-grow-1">
                          <div>
                            <strong
                              >{{ formatTime(t.start_at) }}–{{
                                formatTime(t.end_at)
                              }}</strong
                            >
                            <span class="ms-2">{{ t.ground?.name }}</span>
                          </div>
                          <div class="text-muted small">{{ t.type?.name }}</div>
                        </div>
                        <div class="d-flex align-items-center">
                          <RouterLink
                            v-if="
                              t.my_role?.alias === 'COACH' &&
                              !t.attendance_marked
                            "
                            :to="`/trainings/${t.id}/attendance`"
                            class="btn btn-link p-0"
                            :class="
                              t.attendance_marked
                                ? 'text-success'
                                : 'text-secondary'
                            "
                            :title="
                              t.attendance_marked
                                ? 'Посещаемость отмечена'
                                : 'Отметить посещаемость'
                            "
                          >
                            <i
                              class="bi bi-check2-square"
                              aria-hidden="true"
                            ></i>
                            <span class="visually-hidden">Посещаемость</span>
                          </RouterLink>
                          <button
                            v-if="mineView === 'upcoming'"
                            class="btn btn-link p-0 ms-2"
                            :class="
                              canCancel(t) ? 'text-danger' : 'text-secondary'
                            "
                            :data-bs-toggle="canCancel(t) ? null : 'tooltip'"
                            :title="cancelTooltip(t)"
                            @click="
                              canCancel(t) ? confirmUnregister(t.id) : null
                            "
                          >
                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                            <span class="visually-hidden">Отменить</span>
                          </button>
                        </div>
                        <div
                          v-if="
                            mineView === 'past' && t.my_role?.alias !== 'COACH'
                          "
                          class="small d-flex align-items-center mb-1"
                        >
                          <i
                            :class="[
                              'bi',
                              attendanceStatus(t).icon,
                              attendanceStatus(t).class,
                              'me-1',
                            ]"
                            aria-hidden="true"
                          ></i>
                          <span :class="attendanceStatus(t).class">{{
                            attendanceStatus(t).text
                          }}</span>
                        </div>
                      </div>
                      <div
                        v-if="attendanceAlertType(t)"
                        :class="[
                          'alert',
                          `alert-${attendanceAlertType(t)}`,
                          'py-1',
                          'px-2',
                          'small',
                          'my-2',
                          'd-flex',
                          'align-items-center',
                        ]"
                      >
                        <i
                          class="bi bi-exclamation-triangle-fill me-2"
                          aria-hidden="true"
                        ></i>
                        <span>Отметьте посещаемость</span>
                      </div>
                      <p class="text-muted small mb-1 d-flex mt-1">
                        <i class="bi bi-pin-angle me-1" aria-hidden="true"></i>
                        <span>
                          Роль: {{ t.my_role?.name || '—' }}<br />
                          Тренеры:
                          <span v-if="t.coaches && t.coaches.length">
                            {{ t.coaches.map(shortName).join(', ') }}
                          </span>
                          <span v-else>не назначены</span><br />
                          Инвентарь:
                          <span
                            v-if="
                              t.equipment_managers &&
                              t.equipment_managers.length
                            "
                          >
                            {{ t.equipment_managers.map(shortName).join(', ') }}
                          </span>
                          <span v-else>не назначен</span><br />
                          Адрес: {{ t.ground?.address?.result || '—' }}
                        </span>
                      </p>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'register'">
          <p v-if="!groupedAllByDay.length" class="text-muted">
            Нет доступных тренировок
          </p>
          <div v-else class="ground-list">
            <div
              v-for="g in groupedAllByDay"
              :key="g.ground.id"
              class="ground-card card section-card tile fade-in shadow-sm"
            >
              <div class="card-body ground-body">
                <h2 class="h6 mb-1">{{ g.ground.name }}</h2>
                <div v-if="g.ground.online && g.ground.url" class="mb-3">
                  <a
                    :href="withHttp(g.ground.url)"
                    target="_blank"
                    rel="noopener"
                    >Подключиться по ссылке</a
                  >
                </div>
                <template v-else>
                  <p class="text-muted mb-1 small d-flex align-items-center">
                    <a
                      v-if="g.ground.yandex_url"
                      :href="withHttp(g.ground.yandex_url)"
                      target="_blank"
                      rel="noopener"
                      aria-label="Открыть в Яндекс.Картах"
                      class="me-1 flex-shrink-0"
                    >
                      <img :src="yandexLogo" alt="Яндекс.Карты" height="20" />
                    </a>
                    <span class="flex-grow-1">{{
                      g.ground.address?.result
                    }}</span>
                  </p>
                  <p
                    v-if="metroNames(g.ground.address)"
                    class="text-muted mb-3 small d-flex align-items-center"
                  >
                    <img
                      :src="metroIcon"
                      alt="Метро"
                      height="14"
                      class="me-1"
                    />
                    <span>{{ metroNames(g.ground.address) }}</span>
                  </p>
                </template>
                <div class="date-scroll mb-3">
                  <button
                    v-for="d in g.days"
                    :key="d.date"
                    class="btn btn-sm"
                    :class="[
                      selectedDates[g.ground.id] === d.date.toISOString()
                        ? dayOpen(d)
                          ? 'btn-brand text-white'
                          : 'btn-secondary text-white'
                        : dayOpen(d)
                          ? 'btn-outline-brand'
                          : 'btn-outline-secondary',
                    ]"
                    @click="selectDate(g.ground.id, d.date.toISOString())"
                  >
                    <span class="d-block">{{ formatShortDate(d.date) }}</span>
                  </button>
                </div>
                <div
                  v-if="selectedDates[g.ground.id]"
                  class="training-scroll d-flex flex-nowrap gap-3"
                >
                  <TrainingCard
                    v-for="t in dayTrainings(g.ground.id)"
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

.ground-body {
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

.ground-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ground-card {
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

.schedule-item {
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

  .camps-page h1 {
    margin-bottom: 1rem !important;
  }

  .ground-card {
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
