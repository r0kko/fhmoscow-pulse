<script setup>
import { ref, onMounted, reactive, nextTick, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Toast from 'bootstrap/js/dist/toast';
import Tooltip from 'bootstrap/js/dist/tooltip';
import { apiFetch } from '../api.js';
import TaxationInfo from '../components/TaxationInfo.vue';
import InfoField from '../components/InfoField.vue';

// Placeholder sections hidden until inventory feature is ready
const placeholderSections = [];

const noDataPlaceholder = '—';

const user = ref(null);
const toastRef = ref(null);
const toastMessage = ref('');
const code = ref('');
const codeSent = ref(false);
const verifyError = ref('');
const passport = ref();
const passportError = ref('');
const inn = ref();
const snils = ref();
const innError = ref('');
const snilsError = ref('');
const bankAccount = ref();
const bankAccountError = ref('');
const maskedAccountNumber = computed(() => {
  if (!bankAccount.value?.number) return noDataPlaceholder;
  const num = bankAccount.value.number;
  return '···· ' + (num.length > 4 ? num.slice(-4) : num);
});
const sectionNav = computed(() =>
  [
    { id: 'basic', label: 'Основные данные', show: true },
    { id: 'contacts', label: 'Контакты', show: true },
    {
      id: 'passport',
      label: 'Паспорт',
      show:
        passport.value !== undefined ||
        passportError.value ||
        loading.passport,
    },
    {
      id: 'tax',
      label: 'ИНН и СНИЛС',
      show:
        inn.value !== undefined ||
        snils.value !== undefined ||
        innError.value ||
        snilsError.value ||
        loading.inn ||
        loading.snils,
    },
    {
      id: 'bank',
      label: 'Банк',
      show:
        bankAccount.value !== undefined ||
        bankAccountError.value ||
        loading.bankAccount,
    },
  ].filter((s) => s.show)
);
const loading = reactive({
  user: false,
  passport: false,
  inn: false,
  snils: false,
  bankAccount: false,
});
let toast;

function initTooltips() {
  document
    .querySelectorAll('[data-bs-toggle="tooltip"]')
    .forEach((el) => new Tooltip(el));
}

function formatPhone(digits) {
  if (!digits) return '';
  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += '-' + digits.slice(7, 9);
  if (digits.length >= 9) out += '-' + digits.slice(9, 11);
  return out;
}

function formatDate(str) {
  if (!str) return '';
  const [year, month, day] = str.split('-');
  return `${day}.${month}.${year}`;
}

function maskPassportNumber(num) {
  if (!num) return '';
  const start = num.slice(0, 1);
  const end = num.slice(-1);
  return start + '*'.repeat(num.length - 2) + end;
}

function showToast(message) {
  toastMessage.value = message;
  if (!toast) {
    toast = new Toast(toastRef.value);
  }
  toast.show();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано');
  } catch (_err) {
    showToast('Не удалось скопировать');
  }
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
    initTooltips();
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
    await nextTick();
    initTooltips();
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
    await nextTick();
    initTooltips();
  } catch (e) {
    snilsError.value = e.message;
    snils.value = null;
  } finally {
    loading.snils = false;
  }
}

async function fetchBankAccount() {
  loading.bankAccount = true;
  try {
    const data = await apiFetch('/bank-accounts/me');
    bankAccount.value = data.account;
    bankAccountError.value = '';
    await nextTick();
    initTooltips();
  } catch (e) {
    bankAccountError.value = e.message;
    bankAccount.value = null;
  } finally {
    loading.bankAccount = false;
  }
}
onMounted(() => {
  fetchProfile();
  fetchPassport();
  fetchInn();
  fetchSnils();
  fetchBankAccount();
});
</script>

