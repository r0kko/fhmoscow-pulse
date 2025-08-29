<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="py-3 tasks-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Задачи</li>
        </ol>
      </nav>
      <h1 class="mb-3">Задачи</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body text-center py-5">Раздел временно недоступен</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@media (max-width: 575.98px) {
  .tasks-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
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
