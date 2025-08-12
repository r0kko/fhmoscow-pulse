<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { auth } from '../auth.js';
import UserForm from '../components/UserForm.vue';
import AddPassportModal from '../components/AddPassportModal.vue';
import InnSnilsForm from '../components/InnSnilsForm.vue';
import BankAccountForm from '../components/BankAccountForm.vue';
import TaxationInfo from '../components/TaxationInfo.vue';
import UserAddressForm from '../components/UserAddressForm.vue';
import UserRolesForm from '../components/UserRolesForm.vue';

const route = useRoute();
const router = useRouter();

const user = ref(null);
const isLoading = ref(false);
const error = ref('');
const formRef = ref(null);
const passportModalRef = ref(null);
const passport = ref(null);
const passportError = ref('');
const sexes = ref([]);
// Placeholder sections hidden until inventory feature is ready
const placeholderSections = [];

const activeTab = ref('info');
const tabs = computed(() => [
  { id: 'info', label: 'Контакты' },
  { id: 'passport', label: 'Паспорт' },
  { id: 'inn', label: 'ИНН и СНИЛС' },
  { id: 'bank', label: 'Банк' },
  { id: 'address', label: 'Адреса' },
  { id: 'tax', label: 'Налоговый статус' },
  ...placeholderSections.map((name, idx) => ({
    id: `ph-${idx}`,
    label: name,
    disabled: true,
  })),
]);

const canManageRoles = computed(() => auth.roles.includes('ADMIN'));

const editing = ref(false);
let originalUser = null;

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

