<script setup>
import { ref, onMounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiUpload } from '../api';

const emit = defineEmits(['uploaded']);

const modalRef = ref(null);
const fileInput = ref(null);
let modal;
const progress = ref(0);
const uploading = ref(false);
const error = ref('');
const doc = ref(null);

function open(d) {
  doc.value = d;
  error.value = '';
  progress.value = 0;
  uploading.value = false;
  if (fileInput.value) fileInput.value.value = '';
  modal.show();
}

function close() {
  if (!uploading.value) modal.hide();
}

async function startUpload() {
  if (!doc.value) return;
  const file = fileInput.value?.files?.[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  uploading.value = true;
  error.value = '';
  try {
    const res = await apiUpload(`/documents/${doc.value.id}/file`, form, {
      onProgress: (p) => {
        progress.value = Math.round(p * 100);
      },
    });
    doc.value.status = res.status;
    doc.value.file = res.file;
    emit('uploaded', doc.value);
    modal.hide();
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
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
          <h5 class="modal-title">Загрузить подписанный документ</h5>
          <button
            type="button"
            class="btn-close"
            :disabled="uploading"
            aria-label="Close"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
          </div>
          <input
            ref="fileInput"
            type="file"
            class="form-control mb-3"
            :disabled="uploading"
          />
          <div v-if="uploading" class="progress">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{ width: progress + '%' }"
              :aria-valuenow="progress"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{ progress }}%
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="uploading"
            @click="close"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="uploading"
            @click="startUpload"
          >
            Загрузить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress {
  height: 20px;
}
</style>
