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
    <h1 class="mb-4">Личная информация</h1>
    <table class="table table-striped" v-if="user">
      <tbody>
        <tr>
          <th>Фамилия</th>
          <td>{{ user.last_name }}</td>
        </tr>
        <tr>
          <th>Имя</th>
          <td>{{ user.first_name }}</td>
        </tr>
        <tr>
          <th>Отчество</th>
          <td>{{ user.patronymic }}</td>
        </tr>
        <tr>
          <th>Дата рождения</th>
          <td>{{ user.birth_date }}</td>
        </tr>
        <tr>
          <th>Телефон</th>
          <td>{{ user.phone }}</td>
        </tr>
        <tr>
          <th>Эл. почта</th>
          <td>{{ user.email }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>Данные пользователя не найдены.</p>
  </div>
</template>
