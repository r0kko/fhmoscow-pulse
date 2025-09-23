<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import CookieNotice from '../components/CookieNotice.vue';
import PasswordInput from '../components/PasswordInput.vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch, initCsrf } from '../api';
import { auth, setAuthToken, type AuthUser } from '../auth';

const logo = '/vite.svg' as const;

interface LoginResponse {
  access_token: string;
  user: AuthUser;
  roles?: string[];
  must_change_password?: boolean;
  awaiting_confirmation?: boolean;
}

const router = useRouter();

const phone = ref<string>('');
const phoneInput = ref<string>('');
const password = ref<string>('');
const error = ref<string>('');
const loading = ref(false);

let errorTimer: ReturnType<typeof setTimeout> | null = null;

watch(error, (val) => {
  if (!val) return;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    error.value = '';
    errorTimer = null;
  }, 4000);
});

onBeforeUnmount(() => {
  if (errorTimer) clearTimeout(errorTimer);
});

function formatPhone(digits: string): string {
  if (!digits) return '';
  let formatted = '+7';
  const rest = digits.slice(1);
  if (rest.length > 0) formatted += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) formatted += ') ';
  if (rest.length >= 3) formatted += rest.slice(3, 6);
  if (rest.length >= 6) formatted += `-${rest.slice(6, 8)}`;
  if (rest.length >= 8) formatted += `-${rest.slice(8, 10)}`;
  return formatted;
}

function normalisePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  digits = digits.replace(/^[78]/, '7');
  if (!digits.startsWith('7')) digits = `7${digits}`;
  return digits.slice(0, 11);
}

function onPhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  const digits = normalisePhone(target?.value ?? '');
  phone.value = digits;
  phoneInput.value = formatPhone(digits);
}

function onPhoneKeydown(event: KeyboardEvent): void {
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    const shortenedRaw = phone.value.slice(0, -1);
    const shortened = shortenedRaw.length <= 1 ? '' : shortenedRaw;
    phone.value = shortened;
    phoneInput.value = formatPhone(shortened);
  }
}

async function login(): Promise<void> {
  error.value = '';
  if (phone.value.length !== 11 || !phone.value.startsWith('7')) {
    error.value = 'Неверный номер телефона';
    return;
  }
  loading.value = true;
  try {
    await initCsrf();
    const data = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.value, password: password.value }),
      redirectOn401: false,
    });
    setAuthToken(data.access_token);
    auth.user = data.user;
    auth.roles = data.roles || [];
    auth.mustChangePassword = Boolean(data.must_change_password);

    let destination = '/';
    if (auth.mustChangePassword) {
      destination = '/change-password';
    } else if (
      data.awaiting_confirmation ||
      auth.user?.status === 'AWAITING_CONFIRMATION'
    ) {
      destination = '/awaiting-confirmation';
    } else if (auth.user?.status?.startsWith('REGISTRATION_STEP')) {
      destination = '/complete-profile';
    }

    await router.push(destination);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Ошибка авторизации';
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
