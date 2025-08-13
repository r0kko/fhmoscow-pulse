<script setup>
import { RouterLink } from 'vue-router';

const userSections = [
  { title: 'Пользователи', icon: 'bi-people', to: '/admin/users' },
  { title: 'Документы', icon: 'bi-file-earmark', to: '/admin/documents' },
  { title: 'Медицина', icon: 'bi-file-earmark-medical', to: '/admin/medical' },
  { title: 'Обращения', icon: 'bi-chat-dots', to: '/admin/tickets' },
];

const refereeSections = [
  { title: 'Сборы', icon: 'bi-building', to: '/admin/camps' },
  { title: 'Нормативы', icon: 'bi-speedometer2', to: '/admin/normatives' },
  { title: 'Мероприятия', icon: 'bi-calendar-event', to: '/admin/courses' },
];

const systemSections = [
  { title: 'Площадки', icon: 'bi-geo-alt', to: '/admin/grounds' },
];
</script>

<template>
  <div class="py-4">
    <div class="container">
      <h1 class="mb-3 text-start">Администрирование</h1>

      <div class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-people text-brand me-2" aria-hidden="true"></i>
            Пользователи системы
          </h2>
          <div v-edge-fade class="scroll-container">
            <RouterLink
              v-for="item in userSections"
              :key="item.to"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :aria-label="item.title"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-trophy text-brand me-2" aria-hidden="true"></i>
            Управление судейским корпусом
          </h2>
          <div v-edge-fade class="scroll-container">
            <RouterLink
              v-for="item in refereeSections"
              :key="item.to"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :aria-label="item.title"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="card section-card mb-2">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-gear text-brand me-2" aria-hidden="true"></i>
            Управление сущностями системы
          </h2>
          <div v-edge-fade class="scroll-container">
            <RouterLink
              v-for="item in systemSections"
              :key="item.to"
              :to="item.to"
              class="menu-card card text-decoration-none text-body tile fade-in"
              :aria-label="item.title"
            >
              <div class="card-body">
                <p class="card-title small mb-2">{{ item.title }}</p>
                <i :class="item.icon + ' icon fs-3'" aria-hidden="true"></i>
              </div>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles are centralized in brand.css. */
</style>
