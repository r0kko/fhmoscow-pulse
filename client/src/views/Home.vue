<script setup>
import { auth } from '../auth.js';
import { computed, ref, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '../api.js';
import UpcomingEventCard from '../components/UpcomingEventCard.vue';

const basePreparationSections = [
  { title: 'Сборы', icon: 'bi-people-fill', to: '/camps', referee: true },
  {
    title: 'Нормативы',
    icon: 'bi-stopwatch',
    to: '/normatives',
    referee: true,
  },
  { title: 'Медосмотр', icon: 'bi-heart-pulse', to: '/medical', referee: true },
];

const baseWorkSections = [
  {
    title: 'Моя занятость',
    icon: 'bi-calendar-week',
    to: '/availability',
    referee: true,
  },
  { title: 'Мои назначения', icon: 'bi-calendar-check' },
  { title: 'Прошедшие матчи', icon: 'bi-clock-history' },
  { title: 'Рапорты', icon: 'bi-file-earmark-text' },
  // Надёжный текстовый fallback-значок рубля
  { title: 'Доходы', icon: 'ruble-icon' },
];

const qualificationSection = {
  title: 'Семинары',
  icon: 'bi-mortarboard',
  to: '/qualification',
};

const hasCourse = ref(false);
const canSeePlayers = ref(false);
const route = useRoute();
const noticeMessage = computed(() => String(route.query.notice || ''));

onMounted(checkCourse);
onMounted(checkSchoolLinks);

async function checkCourse() {
  try {
    const data = await apiFetch('/courses/me').catch((e) => {
      if (e.message === 'Курс не назначен') return null;
      throw e;
    });
    hasCourse.value = !!(data && data.course);
  } catch (_err) {
    hasCourse.value = false;
  }
}

async function checkSchoolLinks() {
  // Show players tile only for staff with at least one club/team
  if (!isStaff.value) {
    canSeePlayers.value = false;
    return;
  }
  try {
    const data = await apiFetch('/users/me/sport-schools');
    // Allow entry if user has clubs or teams assigned
    canSeePlayers.value = Boolean(data?.has_club || data?.has_team);
  } catch (_err) {
    // Fail closed to avoid exposing empty section
    canSeePlayers.value = false;
  }
}

const workSections = computed(() => {
  const base = hasCourse.value
    ? [qualificationSection, ...baseWorkSections]
    : baseWorkSections;
  const filtered = base.filter((s) => !s.referee || isReferee.value);
  return isStaffOnly.value ? filtered.filter((s) => Boolean(s.to)) : filtered;
});

// Раздел управления спортивной школой — формируется только для роли сотрудника СШ
const schoolSections = computed(() =>
  isStaff.value
    ? [
        {
          title: 'Ближайшие матчи',
          icon: 'bi-calendar-event',
          to: '/school-matches',
        },
        ...(canSeePlayers.value
          ? [
              {
                title: 'Команды и составы',
                icon: 'bi-people',
                to: '/school-players',
              },
            ]
          : []),
      ]
    : []
);

const docsSections = computed(() => {
  const list = [
    { title: 'Документы', icon: 'bi-folder2-open', to: '/documents' },
    { title: 'Обращения', icon: 'bi-chat-dots', to: '/tickets' },
    { title: 'Профиль', icon: 'bi-person-circle', to: '/profile' },
  ];
  return isStaffOnly.value
    ? list.filter((i) => !['Документы', 'Обращения'].includes(i.title))
    : list;
});

const adminRoles = [
  'ADMIN',
  'FIELD_REFEREE_SPECIALIST',
  'BRIGADE_REFEREE_SPECIALIST',
];
const refereeRoles = ['REFEREE', 'BRIGADE_REFEREE'];
const staffRoles = ['SPORT_SCHOOL_STAFF'];

const isAdmin = computed(() => auth.roles.some((r) => adminRoles.includes(r)));
const isReferee = computed(() =>
  auth.roles.some((r) => refereeRoles.includes(r))
);
const isStaff = computed(() => auth.roles.some((r) => staffRoles.includes(r)));
const isStaffOnly = computed(() => {
  const roles = auth.roles || [];
  const hasStaff = roles.includes('SPORT_SCHOOL_STAFF');
  if (!hasStaff) return false;
  return roles.every((r) => r === 'SPORT_SCHOOL_STAFF');
});
const isBrigadeOnly = computed(
  () =>
    auth.roles.includes('BRIGADE_REFEREE') && !auth.roles.includes('REFEREE')
);
const preparationSections = computed(() => {
  if (isBrigadeOnly.value) return [];
  return basePreparationSections.filter((s) => !s.referee || isReferee.value);
});

const shortName = computed(() => {
  if (!auth.user) return '';
  return [auth.user.first_name].filter(Boolean).join(' ');
});

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
});

const upcoming = ref([]);
const loadingUpcoming = ref(true);
const showUpcoming = computed(
  () => loadingUpcoming.value || upcoming.value.length > 0
);

onMounted(loadUpcoming);

