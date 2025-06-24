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

function formatPhone(digits) {
  if (!digits) return ''
  let out = '+7'
  if (digits.length > 1) out += ' (' + digits.slice(1, 4)
  if (digits.length >= 4) out += ') '
  if (digits.length >= 4) out += digits.slice(4, 7)
  if (digits.length >= 7) out += '-' + digits.slice(7, 9)
  if (digits.length >= 9) out += '-' + digits.slice(9, 11)
  return out
}

function formatDate(str) {
  if (!str) return ''
  const [year, month, day] = str.split('-')
  return `${day}.${month}.${year}`
}

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
                <div class="form-floating">
                  <input
                    id="lastName"
                    type="text"
                    class="form-control"
                    :value="user.last_name"
                    readonly
                    placeholder="Фамилия"
                  />
                  <label for="lastName">Фамилия</label>
                </div>
              </div>
              <div class="col">
                <div class="form-floating">
                  <input
                    id="firstName"
                    type="text"
                    class="form-control"
                    :value="user.first_name"
                    readonly
                    placeholder="Имя"
                  />
                  <label for="firstName">Имя</label>
                </div>
              </div>
              <div class="col">
                <div class="form-floating">
                  <input
                    id="patronymic"
                    type="text"
                    class="form-control"
                    :value="user.patronymic"
                    readonly
                    placeholder="Отчество"
                  />
                  <label for="patronymic">Отчество</label>
                </div>
              </div>
              <div class="col">
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-calendar-event"></i></span>
                  <div class="form-floating flex-grow-1">
                    <input
                      id="birthDate"
                      type="text"
                      class="form-control"
                      :value="formatDate(user.birth_date)"
                      readonly
                      placeholder="Дата рождения"
                    />
                    <label for="birthDate">Дата рождения</label>
                  </div>
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
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                  <div class="form-floating flex-grow-1">
                    <input
                      id="userPhone"
                      type="text"
                      class="form-control"
                      :value="formatPhone(user.phone)"
                      readonly
                      placeholder="Телефон"
                    />
                    <label for="userPhone">Телефон</label>
                  </div>
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
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                  <div class="form-floating flex-grow-1">
                    <input
                      id="userEmail"
                      type="text"
                      class="form-control"
                      :value="user.email"
                      readonly
                      placeholder="Email"
                    />
                    <label for="userEmail">Email</label>
                  </div>
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
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-card-text"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="docType"
                        type="text"
                        class="form-control"
                        :value="passport.document_type_name"
                        readonly
                        placeholder="Тип документа"
                      />
                      <label for="docType">Тип документа</label>
                    </div>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-globe"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="passportCountry"
                        type="text"
                        class="form-control"
                        :value="passport.country_name"
                        readonly
                        placeholder="Страна"
                      />
                      <label for="passportCountry">Страна</label>
                    </div>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-file-earmark-text"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="passportSerial"
                        type="text"
                        class="form-control"
                        :value="passport.series + ' ' + passport.number"
                        readonly
                        placeholder="Серия и номер"
                      />
                      <label for="passportSerial">Серия и номер</label>
                    </div>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-calendar"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="passportValidity"
                        type="text"
                        class="form-control"
                        :value="formatDate(passport.issue_date) + ' - ' + formatDate(passport.valid_until)"
                        readonly
                        placeholder="Срок действия"
                      />
                      <label for="passportValidity">Срок действия</label>
                    </div>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-building"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="passportAuthority"
                        type="text"
                        class="form-control"
                        :value="passport.issuing_authority + ' (' + passport.issuing_authority_code + ')'"
                        readonly
                        placeholder="Кем выдан"
                      />
                      <label for="passportAuthority">Кем выдан</label>
                    </div>
                  </div>
                </div>
                <div class="col">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-geo-alt"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="passportBirthplace"
                        type="text"
                        class="form-control"
                        :value="passport.place_of_birth"
                        readonly
                        placeholder="Место рождения"
                      />
                      <label for="passportBirthplace">Место рождения</label>
                    </div>
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
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-briefcase"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="innNumber"
                        type="text"
                        class="form-control"
                        :value="inn.number"
                        readonly
                        placeholder="ИНН"
                      />
                      <label for="innNumber">ИНН</label>
                    </div>
                  </div>
                </div>
                <div class="col" v-if="snils">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-card-checklist"></i></span>
                    <div class="form-floating flex-grow-1">
                      <input
                        id="snilsNumber"
                        type="text"
                        class="form-control"
                        :value="snils.number"
                        readonly
                        placeholder="СНИЛС"
                      />
                      <label for="snilsNumber">СНИЛС</label>
                    </div>
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
