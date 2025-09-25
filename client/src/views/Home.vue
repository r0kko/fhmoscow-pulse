<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import type { UpcomingListItem } from '@/types/upcoming';
import { auth, type AuthUser } from '../auth';
import { apiFetch } from '../api';
import UpcomingEventCard from '../components/UpcomingEventCard.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import MenuTile from '../components/MenuTile.vue';
import {
  ADMIN_ROLES,
  REFEREE_ROLES,
  STAFF_ROLES,
  FHMO_STAFF_ROLES,
  FHMO_MEDIA_CONTENT_ROLES,
  isBrigadeRefereeOnly,
  isStaffOnly as isStaffOnlyHelper,
  isFhmoStaffOnly as isFhmoStaffOnlyHelper,
  hasRole,
} from '../utils/roles';

type Nullable<T> = T | null | undefined;

interface CourseResponse {
  course: Nullable<{ id: number; title: string }>;
}

interface SportSchoolResponse {
  has_club?: boolean;
  has_team?: boolean;
}

interface TrainingGround {
  address?: { result?: string };
  yandex_url?: string;
}

interface UpcomingTraining {
  id: string | number;
  start_at: string;
  ground?: TrainingGround;
  type?: { online?: boolean };
  url?: string;
}

interface UpcomingExam {
  id: string | number;
  start_at: string;
  registration_status?: string;
  center?: { address?: { result?: string } };
}

interface UpcomingData {
  trainings?: UpcomingTraining[];
  exams?: UpcomingExam[];
}

interface TileSection {
  title: string;
  icon: string;
  to?: string;
  referee?: boolean;
  note?: string;
  placeholder?: boolean;
}

const basePreparationSections: TileSection[] = [
  { title: 'Сборы', icon: 'bi-people-fill', to: '/camps', referee: true },
  {
    title: 'Нормативы',
    icon: 'bi-stopwatch',
    to: '/normatives',
    referee: true,
  },
  { title: 'Медосмотр', icon: 'bi-heart-pulse', to: '/medical', referee: true },
];

const baseWorkSections: TileSection[] = [
  {
    title: 'Моя занятость',
    icon: 'bi-calendar-week',
    to: '/availability',
    referee: true,
  },
  { title: 'Мои назначения', icon: 'bi-calendar-check' },
  { title: 'Прошедшие матчи', icon: 'bi-clock-history' },
  { title: 'Рапорты', icon: 'bi-file-earmark-text' },
  { title: 'Доходы', icon: 'ruble-icon' },
];

const qualificationSection: TileSection = {
  title: 'Семинары',
  icon: 'bi-mortarboard',
  to: '/qualification',
};

const hasCourse = ref(false);
const canSeePlayers = ref(false);
const route = useRoute();
const noticeMessage = computed(() => String(route.query['notice'] ?? ''));

const isFhmoStaff = computed(() => hasRole(auth.roles, FHMO_STAFF_ROLES));
const isFhmoStaffOnly = computed(() => isFhmoStaffOnlyHelper(auth.roles));

onMounted(checkCourse);
onMounted(checkSchoolLinks);

async function checkCourse(): Promise<void> {
  if (isFhmoStaff.value) {
    hasCourse.value = false;
    return;
  }
  try {
    const data = await apiFetch<CourseResponse>('/courses/me').catch(
      (error) => {
        if (error instanceof Error && error.message === 'Курс не назначен') {
          return null;
        }
        throw error;
      }
    );
    hasCourse.value = Boolean(data?.course);
  } catch {
    hasCourse.value = false;
  }
}

async function checkSchoolLinks(): Promise<void> {
  // Show players tile only for staff with at least one club/team
  if (!isStaff.value) {
    canSeePlayers.value = false;
    return;
  }
  try {
    const data = await apiFetch<SportSchoolResponse>('/users/me/sport-schools');
    // Allow entry if user has clubs or teams assigned
    canSeePlayers.value = Boolean(data?.has_club || data?.has_team);
  } catch {
    // Fail closed to avoid exposing empty section
    canSeePlayers.value = false;
  }
}

