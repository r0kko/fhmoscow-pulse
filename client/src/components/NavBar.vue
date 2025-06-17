<script setup>
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { computed } from 'vue'

const router = useRouter()
const isAuthenticated = computed(() => !!localStorage.getItem('access_token'))

function logout() {
  apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('access_token')
    router.push('/login')
  })
}
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container-fluid">
      <RouterLink class="navbar-brand" to="/">FH Pulse</RouterLink>
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
          <li class="nav-item">
            <a class="nav-link" href="#">My appointments</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Reports</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Fees</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#">Personal information</a>
          </li>
        </ul>
        <button
          v-if="isAuthenticated"
          class="btn btn-outline-light ms-lg-3"
          @click="logout"
        >
          Logout
        </button>
      </div>
    </div>
  </nav>
</template>
