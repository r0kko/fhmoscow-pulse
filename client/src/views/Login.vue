<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import CookieNotice from '../components/CookieNotice.vue';
import PasswordInput from '../components/PasswordInput.vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch, type ApiError, initCsrf } from '../api';
import { auth, setAuthToken, type AuthUser } from '../auth';

const logo = '/vite.svg' as const;

interface LoginResponse {
  access_token: string;
  user: AuthUser;
  roles?: string[];
  must_change_password?: boolean;
}

const router = useRouter();

const phone = ref<string>('');
const phoneInput = ref<string>('');
const password = ref<string>('');
const error = ref<string>('');
const errorCode = ref<string | null>(null);
const loading = ref(false);
const lockoutSeconds = ref<number | null>(null);

let errorTimer: ReturnType<typeof setTimeout> | null = null;
let lockoutTimer: ReturnType<typeof setInterval> | null = null;

const hasActiveLockout = computed(() => {
  return (
    typeof lockoutSeconds.value === 'number' &&
    lockoutSeconds.value > 0 &&
    (errorCode.value === 'account_locked_temporary' ||
      errorCode.value === 'account_locked' ||
      error.value.toLowerCase().includes('слишком много попыток'))
  );
});

const showHelpAction = computed(() => {
  return (
    errorCode.value === 'account_locked_temporary' ||
    errorCode.value === 'account_locked' ||
    errorCode.value === 'account_inactive'
  );
});

const retryMessage = computed(() => {
  if (!hasActiveLockout.value || !lockoutSeconds.value) return '';
  const mins = Math.floor(lockoutSeconds.value / 60);
  const secs = lockoutSeconds.value % 60;
  if (mins > 0 && secs > 0) return `Повторите через ${mins} мин ${secs} сек`;
  if (mins > 0) return `Повторите через ${mins} мин`;
  return `Повторите через ${secs} с`;
});

watch(error, (val) => {
  if (!val) return;
  if (lockoutSeconds.value && hasActiveLockout.value) return;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    error.value = '';
    errorCode.value = null;
    errorTimer = null;
  }, 4000);
});

function clearLockoutTimer() {
  if (lockoutTimer) {
    clearInterval(lockoutTimer);
    lockoutTimer = null;
  }
  lockoutSeconds.value = null;
}

function startLockoutCountdown(retryAfterMs: number) {
  clearLockoutTimer();
  const totalSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  lockoutSeconds.value = totalSeconds;
  lockoutTimer = setInterval(() => {
    const next = Number(lockoutSeconds.value) - 1;
    if (next <= 0) {
      clearLockoutTimer();
      return;
    }
    lockoutSeconds.value = next;
  }, 1000);
}

function normalizeRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const candidate = (err as ApiError & { retryAfterMs?: unknown }).retryAfterMs;
  const details = (err as ApiError).details;
  const fromDetails =
    typeof details === 'object' && details !== null
      ? (details as { retryAfterMs?: unknown }).retryAfterMs
      : undefined;
  const ms = Number(candidate ?? fromDetails ?? 0);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

function isTempLockError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const apiError = err as ApiError;
  const code = String(apiError.code || '').toLowerCase();
  const details =
    apiError.details && typeof apiError.details === 'object'
      ? (apiError.details as { reason?: unknown })
      : undefined;
  const detailReason = details ? String(details.reason || '') : '';
  return (
    code === 'account_locked_temporary' ||
    code === 'account_locked' ||
    detailReason.toLowerCase() === 'temporary_lock'
  );
}

onBeforeUnmount(() => {
  if (errorTimer) clearTimeout(errorTimer);
  clearLockoutTimer();
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
    } else if (auth.user?.status?.startsWith('REGISTRATION_STEP')) {
      destination = '/complete-profile';
    }

    await router.push(destination);
  } catch (err: unknown) {
    const apiError = err as ApiError;
    error.value = apiError?.message || 'Ошибка авторизации';
    errorCode.value = apiError?.code || null;
    if (errorCode.value === 'account_inactive') {
      error.value = 'Аккаунт деактивирован';
    }
    const retryAfterMs = normalizeRetryAfterMs(apiError);
    if (isTempLockError(apiError) && retryAfterMs) {
      startLockoutCountdown(retryAfterMs);
    } else {
      clearLockoutTimer();
    }
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
            <div v-if="retryMessage" class="mt-2 small" aria-live="polite">
              {{ retryMessage }}
            </div>
            <div v-if="showHelpAction" class="mt-3">
              <RouterLink to="/password-reset" class="btn btn-link p-0"
                >Получить помощь/восстановить пароль</RouterLink
              >
            </div>
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
