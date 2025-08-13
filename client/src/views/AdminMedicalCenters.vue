<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import { suggestAddress, cleanAddress } from '../dadata.js';

const centers = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminMedCentersPageSize', 8));
const isLoading = ref(false);
const error = ref('');

const form = ref({
  name: '',
  inn: '',
  address: { result: '' },
  phone: '',
  email: '',
  website: '',
});
const phoneInput = ref('');
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const addrSuggestions = ref([]);
let addrTimeout;

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
  savePageSize('adminMedCentersPageSize', val);
  load();
});

watch(
  () => form.value.address.result,
  (val) => {
    clearTimeout(addrTimeout);
    if (!val || val.length < 3) {
      addrSuggestions.value = [];
      return;
    }
    const query = val.trim();
    addrTimeout = setTimeout(async () => {
      addrSuggestions.value = await suggestAddress(query);
    }, 300);
  }
);

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

function applyAddrSuggestion(s) {
  form.value.address.result = s.value;
  addrSuggestions.value = [];
}

async function onAddrBlur() {
  const cleaned = await cleanAddress(form.value.address.result);
  if (cleaned && cleaned.result) {
    form.value.address.result = cleaned.result;
  }
  addrSuggestions.value = [];
}

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(`/medical-centers?${params}`);
    centers.value = data.centers;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form.value, {
    name: '',
    inn: '',
    address: { result: '' },
    phone: '',
    email: '',
    website: '',
  });
  phoneInput.value = '';
  formError.value = '';
  addrSuggestions.value = [];
  modal.show();
}

function openEdit(center) {
  editing.value = center;
  form.value.name = center.name;
  form.value.inn = center.inn;
  form.value.address.result = center.address ? center.address.result : '';
  form.value.phone = center.phone || '';
  phoneInput.value = formatPhone(center.phone || '');
  form.value.email = center.email || '';
  form.value.website = center.website || '';
  formError.value = '';
  addrSuggestions.value = [];
  modal.show();
}

async function save() {
  try {
    formError.value = '';
    const body = {
      name: form.value.name,
      inn: form.value.inn,
      phone: form.value.phone,
      email: form.value.email,
      website: form.value.website,
    };
    if (form.value.address.result) {
      body.address = { result: form.value.address.result };
    }
    let path = '/medical-centers';
    let method = 'POST';
    if (editing.value) {
      path += `/${editing.value.id}`;
      method = 'PUT';
    }
    await apiFetch(path, { method, body: JSON.stringify(body) });
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  }
}

async function removeCenter(center) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(`/medical-centers/${center.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div>
    <div class="card section-card tile fade-in shadow-sm mb-4">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h2 class="h5 mb-0">Медицинские центры</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div
            class="spinner-border spinner-brand"
            role="status"
            aria-label="Загрузка"
          ></div>
        </div>
        <div v-if="centers.length" class="table-responsive d-none d-sm-block">
          <table class="table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Название</th>
                <th>ИНН</th>
                <th>Адрес</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Сайт</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in centers" :key="c.id">
                <td>{{ c.name }}</td>
                <td>{{ c.inn }}</td>
                <td>{{ c.address?.result || '' }}</td>
                <td>{{ formatPhone(c.phone) }}</td>
                <td>{{ c.email }}</td>
                <td>
                  <a
                    v-if="c.website"
                    :href="c.website"
                    target="_blank"
                    rel="noopener"
                    >{{ c.website }}</a
                  >
                </td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-secondary me-2"
                    aria-label="Редактировать центр"
                    @click="openEdit(c)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    aria-label="Удалить центр"
                    @click="removeCenter(c)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="centers.length" class="d-block d-sm-none">
          <div v-for="c in centers" :key="c.id" class="card mb-2">
            <div class="card-body p-2">
              <h3 class="h6 mb-1">{{ c.name }}</h3>
              <p class="mb-1 small">ИНН: {{ c.inn || '—' }}</p>
              <p class="mb-1 small">Адрес: {{ c.address?.result || '—' }}</p>
              <p class="mb-1 small">Телефон: {{ formatPhone(c.phone) }}</p>
              <p class="mb-1 small">Email: {{ c.email || '—' }}</p>
              <p v-if="c.website" class="mb-2 small">
                <a :href="c.website" target="_blank" rel="noopener">
                  {{ c.website }}
                </a>
              </p>
              <div class="text-end">
                <button
                  class="btn btn-sm btn-secondary me-2"
                  @click="openEdit(c)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" @click="removeCenter(c)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <PageNav
      v-if="totalPages > 1"
      v-model:page="currentPage"
      v-model:page-size="pageSize"
      :total-pages="totalPages"
      :sizes="[5, 8, 10, 20]"
    />

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h2 class="modal-title h5">
                {{ editing ? 'Изменить центр' : 'Добавить центр' }}
              </h2>
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
                  id="mcName"
                  v-model="form.name"
                  class="form-control"
                  placeholder="Название"
                  required
                />
                <label for="mcName">Наименование</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcInn"
                  v-model="form.inn"
                  class="form-control"
                  placeholder="ИНН"
                  required
                />
                <label for="mcInn">ИНН</label>
              </div>
              <div class="form-floating mb-3 position-relative">
                <textarea
                  id="mcAddr"
                  v-model="form.address.result"
                  class="form-control"
                  rows="2"
                  placeholder="Адрес"
                  autocomplete="street-address"
                  @blur="onAddrBlur"
                ></textarea>
                <label for="mcAddr">Адрес</label>
                <ul
                  v-if="addrSuggestions.length"
                  class="list-group position-absolute w-100"
                  style="z-index: 1050"
                >
                  <li
                    v-for="s in addrSuggestions"
                    :key="s.value"
                    class="list-group-item list-group-item-action"
                    @mousedown.prevent="applyAddrSuggestion(s)"
                  >
                    {{ s.value }}
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcPhone"
                  v-model="phoneInput"
                  type="tel"
                  class="form-control"
                  placeholder="Телефон"
                  inputmode="tel"
                  autocomplete="tel"
                  @input="onPhoneInput"
                  @keydown="onPhoneKeydown"
                />
                <label for="mcPhone">Телефон</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcEmail"
                  v-model="form.email"
                  type="email"
                  class="form-control"
                  placeholder="Email"
                />
                <label for="mcEmail">Email</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="mcWeb"
                  v-model="form.website"
                  type="url"
                  class="form-control"
                  placeholder="Сайт"
                />
                <label for="mcWeb">Сайт</label>
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
              <button type="submit" class="btn btn-brand">Сохранить</button>
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

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@media (max-width: 575.98px) {
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
