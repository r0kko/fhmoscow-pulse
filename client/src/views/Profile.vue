<script setup>
import { ref, onMounted, reactive, nextTick, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Toast from 'bootstrap/js/dist/toast';
import Tooltip from 'bootstrap/js/dist/tooltip';
import { apiFetch } from '../api.js';
import InfoField from '../components/InfoField.vue';

const noDataPlaceholder = '—';

const user = ref(null);
const toastRef = ref(null);
const toastMessage = ref('');
const code = ref('');
const codeSent = ref(false);
const verifyError = ref('');
const passport = ref();
const inn = ref();
const snils = ref();
const driverLicense = ref();
const bankAccount = ref();
const bankAccountError = ref('');
const maskedAccountNumber = computed(() => {
  if (!bankAccount.value?.number) return noDataPlaceholder;
  const num = bankAccount.value.number;
  return '···· ' + (num.length > 4 ? num.slice(-4) : num);
});
const sectionNav = computed(() =>
  [
    { id: 'documents', label: 'Документы', show: true },
    { id: 'contacts', label: 'Контакты', show: true },
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
  } catch (_e) {
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
    await nextTick();
    initTooltips();
  } catch (_e) {
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
    await nextTick();
    initTooltips();
  } catch (_e) {
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
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Персональные данные
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Документы и данные</h1>
      <div v-if="loading.user" class="text-center my-5">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else-if="user">
        <div class="row">
          <div class="col-lg-9">
            <section id="documents" class="mb-4">
              <div class="tiles-row" role="list">
                <div class="tile-col" role="listitem">
                  <component
                    :is="passport ? RouterLink : 'div'"
                    v-bind="passport ? { to: '/profile/doc/passport' } : {}"
                    class="card section-card tile h-100 fade-in shadow-sm text-decoration-none text-body"
                  >
                    <div class="card-body d-flex flex-column h-100">
                      <i class="bi bi-passport fs-3 icon-brand mb-2"></i>
                      <div class="mt-auto">
                        <h5 class="card-title mb-1">Паспорт РФ</h5>
                        <p class="card-text text-muted mb-0">
                          {{
                            passport
                              ? passport.series +
                                ' ' +
                                maskPassportNumber(passport.number)
                              : 'Отсутствует'
                          }}
                        </p>
                      </div>
                    </div>
                  </component>
                </div>
                <div class="tile-col" role="listitem">
                  <component
                    :is="inn ? RouterLink : 'div'"
                    v-bind="inn ? { to: '/profile/doc/inn' } : {}"
                    class="card section-card tile h-100 fade-in shadow-sm text-decoration-none text-body"
                  >
                    <div class="card-body d-flex flex-column h-100">
                      <i class="bi bi-person-badge fs-3 icon-brand mb-2"></i>
                      <div class="mt-auto">
                        <h5 class="card-title mb-1">ИНН</h5>
                        <p class="card-text text-muted mb-0">
                          {{ inn?.number || 'Отсутствует' }}
                        </p>
                      </div>
                    </div>
                  </component>
                </div>
                <div class="tile-col" role="listitem">
                  <component
                    :is="snils ? RouterLink : 'div'"
                    v-bind="snils ? { to: '/profile/doc/snils' } : {}"
                    class="card section-card tile h-100 fade-in shadow-sm text-decoration-none text-body"
                  >
                    <div class="card-body d-flex flex-column h-100">
                      <i class="bi bi-card-checklist fs-3 icon-brand mb-2"></i>
                      <div class="mt-auto">
                        <h5 class="card-title mb-1">СНИЛС</h5>
                        <p class="card-text text-muted mb-0">
                          {{ snils?.number || 'Отсутствует' }}
                        </p>
                      </div>
                    </div>
                  </component>
                </div>
                <div class="tile-col" role="listitem">
                  <component
                    :is="driverLicense ? RouterLink : 'div'"
                    v-bind="
                      driverLicense ? { to: '/profile/doc/driver-license' } : {}
                    "
                    class="card section-card tile h-100 fade-in shadow-sm text-decoration-none text-body"
                  >
                    <div class="card-body d-flex flex-column h-100">
                      <i class="bi bi-car-front fs-3 icon-brand mb-2"></i>
                      <div class="mt-auto">
                        <h5 class="card-title mb-1">
                          Водительское удостоверение
                        </h5>
                        <p class="card-text text-muted mb-0">
                          {{ driverLicense?.number || 'Отсутствует' }}
                        </p>
                      </div>
                    </div>
                  </component>
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
              id="bank"
              class="mb-4"
              v-if="
                bankAccount !== undefined ||
                bankAccountError ||
                loading.bankAccount
              "
            >
              <div class="card section-card tile fade-in shadow-sm">
                <div class="card-body">
                  <h5 class="card-title mb-3">Банковские реквизиты</h5>
                  <div v-if="loading.bankAccount" class="text-center py-4">
                    <div
                      class="spinner-border"
                      role="status"
                      aria-label="Загрузка"
                    >
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
                          @copy="
                            copyToClipboard(bankAccount.correspondent_account)
                          "
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
          </div>
          <div class="col-lg-3 d-none d-lg-block">
            <nav
              aria-hidden="true"
              class="profile-nav sticky-top"
              style="top: 20px"
            >
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

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

.tiles-row {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 1rem;
  padding-bottom: 0.25rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.tiles-row::-webkit-scrollbar {
  display: none;
}

.tiles-row > .tile-col {
  flex: 0 0 calc(70% - 0.5rem);
  scroll-snap-align: start;
}

@media (min-width: 576px) {
  .tiles-row {
    flex-wrap: wrap;
    overflow-x: visible;
  }
  .tiles-row > .tile-col {
    flex: 0 0 calc(50% - 0.5rem);
  }
}

@media (min-width: 992px) {
  .tiles-row > .tile-col {
    flex: 0 0 calc(25% - 0.75rem);
  }
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

  .tiles-row .section-card {
    margin-left: 0;
    margin-right: 0;
  }

  .tiles-row {
    margin-left: -1rem;
    margin-right: -1rem;
    padding-right: 1rem;
  }

  .tiles-row .card-body {
    padding: 0.75rem;
  }

  .tiles-row .card-title {
    font-size: 1rem;
  }

  .tiles-row .card-text {
    font-size: 0.875rem;
  }

  .tiles-row .icon-brand {
    font-size: 1.5rem;
  }

  .profile-page section {
    margin-bottom: 1rem !important;
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