const workSections = computed<TileSection[]>(() => {
  if (isFhmoStaffOnly.value) return [];
  const base = hasCourse.value
    ? [qualificationSection, ...baseWorkSections]
    : baseWorkSections;
  const filtered = base.filter((s) => !s.referee || isReferee.value);
  return isStaffOnly.value ? filtered.filter((s) => Boolean(s.to)) : filtered;
});

// Раздел управления спортивной школой — формируется только для роли сотрудника СШ
const schoolSections = computed<TileSection[]>(() => {
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

const mediaSections = computed<TileSection[]>(() => {
  if (!isStaff.value || !canSeePlayers.value) return [];
  return [
    {
      title: 'Фотографии игроков',
      icon: 'bi-camera',
      to: '/school-players/photos',
    },
  ];
});

const docsSections = computed<TileSection[]>(() => {
  if (isFhmoStaffOnly.value) {
    return [
      { title: 'Обращения', icon: 'bi-chat-dots', to: '/tickets' },
      { title: 'Профиль', icon: 'bi-person-circle', to: '/profile' },
    ];
  }
  const list: TileSection[] = [
    { title: 'Документы', icon: 'bi-folder2-open', to: '/documents' },
    { title: 'Обращения', icon: 'bi-chat-dots', to: '/tickets' },
    { title: 'Профиль', icon: 'bi-person-circle', to: '/profile' },
  ];
  return isStaffOnly.value
    ? list.filter((i) => !['Документы', 'Обращения'].includes(i.title))
    : list;
});

const canAccessAdmin = computed(
  () =>
    hasRole(auth.roles, ADMIN_ROLES) ||
    hasRole(auth.roles, FHMO_MEDIA_CONTENT_ROLES)
);
const isReferee = computed(() => hasRole(auth.roles, REFEREE_ROLES));
const isStaff = computed(() => hasRole(auth.roles, STAFF_ROLES));
const isStaffOnly = computed(() => isStaffOnlyHelper(auth.roles));
const isBrigadeOnly = computed(() => isBrigadeRefereeOnly(auth.roles));
const preparationSections = computed<TileSection[]>(() => {
  if (isFhmoStaffOnly.value) return [];
  if (isBrigadeOnly.value) return [];
  return basePreparationSections.filter(
    (section) => !section.referee || isReferee.value
  );
});

const shortName = computed(() => {
  const user = auth.user as AuthUser | null;
  if (!user) return '';
  return [user.first_name].filter(Boolean).join(' ');
});

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
});

const upcoming = ref<UpcomingListItem[]>([]);
const loadingUpcoming = ref(true);
const showUpcoming = computed(
  () => loadingUpcoming.value || upcoming.value.length > 0
);

onMounted(loadUpcoming);

function mapTraining(training: UpcomingTraining): UpcomingListItem {
  const address = training.ground?.address?.result || 'Локация уточняется';
  return {
    id: training.id,
    type: 'training',
    title: 'Тренировка',
    description: address,
    startAt: training.start_at,
    link: training.ground?.yandex_url ?? null,
    isOnline: false,
  };
}

function mapExam(exam: UpcomingExam): UpcomingListItem {
  const address = exam.center?.address?.result || 'Место проведения уточняется';
  return {
    id: exam.id,
    type: 'exam',
    title: 'Медосмотр',
    description: `${address} · ${exam.registration_status || 'Заявка'}`,
    startAt: exam.start_at,
    isOnline: false,
  };
}

function mapEvent(event: UpcomingTraining): UpcomingListItem {
  const isOnline = event.type?.online;
  const location = isOnline
    ? 'Онлайн мероприятие'
    : event.ground?.address?.result || 'Место встречи уточняется';
  return {
    id: event.id,
    type: 'event',
    title: 'Мероприятие',
    description: location,
    startAt: event.start_at,
    link: event.url ?? null,
    isOnline: Boolean(isOnline),
  };
}

