<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../api.js'

const user = ref(null)

async function fetchProfile() {
  try {
    const data = await apiFetch('/users/me')
    user.value = data.user
  } catch (_err) {
    user.value = null
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div class="container mt-5">
    <h1 class="mb-4">Personal information</h1>
    <table class="table table-striped" v-if="user">
      <tbody>
        <tr>
          <th>Last name</th>
          <td>{{ user.last_name }}</td>
        </tr>
        <tr>
          <th>First name</th>
          <td>{{ user.first_name }}</td>
        </tr>
        <tr>
          <th>Patronymic</th>
          <td>{{ user.patronymic }}</td>
        </tr>
        <tr>
          <th>Birth date</th>
          <td>{{ user.birth_date }}</td>
        </tr>
        <tr>
          <th>Phone</th>
          <td>{{ user.phone }}</td>
        </tr>
        <tr>
          <th>Email</th>
          <td>{{ user.email }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>No user data found.</p>
  </div>
</template>
