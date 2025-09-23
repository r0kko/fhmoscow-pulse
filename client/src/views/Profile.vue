<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api';
import InfoField from '../components/InfoField.vue';
import AddVehicleModal from '../components/AddVehicleModal.vue';
import ChangeBankRequisitesModal from '../components/ChangeBankRequisitesModal.vue';
import DocumentSignModal from '../components/DocumentSignModal.vue';
import { auth } from '../auth';

const noDataPlaceholder = '—';

const user = ref(null);
const code = ref('');
const codeSent = ref(false);
const verifyError = ref('');
const passport = ref();
const inn = ref();
const taxation = ref();
const snils = ref();
const driverLicense = ref();
const bankAccount = ref();
const bankAccountError = ref('');
const hasSimpleESign = ref(false);
const registrationAddress = ref();
const residenceAddress = ref();
const vehicles = ref([]);
const addVehicleModal = ref(null);
const changeBankModal = ref(null);
const signModal = ref(null);
const maskedAccountNumber = computed(() => {
  if (!bankAccount.value?.number) return noDataPlaceholder;
  const num = bankAccount.value.number;
  return '···· ' + (num.length > 4 ? num.slice(-4) : num);
});
const innDisplay = computed(() => inn.value?.number || 'Отсутствует');
const isStaffOnly = computed(() => {
  const roles = auth.roles || [];
  const hasStaff = roles.includes('SPORT_SCHOOL_STAFF');
  if (!hasStaff) return false;
  return roles.every((r) => r === 'SPORT_SCHOOL_STAFF');
});

const sectionNav = computed(() =>
  [
    { id: 'documents', label: 'Документы', show: true },
    { id: 'contacts', label: 'Контакты', show: true },
    {
      id: 'bank',
      label: 'Банк',
      show:
        !isStaffOnly.value &&
        (bankAccount.value !== undefined ||
          bankAccountError.value ||
          loading.bankAccount),
    },
    {
      id: 'addresses',
      label: 'Адреса',
      show:
        !isStaffOnly.value &&
        (registrationAddress.value !== undefined ||
          residenceAddress.value !== undefined ||
          loading.addresses),
    },
    { id: 'vehicles', label: 'Транспорт', show: !isStaffOnly.value },
  ].filter((s) => s.show)
);
const loading = reactive({
  user: false,
  passport: false,
  inn: false,
  taxation: false,
  snils: false,
  bankAccount: false,
  addresses: false,
  vehicles: false,
});

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
  } catch (_e) {
    inn.value = null;
  } finally {
    loading.inn = false;
  }
}

async function fetchTaxation() {
  loading.taxation = true;
  try {
    const data = await apiFetch('/taxations/me');
    taxation.value = data.taxation;
  } catch (_e) {
    taxation.value = null;
  } finally {
    loading.taxation = false;
  }
}

async function fetchSnils() {
  loading.snils = true;
  try {
    const data = await apiFetch('/snils/me');
    snils.value = data.snils;
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
  } catch (e) {
    bankAccountError.value = e.message;
    bankAccount.value = null;
  } finally {
    loading.bankAccount = false;
  }
}

async function fetchAddresses() {
  loading.addresses = true;
  try {
    const reg = await apiFetch('/addresses/REGISTRATION');
    registrationAddress.value = reg.address || null;
    const res = await apiFetch('/addresses/RESIDENCE');
    residenceAddress.value = res.address || null;
  } catch (_e) {
    registrationAddress.value = null;
    residenceAddress.value = null;
  } finally {
    loading.addresses = false;
  }
}

async function fetchVehicles() {
  loading.vehicles = true;
  try {
    const data = await apiFetch('/vehicles/me');
    vehicles.value = data.vehicles || [];
  } catch (_e) {
    vehicles.value = [];
  } finally {
    loading.vehicles = false;
  }
}

function openAddVehicle() {
  addVehicleModal.value.open();
}

async function setActive(id) {
  await apiFetch(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: true }),
  });
  await fetchVehicles();
}

async function removeVehicle(id) {
  if (!confirm('Удалить транспортное средство?')) return;
  try {
    await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
    await fetchVehicles();
  } catch (e) {
    alert(e.message || 'Не удалось удалить');
  }
}

