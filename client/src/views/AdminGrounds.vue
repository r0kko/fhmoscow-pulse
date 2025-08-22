<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import Toast from 'bootstrap/js/dist/toast';
import { apiFetch } from '../api.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import PageNav from '../components/PageNav.vue';
import { suggestAddress, cleanAddress } from '../dadata.js';

const grounds = ref([]);
const onlyWithoutAddress = ref(false);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminGroundsPageSize', 8));
const isLoading = ref(false);
const error = ref('');

const form = ref({
  name: '',
  address: { result: '' },
  yandex_url: '',
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const errors = ref({});
const addressSuggestions = ref([]);
let addrTimeout;
const saveLoading = ref(false);
const syncLoading = ref(false);
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
});

onBeforeUnmount(() => {
  try {
    clearTimeout(addrTimeout);
  } catch {}
  try {
    modal?.hide?.();
    modal?.dispose?.();
  } catch {}
});

watch(currentPage, load);
watch(pageSize, (val) => {
  currentPage.value = 1;
  savePageSize('adminGroundsPageSize', val);
  load();
});
watch(
  () => form.value.address.result,
  (val) => {
    clearTimeout(addrTimeout);
    if (!val || val.length < 3) {
      addressSuggestions.value = [];
      return;
    }
    const query = val.trim();
    addrTimeout = setTimeout(async () => {
      addressSuggestions.value = await suggestAddress(query);
    }, 300);
  }
);

function openCreate() {
  editing.value = null;
  form.value = {
    name: '',
    address: { result: '' },
    yandex_url: '',
    capacity: '',
    phone: '',
    website: '',
  };
  formError.value = '';
  errors.value = {};
  addressSuggestions.value = [];
  modal.show();
}

function openEdit(s) {
  editing.value = s;
  form.value = {
    name: s.name,
    address: { result: s.address?.result || '' },
  yandex_url: s.yandex_url || '',
  };
  formError.value = '';
  errors.value = {};
  addressSuggestions.value = [];
  modal.show();
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    // prepend scheme if missing for validation purposes
    const test = value.match(/^https?:\/\//i) ? value : `https://${value}`;
    // eslint-disable-next-line no-new
    new URL(test);
    return true;
  } catch {
    return false;
  }
}

function validateForm() {
  const e = {};
  if (!form.value.name || !form.value.name.trim()) {
    e.name = 'Укажите наименование';
  } else if (form.value.name.length > 255) {
    e.name = 'Макс. длина — 255 символов';
  }
  if (form.value.yandex_url && !isValidUrl(form.value.yandex_url)) {
    e.yandex_url = 'Некорректный URL';
  }
  errors.value = e;
  return Object.keys(e).length === 0;
}