async function loadUpcoming(): Promise<void> {
  loadingUpcoming.value = true;
  if (isFhmoStaff.value) {
    upcoming.value = [];
    loadingUpcoming.value = false;
    return;
  }
  try {
    const fetches: Promise<UpcomingData>[] = [];
    if (!isBrigadeOnly.value) {
      fetches.push(
        apiFetch<UpcomingData>('/camp-trainings/me/upcoming?limit=100')
      );
      fetches.push(
        apiFetch<UpcomingData>('/medical-exams/me/upcoming?limit=100')
      );
    }
    fetches.push(
      apiFetch<UpcomingData>('/course-trainings/me/upcoming?limit=100').catch(
        () => ({ trainings: [] })
      )
    );
    const results = await Promise.all(fetches);
    const [trainingData, examData, eventData] = normaliseUpcoming(results);
    const trainingItems = trainingData.trainings?.map(mapTraining) ?? [];
    const approvedExams = (examData.exams ?? []).filter((exam) =>
      ['APPROVED', 'COMPLETED'].includes(exam.registration_status ?? '')
    );
    const examItems = approvedExams.map(mapExam);
    const eventItems = eventData.trainings?.map(mapEvent) ?? [];

    const horizonMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const upcomingWindow = now + horizonMs;

    upcoming.value = [...trainingItems, ...eventItems, ...examItems]
      .filter((item) => {
        const timestamp = Date.parse(item.startAt);
        return (
          Number.isFinite(timestamp) &&
          timestamp >= now &&
          timestamp < upcomingWindow
        );
      })
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
      .slice(0, 6);
  } catch {
    upcoming.value = [];
  } finally {
    loadingUpcoming.value = false;
  }
}

function normaliseUpcoming(
  results: UpcomingData[]
): [UpcomingData, UpcomingData, UpcomingData] {
  if (results.length === 3) {
    const [a, b, c] = results;
    return [a ?? { trainings: [] }, b ?? { exams: [] }, c ?? { trainings: [] }];
  }
  if (results.length === 2) {
    const [a, b] = results;
    return [a ?? { trainings: [] }, { exams: [] }, b ?? { trainings: [] }];
  }
  if (results.length === 1) {
    const [a] = results;
    return [a ?? { trainings: [] }, { exams: [] }, { trainings: [] }];
  }
  return [{ trainings: [] }, { exams: [] }, { trainings: [] }];
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
      <div
        v-if="isFhmoStaffOnly"
        class="alert alert-info d-flex align-items-start gap-3 mb-3 friendly-onboarding"
        role="status"
      >
        <i
          class="bi bi-stars friendly-onboarding__icon text-brand"
          aria-hidden="true"
        ></i>
        <div>
          <h2 class="h6 mb-1 fw-semibold text-brand">Работаем поэтапно</h2>
          <p class="mb-0">
            Сейчас для вас доступны разделы «Обращения» и «Профиль». Мы добавляем
            новые сервисы шаг за шагом и обязательно сообщим, когда появятся
            обновления.
          </p>
        </div>
      </div>
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
              :key="`${item.type}-${item.id}`"
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
              :to="item.to ?? null"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div
        v-if="!isStaffOnly && workSections.length > 0"
        class="card section-card mb-2 menu-section"
      >
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Рабочие сервисы</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in workSections"
              :key="item.title"
              :title="item.title"
              :icon="item.icon"
              :to="item.to ?? null"
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
              :to="item.to ?? null"
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
              :to="item.to ?? null"
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
              :to="item.to ?? null"
              :placeholder="!item.to"
            />
          </div>
        </div>
      </div>

      <div v-if="canAccessAdmin" class="mt-2">
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

.friendly-onboarding {
  background-color: #eef6ff;
  border-color: rgba(17, 56, 103, 0.18);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-tile);
  color: #123962;
}

.friendly-onboarding__icon {
  font-size: 1.5rem;
  line-height: 1;
  margin-top: 0.2rem;
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
