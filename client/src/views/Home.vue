<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = ref(null)

async function fetchUser() {
  const token = localStorage.getItem('access_token')
  const res = await fetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  })
  if (res.ok) {
    const data = await res.json()
    user.value = data.user
  } else {
    router.push('/login')
  }
}

function logout() {
  const token = localStorage.getItem('access_token')
  fetch('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  }).finally(() => {
    localStorage.removeItem('access_token')
    router.push('/login')
  })
}

onMounted(fetchUser)
</script>

<template>
  <div class="container mt-5">
    <div v-if="user">
      <h1 class="mb-4">Welcome {{ user.email }}</h1>
      <button class="btn btn-secondary" @click="logout">Logout</button>
    </div>
  </div>
</template>
