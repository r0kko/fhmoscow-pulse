<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Modal } from 'bootstrap';
import { apiFetch } from '../api.js';
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

const stadiums = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 8;
const isLoading = ref(false);
const error = ref('');

const parkingTypes = ref([]);

const form = ref({
  name: '',
  address: { result: '' },
  yandex_url: '',
  capacity: '',
  phone: '',
  website: '',
  parking: [],
});
const editing = ref(null);
const modalRef = ref(null);
let modal;
const formError = ref('');
const addressSuggestions = ref([]);
let addrTimeout;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
  loadParkingTypes();
});

watch(currentPage, load);

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

async function loadParkingTypes() {
  try {
    const data = await apiFetch('/camp-stadiums/parking-types');
    parkingTypes.value = data.parkingTypes;
  } catch (_) {
    parkingTypes.value = [];
  }
}

async function load() {
  try {
    isLoading.value = true;
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize,
    });
    const data = await apiFetch(`/camp-stadiums?${params}`);
    stadiums.value = data.stadiums;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

function makeParkingForm() {
  return parkingTypes.value.map((t) => ({ type: t.alias, price: '', enabled: false }));
}

function openCreate() {
  editing.value = null;
  form.value = {
    name: '',
    address: { result: '' },
    yandex_url: '',
    capacity: '',
    phone: '',
    website: '',
    parking: makeParkingForm(),
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
    parking: parkingTypes.value.map((t) => {
      const found = (s.parking || []).find((p) => p.type === t.alias);
      return { type: t.alias, price: found?.price || '', enabled: !!found };
    }),
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
    parking: form.value.parking
      .filter((p) => p.enabled)
      .map((p) => ({ type: p.type, price: p.price || null })),
  };
  try {
    if (editing.value) {
      await apiFetch(`/camp-stadiums/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/camp-stadiums', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    modal.hide();
    await load();
  } catch (e) {
    formError.value = e.message;
  }
}

async function removeStadium(s) {
  if (!confirm('Удалить стадион?')) return;
  await apiFetch(`/camp-stadiums/${s.id}`, { method: 'DELETE' });
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
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Стадионы</li>
      </ol>
    </nav>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">Стадионы</h1>
      <button class="btn btn-brand" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Добавить
      </button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="isLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div v-if="stadiums.length" class="table-responsive">
      <table class="table table-striped align-middle">
        <thead>
          <tr>
            <th>Название</th>
            <th>Адрес</th>
            <th class="text-center">Вместимость</th>
            <th>Телефон</th>
            <th class="d-none d-md-table-cell">Сайт</th>
            <th class="d-none d-lg-table-cell">Парковка</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="st in stadiums" :key="st.id">
            <td>{{ st.name }}</td>
            <td>{{ st.address?.result }}</td>
            <td class="text-center">{{ st.capacity }}</td>
            <td>{{ formatPhone(st.phone) }}</td>
            <td class="d-none d-md-table-cell">
              <a v-if="st.website" :href="st.website" target="_blank">{{ st.website }}</a>
            </td>
            <td class="d-none d-lg-table-cell">
              <div v-if="st.parking?.length">
                <span v-for="p in st.parking" :key="p.type" class="d-block">
                  {{ p.type_name }}<span v-if="p.price"> — {{ p.price }} ₽</span>
                </span>
              </div>
              <span v-else class="text-muted">Нет</span>
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-secondary me-2" @click="openEdit(st)">Изменить</button>
              <button class="btn btn-sm btn-danger" @click="removeStadium(st)">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="!isLoading" class="text-muted">Записей нет.</p>
    <nav class="mt-3" v-if="totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">Пред</button>
        </li>
        <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: currentPage === p }">
          <button class="page-link" @click="currentPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">След</button>
        </li>
      </ul>
    </nav>

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">{{ editing ? 'Изменить стадион' : 'Добавить стадион' }}</h5>
              <button type="button" class="btn-close" @click="modal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div class="form-floating mb-3">
                <input id="stadName" v-model="form.name" class="form-control" placeholder="Название" required />
                <label for="stadName">Наименование</label>
              </div>
              <div class="form-floating mb-3 position-relative">
                <textarea id="stadAddr" v-model="form.address.result" @blur="onAddressBlur" class="form-control" rows="2" placeholder="Адрес"></textarea>
                <label for="stadAddr">Адрес</label>
                <ul v-if="addressSuggestions.length" class="list-group position-absolute w-100" style="z-index: 1050">
                  <li v-for="s in addressSuggestions" :key="s.value" class="list-group-item list-group-item-action" @mousedown.prevent="applyAddressSuggestion(s)">
                    {{ s.value }}
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <input id="stadYandex" v-model="form.yandex_url" class="form-control" placeholder="URL в Яндекс.Картах" />
                <label for="stadYandex">URL в Яндекс.Картах</label>
              </div>
              <div class="form-floating mb-3">
                <input id="stadCapacity" v-model="form.capacity" type="number" class="form-control" placeholder="Вместимость" />
                <label for="stadCapacity">Вместимость</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="stadPhone"
                  type="tel"
                  v-model="phoneInput"
                  @input="onPhoneInput"
                  @keydown="onPhoneKeydown"
                  class="form-control"
                  placeholder="+7 (___) ___-__-__"
                />
                <label for="stadPhone">Телефон</label>
              </div>
              <div class="form-floating mb-3">
                <input id="stadWebsite" v-model="form.website" class="form-control" placeholder="Сайт" />
                <label for="stadWebsite">Сайт</label>
              </div>
              <div class="mb-3" v-if="parkingTypes.length">
                <h6 class="mb-2">Парковка</h6>
                <div v-for="(p, idx) in form.parking" :key="p.type" class="row g-2 align-items-center mb-2">
                  <div class="col-auto">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" v-model="p.enabled" :id="`p-${idx}`" />
                      <label class="form-check-label" :for="`p-${idx}`">{{ parkingTypes[idx].name }}</label>
                    </div>
                  </div>
                  <div class="col" v-if="p.enabled">
                    <input v-model="p.price" type="number" min="0" step="0.01" class="form-control" placeholder="Цена" />
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
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
</style>
