<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { auth, setAuthToken } from '../auth.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.vue';
import PasswordInput from '../components/PasswordInput.vue';

const router = useRouter();
const current = ref('');
const password = ref('');
const confirm = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  if (!password.value || password.value !== confirm.value) {
    error.value = 'Пароли не совпадают';
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
    router.push('/');
  } catch (e) {
    error.value = e.message || 'Не удалось изменить пароль';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 560px">
    <h1 class="mb-3">Смена пароля</h1>
    <p class="text-muted">
      Для продолжения работы необходимо задать новый пароль.
    </p>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div class="card section-card">
      <div class="card-body">
        <form @submit.prevent="submit">
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
          />
          <PasswordStrengthMeter class="mb-3" :password="password" />
          <PasswordInput
            id="confirm"
            v-model="confirm"
            class="mb-3"
            label="Подтвердите пароль"
            placeholder="Подтверждение пароля"
            autocomplete="new-password"
            :required="true"
          />
          <button type="submit" class="btn btn-brand" :disabled="loading">
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
