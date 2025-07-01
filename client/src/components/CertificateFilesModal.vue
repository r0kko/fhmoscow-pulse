<script setup>
import { ref, onMounted } from 'vue';
import { Modal } from 'bootstrap';
import { apiFetch, apiFetchForm } from '../api.js';

const props = defineProps({ certificateId: String });
const certId = ref(props.certificateId || '');
const modalRef = ref(null);
let modal;
const files = ref([]);
const isLoading = ref(false);
const error = ref('');
const type = ref('CONCLUSION');
const fileInput = ref(null);

function open(id) {
  if (id) certId.value = id;
  load();
  type.value = 'CONCLUSION';
  if (fileInput.value) fileInput.value.value = '';
  error.value = '';
  modal.show();
}

function close() {
  modal.hide();
}

async function load() {
  if (!certId.value) return;
  isLoading.value = true;
  error.value = '';
  try {
    const data = await apiFetch(`/medical-certificates/${certId.value}/files`);
    files.value = data.files;
  } catch (e) {
    files.value = [];
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

async function upload() {
  const f = fileInput.value?.files[0];
  if (!f) return;
  const form = new FormData();
  form.append('file', f);
  form.append('type', type.value);
  try {
    await apiFetchForm(`/medical-certificates/${certId.value}/files`, form, { method: 'POST' });
    fileInput.value.value = '';
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});

defineExpose({ open, close });
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Файлы справки</h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="isLoading" class="text-center py-2">Загрузка...</div>
          <ul v-if="files.length" class="list-group mb-3">
            <li v-for="f in files" :key="f.id" class="list-group-item">
              <a :href="f.url" target="_blank">{{ f.type }} — {{ f.name }}</a>
            </li>
          </ul>
          <p v-else-if="!isLoading" class="text-muted">Нет файлов</p>
          <div class="mb-3">
            <label for="fileType" class="form-label">Тип документа</label>
            <select id="fileType" class="form-select" v-model="type">
              <option value="CONCLUSION">Заключение</option>
              <option value="RESULTS">Результаты исследований</option>
            </select>
          </div>
          <div class="mb-3">
            <input type="file" class="form-control" ref="fileInput" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">Закрыть</button>
          <button type="button" class="btn btn-primary" @click="upload">Загрузить</button>
        </div>
      </div>
    </div>
  </div>
</template>
