<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const users = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const data = await apiFetch('/sign-types/users');
    users.value = data.users;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">
          Документы и подписи
        </li>
      </ol>
    </nav>
    <h1 class="mb-3">Документы и подписи</h1>
    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else>
      <div v-if="error" class="text-danger">{{ error }}</div>
      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">ФИО</th>
                  <th scope="col">Email</th>
                  <th scope="col">Тип подписи</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id">
                  <td>{{ u.lastName }} {{ u.firstName }} {{ u.patronymic }}</td>
                  <td>{{ u.email }}</td>
                  <td>{{ u.signType ? u.signType.name : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles are centralized in brand.css. */
</style>
