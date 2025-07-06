<script setup>
import { auth } from '../auth.js'
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'

const sections = [
  { title: 'Мои назначения', icon: 'bi-calendar-check' },
  { title: 'Прошедшие матчи', icon: 'bi-clock-history' },
  { title: 'Рапорты', icon: 'bi-file-earmark-text' },
  { title: 'Доходы', icon: 'bi-currency-dollar' },
  { title: 'Сборы', icon: 'bi-people-fill', to: '/camps' },
  { title: 'Медосмотр', icon: 'bi-heart-pulse', to: '/medical' },
  { title: 'Результаты тестов', icon: 'bi-graph-up' },
  { title: 'Документы', icon: 'bi-folder2-open' },
  { title: 'Персональные данные', icon: 'bi-person-circle', to: '/profile' }
]

const isAdmin = computed(() => auth.roles.includes('ADMIN'))

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
    const data = await apiFetch('/camp-trainings/me/upcoming?limit=3')
    upcoming.value = data.trainings || []
  } catch (_err) {
    upcoming.value = []
  } finally {
    loadingUpcoming.value = false
  }
}

function formatStart(date) {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
  const timeStr = d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dateStr} в ${timeStr}`
}
</script>

<template>
  <div class="py-4">
    <div class="container">
      <h3 class="mb-4 text-start">
        {{ greeting }}, {{ shortName || auth.user?.phone }}!
      </h3>
      <div class="card mb-4 text-start">
        <div class="card-body">
          <h5 class="card-title mb-3">Ближайшие события</h5>
          <div v-if="loadingUpcoming" class="text-center py-3">
            <div class="spinner-border" role="status" aria-label="Загрузка">
              <span class="visually-hidden">Загрузка…</span>
            </div>
          </div>
          <p v-else-if="!upcoming.length" class="text-muted mb-0">У вас нет записей</p>
          <div v-else class="upcoming-scroll d-flex flex-nowrap gap-3">
            <a
              v-for="t in upcoming"
              :key="t.id"
              :href="t.stadium?.yandex_url"
              target="_blank"
              class="text-decoration-none text-body"
            >
              <div class="card h-100 upcoming-card">
                <div class="card-body d-flex align-items-start">
                  <i class="bi bi-people-fill fs-3 me-3 text-brand" aria-hidden="true"></i>
                  <div>
                    <p class="small text-muted mb-1">Тренировка</p>
                    <p class="mb-1">
                      <i class="bi bi-clock me-1" aria-hidden="true"></i>
                      {{ formatStart(t.start_at) }}
                    </p>
                    <p class="mb-0 small">
                      <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>
                      {{ t.stadium?.address?.result }}
                    </p>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
      <div class="card main-tile p-4">
        <div class="row g-4">
          <div class="col-6 col-md-4 col-lg-3" v-for="section in sections" :key="section.title">
          <component
            :is="section.to ? RouterLink : 'div'"
            :to="section.to"
            class="card h-100 text-center tile fade-in text-decoration-none text-body"
            :class="{ 'placeholder-card': !section.to }"
        >
          <div class="card-body d-flex flex-column justify-content-center align-items-center">
            <i
              :class="section.icon + ' fs-1 mb-3 icon-brand'"
              role="img"
              :aria-label="section.title"
            ></i>
            <h6 class="card-title">{{ section.title }}</h6>
            <p v-if="!section.to" class="text-muted small mb-0">Скоро</p>
          </div>
          </component>
        </div>
        <div v-if="isAdmin" class="col-6 col-md-4 col-lg-3">
          <RouterLink to="/admin" class="card h-100 text-center tile fade-in text-decoration-none text-body">
            <div class="card-body d-flex flex-column justify-content-center align-items-center">
              <i
                class="bi bi-shield-lock fs-1 mb-3 icon-brand"
                role="img"
                aria-label="Администрирование"
              ></i>
              <h6 class="card-title">Администрирование</h6>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>

.main-tile {
  border-radius: 1rem;
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.05);
  background-color: #fff;
}

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
  gap: 0.75rem;
  padding-bottom: 0.25rem;
  justify-content: flex-start;
}

.upcoming-card {
  width: clamp(16rem, 75vw, 20rem);
  margin: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.upcoming-card i {
  color: var(--brand-color);
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
