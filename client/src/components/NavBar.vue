<template>
  <nav class="navbar navbar-expand-md navbar-dark bg-primary">
    <div class="container-fluid">
      <RouterLink class="navbar-brand" to="/">Федерация хоккея Москвы</RouterLink>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <li class="nav-item" v-if="roles.includes('REFEREE') || roles.includes('ADMIN')">
            <RouterLink class="nav-link" to="/">Назначения</RouterLink>
          </li>
        <li class="nav-item" v-if="roles.includes('ADMIN')">
          <RouterLink class="nav-link" to="/users">Пользователи</RouterLink>
        </li>
        <li class="nav-item" v-if="roles.includes('ADMIN')">
          <a class="nav-link" href="#">Взносы</a>
        </li>
          <li class="nav-item">
            <RouterLink class="nav-link" to="/profile">Профиль</RouterLink>
          </li>
        </ul>
        <span class="navbar-text me-3" v-if="user">{{ user.phone }}</span>
        <button class="btn btn-outline-light" @click="logout">Выйти</button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, fetchCurrentUser, clearAuth } from '../auth.js'
import { apiFetch } from '../api.js'

const router = useRouter()
const { user, roles } = auth

onMounted(async () => {
  if (!auth.user) {
    try {
      await fetchCurrentUser()
    } catch (e) {
      logout()
    }
  }
})

function logout() {
  apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('access_token')
    clearAuth()
    router.push('/login')
  })
}
</script>