<template>
  <div class="py-3 profile-page">
    <div class="container">
    <nav aria-label="breadcrumb" class="mb-2">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">
          Персональные данные
        </li>
      </ol>
    </nav>
    <h1 class="mb-3">Личная информация</h1>
    <div v-if="loading.user" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else-if="user">
      <div class="row">
        <div class="col-lg-9">
          <section id="basic" class="mb-4">
            <div class="card section-card tile fade-in shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Основные данные</h5>
                <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
                  <div class="col">
                    <InfoField
                      id="lastName"
                      label="Фамилия"
                      :value="user.last_name"
                    />
                  </div>
                  <div class="col">
                    <InfoField
                      id="firstName"
                      label="Имя"
                      :value="user.first_name"
                    />
                  </div>
                  <div class="col">
                    <InfoField
                      id="patronymic"
                      label="Отчество"
                      :value="user.patronymic"
                    />
                  </div>
                  <div class="col">
                    <InfoField
                      id="birthDate"
                      label="Дата рождения"
                      icon="bi bi-calendar-event"
                      :value="user.birth_date ? formatDate(user.birth_date) : ''"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section id="contacts" class="mb-4">
            <div class="card section-card tile fade-in shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Контакты</h5>
                <div class="row row-cols-1 row-cols-sm-2 g-3">
                  <div class="col">
                    <InfoField
                      id="userPhone"
                      label="Телефон"
                      icon="bi bi-telephone"
                      :value="user.phone ? formatPhone(user.phone) : ''"
                      :copyable="!!user.phone"
                      @copy="copyToClipboard(user.phone)"
                    />
                  </div>
                  <div class="col">
                    <InfoField
                      id="userEmail"
                      label="Email"
                      icon="bi bi-envelope"
                      :value="user.email"
                      :copyable="!!user.email"
                      @copy="copyToClipboard(user.email)"
                    />
                  </div>
                </div>
                <div v-if="!user.email_confirmed" class="mt-3">
                  <div class="alert alert-warning p-2">
                    Email не подтверждён.
                    <button
                      class="btn btn-sm btn-brand ms-2"
                      @click="sendCode"
                    >
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
                    <button class="btn btn-brand" @click="confirmCode">
                      Подтвердить
                    </button>
                  </div>
                  <div v-if="verifyError" class="text-danger mt-1">
                    {{ verifyError }}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section
            id="passport"
            class="mb-4"
            v-if="passport !== undefined || passportError || loading.passport"
          >
            <div class="card section-card tile fade-in shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Документ, удостоверяющий личность</h5>
                <div v-if="loading.passport" class="text-center py-4">
                  <div class="spinner-border" role="status" aria-label="Загрузка">
                    <span class="visually-hidden">Загрузка…</span>
                  </div>
                </div>
                <div v-else-if="passport">
                  <div class="row row-cols-1 row-cols-sm-2 g-3">
                <div class="col">
                  <InfoField
                    id="docType"
                    label="Тип документа"
                    icon="bi bi-card-text"
                    :value="passport.document_type_name || ''"
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="passportCountry"
                    label="Страна"
                    icon="bi bi-globe"
                    :value="passport.country_name || ''"
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="passportSerial"
                    label="Серия и номер"
                    icon="bi bi-file-earmark-text"
                    :value="
                      passport.series + ' ' + maskPassportNumber(passport.number)
                    "
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="passportValidity"
                    label="Срок действия"
                    icon="bi bi-calendar"
                    :value="
                      passport.issue_date && passport.valid_until
                        ?
                            formatDate(passport.issue_date) +
                            ' - ' +
                            formatDate(passport.valid_until)
                        : ''
                    "
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="passportAuthority"
                    label="Кем выдан"
                    icon="bi bi-building"
                    :value="
                      passport.issuing_authority && passport.issuing_authority_code
                        ?
                            passport.issuing_authority + ' (' +
                            passport.issuing_authority_code + ')'
                        : ''
                    "
                  />
                </div>
                <div class="col">
                  <InfoField
                    id="passportBirthplace"
                    label="Место рождения"
                    icon="bi bi-geo-alt"
                    :value="passport.place_of_birth || ''"
                  />
                </div>
              </div>
            </div>
                <p v-else class="mb-0 text-muted">
                  {{ passportError || 'Паспортные данные не найдены.' }}
                </p>
              </div>
            </div>
          </section>
          <section
            id="tax"
            class="mb-4"
            v-if="
              inn !== undefined ||
              snils !== undefined ||
              innError ||
              snilsError ||
              loading.inn ||
              loading.snils
            "
          >
            <div class="card section-card tile fade-in shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Данные социального и налогового учёта</h5>
                <div v-if="loading.inn || loading.snils" class="text-center py-4">
                  <div class="spinner-border" role="status" aria-label="Загрузка">
                    <span class="visually-hidden">Загрузка…</span>
                  </div>
                </div>
                <div v-else-if="inn || snils">
                  <div class="row row-cols-1 row-cols-sm-2 g-3">
                    <div class="col" v-if="inn">
                      <InfoField
                        id="innNumber"
                        label="ИНН"
                        icon="bi bi-briefcase"
                        :value="inn.number"
                        :copyable="!!inn.number"
                        @copy="copyToClipboard(inn.number)"
                      />
                    </div>
                    <div class="col" v-if="snils">
                      <InfoField
                        id="snilsNumber"
                        label="СНИЛС"
                        icon="bi bi-card-checklist"
                        :value="snils.number"
                        :copyable="!!snils.number"
                        @copy="copyToClipboard(snils.number)"
                      />
                    </div>
                  </div>
                </div>
                <p v-else class="mb-0 text-muted">
                  {{ innError || snilsError || 'Данные отсутствуют.' }}
                </p>
              </div>
            </div>
            <TaxationInfo class="mt-4" :editable="false" :showOkved="false" />
          </section>
          <section
            id="bank"
            class="mb-4"
            v-if="
              bankAccount !== undefined || bankAccountError || loading.bankAccount
            "
          >
            <div class="card section-card tile fade-in shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Банковские реквизиты</h5>
                <div v-if="loading.bankAccount" class="text-center py-4">
                  <div class="spinner-border" role="status" aria-label="Загрузка">
                    <span class="visually-hidden">Загрузка…</span>
                  </div>
                </div>
                <div v-else-if="bankAccount">
                  <div class="row row-cols-1 row-cols-sm-2 g-3">
                    <div class="col">
                      <InfoField
                        id="accNumber"
                        label="Счёт"
                        icon="bi bi-credit-card"
                        :value="maskedAccountNumber"
                        :copyable="!!bankAccount.number"
                        @copy="copyToClipboard(bankAccount.number)"
                      />
                    </div>
                    <div class="col">
                      <InfoField
                        id="accBic"
                        label="БИК"
                        icon="bi bi-123"
                        :value="bankAccount.bic"
                        :copyable="!!bankAccount.bic"
                        @copy="copyToClipboard(bankAccount.bic)"
                      />
                    </div>
                    <div class="col">
                      <InfoField
                        id="accBank"
                        label="Банк"
                        icon="bi bi-bank"
                        :value="bankAccount.bank_name"
                      />
                    </div>
                    <div class="col">
                      <InfoField
                        id="accCorr"
                        label="Корсчёт"
                        icon="bi bi-building"
                        :value="bankAccount.correspondent_account"
                        :copyable="!!bankAccount.correspondent_account"
                        @copy="copyToClipboard(bankAccount.correspondent_account)"
                      />
                    </div>
                  </div>
                </div>
                <p v-else class="mb-0 text-muted">
                  {{ bankAccountError || 'Банковский счёт не найден.' }}
                </p>
              </div>
            </div>
          </section>
          <div v-for="section in placeholderSections" :key="section" class="mb-4">
            <div class="card placeholder-card text-center">
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
        <div class="col-lg-3 d-none d-lg-block">
          <nav aria-hidden="true" class="profile-nav sticky-top" style="top: 20px">
            <ul class="nav flex-column">
              <li class="nav-item" v-for="s in sectionNav" :key="s.id">
                <a class="nav-link py-1" :href="'#' + s.id">{{ s.label }}</a>
              </li>
            </ul>
          </nav>
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
        <div class="toast-body">{{ toastMessage }}</div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.placeholder-card {
  opacity: 0.6;
  cursor: default;
}
.placeholder-card:hover {
  transform: none;
  box-shadow: none;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}


.profile-nav .nav-link {
  color: var(--bs-body-color);
}

.profile-nav .nav-link:hover {
  color: var(--bs-primary);
}

@media (max-width: 575.98px) {
  .profile-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .profile-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .profile-page h1 {
    margin-bottom: 1rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
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