function formatAddress(addr) {
  if (!addr) return '';
  const parts = [];
  if (addr.postal_code) parts.push(addr.postal_code);
  if (addr.result) parts.push(addr.result);
  return parts.join(', ');
}
onMounted(() => {
  fetchProfile();
  fetchPassport();
  fetchInn();
  fetchTaxation();
  fetchSnils();
  // Load current sign type to gate bank change flow
  apiFetch('/sign-types/me')
    .then((res) => {
      hasSimpleESign.value = res?.signType?.alias === 'SIMPLE_ELECTRONIC';
    })
    .catch(() => {
      hasSimpleESign.value = false;
    });
  if (!isStaffOnly.value) {
    fetchBankAccount();
    fetchAddresses();
  }
  if (!isStaffOnly.value) {
    fetchVehicles();
  }
});

function openChangeBank() {
  changeBankModal.value?.open?.();
}

function onBankChangeCreated(doc) {
  // Open sign modal for the newly created document
  if (doc) signModal.value?.open?.(doc);
}
</script>

<template>
  <div class="py-3 profile-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Мои данные</li>
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
                        <h2 class="card-title h5 mb-1">Паспорт РФ</h2>
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
                        <h2 class="card-title h5 mb-1">ИНН</h2>
                        <p class="card-text text-muted mb-0">
                          {{ innDisplay }}
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
                        <h2 class="card-title h5 mb-1">СНИЛС</h2>
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
                        <h2 class="card-title h5 mb-1">
                          Водительское удостоверение
                        </h2>
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
                  <h2 class="card-title h5 mb-3">Контакты</h2>
                  <div class="row row-cols-1 row-cols-sm-2 g-3">
                    <div class="col">
                      <InfoField
                        id="userPhone"
                        label="Телефон"
                        icon="bi bi-telephone"
                        :value="user.phone ? formatPhone(user.phone) : ''"
                      />
                    </div>
                    <div class="col">
                      <InfoField
                        id="userEmail"
                        label="Email"
                        icon="bi bi-envelope"
                        :value="user.email"
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
                        v-model="code"
                        type="text"
                        class="form-control"
                        maxlength="6"
                        placeholder="Код из письма"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        autocomplete="one-time-code"
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
              v-if="
                !isStaffOnly &&
                (bankAccount !== undefined ||
                  bankAccountError ||
                  loading.bankAccount)
              "
              id="bank"
              class="mb-4"
            >
              <div class="card section-card tile fade-in shadow-sm">
                <div class="card-body">
                  <div
                    class="d-flex align-items-center justify-content-between mb-3"
                  >
                    <h2 class="card-title h5 mb-0">Банковские реквизиты</h2>
                    <button
                      v-if="bankAccount && hasSimpleESign"
                      type="button"
                      class="btn btn-sm btn-outline-secondary"
                      aria-label="Изменить банковские реквизиты"
                      title="Изменить"
                      @click="openChangeBank"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                  </div>
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
                    </div>
                    <div
                      v-if="!hasSimpleESign"
                      class="alert alert-warning mt-3 mb-0"
                      role="alert"
                    >
                      Для изменения реквизитов требуется простая электронная
                      подпись. Перейдите в раздел «Документы», чтобы выбрать
                      способ подписания.
                    </div>
                  </div>
                  <p v-else class="mb-0 text-muted">
                    {{ bankAccountError || 'Банковский счёт не найден.' }}
                  </p>
                </div>
              </div>
            </section>
            <section
              v-if="
                !isStaffOnly &&
                (registrationAddress !== undefined ||
                  residenceAddress !== undefined ||
                  loading.addresses)
              "
              id="addresses"
              class="mb-4"
            >
              <div class="card section-card tile fade-in shadow-sm">
                <div class="card-body">
                  <h2 class="card-title h5 mb-3">Адреса</h2>
                  <div v-if="loading.addresses" class="text-center py-4">
                    <div
                      class="spinner-border"
                      role="status"
                      aria-label="Загрузка"
                    >
                      <span class="visually-hidden">Загрузка…</span>
                    </div>
                  </div>
                  <div v-else>
                    <div class="row row-cols-1 g-3">
                      <div class="col">
                        <InfoField
                          id="regAddress"
                          label="Адрес регистрации"
                          icon="bi bi-geo-alt"
                          :value="formatAddress(registrationAddress)"
                          multiline
                        />
                        <div class="form-text">
                          Для юридически значимых документов
                        </div>
                      </div>
                      <div class="col">
                        <InfoField
                          id="resAddress"
                          label="Адрес проживания"
                          icon="bi bi-geo-alt"
                          :value="formatAddress(residenceAddress)"
                          multiline
                        />
                        <div class="form-text">
                          Может использоваться для назначений
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section v-if="!isStaffOnly" id="vehicles" class="mb-4">
              <div class="card section-card tile fade-in shadow-sm">
                <div class="card-body">
                  <div class="d-flex align-items-center mb-3">
                    <h2 class="card-title h5 mb-0">Транспортные средства</h2>
                    <button
                      v-if="vehicles.length < 3"
                      type="button"
                      class="btn btn-sm btn-outline-brand ms-auto"
                      aria-label="Добавить транспортное средство"
                      @click="openAddVehicle"
                    >
                      <i class="bi bi-plus"></i>
                    </button>
                  </div>
                  <div v-if="loading.vehicles" class="text-center py-4">
                    <div
                      class="spinner-border"
                      role="status"
                      aria-label="Загрузка"
                    >
                      <span class="visually-hidden">Загрузка…</span>
                    </div>
                  </div>
                  <div v-else>
                    <template v-if="vehicles.length">
                      <ul class="list-group list-group-flush">
                        <li
                          v-for="v in vehicles"
                          :key="v.id"
                          class="list-group-item d-flex align-items-center gap-3"
                        >
                          <i class="bi bi-car-front fs-5"></i>
                          <span>
                            {{ v.brand }}
                            <span v-if="v.model"> {{ v.model }}</span>
                            &middot; {{ v.number }}
                          </span>
                          <div class="ms-auto d-flex align-items-center gap-2">
                            <div
                              class="form-check mb-0 d-flex align-items-center"
                            >
                              <input
                                :id="`vehicle-active-${v.id}`"
                                class="form-check-input brand-radio"
                                type="radio"
                                name="activeVehicle"
                                :checked="v.is_active"
                                aria-label="Активное транспортное средство"
                                @change="setActive(v.id)"
                              />
                              <label
                                v-if="v.is_active"
                                class="form-check-label ms-1"
                                :for="`vehicle-active-${v.id}`"
                              >
                                Активен
                              </label>
                            </div>
                            <button
                              type="button"
                              class="btn p-0 text-muted"
                              aria-label="Удалить"
                              @click="removeVehicle(v.id)"
                            >
                              <i class="bi bi-x"></i>
                            </button>
                          </div>
                        </li>
                      </ul>
                    </template>
                    <p v-else class="text-muted text-center py-4">
                      Вы пока не добавили транспортных средств
                    </p>
                  </div>
                </div>
              </div>
            </section>
            <section v-if="!isStaffOnly" class="mb-4">
              <div class="section-card p-3 fade-in no-shadow">
                <div class="d-flex align-items-start">
                  <i class="bi bi-globe fs-4 me-3"></i>
                  <div>
                    <div>Российская Федерация</div>
                    <div class="form-text">Налоговое резидентство</div>
                  </div>
                </div>
                <hr class="my-3" />
                <div class="d-flex align-items-start">
                  <i class="bi bi-x-circle fs-4 me-3 text-secondary"></i>
                  <div>
                    <div>Удалить личный кабинет</div>
                    <div class="form-text">
                      Возможно после обращения в офис ФХМ с паспортом
                    </div>
                  </div>
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
                <li v-for="s in sectionNav" :key="s.id" class="nav-item">
                  <a class="nav-link py-1" :href="'#' + s.id">{{ s.label }}</a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
      <p v-else>Данные пользователя не найдены.</p>
    </div>
  </div>
  <AddVehicleModal ref="addVehicleModal" @saved="fetchVehicles" />
  <ChangeBankRequisitesModal
    ref="changeBankModal"
    @created="onBankChangeCreated"
  />
  <DocumentSignModal
    ref="signModal"
    :user-email="user?.email || ''"
    @signed="
      () => {
        fetchProfile();
        fetchBankAccount();
      }
    "
  />
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.tiles-row {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 0.5rem 1rem;
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
  .tiles-row .card-title {
    font-size: 1rem;
  }
  .tiles-row .card-text {
    font-size: 0.875rem;
  }
  .tiles-row .icon-brand {
    font-size: 1.5rem;
  }
}

/* Remove elevation and border specifically for the taxation/delete block */
.section-card.no-shadow {
  box-shadow: none !important;
  border: none !important;
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
