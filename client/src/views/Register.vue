<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { auth, setAuthToken } from '../auth.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.vue';
import PasswordChecklist from '../components/PasswordChecklist.vue';
import PasswordInput from '../components/PasswordInput.vue';
import CookieNotice from '../components/CookieNotice.vue';

const router = useRouter();
const step = ref(1);
const email = ref('');
const code = ref('');
const password = ref('');
const confirm = ref('');
const error = ref('');
const loading = ref(false);
const resentAt = ref(0);
const now = ref(Date.now());
const emailInput = ref(null);
const codeInput = ref(null);

// Cooldown for resending code (seconds)
const RESEND_COOLDOWN = 60;
const secondsUntilResend = computed(() => {
  const diff = Math.ceil(
    (resentAt.value + RESEND_COOLDOWN * 1000 - now.value) / 1000
  );
  return Math.max(0, diff);
});

// Basic client-side validations (complement server-side)
const normalizedEmail = computed(() => email.value.trim().toLowerCase());
const isEmailValid = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail.value)
);
const sanitizedCode = computed(() =>
  code.value.replace(/\s+/g, '').toUpperCase()
);
const passwordMeetsMin = computed(() => password.value.length >= 8);
const passwordHasLetter = computed(() => /[A-Za-z]/.test(password.value));
const passwordHasDigit = computed(() => /\d/.test(password.value));
const passwordMeetsPolicy = computed(
  () =>
    passwordMeetsMin.value && passwordHasLetter.value && passwordHasDigit.value
);
const passwordsMatch = computed(
  () => password.value && password.value === confirm.value
);
const canSubmitStart = computed(() => isEmailValid.value && !loading.value);
const canSubmitFinish = computed(
  () =>
    sanitizedCode.value.length > 0 &&
    passwordMeetsPolicy.value &&
    passwordsMatch.value &&
    !loading.value
);

// tick timer for resend cooldown
if (typeof window !== 'undefined') {
  setInterval(() => {
    now.value = Date.now();
  }, 500);
}

watch(error, (val) => {
  if (val) {
    setTimeout(() => {
      error.value = '';
    }, 4000);
  }
});

function onEmailInput(e) {
  // normalize as user types without being disruptive
  email.value = (e?.target?.value ?? email.value).trimStart().toLowerCase();
}

function onCodeInput(e) {
  code.value = (e?.target?.value ?? code.value).replace(/\s+/g, '');
}

async function start() {
  error.value = '';
  loading.value = true;
  try {
    await apiFetch('/register/start', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail.value }),
    });
    step.value = 2;
    resentAt.value = Date.now();
    await nextTick();
    codeInput.value?.focus?.();
  } catch (err) {
    error.value = err.message || 'Ошибка регистрации';
  } finally {
    loading.value = false;
  }
}

async function finish() {
  error.value = '';
  if (password.value !== confirm.value) {
    error.value = 'Пароли не совпадают';
    return;
  }
  if (!passwordMeetsMin.value) {
    error.value = 'Минимальная длина пароля — 8 символов';
    return;
  }
  if (!passwordHasLetter.value || !passwordHasDigit.value) {
    error.value = 'Пароль должен содержать латинские буквы и цифры';
    return;
  }
  loading.value = true;
  try {
    const data = await apiFetch('/register/finish', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedEmail.value,
        code: sanitizedCode.value,
        password: password.value,
      }),
    });
    setAuthToken(data.access_token);
    auth.user = data.user;
    auth.roles = data.roles || [];
    await router.push('/complete-profile');
  } catch (err) {
    error.value = err.message || 'Ошибка регистрации';
  } finally {
    loading.value = false;
  }
}

async function resend() {
  if (secondsUntilResend.value > 0 || loading.value) return;
  await start();
}
</script>

<template>
  <div
    class="auth-page d-flex flex-column align-items-center justify-content-center min-vh-100"
  >
    <div class="card section-card login-card w-100" style="max-width: 400px">
      <div class="card-body">
        <h1 class="mb-3 text-center">Регистрация</h1>
        <p class="text-center mb-3">
          с использованием существующей учетной записи в личном кабинете судьи
        </p>
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
        <form v-if="step === 1" novalidate @submit.prevent="start">
          <div class="form-floating mb-3">
            <input
              id="email"
              ref="emailInput"
              v-model="email"
              type="email"
              class="form-control"
              placeholder="Email"
              autocomplete="email"
              autocapitalize="none"
              required
              :aria-invalid="
                !isEmailValid && email.length > 0 ? 'true' : 'false'
              "
              @input="onEmailInput"
              @keydown.enter.prevent="start"
            />
            <label for="email">Email</label>
          </div>
          <button
            type="submit"
            class="btn btn-brand btn-lg w-100"
            :disabled="!canSubmitStart"
          >
            <span
              v-if="loading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Отправить код
          </button>
          <div class="text-center mt-3">
            <RouterLink to="/login" class="link-secondary"
              >Назад ко входу</RouterLink
            >
          </div>
        </form>

        <form v-else novalidate @submit.prevent="finish">
          <p class="mb-3">
            На <strong>{{ normalizedEmail }}</strong> отправлен код
            подтверждения.
            <br />
            Если письмо не пришло, проверьте папку «Спам» или отправьте код
            повторно.
          </p>
          <div class="form-floating mb-3">
            <input
              id="code"
              ref="codeInput"
              v-model="code"
              class="form-control"
              placeholder="Код"
              required
              inputmode="numeric"
              autocomplete="one-time-code"
              @input="onCodeInput"
            />
            <label for="code">Код из письма</label>
          </div>
          <div class="mb-2">
            <PasswordInput
              id="password"
              v-model="password"
              label="Пароль"
              placeholder="Пароль"
              autocomplete="new-password"
              :required="true"
              :aria-invalid="
                !passwordMeetsMin && password.length > 0 ? 'true' : 'false'
              "
              aria-describedby="passwordHelp"
            />
          </div>
          <PasswordStrengthMeter class="mb-2" :password="password" />
          <PasswordChecklist :password="password" />
          <small id="passwordHelp" class="text-muted d-block mb-3"
            >Минимум 8 символов. Обязательно: латинские буквы и цифры.
            Рекомендуем добавить спецсимволы.</small
          >
          <div class="mb-3">
            <PasswordInput
              id="confirm"
              v-model="confirm"
              label="Повторите пароль"
              placeholder="Повторите пароль"
              autocomplete="new-password"
              :required="true"
              :aria-invalid="
                !passwordsMatch && confirm.length > 0 ? 'true' : 'false'
              "
            />
          </div>
          <button
            type="submit"
            class="btn btn-brand btn-lg w-100"
            :disabled="!canSubmitFinish"
          >
            <span
              v-if="loading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Завершить регистрацию
          </button>
          <div class="d-flex justify-content-end align-items-center mt-3">
            <button
              type="button"
              class="btn btn-link p-0"
              :disabled="secondsUntilResend > 0 || loading"
              @click="resend"
            >
              Отправить код повторно<span v-if="secondsUntilResend > 0">
                ({{ secondsUntilResend }}с)</span
              >
            </button>
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
/* no extra mobile overrides here; using global section-card/mobile.css */

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