async function save() {
  formError.value = '';
  if (!validateForm()) {
    formError.value = 'Исправьте ошибки в форме';
    return;
  }
  const payload = {
    name: form.value.name,
    address: form.value.address?.result
      ? { result: form.value.address.result }
      : undefined,
    yandex_url: form.value.yandex_url || undefined,
  };
  try {
    saveLoading.value = true;
    if (editing.value) {
      await apiFetch(`/grounds/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/grounds', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saveLoading.value = false;
  }
}

async function removeGround(s) {
  if (!confirm('Удалить площадку?')) return;
  await apiFetch(`/grounds/${s.id}`, { method: 'DELETE' });
  await load();
}

function applyAddressSuggestion(sug) {
  form.value.address.result = sug.value;
  addressSuggestions.value = [];
}

async function onAddressBlur() {
  const cleaned = await cleanAddress(form.value.address.result);
  if (cleaned && cleaned.result) {
    form.value.address.result = cleaned.result;
  }
  addressSuggestions.value = [];
}

function showToast(message) {
  toastMessage.value = message;
  if (!toast) toast = new Toast(toastRef.value);
  toast.show();
}

async function syncGrounds() {
  try {
    syncLoading.value = true;
    const res = await apiFetch('/grounds/sync', { method: 'POST' });
    const { upserts, softDeletedTotal, softDeletedArchived, softDeletedMissing } = res;
    showToast(
      `Синхронизировано: добавлено/обновлено ${upserts}, удалено ${softDeletedTotal} (архив: ${softDeletedArchived}, отсутствуют: ${softDeletedMissing})`
    );
    await load();
  } catch (e) {
    showToast(e.message || 'Ошибка синхронизации');
  } finally {
    syncLoading.value = false;
  }
}

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(`/grounds?${params}`);
    grounds.value = data.grounds;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="py-4 admin-grounds-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-3">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Площадки</li>
        </ol>
      </nav>
      <h1 class="mb-3">Площадки</h1>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="isLoading" class="text-center my-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        ></div>
      </div>
      <div class="card section-card tile fade-in shadow-sm">
        <div
          class="card-header d-flex justify-content-between align-items-center"
        >
          <h2 class="h5 mb-0">Площадки</h2>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary" @click="syncGrounds" :disabled="syncLoading">
              <span v-if="syncLoading" class="spinner-border spinner-border-sm me-2"></span>
              Синхронизировать
            </button>
            <button class="btn btn-brand" @click="openCreate">
            <i class="bi bi-plus-lg me-1"></i>Добавить
            </button>
          </div>
        </div>
        <div class="card-body p-3">
          <div class="d-flex justify-content-end mb-2">
            <div class="form-check form-switch">
              <input
                id="filterWithoutAddress"
                v-model="onlyWithoutAddress"
                class="form-check-input"
                type="checkbox"
                role="switch"
              />
              <label class="form-check-label" for="filterWithoutAddress"
                >Без адреса</label
              >
            </div>
          </div>
          <div v-if="grounds.length" class="table-responsive d-none d-sm-block">
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Адрес</th>
                  <th>Ссылка</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="st in grounds.filter(g => !onlyWithoutAddress || !g.address)" :key="st.id">
                  <td>{{ st.name }}</td>
                  <td>
                    <span v-if="st.address?.result">{{ st.address.result }}</span>
                    <span v-else class="badge text-bg-warning">Нет адреса</span>
                    <span v-if="st.external_id" class="badge text-bg-info ms-2">Импортирован</span>
                  </td>
                  <td class="d-none d-md-table-cell">
                    <a v-if="st.yandex_url" :href="st.yandex_url" target="_blank" rel="noopener">Яндекс.Карты</a>
                  </td>
                  <td class="text-end">
                    <button
                      class="btn btn-sm btn-secondary me-2"
                      aria-label="Редактировать площадку"
                      @click="openEdit(st)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-danger"
                      aria-label="Удалить площадку"
                      @click="removeGround(st)"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="grounds.length" class="d-block d-sm-none">
            <div
              v-for="st in grounds.filter(g => !onlyWithoutAddress || !g.address)"
              :key="st.id"
              class="card training-card mb-2"
            >
              <div class="card-body p-2">
                <h3 class="h6 mb-1">
                  {{ st.name }}
                  <span v-if="st.external_id" class="badge text-bg-info ms-2">Импортирован</span>
                </h3>
                <p class="mb-1">{{ st.address?.result }}</p>
                <p v-if="st.yandex_url" class="mb-1">
                  <a :href="st.yandex_url" target="_blank" rel="noopener">Яндекс.Карты</a>
                </p>
                <div class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать площадку"
                    @click="openEdit(st)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить площадку"
                    @click="removeGround(st)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="!isLoading" class="alert alert-warning mb-0">
            Площадок нет.
          </div>
        </div>
      </div>
      <PageNav
        v-if="totalPages > 1"
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :total-pages="totalPages"
        :sizes="[5, 8, 10, 20]"
      />
    </div>

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">
                {{ editing ? 'Изменить стадион' : 'Добавить стадион' }}
              </h5>
              <button
                type="button"
                class="btn-close"
                @click="modal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">
                {{ formError }}
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadName"
                  v-model="form.name"
                  class="form-control"
                  placeholder="Название"
                  :class="{ 'is-invalid': !!errors.name }"
                  required
                />
                <label for="stadName">Наименование</label>
                <div v-if="errors.name" class="invalid-feedback">{{ errors.name }}</div>
              </div>
              <div class="form-floating mb-3 position-relative">
                <textarea
                  id="stadAddr"
                  v-model="form.address.result"
                  class="form-control"
                  rows="2"
                  placeholder="Адрес"
                  autocomplete="street-address"
                  @blur="onAddressBlur"
                ></textarea>
                <label for="stadAddr">Адрес</label>
                <ul
                  v-if="addressSuggestions.length"
                  class="list-group position-absolute w-100"
                  style="z-index: 1050"
                >
                  <li
                    v-for="s in addressSuggestions"
                    :key="s.value"
                    class="list-group-item list-group-item-action"
                    @mousedown.prevent="applyAddressSuggestion(s)"
                  >
                    {{ s.value }}
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadYandex"
                  v-model="form.yandex_url"
                  type="url"
                  class="form-control"
                  placeholder="URL в Яндекс.Картах"
                  :class="{ 'is-invalid': !!errors.yandex_url }"
                />
                <label for="stadYandex">URL в Яндекс.Картах</label>
                <div v-if="errors.yandex_url" class="invalid-feedback">{{ errors.yandex_url }}</div>
              </div>
              
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="modal.hide()"
              >
                Отмена
              </button>
              <button
                type="submit"
                class="btn btn-brand"
                :disabled="saveLoading"
              >
                <span
                  v-if="saveLoading"
                  class="spinner-border spinner-border-sm spinner-brand me-2"
                ></span>
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div ref="toastRef" class="toast text-bg-secondary" role="status" aria-live="polite" aria-atomic="true">
      <div class="toast-body">{{ toastMessage }}</div>
    </div>
  </div>
</template>

<style scoped>
.list-group {
  max-height: 200px;
  overflow-y: auto;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

.training-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@media (max-width: 575.98px) {
  .admin-grounds-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
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
