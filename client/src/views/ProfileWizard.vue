<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { auth } from '../auth.js'
import UserForm from '../components/UserForm.vue'
import { isValidInn, isValidSnils, formatSnils } from '../utils/personal.js'

const router = useRouter()
const step = ref(
  auth.user?.status === 'REGISTRATION_STEP_2' ? 2 : 1
)
const total = 2
const user = ref({})
const inn = ref('')
const snilsDigits = ref('')
const snilsInput = ref('')
const error = ref('')
const loading = ref(false)
const formRef = ref(null)

onMounted(async () => {
  try {
    const data = await apiFetch('/users/me')
    user.value = data.user
  } catch (_) {}
})

function onInnInput(e) {
  inn.value = e.target.value.replace(/\D/g, '').slice(0, 12)
}

function onSnilsInput(e) {
  let digits = e.target.value.replace(/\D/g, '').slice(0, 11)
  snilsDigits.value = digits
  snilsInput.value = formatSnils(digits)
}

async function saveStep() {
  loading.value = true
  error.value = ''
  try {
    if (step.value === 1) {
      if (!formRef.value.validate()) {
        loading.value = false
        return
      }
      await apiFetch('/profile/progress', {
        method: 'POST',
        body: JSON.stringify({ status: 'REGISTRATION_STEP_2' })
      })
      auth.user.status = 'REGISTRATION_STEP_2'
      step.value = 2
      loading.value = false
      return
    }
    if (!isValidSnils(snilsInput.value)) {
      error.value = 'Неверный СНИЛС'
      return
    }
    if (!isValidInn(inn.value)) {
      error.value = 'Неверный ИНН'
      return
    }
    await apiFetch('/snils', {
      method: 'POST',
      body: JSON.stringify({ number: snilsInput.value })
    })
    await apiFetch('/inns', {
      method: 'POST',
      body: JSON.stringify({ number: inn.value })
    })
    await apiFetch('/profile/complete', { method: 'POST' })
    auth.user.status = 'AWAITING_CONFIRMATION'
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 600px">
    <h1 class="mb-4 text-center">Заполнение профиля</h1>
    <div class="progress mb-4">
      <div class="progress-bar" role="progressbar" :style="{ width: (step / total) * 100 + '%' }"></div>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <form @submit.prevent="saveStep">
      <div v-if="step === 1" class="mb-4">
        <UserForm ref="formRef" v-model="user" />
      </div>
      <div v-else-if="step === 2" class="mb-4">
        <div class="form-floating mb-3">
          <input
            id="snils"
            v-model="snilsInput"
            @input="onSnilsInput"
            class="form-control"
            placeholder="СНИЛС"
          />
          <label for="snils">СНИЛС</label>
        </div>
        <div class="form-floating">
          <input
            id="inn"
            v-model="inn"
            @input="onInnInput"
            class="form-control"
            placeholder="ИНН"
          />
          <label for="inn">ИНН</label>
        </div>
      </div>
      <button type="submit" class="btn btn-primary w-100" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ step < total ? 'Все верно, продолжить' : 'Завершить' }}
      </button>
    </form>
  </div>
</template>
