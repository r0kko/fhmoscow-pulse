<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { auth } from '../auth.js'
import logo from '../assets/fhm-logo.svg'

const router = useRouter()
const phone = ref('')
const phoneInput = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(false)
const error = ref('')
const loading = ref(false)
const phoneTouched = ref(false)
const phoneValid = computed(() => phone.value.length === 11 && phone.value.startsWith('7'))

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
  phoneTouched.value = true
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    phone.value = phone.value.slice(0, -1)
    phoneInput.value = formatPhone(phone.value)
    phoneTouched.value = true
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
    const storage = rememberMe.value ? localStorage : sessionStorage
    storage.setItem('access_token', data.access_token)
    storage.setItem('roles', JSON.stringify(data.roles || []))
    ;(rememberMe.value ? sessionStorage : localStorage).removeItem('access_token')
    ;(rememberMe.value ? sessionStorage : localStorage).removeItem('roles')
    auth.user = data.user
    auth.roles = data.roles || []
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
    <div class="card p-4 shadow login-card w-100">
      <img :src="logo" alt="FHM Pulse logo" class="login-logo mb-3 mx-auto d-block" />
      <h2 class="mb-4 text-center">Авторизация</h2>
      <transition name="fade">
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
      </transition>
      <form @submit.prevent="login">
        <div class="mb-3 input-group">
          <label for="phoneInput" class="form-label visually-hidden">Телефон</label>
          <span class="input-group-text"><i class="bi bi-phone"></i></span>
          <input
            id="phoneInput"
            v-model="phoneInput"
            @input="onPhoneInput"
            @keydown="onPhoneKeydown"
            type="tel"
            :class="['form-control', { 'is-invalid': phoneTouched && !phoneValid }]"
            placeholder="+7 (___) ___-__-__"
            required
            :aria-invalid="phoneTouched && !phoneValid"
          />
          <div class="invalid-feedback">Введите корректный номер</div>
        </div>
        <div class="mb-3 input-group">
          <label for="password" class="form-label visually-hidden">Пароль</label>
          <span class="input-group-text"><i class="bi bi-lock"></i></span>
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="form-control"
            required
          />
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
          >
            <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
          </button>
        </div>
        <div class="form-check mb-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="rememberMe"
            v-model="rememberMe"
          />
          <label class="form-check-label" for="rememberMe">Запомнить меня</label>
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
  max-width: 400px;
}

.login-logo {
  max-width: 120px;
  height: auto;
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
