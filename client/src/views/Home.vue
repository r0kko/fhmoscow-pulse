<script setup>
import { auth } from '../auth.js'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const sections = [
  { title: 'Мои назначения', icon: 'bi-calendar-check' },
  { title: 'Прошедшие матчи', icon: 'bi-clock-history' },
  { title: 'Рапорты', icon: 'bi-file-earmark-text' },
  { title: 'Доходы', icon: 'bi-currency-dollar' },
  { title: 'Сборы', icon: 'bi-people-fill' },
  { title: 'Медосмотр', icon: 'bi-heart-pulse', to: '/medical' },
  { title: 'Результаты тестов', icon: 'bi-graph-up' },
  { title: 'Документы', icon: 'bi-folder2-open' },
  { title: 'Персональные данные', icon: 'bi-person-circle', to: '/profile' }
]

const isAdmin = computed(() => auth.roles.includes('ADMIN'))

const shortName = computed(() => {
  if (!auth.user) return ''
  return [auth.user.first_name, auth.user.patronymic].filter(Boolean).join(' ')
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 18) return 'Добрый день'
  if (hour >= 18 && hour < 23) return 'Добрый вечер'
  return 'Доброй ночи'
})
</script>

<template>
  <div class="home-page py-4">
    <div class="container">
      <h1 class="mb-4 text-start">
        {{ greeting }}, {{ shortName || auth.user?.phone }}!
      </h1>
      <div class="card mb-4 text-center">
        <div class="card-body">
          <h5 class="card-title mb-2">Ближайшие события</h5>
          <p class="card-text text-muted mb-0">Информация скоро будет доступна</p>
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
            <h5 class="card-title">{{ section.title }}</h5>
            <p v-if="!section.to" class="text-muted small mb-0">Раздел в разработке</p>
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
              <h5 class="card-title">Администрирование</h5>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.home-page {
  background-color: #f0f1f3;
}

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
