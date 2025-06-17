<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'

const router = useRouter()
const phone = ref('')
const phoneInput = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

watch(error, (val) => {
  if (val) {
    setTimeout(() => {
      error.value = ''
    }, 4000)
  }
})

function formatPhone(digits) {
  let out = '+7'
  if (digits.length > 1) out += ' (' + digits.slice(1, 4)
  if (digits.length >= 4) out += ') '
  if (digits.length >= 4) out += digits.slice(4, 7)
  if (digits.length >= 7) out += '-' + digits.slice(7, 9)
  if (digits.length >= 9) out += '-' + digits.slice(9, 11)
  return out
}

function onPhoneInput(e) {
  let digits = e.target.value.replace(/\D/g, '')
  if (!digits.startsWith('7')) digits = '7' + digits.replace(/^7*/, '')
  digits = digits.slice(0, 11)
  phone.value = digits
  phoneInput.value = formatPhone(digits)
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    phone.value = phone.value.slice(0, -1)
    phoneInput.value = formatPhone(phone.value)
  }
}

async function login() {
  error.value = ''
  if (phone.value.length !== 11 || !phone.value.startsWith('7')) {
    error.value = 'Неверный номер телефона'
    return
  }
  loading.value = true
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.value, password: password.value })
    })
    localStorage.setItem('access_token', data.access_token)
    router.push('/')
  } catch (err) {
    error.value = err.message || 'Ошибка авторизации'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="d-flex align-items-center justify-content-center vh-100">
    <div class="card p-4 shadow login-card w-100" style="max-width: 400px;">
      <h1 class="mb-4 text-center">Вход</h1>
      <transition name="fade">
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
      </transition>
      <form @submit.prevent="login">
        <div class="mb-3 input-group">
          <span class="input-group-text"><i class="bi bi-phone"></i></span>
          <input
            v-model="phoneInput"
            @input="onPhoneInput"
            @keydown="onPhoneKeydown"
            type="tel"
            class="form-control"
            placeholder="+7 (___) ___-__-__"
            required
          />
        </div>
        <div class="mb-3 input-group">
          <span class="input-group-text"><i class="bi bi-lock"></i></span>
          <input v-model="password" type="password" class="form-control" required />
        </div>
        <button type="submit" class="btn btn-primary w-100" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          Войти
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-card {
  animation: fade-in 0.4s ease-out;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
