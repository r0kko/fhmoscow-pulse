<script setup>
import { ref, onMounted } from 'vue';
import { Modal } from 'bootstrap';
import { apiFetch } from '../api.js';

const props = defineProps({ userId: { type: String, required: true } });

const addresses = ref({ REGISTRATION: null, RESIDENCE: null });
const error = ref('');
const modalRef = ref(null);
let modal;
const current = ref('REGISTRATION');
const form = ref({ result: '' });

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
              <div class="form-floating">
                <textarea
                  id="addrInput"
                  v-model="form.result"
                  class="form-control"
                  rows="3"
                  placeholder="Адрес"
                ></textarea>
                <label for="addrInput">Стандартизованный адрес</label>
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
