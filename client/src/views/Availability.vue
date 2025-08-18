<script setup>
import { ref, onMounted, watch } from 'vue';
import { apiFetch } from '../api.js';

const days = ref([]);
const loading = ref(true);
const statuses = [
  { value: 'FREE', label: 'Свободен' },
  { value: 'PARTIAL', label: 'Частично' },
  { value: 'BUSY', label: 'Занят' },
];

async function load() {
  loading.value = true;
  try {
    const data = await apiFetch('/availabilities');
    days.value = data.days || [];
  } finally {
    loading.value = false;
  }
}

async function save() {
  await apiFetch('/availabilities', {
    method: 'PUT',
    body: JSON.stringify({ days: days.value }),
  });
}

watch(
  () => days.value,
  (list) => {
    for (const d of list) {
      if (d.status !== 'PARTIAL') {
        d.from_time = null;
        d.to_time = null;
      }
    }
  },
  { deep: true }
);

onMounted(load);
</script>

<template>
  <div class="py-3">
    <h2 class="h5 mb-3">Моя занятость</h2>
    <div v-if="loading" class="text-center py-3">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else>
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Статус</th>
            <th>С</th>
            <th>До</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in days" :key="d.date">
            <td>{{ new Date(d.date).toLocaleDateString('ru-RU') }}</td>
            <td>
              <select v-model="d.status" class="form-select">
                <option v-for="s in statuses" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
            </td>
            <td>
              <input
                v-if="d.status === 'PARTIAL'"
                v-model="d.from_time"
                type="time"
                class="form-control"
              />
            </td>
            <td>
              <input
                v-if="d.status === 'PARTIAL'"
                v-model="d.to_time"
                type="time"
                class="form-control"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <button class="btn btn-primary" @click="save">Сохранить</button>
    </div>
  </div>
</template>
