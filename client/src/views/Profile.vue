<script setup>
import { ref, onMounted, reactive, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { Toast, Tooltip } from 'bootstrap';
import { apiFetch } from '../api.js';

const placeholderSections = [
  'Банковские реквизиты',
  'Тип налогообложения',
  'Выданный инвентарь',
];

const user = ref(null);
const toastRef = ref(null);
const code = ref('');
const codeSent = ref(false);
const verifyError = ref('');
const passport = ref(null);
const passportError = ref('');
const inn = ref(null);
const snils = ref(null);
const innError = ref('');
const snilsError = ref('');
const loading = reactive({
  user: false,
  passport: false,
  inn: false,
  snils: false,
});
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
  loading.user = true;
  try {
    const data = await apiFetch('/users/me');
    user.value = data.user;
    await nextTick();
    document
      .querySelectorAll('[data-bs-toggle="tooltip"]')
      .forEach((el) => new Tooltip(el));
  } catch (_err) {
    user.value = null;
  } finally {
    loading.user = false;
  }
}

async function fetchPassport() {
  loading.passport = true;
  try {
    const data = await apiFetch('/passports/me');
    passport.value = data.passport;
    passportError.value = '';
  } catch (e) {
    passportError.value = e.message;
    passport.value = null;
  } finally {
    loading.passport = false;
  }
}

async function fetchInn() {
  loading.inn = true;
  try {
    const data = await apiFetch('/inns/me');
    inn.value = data.inn;
    innError.value = '';
  } catch (e) {
    innError.value = e.message;
    inn.value = null;
  } finally {
    loading.inn = false;
  }
}

async function fetchSnils() {
  loading.snils = true;
  try {
    const data = await apiFetch('/snils/me');
    snils.value = data.snils;
    snilsError.value = '';
  } catch (e) {
    snilsError.value = e.message;
    snils.value = null;
  } finally {
    loading.snils = false;
  }
}
onMounted(() => {
  fetchProfile();
  fetchPassport();
  fetchInn();
  fetchSnils();
});
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
    <div v-if="loading.user" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else-if="user">
      <div class="mb-4">
        <div class="card tile fade-in">
          <div class="card-body">
            <h5 class="card-title mb-3">Основные данные</h5>
            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
              <div class="col">
                <label class="form-label">Фамилия</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-person-fill"></i></span>
                  <input
                    type="text"
                    class="form-control"
                    :value="user.last_name"
                    readonly
                  />
                </div>
              </div>
              <div class="col">
                <label class="form-label">Имя</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-person-fill"></i></span>
                  <input
                    type="text"
                    class="form-control"
                    :value="user.first_name"
                    readonly
                  />
                </div>
              </div>
              <div class="col">
                <label class="form-label">Отчество</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-person-fill"></i></span>
                  <input
                    type="text"
                    class="form-control"
                    :value="user.patronymic"
                    readonly
                  />
                </div>
              </div>
              <div class="col">
                <label class="form-label">Дата рождения</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-calendar-event"></i></span>
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
      </div>
      <div class="mb-4">
        <div class="card tile fade-in">
          <div class="card-body">
            <h5 class="card-title mb-3">Контакты</h5>
            <div class="row row-cols-1 row-cols-sm-2 g-3">
              <div class="col">
                <label class="form-label">Телефон</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                  <input type="text" class="form-control" :value="user.phone" readonly />
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="copyToClipboard(user.phone)"
                    title="Скопировать"
                    aria-label="Скопировать телефон"
                    data-bs-toggle="tooltip"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>
              <div class="col">
                <label class="form-label">Email</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                  <input type="text" class="form-control" :value="user.email" readonly />
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="copyToClipboard(user.email)"
                    title="Скопировать"
                    aria-label="Скопировать email"
                    data-bs-toggle="tooltip"
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
      <div class="mb-4" v-if="passport || passportError || loading.passport">
        <div class="card tile fade-in">
          <div class="card-body">
            <h5 class="card-title mb-3">Паспорт</h5>
            <div v-if="loading.passport" class="text-center py-4">
              <div class="spinner-border" role="status" aria-label="Загрузка">
                <span class="visually-hidden">Загрузка…</span>
              </div>
            </div>
            <div v-else-if="passport">
              <div class="row row-cols-1 row-cols-sm-2 g-3">
                <div class="col">
                  <label class="form-label">Тип документа</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-card-text"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.document_type_name"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Страна</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-globe"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.country_name"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Серия</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-hash"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.series"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Номер</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-file-text"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.number"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Дата выдачи</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-calendar-event"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.issue_date"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Действителен до</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-calendar-check"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.valid_until"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Кем выдан</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-building"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.issuing_authority"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Код подразделения</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-123"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.issuing_authority_code"
                      readonly
                    />
                  </div>
                </div>
                <div class="col">
                  <label class="form-label">Место рождения</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-geo-alt"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      :value="passport.place_of_birth"
                      readonly
                    />
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="mb-0 text-muted">{{ passportError || 'Паспортные данные не найдены.' }}</p>
          </div>
        </div>
      </div>
      <div class="mb-4" v-if="inn || snils || innError || snilsError || loading.inn || loading.snils">
        <div class="card tile fade-in">
          <div class="card-body">
            <h5 class="card-title mb-3">ИНН и СНИЛС</h5>
            <div v-if="loading.inn || loading.snils" class="text-center py-4">
              <div class="spinner-border" role="status" aria-label="Загрузка">
                <span class="visually-hidden">Загрузка…</span>
              </div>
            </div>
            <div v-else-if="inn || snils">
              <div class="row row-cols-1 row-cols-sm-2 g-3">
                <div class="col" v-if="inn">
                  <label class="form-label">ИНН</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-briefcase"></i></span>
                    <input type="text" class="form-control" :value="inn.number" readonly />
                  </div>
                </div>
                <div class="col" v-if="snils">
                  <label class="form-label">СНИЛС</label>
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-card-checklist"></i></span>
                    <input type="text" class="form-control" :value="snils.number" readonly />
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="mb-0 text-muted">{{ innError || snilsError || 'Данные отсутствуют.' }}</p>
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
