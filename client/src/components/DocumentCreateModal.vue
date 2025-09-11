<script setup>
import { ref, reactive, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiUpload } from '../api.js';

const props = defineProps({
  users: { type: Array, required: true },
  docTypes: { type: Array, required: true },
  signTypes: { type: Array, required: true },
});
const emit = defineEmits(['created']);

const modalRef = ref(null);
let modal;
const fileInput = ref(null);
const saving = ref(false);
const error = ref('');
const local = reactive({
  recipientId: '',
  documentTypeId: '',
  signTypeId: '',
});

function open() {
  error.value = '';
  saving.value = false;
  local.recipientId = props.users[0]?.id || '';
  local.documentTypeId = props.docTypes[0]?.id || '';
  local.signTypeId = props.signTypes[0]?.id || '';
  if (fileInput.value) fileInput.value.value = '';
  modal.show();
}

function close() {
  if (!saving.value) modal.hide();
}

async function save() {
  const file = fileInput.value?.files?.[0];
  if (!local.recipientId || !local.documentTypeId || !local.signTypeId || !file)
    return;
  const form = new FormData();
  form.append('recipientId', local.recipientId);
  form.append('documentTypeId', local.documentTypeId);
  form.append('signTypeId', local.signTypeId);
  const name =
    props.docTypes.find((d) => d.id === local.documentTypeId)?.name ||
    'Документ';
  form.append('name', name);
  form.append('file', file);
  saving.value = true;
  error.value = '';
  try {
    await apiUpload('/documents', form);
    emit('created');
    modal.hide();
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});

defineExpose({ open });
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Добавить документ</h5>
          <button
            type="button"
            class="btn-close"
            :disabled="saving"
            aria-label="Close"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
          </div>
          <div class="mb-3">
            <label class="form-label">Пользователь</label>
            <select v-model="local.recipientId" class="form-select">
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.lastName }} {{ u.firstName }} {{ u.patronymic }}
              </option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Тип документа</label>
            <select v-model="local.documentTypeId" class="form-select">
              <option v-for="dt in docTypes" :key="dt.id" :value="dt.id">
                {{ dt.name }}
              </option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Тип подписи</label>
            <select v-model="local.signTypeId" class="form-select">
              <option v-for="st in signTypes" :key="st.id" :value="st.id">
                {{ st.name }}
              </option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Файл</label>
            <input
              ref="fileInput"
              type="file"
              class="form-control"
              :disabled="saving"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            @click="close"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving"
            @click="save"
          >
            <span
              v-if="saving"
              class="spinner-border spinner-border-sm spinner-brand me-2"
              aria-hidden="true"
            ></span>
            Создать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No additional styles */
</style>
