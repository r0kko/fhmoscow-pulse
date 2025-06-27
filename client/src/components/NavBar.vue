<template>
  <nav class="navbar navbar-expand-md navbar-dark" style="background-color: var(--brand-color)">
    <div class="container-fluid">
      <RouterLink class="navbar-brand d-flex align-items-center gap-2" to="/">
        <img :src="logo" alt="FHM" height="30" />
        Отдел организации судейства
      </RouterLink>
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
      <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
        <span class="navbar-text me-3" v-if="user">
          {{ user.last_name }} {{ user.first_name }} {{ user.patronymic }}
        </span>
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
import logo from '../assets/fhm-logo.svg'

const router = useRouter()
const { user } = auth

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
