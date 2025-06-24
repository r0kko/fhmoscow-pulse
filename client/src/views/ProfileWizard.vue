<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { auth } from '../auth.js'

const router = useRouter()
const step = ref(
  auth.user?.status === 'REGISTRATION_STEP_2' ? 2 : 1
)
const total = 2
const snils = ref('')
const inn = ref('')
const error = ref('')
const loading = ref(false)

async function saveStep() {
  loading.value = true
  error.value = ''
  try {
    if (step.value === 1) {
      await apiFetch('/snils', {
        method: 'POST',
        body: JSON.stringify({ number: snils.value })
      })
      await apiFetch('/profile/progress', {
        method: 'POST',
        body: JSON.stringify({ status: 'REGISTRATION_STEP_2' })
      })
      auth.user.status = 'REGISTRATION_STEP_2'
    } else if (step.value === 2) {
      await apiFetch('/inns', {
        method: 'POST',
        body: JSON.stringify({ number: inn.value })
      })
    }
    if (step.value < total) {
      step.value++
      loading.value = false
      return
    }
    await apiFetch('/profile/complete', { method: 'POST' })
    auth.user.status = 'AWAITING_CONFIRMATION'
    router.push('/login')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 500px">
    <h1 class="mb-4 text-center">Заполнение профиля</h1>
    <div class="progress mb-4">
      <div class="progress-bar" role="progressbar" :style="{ width: (step / total) * 100 + '%' }"></div>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <form @submit.prevent="saveStep">
      <div v-if="step === 1" class="mb-3">
        <label for="snils" class="form-label">СНИЛС</label>
        <input id="snils" v-model="snils" class="form-control" required />
      </div>
      <div v-else-if="step === 2" class="mb-3">
        <label for="inn" class="form-label">ИНН</label>
        <input id="inn" v-model="inn" class="form-control" required />
      </div>
      <button type="submit" class="btn btn-primary w-100" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ step < total ? 'Далее' : 'Отправить на проверку' }}
      </button>
    </form>
  </div>
</template>
