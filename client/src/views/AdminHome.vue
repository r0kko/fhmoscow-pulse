<script setup>
import { RouterLink } from 'vue-router'

const userSections = [
  { title: 'Пользователи', icon: 'bi-people', to: '/admin/users' },
  { title: 'Документы', icon: 'bi-file-earmark', to: '/admin/documents' },
  { title: 'Медицина', icon: 'bi-file-earmark-medical', to: '/admin/medical' },
  { title: 'Обращения', icon: 'bi-chat-dots', to: '/admin/tickets' },
]

const refereeSections = [
  { title: 'Управление площадками', icon: 'bi-building', to: '/admin/grounds' },
  { title: 'Нормативы', icon: 'bi-speedometer2', to: '/admin/normatives' },
]
</script>

<template>
  <div class="py-4">
    <div class="container">
    <h1 class="mb-3 text-center">Администрирование</h1>

    <div class="card section-card mb-2">
      <div class="card-body">
        <h5 class="card-title mb-3">Пользователи системы</h5>
        <div class="scroll-container">
          <RouterLink
            v-for="item in userSections"
            :key="item.to"
            :to="item.to"
            class="menu-card card text-decoration-none text-body tile fade-in"
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
        <h5 class="card-title mb-3">Управление судейским корпусом</h5>
        <div class="scroll-container">
          <RouterLink
            v-for="item in refereeSections"
            :key="item.to"
            :to="item.to"
            class="menu-card card text-decoration-none text-body tile fade-in"
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
