<script setup>
import { ref, computed } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { auth, setAuthToken } from '../auth.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.vue';
import PasswordChecklist from '../components/PasswordChecklist.vue';
import PasswordInput from '../components/PasswordInput.vue';

const router = useRouter();
const current = ref('');
const password = ref('');
const confirm = ref('');
const error = ref('');
const loading = ref(false);

const passwordMeetsMin = computed(() => (password.value || '').length >= 8);
const passwordHasLetter = computed(() => /[A-Za-z]/.test(password.value || ''));
const passwordHasDigit = computed(() => /\d/.test(password.value || ''));
const passwordMeetsPolicy = computed(
  () =>
    passwordMeetsMin.value && passwordHasLetter.value && passwordHasDigit.value
);
const passwordsMatch = computed(
  () => (password.value || '') && password.value === confirm.value
);
const notSameAsCurrent = computed(
  () => !current.value || !password.value || current.value !== password.value
);
const canSubmit = computed(
  () =>
    !loading.value &&
    Boolean(current.value) &&
    passwordMeetsPolicy.value &&
    passwordsMatch.value &&
    notSameAsCurrent.value
);

async function submit() {
  error.value = '';
  if (!passwordsMatch.value) {
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
  if (!notSameAsCurrent.value) {
    error.value = 'Новый пароль не должен совпадать с текущим';
    return;
  }
  loading.value = true;
  try {
    const data = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: current.value,
        new_password: password.value,
      }),
    });
    setAuthToken(data.access_token);
    auth.user = data.user;
    auth.roles = data.roles || [];
    auth.mustChangePassword = false;
    await router.push('/');
  } catch (e) {
    error.value = e.message || 'Не удалось изменить пароль';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container change-password-page py-5" style="max-width: 560px">
    <h1 class="mb-3">Смена пароля</h1>
    <p class="text-muted">
      Для продолжения работы необходимо задать новый пароль.
    </p>
    <div v-if="error" class="alert alert-danger" aria-live="polite">
      {{ error }}
    </div>
    <div class="card section-card">
      <div class="card-body">
        <form novalidate @submit.prevent="submit">
          <PasswordInput
            id="current"
            v-model="current"
            class="mb-3"
            label="Текущий пароль"
            placeholder="Текущий пароль"
            autocomplete="current-password"
            :required="true"
          />
          <PasswordInput
            id="password"
            v-model="password"
            class="mb-3"
            label="Новый пароль"
            placeholder="Новый пароль"
            autocomplete="new-password"
            :required="true"
            :aria-invalid="
              !passwordMeetsMin && password.length > 0 ? 'true' : 'false'
            "
            aria-describedby="passwordHelp"
          />
          <PasswordStrengthMeter class="mb-2" :password="password" />
          <PasswordChecklist :password="password" />
          <small id="passwordHelp" class="text-muted d-block mb-2"
            >Минимум 8 символов. Обязательно: латинские буквы и цифры.
            Рекомендуем добавить спецсимволы.</small
          >
          <PasswordInput
            id="confirm"
            v-model="confirm"
            class="mb-3"
            label="Подтвердите пароль"
            placeholder="Подтверждение пароля"
            autocomplete="new-password"
            :required="true"
            :aria-invalid="
              !passwordsMatch && confirm.length > 0 ? 'true' : 'false'
            "
          />
          <button
            type="submit"
            class="btn btn-brand submit-btn"
            :disabled="!canSubmit"
            :aria-busy="loading ? 'true' : 'false'"
          >
            <span
              v-if="loading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Сохранить пароль
          </button>
          <RouterLink to="/logout" class="btn btn-link ms-2">Выйти</RouterLink>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 575.98px) {
  .change-password-page {
    padding-top: 1.25rem !important;
    padding-bottom: 1.25rem !important;
  }
}
.submit-btn {
  min-height: 44px;
}
</style>
