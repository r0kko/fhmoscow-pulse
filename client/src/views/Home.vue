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
      <!-- menu items will be added here -->
      <ul class="nav">
        <li class="nav-item"><a class="nav-link" href="#">Menu</a></li>
      </ul>
    </nav>
    <h1 class="mb-4">Welcome {{ user.phone }}</h1>
    <button class="btn btn-secondary" @click="logout">Logout</button>
  </div>
</template>
