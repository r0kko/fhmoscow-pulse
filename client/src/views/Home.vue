<script setup>
import { auth } from '../auth.js';
import { computed, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { apiFetch } from '../api.js';
import UpcomingEventCard from '../components/UpcomingEventCard.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import MenuTile from '../components/MenuTile.vue';
import {
  ADMIN_ROLES,
  REFEREE_ROLES,
  STAFF_ROLES,
  isBrigadeRefereeOnly,
  isStaffOnly as isStaffOnlyHelper,
  hasRole,
} from '../utils/roles.js';

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
const schoolSections = computed(() => {
  if (!isStaff.value) return [];
  const sections = [
    {
      title: 'Ближайшие матчи',
      icon: 'bi-calendar-event',
      to: '/school-matches',
    },
  ];
  if (canSeePlayers.value) {
    sections.push(
      {
        title: 'Прошедшие матчи',
        icon: 'bi-clock-history',
        to: '/school-matches/past',
      },
      {
        title: 'Команды и составы',
        icon: 'bi-people',
        to: '/school-players',
      },
      {
        title: 'Стадионы',
        icon: 'bi-geo-alt',
        to: '/school-grounds',
      }
    );
  }
  return sections;
});

const mediaSections = computed(() => {
  if (!isStaff.value || !canSeePlayers.value) return [];
  return [
    {
      title: 'Фотографии игроков',
      icon: 'bi-camera',
      to: '/school-players/photos',
    },
  ];
});

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

const isAdmin = computed(() => hasRole(auth.roles, ADMIN_ROLES));
const isReferee = computed(() => hasRole(auth.roles, REFEREE_ROLES));
const isStaff = computed(() => hasRole(auth.roles, STAFF_ROLES));
const isStaffOnly = computed(() => isStaffOnlyHelper(auth.roles));
const isBrigadeOnly = computed(() => isBrigadeRefereeOnly(auth.roles));
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
  <div class="py-4 home-page">
    <div class="container">
      <div v-if="noticeMessage" class="alert alert-info" role="status">
        {{ noticeMessage }}
      </div>
      <h3 class="mb-3 text-start greeting-title">
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
            <SkeletonBlock v-for="i in 3" :key="i" />
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
      <div
        v-if="preparationSections.length > 0"
        class="card section-card mb-2 menu-section"
      >
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Подготовка к сезону</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in preparationSections"
              :key="item.title"
              :title="item.title"
              :icon="item.icon"
              :to="item.to"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div v-if="!isStaffOnly" class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Рабочие сервисы</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in workSections"
              :key="item.title"
              :title="item.title"
              :icon="item.icon"
              :to="item.to"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div v-if="isStaff" class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Управление спортивной школой</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in schoolSections"
              :key="item.title"
              :title="item.title"
              :icon="item.icon"
              :to="item.to"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div
        v-if="mediaSections.length > 0"
        class="card section-card mb-2 menu-section"
      >
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Управление медиа и контентом</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in mediaSections"
              :key="item.title"
              :title="item.title"
              :icon="item.icon"
              :to="item.to"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Документы и формальности</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in docsSections"
              :key="item.title"
              :title="item.title"
              :icon="item.icon"
              :to="item.to"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div v-if="isAdmin" class="mt-2">
        <MenuTile
          title="Администрирование"
          icon="bi bi-shield-lock"
          to="/admin"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  /* Reduced elevation and slightly stronger border for clearer structure */
  --shadow-tile:
    0 1px 2px rgba(17, 56, 103, 0.03), 0 2px 4px rgba(17, 56, 103, 0.05);
  --border-subtle: #dfe5ec;
}

.upcoming-scroll {
  gap: 0.75rem;
}

/* Greeting size on mobile: slightly larger for quick scanability */
@media (max-width: 575.98px) {
  .greeting-title {
    font-size: clamp(1.125rem, 5vw, 1.375rem);
    line-height: 1.25;
    letter-spacing: 0.1px;
  }
}

/* ruble-icon moved to brand.css for reuse */
</style>
<style scoped>
/* Mobile: make tile groups full-bleed only on Home */
@media (max-width: 575.98px) {
  .menu-section {
    margin-left: calc(var(--bs-gutter-x) * -0.5);
    margin-right: calc(var(--bs-gutter-x) * -0.5);
    border-radius: 0; /* flush to screen edges */
  }
}
</style>
