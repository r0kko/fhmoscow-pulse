<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api';
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
const normalizedEmail = computed(() => email.value.trim().toLowerCase());
const isEmailValid = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail.value)
);
const sanitizedCode = computed(() => code.value.replace(/\s+/g, ''));
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

watch(error, (val) => {
  if (val) {
    setTimeout(() => {
      error.value = '';
    }, 4000);
  }
});

async function start() {
  error.value = '';
  loading.value = true;
  try {
    await apiFetch('/password-reset/start', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail.value }),
    });
    step.value = 2;
    await nextTick();
    const el = document.getElementById('code');
    el?.focus?.();
  } catch (err) {
    error.value = err.message || 'Ошибка';
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
  loading.value = true;
  try {
    await apiFetch('/password-reset/finish', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedEmail.value,
        code: sanitizedCode.value,
        password: password.value,
      }),
    });
    await router.push('/login');
  } catch (err) {
    error.value = err.message || 'Ошибка';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="d-flex flex-column align-items-center justify-content-center min-vh-100"
  >
    <div class="card section-card login-card w-100" style="max-width: 400px">
      <div class="card-body">
        <h1 class="mb-3 text-center">Восстановление пароля</h1>
        <transition name="fade">
          <div v-if="error" class="alert alert-danger" aria-live="polite">
            {{ error }}
          </div>
        </transition>
        <form v-if="step === 1" novalidate @submit.prevent="start">
          <div class="form-floating mb-3">
            <input
              id="email"
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
              @input="
                (e) =>
                  (email.value = (e?.target?.value || '')
                    .trimStart()
                    .toLowerCase())
              "
              @keydown.enter.prevent="start"
            />
            <label for="email">Email</label>
          </div>
          <button
            type="submit"
            class="btn btn-brand btn-lg w-100 submit-btn"
            :disabled="!canSubmitStart"
            :aria-busy="loading ? 'true' : 'false'"
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
          </p>
          <div class="form-floating mb-3">
            <input
              id="code"
              v-model="code"
              class="form-control"
              placeholder="Код"
              required
              inputmode="numeric"
              autocomplete="one-time-code"
            />
            <label for="code">Код из письма</label>
          </div>
          <div class="mb-2">
            <PasswordInput
              id="password"
              v-model="password"
              label="Новый пароль"
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
            class="btn btn-brand btn-lg w-100 submit-btn"
            :disabled="!canSubmitFinish"
            :aria-busy="loading ? 'true' : 'false'"
          >
            <span
              v-if="loading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Сохранить пароль
          </button>
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
  .login-card .card-body {
    padding: 0.75rem;
  }
}
.submit-btn {
  min-height: 44px;
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
