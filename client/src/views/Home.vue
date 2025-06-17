<script setup>
import { auth } from '../auth.js'

const sections = [
  { title: 'Мои назначения', icon: 'bi-calendar-check' },
  { title: 'Прошедшие матчи', icon: 'bi-clock-history' },
  { title: 'Отчеты', icon: 'bi-file-earmark-text' },
  { title: 'Доходы', icon: 'bi-currency-dollar' },
  { title: 'Взносы', icon: 'bi-wallet2' },
  { title: 'Медосмотр', icon: 'bi-heart-pulse' },
  { title: 'Результаты тестов', icon: 'bi-graph-up' },
  { title: 'Документы', icon: 'bi-folder2-open' },
  { title: 'Персональные данные', icon: 'bi-person-circle' }
]
</script>

<template>
  <div class="container mt-4">
    <h1 class="mb-4 text-center">Добро пожаловать {{ auth.user?.phone }}</h1>
    <div class="row g-4">
      <div class="col-6 col-md-4" v-for="section in sections" :key="section.title">
        <div class="card h-100 text-center tile fade-in">
          <div class="card-body d-flex flex-column justify-content-center align-items-center">
            <i :class="section.icon + ' fs-1 mb-3'"></i>
            <h5 class="card-title">{{ section.title }}</h5>
            <p class="text-muted small mb-0">Раздел в разработке</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.tile:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
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
