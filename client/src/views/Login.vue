<script setup>
import { ref, watch } from 'vue';
import CookieNotice from '../components/CookieNotice.vue';
import PasswordInput from '../components/PasswordInput.vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch, initCsrf } from '../api.js';
import { auth, setAuthToken } from '../auth.js';
const logo = '/vite.svg';

const router = useRouter();
const phone = ref('');
const phoneInput = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

watch(error, (val) => {
  if (val) {
    setTimeout(() => {
      error.value = '';
    }, 4000);
  }
});

function formatPhone(digits) {
  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += '-' + digits.slice(7, 9);
  if (digits.length >= 9) out += '-' + digits.slice(9, 11);
  return out;
}

function onPhoneInput(e) {
  let digits = e.target.value.replace(/\D/g, '');
  // Normalize Russian numbers: accept leading 7 or 8, store as 7XXXXXXXXXX
  if (digits.length > 0) {
    // remove a single leading 7 or 8, then re-add 7
    digits = '7' + digits.replace(/^[78]/, '');
  } else {
    digits = '7';
  }
  digits = digits.slice(0, 11);
  phone.value = digits;
  phoneInput.value = formatPhone(digits);
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    phone.value = phone.value.slice(0, -1);
    phoneInput.value = formatPhone(phone.value);
  }
}

async function login() {
  error.value = '';
  if (phone.value.length !== 11 || !phone.value.startsWith('7')) {
    error.value = 'Неверный номер телефона';
    return;
  }
  loading.value = true;
  try {
    await initCsrf();
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.value, password: password.value }),
      redirectOn401: false,
    });
    setAuthToken(data.access_token);
    auth.user = data.user;
    auth.roles = data.roles || [];
    auth.mustChangePassword = !!data.must_change_password;
    let destination = '/';
    if (auth.mustChangePassword) {
      destination = '/change-password';
    } else if (
      data.awaiting_confirmation ||
      auth.user.status === 'AWAITING_CONFIRMATION'
    ) {
      destination = '/awaiting-confirmation';
    } else if (
      auth.user.status &&
      auth.user.status.startsWith('REGISTRATION_STEP')
    ) {
      destination = '/complete-profile';
    }
    await router.push(destination);
  } catch (err) {
    error.value = err.message || 'Ошибка авторизации';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="auth-page d-flex flex-column align-items-center justify-content-center min-vh-100"
  >
    <div class="card section-card login-card w-100" style="max-width: 400px">
      <div class="card-body">
        <img
          :src="logo"
          alt="FHM"
          class="mx-auto d-block mb-3"
          style="max-height: 80px"
        />
        <h2 class="mb-3 text-center">Авторизация</h2>
        <transition name="fade">
          <div
            v-if="error"
            class="alert alert-danger"
            role="alert"
            aria-live="polite"
          >
            {{ error }}
          </div>
        </transition>
        <form @submit.prevent="login">
          <div class="form-floating mb-3">
            <input
              id="phone"
              v-model="phoneInput"
              type="tel"
              class="form-control"
              placeholder="+7 (___) ___-__-__"
              autocomplete="tel"
              inputmode="numeric"
              required
              @input="onPhoneInput"
              @keydown="onPhoneKeydown"
            />
            <label for="phone">Телефон</label>
          </div>
          <PasswordInput
            id="password"
            v-model="password"
            class="mb-3"
            label="Пароль"
            placeholder="Пароль"
            autocomplete="current-password"
            :required="true"
          />
          <button
            type="submit"
            class="btn btn-brand btn-lg w-100"
            :disabled="loading"
          >
            <span
              v-if="loading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Войти
          </button>
          <div class="text-center mt-3">
            <RouterLink to="/register" class="link-secondary me-3"
              >Регистрация</RouterLink
            >
            <RouterLink to="/password-reset" class="link-secondary"
              >Забыли пароль?</RouterLink
            >
          </div>
        </form>
      </div>
    </div>
    <CookieNotice />
  </div>
</template>

<style scoped>
.login-card {
  animation: fade-in 0.4s ease-out;
}

@media (max-width: 575.98px) {
  .auth-page {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
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
