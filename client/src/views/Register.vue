<script setup>
import { ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import { auth, setAuthToken } from '../auth.js'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.vue'

const router = useRouter()
const step = ref(1)
const email = ref('')
const code = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)


watch(error, (val) => {
  if (val) {
    setTimeout(() => {
      error.value = ''
    }, 4000)
  }
})

async function start() {
  error.value = ''
  loading.value = true
  try {
    await apiFetch('/register/start', {
      method: 'POST',
      body: JSON.stringify({ email: email.value })
    })
    step.value = 2
  } catch (err) {
    error.value = err.message || 'Ошибка регистрации'
  } finally {
    loading.value = false
  }
}

async function finish() {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  loading.value = true
  try {
    const data = await apiFetch('/register/finish', {
      method: 'POST',
      body: JSON.stringify({
        email: email.value,
        code: code.value,
        password: password.value
      })
    })
    setAuthToken(data.access_token)
    auth.user = data.user
    auth.roles = data.roles || []
    router.push('/complete-profile')
  } catch (err) {
    error.value = err.message || 'Ошибка регистрации'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="d-flex align-items-center justify-content-center min-vh-100">
    <div class="card p-4 shadow login-card w-100" style="max-width: 400px;">
      <h1 class="mb-1 text-center">Регистрация</h1>
      <p class="text-center mb-3">с использованием существующей учетной записи в личном кабинете судьи</p>
      <transition name="fade">
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
      </transition>
      <form v-if="step === 1" @submit.prevent="start">
        <div class="form-floating mb-3">
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control"
            placeholder="Email"
            autocomplete="email"
            required
          />
          <label for="email">Email</label>
        </div>
        <button type="submit" class="btn btn-brand w-100" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          Отправить код
        </button>
        <div class="text-center mt-3">
          <RouterLink to="/login" class="link-secondary">Назад ко входу</RouterLink>
        </div>
      </form>

      <form v-else @submit.prevent="finish">
        <p class="mb-3">На {{ email }} отправлен код подтверждения.</p>
        <div class="form-floating mb-3">
          <input
            id="code"
            v-model="code"
            class="form-control"
            placeholder="Код"
            required
          />
          <label for="code">Код из письма</label>
        </div>
        <div class="form-floating mb-3">
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control"
            placeholder="Пароль"
            autocomplete="new-password"
            required
          />
          <label for="password">Пароль</label>
        </div>
        <PasswordStrengthMeter class="mb-3" :password="password" />
        <div class="form-floating mb-3">
          <input
            id="confirm"
            v-model="confirm"
            type="password"
            class="form-control"
            placeholder="Повторите пароль"
            autocomplete="new-password"
            required
          />
          <label for="confirm">Повторите пароль</label>
        </div>
        <button type="submit" class="btn btn-brand w-100" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          Завершить регистрацию
        </button>
      </form>
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
