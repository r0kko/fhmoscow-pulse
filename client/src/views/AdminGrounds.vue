<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import Pagination from '../components/Pagination.vue';
import { suggestAddress, cleanAddress } from '../dadata.js';

const phoneInput = ref('');

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

function onPhoneInput(e) {
  let digits = e.target.value.replace(/\D/g, '');
  if (!digits.startsWith('7')) digits = '7' + digits.replace(/^7*/, '');
  digits = digits.slice(0, 11);
  form.value.phone = digits;
  phoneInput.value = formatPhone(digits);
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    form.value.phone = form.value.phone.slice(0, -1);
    phoneInput.value = formatPhone(form.value.phone);
  }
}

const grounds = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminGroundsPageSize', 8));
const isLoading = ref(false);
const error = ref('');

const form = ref({
  name: '',
  address: { result: '' },
  yandex_url: '',
  capacity: '',
  phone: '',
  website: '',
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const addressSuggestions = ref([]);
let addrTimeout;
const saveLoading = ref(false);

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
  phoneInput.value = '';
  formError.value = '';
  addressSuggestions.value = [];
  modal.show();
}

function openEdit(s) {
  editing.value = s;
  form.value = {
    name: s.name,
    address: { result: s.address?.result || '' },
    yandex_url: s.yandex_url || '',
    capacity: s.capacity || '',
    phone: s.phone || '',
    website: s.website || '',
  };
  phoneInput.value = formatPhone(form.value.phone);
  formError.value = '';
  addressSuggestions.value = [];
  modal.show();
}

async function save() {
  const payload = {
    name: form.value.name,
    address: { result: form.value.address.result },
    yandex_url: form.value.yandex_url || undefined,
    capacity: form.value.capacity || undefined,
    phone: form.value.phone || undefined,
    website: form.value.website || undefined,
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
          <button class="btn btn-brand" @click="openCreate">
            <i class="bi bi-plus-lg me-1"></i>Добавить
          </button>
        </div>
        <div class="card-body p-3">
          <div v-if="grounds.length" class="table-responsive d-none d-sm-block">
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Адрес</th>
                  <th class="text-center">Вместимость</th>
                  <th>Телефон</th>
                  <th class="d-none d-md-table-cell">Сайт</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="st in grounds" :key="st.id">
                  <td>{{ st.name }}</td>
                  <td>{{ st.address?.result }}</td>
                  <td class="text-center">{{ st.capacity }}</td>
                  <td>{{ formatPhone(st.phone) }}</td>
                  <td class="d-none d-md-table-cell">
                    <a
                      v-if="st.website"
                      :href="st.website"
                      target="_blank"
                      rel="noopener"
                      >{{ st.website }}</a
                    >
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
              v-for="st in grounds"
              :key="st.id"
              class="card training-card mb-2"
            >
              <div class="card-body p-2">
                <h3 class="h6 mb-1">{{ st.name }}</h3>
                <p class="mb-1">{{ st.address?.result }}</p>
                <p class="mb-1">Вместимость: {{ st.capacity }}</p>
                <p class="mb-1">Телефон: {{ formatPhone(st.phone) }}</p>
                <p v-if="st.website" class="mb-1">
                  <a :href="st.website" target="_blank" rel="noopener">{{
                    st.website
                  }}</a>
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
      <nav
        v-if="totalPages > 1"
        class="mt-3 d-flex align-items-center justify-content-between"
      >
        <select
          v-model.number="pageSize"
          class="form-select form-select-sm w-auto"
        >
          <option :value="5">5</option>
          <option :value="8">8</option>
          <option :value="10">10</option>
          <option :value="20">20</option>
        </select>
        <Pagination v-model="currentPage" :total-pages="totalPages" />
      </nav>
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
                  required
                />
                <label for="stadName">Наименование</label>
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
                />
                <label for="stadYandex">URL в Яндекс.Картах</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadCapacity"
                  v-model="form.capacity"
                  type="number"
                  min="0"
                  class="form-control"
                  placeholder="Вместимость"
                />
                <label for="stadCapacity">Вместимость</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadPhone"
                  v-model="phoneInput"
                  type="tel"
                  class="form-control"
                  placeholder="+7 (___) ___-__-__"
                  inputmode="tel"
                  autocomplete="tel"
                  @input="onPhoneInput"
                  @keydown="onPhoneKeydown"
                />
                <label for="stadPhone">Телефон</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadWebsite"
                  v-model="form.website"
                  type="url"
                  class="form-control"
                  placeholder="Сайт"
                />
                <label for="stadWebsite">Сайт</label>
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
