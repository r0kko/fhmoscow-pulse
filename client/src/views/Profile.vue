<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Toast } from 'bootstrap';
import { apiFetch } from '../api.js';

const placeholderSections = [
  'Паспорт',
  'ИНН и СНИЛС',
  'Банковские реквизиты',
  'Тип налогообложения',
  'Выданный инвентарь',
];

const user = ref(null);
const toastRef = ref(null);
const code = ref('');
const codeSent = ref(false);
const verifyError = ref('');
let toast;

function showToast() {
  if (!toast) {
    toast = new Toast(toastRef.value);
  }
  toast.show();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast();
}

async function sendCode() {
  try {
    await apiFetch('/email/send-code', { method: 'POST' });
    codeSent.value = true;
    verifyError.value = '';
  } catch (e) {
    verifyError.value = e.message;
  }
}

async function confirmCode() {
  try {
    await apiFetch('/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: code.value }),
    });
    code.value = '';
    codeSent.value = false;
    verifyError.value = '';
    await fetchProfile();
  } catch (e) {
    verifyError.value = e.message;
  }
}

async function fetchProfile() {
  try {
    const data = await apiFetch('/users/me');
    user.value = data.user;
  } catch (_err) {
    user.value = null;
  }
}

onMounted(fetchProfile);
</script>

<template>
  <div class="container my-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">
          Персональные данные
        </li>
      </ol>
    </nav>
    <h1 class="mb-4">Личная информация</h1>
    <div v-if="user">
      <div class="mb-4">
        <div class="card tile fade-in">
          <div class="card-body">
            <h5 class="card-title mb-3">Основные данные</h5>
            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
              <div class="col">
                <label class="form-label">Фамилия</label>
                <input
                  type="text"
                  class="form-control"
                  :value="user.last_name"
                  readonly
                />
              </div>
              <div class="col">
                <label class="form-label">Имя</label>
                <input
                  type="text"
                  class="form-control"
                  :value="user.first_name"
                  readonly
                />
              </div>
              <div class="col">
                <label class="form-label">Отчество</label>
                <input
                  type="text"
                  class="form-control"
                  :value="user.patronymic"
                  readonly
                />
              </div>
              <div class="col">
                <label class="form-label">Дата рождения</label>
                <input
                  type="text"
                  class="form-control"
                  :value="user.birth_date"
                  readonly
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="mb-4">
        <div class="card tile fade-in">
          <div class="card-body">
            <h5 class="card-title mb-3">Контакты</h5>
            <div class="row row-cols-1 row-cols-sm-2 g-3">
              <div class="col">
                <label class="form-label">Телефон</label>
                <div class="input-group">
                  <input
                    type="text"
                    class="form-control"
                    :value="user.phone"
                    readonly
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="copyToClipboard(user.phone)"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>
              <div class="col">
                <label class="form-label">Email</label>
                <div class="input-group">
                  <input
                    type="text"
                    class="form-control"
                    :value="user.email"
                    readonly
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="copyToClipboard(user.email)"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="!user.email_confirmed" class="mt-3">
              <div class="alert alert-warning p-2">
                Email не подтверждён.
                <button class="btn btn-sm btn-primary ms-2" @click="sendCode">
                  Отправить код
                </button>
              </div>
              <div v-if="codeSent" class="input-group mt-2">
                <input
                  type="text"
                  class="form-control"
                  v-model="code"
                  maxlength="6"
                  placeholder="Код из письма"
                />
                <button class="btn btn-primary" @click="confirmCode">
                  Подтвердить
                </button>
              </div>
              <div v-if="verifyError" class="text-danger mt-1">{{ verifyError }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-for="section in placeholderSections" :key="section" class="mb-4">
        <div class="card tile placeholder-card text-center">
          <div
            class="card-body d-flex flex-column align-items-center justify-content-center"
          >
            <i class="bi bi-clock mb-2 fs-2"></i>
            <h5 class="card-title mb-1">{{ section }}</h5>
            <p class="mb-0">Информация будет доступна позже</p>
          </div>
        </div>
      </div>
    </div>
    <p v-else>Данные пользователя не найдены.</p>
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div
        ref="toastRef"
        class="toast text-bg-secondary"
        role="status"
        data-bs-delay="1500"
        data-bs-autohide="true"
      >
        <div class="toast-body">Скопировано</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
}
.tile:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.placeholder-card {
  opacity: 0.6;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
