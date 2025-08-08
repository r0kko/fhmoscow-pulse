<script setup>
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api.js';

const tasks = ref([]);
const loading = ref(true);

async function loadTasks() {
  loading.value = true;
  try {
    const data = await apiFetch('/tasks');
    tasks.value = data.tasks || [];
  } catch (_err) {
    tasks.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadTasks);
</script>

<template>
  <div>
    <h2 class="card-title h5 mb-3">Задачи</h2>
    <div v-if="loading" class="text-center py-3">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <p v-else-if="!tasks.length" class="text-muted mb-0">У вас нет задач</p>
    <ul v-else class="list-group list-group-flush">
      <li v-for="task in tasks" :key="task.id" class="list-group-item">
        <div class="d-flex justify-content-between">
          <div>
            <h3 class="h6 mb-1">{{ task.title }}</h3>
            <p v-if="task.description" class="mb-1 small text-muted">
              {{ task.description }}
            </p>
          </div>
          <span
            class="badge"
            :class="{
              'bg-secondary': task.status?.alias === 'PENDING',
              'bg-primary': task.status?.alias === 'IN_PROGRESS',
              'bg-success': task.status?.alias === 'COMPLETED',
            }"
            >{{ task.status?.name }}</span
          >
        </div>
      </li>
    </ul>
  </div>
</template>
