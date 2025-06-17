<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'

const router = useRouter()
const user = ref(null)

async function fetchUser() {
  try {
    const data = await apiFetch('/auth/me')
    user.value = data.user
  } catch (_err) {
    router.push('/login')
  }
}

function logout() {
  apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('access_token')
    router.push('/login')
  })
}

onMounted(fetchUser)
</script>

<template>
  <div class="container mt-5" v-if="user">
    <nav class="mb-3">
      <ul class="nav nav-pills gap-2 flex-wrap">
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
          <RouterLink class="nav-link" to="/profile">Personal information</RouterLink>
        </li>
      </ul>
    </nav>
    <h1 class="mb-4">Welcome {{ user.phone }}</h1>
    <button class="btn btn-secondary" @click="logout">Logout</button>
  </div>
</template>
