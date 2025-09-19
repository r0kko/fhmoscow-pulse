<script setup>
import { computed } from 'vue';
import { auth } from '../auth.js';
import MenuTile from '../components/MenuTile.vue';

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
  {
    title: 'Занятость судей',
    icon: 'bi-calendar-week',
    to: '/admin/referee-availability',
  },
  { title: 'Экипировка', icon: 'bi-tshirt', to: '/admin/equipment' },
];

const sportsSections = [
  {
    title: 'Календарь игр',
    icon: 'bi-calendar-week',
    to: '/admin/sports-calendar',
  },
];

const systemSections = computed(() => {
  const items = [];
  if (auth.roles.includes('ADMIN')) {
    items.push({ title: 'Площадки', icon: 'bi-geo-alt', to: '/admin/grounds' });
    items.push({
      title: 'Команды и клубы',
      icon: 'bi-shield',
      to: '/admin/clubs-teams',
    });
    items.push({
      title: 'Турниры',
      icon: 'bi-trophy',
      to: '/admin/tournaments',
    });
    items.push({
      title: 'Управление спортивными школами',
      icon: 'bi-building',
      to: '/admin/sport-schools',
    });
    items.push({
      title: 'Фото игроков',
      icon: 'bi-person-bounding-box',
      to: '/admin/player-photo-requests',
    });
    items.push({
      title: 'Синхронизация',
      icon: 'bi-arrow-repeat',
      to: '/admin/system-ops',
    });
  }
  return items;
});
</script>

<template>
  <div class="py-4">
    <div class="container">
      <!-- Keep semantic h1 for accessibility; style to match Home greeting size -->
      <h1 class="h3 mb-3 text-start">Администрирование</h1>

      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-people text-brand me-2" aria-hidden="true"></i>
            Пользователи системы
          </h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in userSections"
              :key="item.to"
              :to="item.to"
              :title="item.title"
              :icon="item.icon"
            />
          </div>
        </div>
      </div>

      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-trophy text-brand me-2" aria-hidden="true"></i>
            Управление судейским корпусом
          </h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in refereeSections"
              :key="item.to"
              :to="item.to"
              :title="item.title"
              :icon="item.icon"
            />
          </div>
        </div>
      </div>

      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-flag text-brand me-2" aria-hidden="true"></i>
            Управление спортивной частью
          </h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in sportsSections"
              :key="item.to"
              :to="item.to"
              :title="item.title"
              :icon="item.icon"
            />
          </div>
        </div>
      </div>

      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">
            <i class="bi bi-gear text-brand me-2" aria-hidden="true"></i>
            Управление сущностями системы
          </h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="item in systemSections"
              :key="item.to"
              :to="item.to"
              :title="item.title"
              :icon="item.icon"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles are centralized in brand.css. */
/* Mobile: make tile groups full-bleed only on Admin Home */
@media (max-width: 575.98px) {
  .menu-section {
    margin-left: calc(var(--bs-gutter-x) * -0.5);
    margin-right: calc(var(--bs-gutter-x) * -0.5);
    border-radius: 0;
  }
}
</style>
