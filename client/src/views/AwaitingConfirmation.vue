<script setup>
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { clearAuth } from '../auth.js'

const router = useRouter()

function logout() {
  apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
    localStorage.removeItem('access_token')
    clearAuth()
    router.push('/login')
  })
}
</script>

<template>
  <div class="d-flex flex-column align-items-center justify-content-center vh-100 text-center">
    <h1 class="mb-4">Заявка отправлена</h1>
    <p class="mb-3">Ваша регистрация завершена и ожидает проверки администратором.</p>
    <p class="mb-4">После подтверждения вам станет доступен портал.</p>
    <button class="btn btn-secondary" @click="logout">Выйти</button>
  </div>
</template>
