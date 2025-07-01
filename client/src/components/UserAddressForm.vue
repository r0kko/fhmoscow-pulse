<script setup>
import { ref, onMounted, watch } from 'vue';
import { Modal } from 'bootstrap';
import { apiFetch } from '../api.js';
import { suggestAddress, cleanAddress } from '../dadata.js';

const props = defineProps({
  userId: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
});

const addressTypes = [
  { alias: 'REGISTRATION', name: 'Адрес регистрации' },
  { alias: 'RESIDENCE', name: 'Адрес проживания' },
];

const addresses = ref({ REGISTRATION: null, RESIDENCE: null });
const error = ref('');
const modalRef = ref(null);
let modal;
const current = ref('REGISTRATION');
const form = ref({ result: '' });
const sameAsResidence = ref(false);
const suggestions = ref([]);
let timeout;



onMounted(() => {
  modal = new Modal(modalRef.value);
  load();
});

async function load() {
  for (const type of ['REGISTRATION', 'RESIDENCE']) {
    try {
      const { address } = await apiFetch(
        `/users/${props.userId}/address/${type}`
      );
      addresses.value[type] = address;
    } catch (_e) {
      addresses.value[type] = null;
    }
  }
}

function open(type) {
  current.value = type;
  form.value.result = addresses.value[type]?.result || '';
  sameAsResidence.value = false;
  error.value = '';
  suggestions.value = [];
  modal.show();
}

async function save() {
  const body = JSON.stringify({ result: form.value.result });
  try {
    let res;
    if (addresses.value[current.value]) {
      res = await apiFetch(`/users/${props.userId}/address/${current.value}`, {
        method: 'PUT',
        body,
      });
    } else {
      res = await apiFetch(`/users/${props.userId}/address/${current.value}`, {
        method: 'POST',
        body,
      });
    }
    addresses.value[current.value] = res.address;

    if (
      props.isAdmin &&
      current.value === 'REGISTRATION' &&
      sameAsResidence.value
    ) {
      let res2;
      if (addresses.value.RESIDENCE) {
        res2 = await apiFetch(`/users/${props.userId}/address/RESIDENCE`, {
          method: 'PUT',
          body,
        });
      } else {
        res2 = await apiFetch(`/users/${props.userId}/address/RESIDENCE`, {
          method: 'POST',
          body,
        });
      }
      addresses.value.RESIDENCE = res2.address;
    }

    modal.hide();
  } catch (e) {
    error.value = e.message;
  }
}

async function removeAddress() {
  if (!confirm('Удалить адрес?')) return;
  try {
    await apiFetch(`/users/${props.userId}/address/${current.value}`, {
      method: 'DELETE',
    });
    addresses.value[current.value] = null;
    modal.hide();
  } catch (e) {
    error.value = e.message;
  }
}

watch(
  () => form.value.result,
  (val) => {
    clearTimeout(timeout);
    if (!val || val.length < 3) {
      suggestions.value = [];
      return;
    }
    const query = val.trim();
    timeout = setTimeout(async () => {
      suggestions.value = await suggestAddress(query);
    }, 300);
  }
);

async function onBlur() {
  const cleaned = await cleanAddress(form.value.result);
  if (cleaned && cleaned.result) {
    form.value.result = cleaned.result;
  }
  suggestions.value = [];
}

function applySuggestion(sug) {
  form.value.result = sug.value;
  suggestions.value = [];
}
</script>

<template>
  <div>
    <div class="card mt-4">
      <div class="card-body">
        <h5 class="card-title mb-3">Адреса</h5>
        <div v-for="type in addressTypes" :key="type.alias" class="mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">{{ type.name }}</h6>
            <button
              type="button"
              class="btn btn-link p-0"
              @click="open(type.alias)"
            >
              <i
                class="bi"
                :class="addresses[type.alias] ? 'bi-pencil' : 'bi-plus'"
              ></i>
            </button>
          </div>
          <div
            v-if="addresses[type.alias]"
            class="row g-3 align-items-end"
          >
            <div class="col-auto" style="width: 10ch">
              <div class="form-floating">
                <input
                  :id="`zip-${type.alias}`"
                  type="text"
                  class="form-control"
                  :value="addresses[type.alias].postal_code"
                  readonly
                  placeholder="Индекс"
                />
                <label :for="`zip-${type.alias}`">Индекс</label>
              </div>
            </div>
            <div class="col-auto" style="width: 12ch">
              <div class="form-floating">
                <input
                  :id="`country-${type.alias}`"
                  type="text"
                  class="form-control"
                  :value="addresses[type.alias].country"
                  readonly
                  placeholder="Страна"
                />
                <label :for="`country-${type.alias}`">Страна</label>
              </div>
            </div>
            <div class="col">
              <div class="form-floating">
                <input
                  :id="`addr-${type.alias}`"
                  type="text"
                  class="form-control"
                  :value="addresses[type.alias].result"
                  readonly
                  placeholder="Адрес"
                />
                <label :for="`addr-${type.alias}`">Адрес</label>
              </div>
            </div>
          </div>
          <div v-else class="alert alert-warning p-2 mb-0">Адрес не указан.</div>
          <div v-if="error && current === type.alias" class="text-danger mt-2">
            {{ error }}
          </div>
        </div>
      </div>
    </div>

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">
                {{
                  addresses[current]?.result
                    ? 'Изменить адрес'
                    : 'Добавить адрес'
                }}
              </h5>
              <button
                type="button"
                class="btn-close"
                @click="modal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="error" class="alert alert-danger">{{ error }}</div>
              <div
                v-if="props.isAdmin && current === 'REGISTRATION'"
                class="form-check form-switch mb-3"
              >
                <input
                  id="sameResidence"
                  v-model="sameAsResidence"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label" for="sameResidence"
                  >Совпадает с адресом проживания</label
                >
              </div>
              <div class="form-floating position-relative">
                <textarea
                  id="addrInput"
                  v-model="form.result"
                  @blur="onBlur"
                  class="form-control"
                  rows="3"
                  placeholder="Адрес"
                ></textarea>
                <label for="addrInput">Стандартизованный адрес</label>
                <ul
                  v-if="suggestions.length"
                  class="list-group position-absolute w-100"
                  style="z-index: 1050"
                >
                  <li
                    v-for="s in suggestions"
                    :key="s.value"
                    class="list-group-item list-group-item-action"
                    @mousedown.prevent="applySuggestion(s)"
                  >
                    {{ s.value }}
                  </li>
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button
                v-if="addresses[current]"
                type="button"
                class="btn btn-danger me-auto"
                @click="removeAddress"
              >
                Удалить
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                @click="modal.hide()"
              >
                Отмена
              </button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
