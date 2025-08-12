<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import TrainingCalendar from '../components/TrainingCalendar.vue';
import { toDayKey } from '../utils/time.js';

const course = ref(null);
const error = ref('');
const loading = ref(true);
const trainings = ref([]);
const trainingsError = ref('');
const trainingsLoading = ref(false);
const actionPendingId = ref(null);
const contactModalRef = ref(null);
let contactModal;

const pastTrainings = ref([]);
const eventsView = ref('future');
const pastLoading = ref(false);
const pastError = ref('');

const olenin = {
  name: 'Оленин Константин Константинович',
  title: 'Руководитель отдела организации судейства',
  phone: '79257033737',
  email: 'kkolenin@fhmoscow.com',
};

const activeContact = ref(null);

const responsibleContact = computed(() => {
  const r = course.value?.responsible;
  if (!r) return null;
  const name = [r.last_name, r.first_name, r.patronymic]
    .filter(Boolean)
    .join(' ');
  return {
    name,
    title: 'Куратор курса',
    phone: r.phone,
    email: r.email,
  };
});

function teacherName(t) {
  if (!t.teacher) return '';
  return [t.teacher.last_name, t.teacher.first_name, t.teacher.patronymic]
    .filter(Boolean)
    .join(' ');
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

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

async function loadPastTrainings() {
  pastLoading.value = true;
  try {
    const data = await apiFetch('/course-trainings/me/past');
    pastTrainings.value = data.trainings || [];
    pastError.value = '';
  } catch (err) {
    pastError.value = err.message;
  } finally {
    pastLoading.value = false;
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
  actionPendingId.value = id;
  try {
    await apiFetch(`/course-trainings/${id}/register`, { method: 'POST' });
    await loadTrainings();
  } finally {
    actionPendingId.value = null;
  }
}

async function unregister(id) {
  const target = trainings.value.find((t) => t.id === id);
  if (target) {
    const start = new Date(target.start_at).getTime();
    if (start - Date.now() <= 48 * 60 * 60 * 1000) return;
  }
  actionPendingId.value = id;
  try {
    await apiFetch(`/course-trainings/${id}/register`, { method: 'DELETE' });
    await loadTrainings();
  } finally {
    actionPendingId.value = null;
  }
}

onMounted(async () => {
  contactModal = new Modal(contactModalRef.value);
  try {
    const data = await apiFetch('/courses/me').catch((e) => {
      if (e.message === 'Курс не назначен') return null;
      throw e;
    });
    course.value = data ? data.course : null;
    if (course.value) {
      await loadTrainings();
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

watch(eventsView, (val) => {
  if (val === 'past' && !pastTrainings.value.length) {
    loadPastTrainings();
  } else if (val === 'future' && !trainings.value.length) {
    loadTrainings();
  }
});

function groupByDay(list) {
  const map = {};
  list.forEach((t) => {
    const d = new Date(t.start_at);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const idx = key.toISOString();
    if (!map[idx]) map[idx] = { date: key, trainings: [] };
    map[idx].trainings.push(t);
  });
  return Object.values(map).sort((a, b) => a.date - b.date);
}

const groupedPast = computed(() => groupByDay(pastTrainings.value));

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

function openContactModal(contact) {
  activeContact.value = contact;
  contactModal?.show();
}

onBeforeUnmount(() => {
  try {
    contactModal?.hide?.();
    contactModal?.dispose?.();
  } catch {}
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
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <div class="card section-card tile fade-in shadow-sm h-100">
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
        <div class="col-md-6">
          <div class="card section-card tile fade-in shadow-sm h-100">
            <div class="card-body p-0">
              <h2 class="h5 mb-0 px-3 pt-3">Команда курса</h2>
              <div
                v-if="responsibleContact"
                class="d-flex align-items-center p-3 cursor-pointer"
                role="button"
                tabindex="0"
                @click="openContactModal(responsibleContact)"
              >
                <div
                  class="flex-shrink-0 me-3 rounded-circle bg-light d-flex align-items-center justify-content-center"
                  style="width: 3rem; height: 3rem"
                >
                  <i class="bi bi-person-fill text-muted fs-3"></i>
                </div>
                <div>
                  <div>{{ responsibleContact.name }}</div>
                  <div class="text-muted small">
                    {{ responsibleContact.title }}
                  </div>
                </div>
              </div>
              <template v-if="responsibleContact">
                <hr class="my-0 mx-3" />
              </template>
              <div
                class="d-flex align-items-center p-3 cursor-pointer"
                role="button"
                tabindex="0"
                @click="openContactModal(olenin)"
              >
                <div
                  class="flex-shrink-0 me-3 rounded-circle bg-light d-flex align-items-center justify-content-center"
                  style="width: 3rem; height: 3rem"
                >
                  <i class="bi bi-person-fill text-muted fs-3"></i>
                </div>
                <div>
                  <div>{{ olenin.name }}</div>
                  <div class="text-muted small">
                    {{ olenin.title }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="course" class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <h2 class="h5 mb-3">Мероприятия</h2>
          <ul class="nav nav-pills mb-3">
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: eventsView === 'future' }"
                @click="eventsView = 'future'"
              >
                Будущие
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: eventsView === 'past' }"
                @click="eventsView = 'past'"
              >
                Прошедшие
              </button>
            </li>
          </ul>
          <template v-if="eventsView === 'future'">
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
              :pending-id="actionPendingId"
              @register="register"
              @unregister="unregister"
            />
            <div v-else class="alert alert-info mb-0">
              Нет доступных мероприятий
            </div>
          </template>
          <template v-else>
            <div v-if="pastError" class="alert alert-danger mb-0">
              {{ pastError }}
            </div>
            <div v-else-if="pastLoading" class="text-center py-3">
              <div class="spinner-border text-brand" role="status">
                <span class="visually-hidden">Загрузка...</span>
              </div>
            </div>
            <div v-else>
              <div v-if="pastTrainings.length">
                <div
                  v-for="day in groupedPast"
                  :key="day.date.toISOString()"
                  class="mb-3"
                >
                  <h3 class="h6 mb-2">
                    {{
                      day.date.toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'Europe/Moscow',
                      })
                    }}
                  </h3>
                  <div
                    v-for="t in day.trainings"
                    :key="t.id"
                    class="d-flex justify-content-between align-items-start mb-2"
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
                        <span v-if="t.teacher"> · {{ teacherName(t) }}</span>
                      </div>
                    </div>
                    <div class="small d-flex align-items-center">
                      <i
                        :class="[
                          'bi',
                          attendanceStatus(t).icon,
                          attendanceStatus(t).class,
                          'me-1',
                        ]"
                        aria-hidden="true"
                      ></i>
                      <span :class="attendanceStatus(t).class">
                        {{ attendanceStatus(t).text }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="alert alert-info mb-0">Архив пуст</p>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div ref="contactModalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4 overflow-hidden">
          <div class="modal-header">
            <h5 class="modal-title">{{ activeContact?.name }}</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
            ></button>
          </div>
          <div class="modal-body p-0">
            <div class="text-center p-3">
              <div
                class="mx-auto mb-2 rounded-circle bg-light d-flex align-items-center justify-content-center"
                style="width: 4rem; height: 4rem"
              >
                <i class="bi bi-person-fill text-muted fs-2"></i>
              </div>
              <div>{{ activeContact?.name }}</div>
              <div class="text-muted small">{{ activeContact?.title }}</div>
            </div>
            <hr class="my-0" />
            <div class="list-group list-group-flush">
              <a
                v-if="activeContact?.phone"
                :href="`tel:+${activeContact.phone}`"
                class="list-group-item list-group-item-action"
              >
                <i class="bi bi-telephone me-2"></i>Позвонить
              </a>
              <a
                v-if="activeContact?.email"
                :href="`mailto:${activeContact.email}`"
                class="list-group-item list-group-item-action"
              >
                <i class="bi bi-envelope me-2"></i>Написать на email
              </a>
            </div>
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
