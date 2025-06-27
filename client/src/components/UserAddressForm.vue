<script setup>
import { ref, onMounted, watch } from 'vue';
import { Modal } from 'bootstrap';
import { apiFetch } from '../api.js';
import { suggestAddress, cleanAddress } from '../dadata.js';

const props = defineProps({ userId: { type: String, required: true } });

const addresses = ref({ REGISTRATION: null, RESIDENCE: null });
const error = ref('');
const modalRef = ref(null);
let modal;
const current = ref('REGISTRATION');
const form = ref({ result: '' });
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
    <div
      v-for="type in [
        { alias: 'REGISTRATION', name: 'Адрес регистрации' },
        { alias: 'RESIDENCE', name: 'Адрес проживания' },
      ]"
      :key="type.alias"
      class="card mt-4"
    >
      <div class="card-body">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="card-title mb-0">{{ type.name }}</h5>
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
        <p v-if="addresses[type.alias]" class="mb-0">
          {{ addresses[type.alias].result }}
        </p>
        <p v-else class="mb-0 text-muted">Адрес не указан.</p>
        <div v-if="error && current === type.alias" class="text-danger mt-2">
          {{ error }}
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
