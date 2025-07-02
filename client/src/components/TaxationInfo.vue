<script setup>
import { ref, onMounted, computed } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const props = defineProps({
  userId: String,
  editable: { type: Boolean, default: true },
  showOkved: { type: Boolean, default: true },
});

const taxation = ref(null);
const error = ref('');
const loading = ref(false);
const modalRef = ref(null);
let modal;
const preview = ref(null);
const checkStatus = ref('');
const checkError = ref('');
const statuses = ref({ dadata: null, fns: null });

function statusIcon(code) {
  if (code === 200) return 'bi-check-circle text-success';
  if (code) return 'bi-exclamation-circle text-danger';
  return 'bi-question-circle text-muted';
}

function statusText(code) {
  if (code === 200) return 'OK';
  if (code) return 'Error';
  return '—';
}

const canSave = computed(
  () => statuses.value.dadata === 200 && statuses.value.fns === 200
);

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const path = props.userId
      ? `/users/${props.userId}/taxation`
      : '/taxations/me';
    const data = await apiFetch(path);
    taxation.value = data.taxation;
  } catch (e) {
    taxation.value = null;
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openModal() {
  if (!props.editable) return;
  preview.value = null;
  checkStatus.value = '';
  checkError.value = '';
  statuses.value = { dadata: null, fns: null };
  modal.show();
  runCheck();
}

async function runCheck(source = 'all') {
  checkStatus.value = 'pending';
  const path = props.userId
    ? `/users/${props.userId}/taxation/check`
    : '/taxations/me/check';
  const url = source && source !== 'all' ? `${path}?source=${source}` : path;
  try {
    const data = await apiFetch(url, { method: 'POST' });
    preview.value = data.preview;
    statuses.value = data.preview.statuses || { dadata: null, fns: null };
    checkStatus.value = 'success';
  } catch (e) {
    checkStatus.value = 'error';
    checkError.value = e.message;
  }
}

async function save() {
  if (!props.editable) return;
  const path = props.userId ? `/users/${props.userId}/taxation` : '/taxations/me';
  try {
    const data = await apiFetch(path, { method: 'POST' });
    taxation.value = data.taxation;
    modal.hide();
  } catch (e) {
    checkError.value = e.message;
  }
}

onMounted(() => {
  if (props.editable) {
    modal = new Modal(modalRef.value);
  }
  load();
});
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <div class="d-flex justify-content-between mb-3">
        <h5 class="card-title mb-0">Налоговый статус</h5>
        <button
          v-if="props.editable"
          type="button"
          class="btn btn-link p-0"
          @click="openModal"
        >
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
      <div v-if="loading" class="text-center py-4">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else-if="taxation">
        <div class="row row-cols-1 row-cols-sm-2 g-3">
          <div class="col">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-file-earmark-text"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxType" type="text" class="form-control" :value="taxation.type?.name" readonly placeholder="Тип" />
                <label for="taxType">Тип</label>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar-check"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxCheck" type="text" class="form-control" :value="formatDate(taxation.check_date)" readonly placeholder="Проверено" />
                <label for="taxCheck">Проверено</label>
              </div>
            </div>
          </div>
          <div class="col" v-if="taxation.registration_date">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxReg" type="text" class="form-control" :value="formatDate(taxation.registration_date)" readonly placeholder="Регистрация" />
                <label for="taxReg">Регистрация</label>
              </div>
            </div>
          </div>
          <div class="col" v-if="taxation.ogrn">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-hash"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxOgrn" type="text" class="form-control" :value="taxation.ogrn" readonly placeholder="ОГРН" />
                <label for="taxOgrn">ОГРН</label>
              </div>
            </div>
          </div>
          <div class="col" v-if="props.showOkved && taxation.okved">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-briefcase"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxOkved" type="text" class="form-control" :value="taxation.okved" readonly placeholder="ОКВЭД" />
                <label for="taxOkved">ОКВЭД</label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="mb-0 text-muted">
        {{ error || 'Tax information is missing' }}
      </p>
    </div>
  </div>

  <div v-if="props.editable" ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Проверка налогового статуса</h5>
          <button type="button" class="btn-close" @click="modal.hide()"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex align-items-center mb-3 gap-3">
            <div class="d-flex align-items-center">
              <i :class="statusIcon(statuses.dadata)" class="me-1"></i>
              <span>DaData - {{ statusText(statuses.dadata) }}</span>
            </div>
            <div class="d-flex align-items-center">
              <i :class="statusIcon(statuses.fns)" class="me-1"></i>
              <span>ФНС - {{ statusText(statuses.fns) }}</span>
            </div>
            <button class="btn btn-link p-0 ms-auto" @click="runCheck()">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          </div>
          <div v-if="checkStatus === 'pending'">Проверка...</div>
          <div v-if="checkStatus === 'error'" class="text-danger mb-2">
            {{ checkError }}
          </div>
          <div v-if="checkStatus === 'success' && preview">
            <div class="row row-cols-1 g-3">
              <div class="col">
                <div class="form-floating">
                  <input id="prevType" type="text" class="form-control" :value="preview.type?.name" readonly placeholder="Тип" />
                  <label for="prevType">Тип</label>
                </div>
              </div>
              <div class="col">
                <div class="form-floating">
                  <input id="prevCheck" type="text" class="form-control" :value="formatDate(preview.check_date)" readonly placeholder="Проверено" />
                  <label for="prevCheck">Проверено</label>
                </div>
              </div>
              <div class="col" v-if="preview.registration_date">
                <div class="form-floating">
                  <input id="prevReg" type="text" class="form-control" :value="formatDate(preview.registration_date)" readonly placeholder="Регистрация" />
                  <label for="prevReg">Регистрация</label>
                </div>
              </div>
              <div class="col" v-if="preview.ogrn">
                <div class="form-floating">
                  <input id="prevOgrn" type="text" class="form-control" :value="preview.ogrn" readonly placeholder="ОГРН" />
                  <label for="prevOgrn">ОГРН</label>
                </div>
              </div>
              <div class="col" v-if="props.showOkved && preview.okved">
                <div class="form-floating">
                  <input id="prevOkved" type="text" class="form-control" :value="preview.okved" readonly placeholder="ОКВЭД" />
                  <label for="prevOkved">ОКВЭД</label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
          <button type="button" class="btn btn-primary" @click="save" :disabled="!canSave">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>