async function loadUser() {
  isLoading.value = true;
  error.value = '';
  try {
    const data = await apiFetch(`/users/${route.params.id}`);
    user.value = data.user;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

async function loadSexes() {
  try {
    const data = await apiFetch('/sexes');
    sexes.value = data.sexes;
  } catch (_) {
    sexes.value = [];
  }
}

onMounted(loadUser);
onMounted(loadSexes);

async function loadPassport() {
  try {
    const data = await apiFetch(`/users/${route.params.id}/passport`);
    passport.value = data.passport;
    passportError.value = '';
  } catch (e) {
    if (e.message === 'passport_not_found') {
      passport.value = null;
      passportError.value = '';
    } else {
      passportError.value = e.message;
    }
  }
}

onMounted(loadPassport);

async function savePassport(data) {
  try {
    const { passport: saved } = await apiFetch(
      `/users/${route.params.id}/passport`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    passport.value = saved;
    passportError.value = '';
  } catch (e) {
    passportError.value = e.message;
  }
}

async function deletePassport() {
  if (!confirm('Удалить паспортные данные?')) return;
  try {
    await apiFetch(`/users/${route.params.id}/passport`, { method: 'DELETE' });
    passport.value = null;
    passportError.value = '';
  } catch (e) {
    passportError.value = e.message;
  }
}

function openPassportModal() {
  passportModalRef.value.open();
}

function onEditingChanged(val) {
  editing.value = val;
  if (val) originalUser = { ...user.value };
}

function cancelEdit() {
  if (originalUser) user.value = { ...originalUser };
  formRef.value.lock();
}

async function save() {
  if (!formRef.value?.validate || !formRef.value.validate()) return;
  const payload = { ...user.value };
  delete payload.roles;
  delete payload.status;
  try {
    await apiFetch(`/users/${route.params.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    formRef.value.lock();
    originalUser = { ...user.value };
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item">
          <RouterLink to="/admin/users">Пользователи</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">
          Редактирование
        </li>
      </ol>
    </nav>
    <h1 class="mb-3">Редактирование пользователя</h1>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <ul v-if="user" class="nav nav-pills nav-fill justify-content-between mb-4">
      <li v-for="tab in tabs" :key="tab.id" class="nav-item">
        <button
          type="button"
          class="nav-link"
          :class="{ active: activeTab === tab.id, disabled: tab.disabled }"
          @click="!tab.disabled && (activeTab = tab.id)"
        >
          {{ tab.label }}
        </button>
      </li>
    </ul>
    <p v-else-if="isLoading">Загрузка...</p>

    <div v-show="activeTab === 'info'">
      <form v-if="user" @submit.prevent="save">
        <UserForm
          ref="formRef"
          v-model="user"
          :locked="true"
          :sexes="sexes"
          @editing-changed="onEditingChanged"
        >
          <template #actions>
            <button type="submit" class="btn btn-brand me-2">Сохранить</button>
            <button type="button" class="btn btn-secondary" @click="cancelEdit">
              Отмена
            </button>
          </template>
        </UserForm>
      </form>
      <UserRolesForm
        v-if="user && canManageRoles"
        :user-id="route.params.id"
        :user-roles="user.roles"
        @updated="(roles) => (user.roles = roles)"
      />
    </div>

    <div
      v-show="activeTab === 'passport'"
      v-if="passport !== undefined"
      class="mt-4"
    >
      <div v-if="passport" class="card">
        <div class="card-body position-relative">
          <div class="d-flex justify-content-between mb-3">
            <h2 class="card-title h5 mb-0">Основной документ</h2>
            <button
              type="button"
              class="btn btn-link text-danger p-0"
              @click="deletePassport"
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="row row-cols-1 row-cols-sm-2 g-3">
            <div class="col">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-card-text"></i
                ></span>
                <div class="form-floating flex-grow-1">
                  <input
                    id="admDocType"
                    type="text"
                    class="form-control"
                    :value="passport.document_type_name"
                    readonly
                    placeholder="Тип документа"
                  />
                  <label for="admDocType">Тип документа</label>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-globe"></i
                ></span>
                <div class="form-floating flex-grow-1">
                  <input
                    id="admCountry"
                    type="text"
                    class="form-control"
                    :value="passport.country_name"
                    readonly
                    placeholder="Страна"
                  />
                  <label for="admCountry">Страна</label>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-file-earmark-text"></i
                ></span>
                <div class="form-floating flex-grow-1">
                  <input
                    id="admSeries"
                    type="text"
                    class="form-control"
                    :value="passport.series + ' ' + passport.number"
                    readonly
                    placeholder="Серия и номер"
                  />
                  <label for="admSeries">Серия и номер</label>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-calendar"></i
                ></span>
                <div class="form-floating flex-grow-1">
                  <input
                    id="admValidity"
                    type="text"
                    class="form-control"
                    :value="
                      formatDate(passport.issue_date) +
                      ' - ' +
                      formatDate(passport.valid_until)
                    "
                    readonly
                    placeholder="Срок действия"
                  />
                  <label for="admValidity">Срок действия</label>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-building"></i
                ></span>
                <div class="form-floating flex-grow-1">
                  <input
                    id="admAuthority"
                    type="text"
                    class="form-control"
                    :value="
                      passport.issuing_authority +
                      ' (' +
                      passport.issuing_authority_code +
                      ')'
                    "
                    readonly
                    placeholder="Кем выдан"
                  />
                  <label for="admAuthority">Кем выдан</label>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-geo-alt"></i
                ></span>
                <div class="form-floating flex-grow-1">
                  <input
                    id="admBirthplace"
                    type="text"
                    class="form-control"
                    :value="passport.place_of_birth"
                    readonly
                    placeholder="Место рождения"
                  />
                  <label for="admBirthplace">Место рождения</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="mt-3">
        <div class="alert alert-warning" role="alert">
          Паспортные данные отсутствуют.
        </div>
        <button class="btn btn-brand mt-2" @click="openPassportModal">
          Добавить паспорт
        </button>
      </div>
      <AddPassportModal
        ref="passportModalRef"
        :user="user"
        @saved="savePassport"
      />
      <div v-if="passportError" class="alert alert-danger mt-2">
        {{ passportError }}
      </div>
    </div>

    <div v-show="activeTab === 'inn'">
      <InnSnilsForm v-if="user" :user-id="route.params.id" />
    </div>

    <div v-show="activeTab === 'bank'">
      <BankAccountForm v-if="user" :user-id="route.params.id" />
    </div>

    <div v-show="activeTab === 'address'">
      <UserAddressForm v-if="user" :user-id="route.params.id" is-admin />
    </div>

    <div v-show="activeTab === 'tax'">
      <TaxationInfo v-if="user" :user-id="route.params.id" />
    </div>

    <div
      v-for="(section, idx) in placeholderSections"
      v-show="activeTab === `ph-${idx}`"
      :key="`ph-${idx}`"
      class="mt-4"
    >
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
</template>

<style scoped>
.placeholder-card {
  opacity: 0.6;
}
</style>
