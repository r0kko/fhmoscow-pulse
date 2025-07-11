<script setup>
import TaskList from '../components/TaskList.vue';
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="py-3 tasks-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-2">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Задачи</li>
        </ol>
      </nav>
      <h1 class="mb-3">Задачи</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <TaskList />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tasks-page nav[aria-label='breadcrumb'] {
  margin-bottom: 1rem;
}

@media (max-width: 575.98px) {
  .tasks-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .tasks-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>

