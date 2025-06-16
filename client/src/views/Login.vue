<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'

const router = useRouter()
const phone = ref('')
const password = ref('')
const error = ref('')

async function login() {
  error.value = ''
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.value, password: password.value })
    })
    localStorage.setItem('access_token', data.access_token)
    router.push('/')
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <div class="d-flex align-items-center justify-content-center vh-100">
    <div class="card p-4 shadow login-card w-100" style="max-width: 400px;">
      <h1 class="mb-4 text-center">Login</h1>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <form @submit.prevent="login">
        <div class="mb-3">
          <label class="form-label">Phone</label>
          <input v-model="phone" type="tel" class="form-control" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <input v-model="password" type="password" class="form-control" required />
        </div>
        <button type="submit" class="btn btn-primary w-100">Login</button>
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
