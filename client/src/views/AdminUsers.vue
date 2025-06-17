<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../api.js'

const users = ref([])
const error = ref('')

async function loadUsers() {
  try {
    const data = await apiFetch('/users')
    users.value = data.users
  } catch (e) {
    error.value = e.message
  }
}

async function blockUser(id) {
  await apiFetch(`/users/${id}/block`, { method: 'POST' })
  await loadUsers()
}

async function unblockUser(id) {
  await apiFetch(`/users/${id}/unblock`, { method: 'POST' })
  await loadUsers()
}

onMounted(loadUsers)
</script>

<template>
  <div>
    <h1 class="mb-4">Пользователи</h1>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <table class="table table-striped" v-if="users.length">
      <thead>
        <tr>
          <th>Фамилия</th>
          <th>Имя</th>
          <th>Телефон</th>
          <th>Статус</th>
          <th>Роли</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.last_name }}</td>
          <td>{{ u.first_name }}</td>
          <td>{{ u.phone }}</td>
          <td>{{ u.status }}</td>
          <td>{{ u.roles?.join(', ') }}</td>
          <td>
            <button
              v-if="u.status === 'ACTIVE'"
              @click="blockUser(u.id)"
              class="btn btn-sm btn-danger me-2"
            >
              Block
            </button>
            <button
              v-if="u.status === 'INACTIVE'"
              @click="unblockUser(u.id)"
              class="btn btn-sm btn-success"
            >
              Unblock
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет пользователей.</p>
  </div>
</template>