async function loadUpcoming() {
  loadingUpcoming.value = true;
  try {
    const fetches = [];
    if (!isBrigadeOnly.value) {
      fetches.push(apiFetch('/camp-trainings/me/upcoming?limit=100'));
      fetches.push(apiFetch('/medical-exams/me/upcoming?limit=100'));
    }
    fetches.push(
      apiFetch('/course-trainings/me/upcoming?limit=100').catch(() => ({
        trainings: [],
      }))
    );
    const results = await Promise.all(fetches);
    const [
      trainingData = { trainings: [] },
      examData = { exams: [] },
      eventData = { trainings: [] },
    ] =
      results.length === 3
        ? results
        : results.length === 2
          ? [results[0], { exams: [] }, results[1]]
          : [{ trainings: [] }, { exams: [] }, { trainings: [] }];
    const trainings = (trainingData.trainings || []).map((t) => ({
      ...t,
      kind: 'training',
    }));
    const events = (eventData.trainings || []).map((e) => ({
      ...e,
      kind: 'event',
    }));
    const exams = (examData.exams || [])
      .filter(
        (e) =>
          e.registration_status === 'APPROVED' ||
          e.registration_status === 'COMPLETED'
      )
      .map((e) => ({
        ...e,
        kind: 'exam',
      }));
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    upcoming.value = [...trainings, ...events, ...exams]
      .filter((e) => {
        const start = new Date(e.start_at);
        return start >= now && start < end;
      })
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  } catch (_err) {
    upcoming.value = [];
  } finally {
    loadingUpcoming.value = false;
  }
}
</script>

<template>
  <div class="py-4">
    <div class="container">
      <div v-if="noticeMessage" class="alert alert-info" role="status">
        {{ noticeMessage }}
      </div>
      <h3 class="mb-3 text-start">
        {{ greeting }}, {{ shortName || auth.user?.phone }}!
      </h3>
      <div v-if="showUpcoming" class="card section-card mb-2 text-start">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i
              class="bi bi-calendar-event text-brand me-2"
              aria-hidden="true"
            ></i>
            Ближайшие события
          </h2>
          <div
            v-if="loadingUpcoming"
            v-edge-fade
            class="upcoming-scroll scroll-container"
            aria-label="Загрузка ближайших событий"
          >
            <div
              v-for="i in 3"
              :key="i"
              class="skeleton-card"
              aria-hidden="true"
            ></div>
          </div>
          <div
            v-else
            v-edge-fade
            class="upcoming-scroll scroll-container"
            aria-label="Список ближайших событий"
          >
            <UpcomingEventCard
              v-for="item in upcoming"
              :key="item.kind + '-' + item.id"
              :event="item"
            />
          </div>
        </div>
      </div>
      <div v-if="preparationSections.length > 0" class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Подготовка к сезону</h2>
          <div v-edge-fade class="scroll-container">
            <component
              :is="item.to ? RouterLink : 'div'"
              v-for="item in preparationSections"
              :key="item.title"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
              :aria-label="item.to ? item.title : null"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </component>
          </div>
        </div>
      </div>

      <div v-if="!isStaffOnly" class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Рабочие сервисы</h2>
          <div v-edge-fade class="scroll-container">
            <component
              :is="item.to ? RouterLink : 'div'"
              v-for="item in workSections"
              :key="item.title"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
              :aria-label="item.to ? item.title : null"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </component>
          </div>
        </div>
      </div>

      <div v-if="isStaff" class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Управление спортивной школой</h2>
          <div v-edge-fade class="scroll-container">
            <component
              :is="item.to ? RouterLink : 'div'"
              v-for="item in schoolSections"
              :key="item.title"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
              :aria-label="item.to ? item.title : null"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </component>
          </div>
        </div>
      </div>

      <div class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Документы и формальности</h2>
          <div v-edge-fade class="scroll-container">
            <component
              :is="item.to ? RouterLink : 'div'"
              v-for="item in docsSections"
              :key="item.title"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
              :aria-label="item.to ? item.title : null"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </component>
          </div>
        </div>
      </div>

      <div v-if="isAdmin" class="mt-2">
        <RouterLink
          to="/admin"
          class="menu-card card text-decoration-none text-body tile fade-in d-inline-block"
          aria-label="Администрирование"
        >
          <div class="card-body">
            <span class="card-title small">Администрирование</span>
            <i class="bi bi-shield-lock icon fs-3" aria-hidden="true"></i>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.placeholder-card {
  background-color: #f8f9fa;
  opacity: 0.6;
  cursor: default;
}
.placeholder-card:hover {
  transform: none;
  box-shadow: none;
}
.upcoming-scroll {
  gap: 0.75rem;
}

/* Skeleton placeholders for upcoming cards */
.skeleton-card {
  width: clamp(14rem, 70vw, 18rem);
  height: 5.5rem;
  border-radius: 0.75rem;
  background: linear-gradient(90deg, #f1f3f5 25%, #eceff3 37%, #f1f3f5 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.2s ease-in-out infinite;
  flex: 0 0 auto;
  scroll-snap-align: start;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-card {
    animation: none;
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

/* Текстовый fallback-значок рубля для стабильного отображения */
.ruble-icon::before {
  content: '₽';
  display: inline-block;
  font-style: normal;
  font-weight: 600;
  line-height: 1;
  vertical-align: -0.125em;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    'Noto Sans',
    'Helvetica Neue',
    Arial,
    'Apple Color Emoji',
    'Segoe UI Emoji',
    'Noto Color Emoji';
}
</style>
