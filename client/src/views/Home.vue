<script setup>
import { auth } from '../auth.js'
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import UpcomingEventCard from '../components/UpcomingEventCard.vue'

const basePreparationSections = [
  { title: 'Сборы', icon: 'bi-people-fill', to: '/camps', referee: true },
  { title: 'Медосмотр', icon: 'bi-heart-pulse', to: '/medical', referee: true },
  { title: 'Результаты тестов', icon: 'bi-graph-up' },
]

const workSections = [
  { title: 'Мои назначения', icon: 'bi-calendar-check' },
  { title: 'Прошедшие матчи', icon: 'bi-clock-history' },
  { title: 'Рапорты', icon: 'bi-file-earmark-text' },
  { title: 'Доходы', icon: 'ruble-icon' }
]

const docsSections = [
  { title: 'Документы', icon: 'bi-folder2-open' },
  { title: 'Персональные данные', icon: 'bi-person-circle', to: '/profile' }
]

const isAdmin = computed(() => auth.roles.includes('ADMIN'))
const isReferee = computed(() => auth.roles.includes('REFEREE'))
const preparationSections = computed(() =>
  basePreparationSections.filter((s) => !s.referee || isReferee.value)
)

const shortName = computed(() => {
  if (!auth.user) return ''
  return [auth.user.first_name].filter(Boolean).join(' ')
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 18) return 'Добрый день'
  if (hour >= 18 && hour < 23) return 'Добрый вечер'
  return 'Доброй ночи'
})

const upcoming = ref([])
const loadingUpcoming = ref(true)

onMounted(loadUpcoming)

async function loadUpcoming() {
  loadingUpcoming.value = true
  try {
    const [trainingData, examData] = await Promise.all([
      apiFetch('/camp-trainings/me/upcoming?limit=100'),
      apiFetch('/medical-exams/me/upcoming?limit=100')
    ])
    const trainings = (trainingData.trainings || []).map((t) => ({
      ...t,
      kind: 'training'
    }))
    const exams = (examData.exams || [])
      .filter(
        (e) => e.registration_status === 'APPROVED' || e.registration_status === 'COMPLETED'
      )
      .map((e) => ({
        ...e,
        kind: 'exam'
      }))
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    upcoming.value = [...trainings, ...exams]
      .filter((e) => {
        const start = new Date(e.start_at)
        return start >= now && start < end
      })
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  } catch (_err) {
    upcoming.value = []
  } finally {
    loadingUpcoming.value = false
  }
}
</script>

<template>
  <div class="py-4">
    <div class="container">
      <h3 class="mb-3 text-start">
        {{ greeting }}, {{ shortName || auth.user?.phone }}!
      </h3>
      <div class="card section-card mb-2 text-start">
        <div class="card-body">
          <h5 class="card-title mb-3">Ближайшие события</h5>
          <div v-if="loadingUpcoming" class="text-center py-3">
            <div class="spinner-border" role="status" aria-label="Загрузка">
              <span class="visually-hidden">Загрузка…</span>
            </div>
          </div>
          <p v-else-if="!upcoming.length" class="text-muted mb-0">У вас нет записей</p>
          <div v-else class="upcoming-scroll d-flex flex-nowrap gap-3">
            <UpcomingEventCard
              v-for="item in upcoming"
              :key="item.kind + '-' + item.id"
              :event="item"
            />
          </div>
        </div>
      </div>
      <div class="card section-card mb-2">
        <div class="card-body">
          <h5 class="card-title mb-3">Подготовка к сезону</h5>
          <div class="scroll-container">
            <component
              v-for="item in preparationSections"
              :key="item.title"
              :is="item.to ? RouterLink : 'div'"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
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
          <h5 class="card-title mb-3">Рабочие сервисы</h5>
          <div class="scroll-container">
            <component
              v-for="item in workSections"
              :key="item.title"
              :is="item.to ? RouterLink : 'div'"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
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
          <h5 class="card-title mb-3">Документы и формальности</h5>
          <div class="scroll-container">
            <component
              v-for="item in docsSections"
              :key="item.title"
              :is="item.to ? RouterLink : 'div'"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :class="{ 'placeholder-card': !item.to }"
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
        <RouterLink to="/admin" class="menu-card card text-decoration-none text-body tile fade-in d-inline-block">
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
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.upcoming-scroll {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
  justify-content: flex-start;
}


.scroll-container {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  gap: 0.75rem;
  padding-bottom: 0.25rem;
  justify-content: flex-start;
}

.menu-card {
  width: 8rem;
  flex: 0 0 auto;
  height: 6.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.05);
  scroll-snap-align: start;
  scroll-snap-stop: always;
  position: relative;
}

.menu-card .card-body {
  padding: 0.75rem;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: 100%;
}

.menu-card .card-title {
  line-height: 1.2;
  font-weight: 600;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@media (max-width: 575.98px) {
  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}

.menu-card .icon {
  position: absolute;
  bottom: 0.75rem;
  right: 0.75rem;
  color: var(--brand-color);
}

.ruble-icon::before {
  content: '₽';
  display: inline-block;
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  vertical-align: -.125em;
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
