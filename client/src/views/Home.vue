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

onMounted(fetchUser)
</script>

<template>
  <div class="container mt-5" v-if="user">
    <h1 class="mb-4">Welcome {{ user.phone }}</h1>
  </div>
</template>
