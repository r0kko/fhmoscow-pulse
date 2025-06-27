<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { clearAuth, fetchCurrentUser, auth } from '../auth.js'
import logo from '../assets/fhm-logo.svg'

const router = useRouter()
const checking = ref(false)
let intervalId

async function checkStatus() {
  checking.value = true
  try {
    await fetchCurrentUser()
    if (auth.user?.status !== 'AWAITING_CONFIRMATION') {
      router.push('/')
    }
  } catch (_) {
    // ignore errors
  } finally {
    checking.value = false
  }
}

function logout() {
  apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
    clearAuth()
    router.push('/login')
  })
}

onMounted(() => {
  checkStatus()
  intervalId = setInterval(checkStatus, 30000)
})

onUnmounted(() => {
  clearInterval(intervalId)
})
</script>

<template>
  <div class="d-flex align-items-center justify-content-center vh-100">
    <div class="card p-4 shadow login-card w-100 text-center" style="max-width: 420px;">
      <img :src="logo" alt="FHM" class="mx-auto d-block mb-3" style="max-height: 80px" />
      <h2 class="mb-3">Заявка отправлена</h2>
      <p class="mb-3">Ваша регистрация завершена и ожидает проверки администратором.</p>
      <p class="mb-4">После подтверждения вам станет доступен портал.</p>
      <div class="d-flex justify-content-center gap-2">
        <button class="btn btn-outline-primary" @click="checkStatus" :disabled="checking">
          <span v-if="checking" class="spinner-border spinner-border-sm me-2"></span>
          Проверить статус
        </button>
        <button class="btn btn-secondary" @click="logout">Выйти</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-card {
  animation: fade-in 0.4s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
