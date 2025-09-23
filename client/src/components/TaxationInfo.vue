<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';

interface TaxationType {
  name?: string | null;
}

interface TaxationStatuses {
  dadata: number | null;
  fns: number | null;
}

interface TaxationRecord {
  id?: string;
  type?: TaxationType | null;
  check_date?: string | null;
  registration_date?: string | null;
  ogrn?: string | null;
  okved?: string | null;
}

interface TaxationResponse {
  taxation: TaxationRecord | null;
}

interface TaxationPreview extends TaxationRecord {
  statuses?: TaxationStatuses | null;
}

interface TaxationCheckResponse {
  preview: TaxationPreview;
}

type CheckSource = 'all' | 'dadata' | 'fns';

const props = withDefaults(
  defineProps<{
    userId?: string | null;
    editable?: boolean;
    showOkved?: boolean;
    modalOnly?: boolean;
  }>(),
  {
    userId: null,
    editable: true,
    showOkved: true,
    modalOnly: false,
  }
);

const taxation = ref<TaxationRecord | null>(null);
const error = ref('');
const loading = ref(false);
const modalRef = ref<HTMLDivElement | null>(null);
let modal: InstanceType<typeof Modal> | null = null;
const preview = ref<TaxationPreview | null>(null);
const checkStatus = ref<'pending' | 'success' | 'error' | ''>('');
const checkError = ref('');
const statuses = ref<TaxationStatuses>({ dadata: null, fns: null });

const emit = defineEmits<{
  (e: 'saved', taxation: TaxationRecord | null): void;
}>();

function statusIcon(code: number | null | undefined): string {
  if (code === 200) return 'bi-check-circle text-success';
  if (code) return 'bi-exclamation-circle text-danger';
  return 'bi-question-circle text-muted';
}

function statusText(code: number | null | undefined): string {
  if (code === 200) return 'OK';
  if (code) return 'Error';
  return '—';
}

const canSave = computed(
  () => statuses.value.dadata === 200 && statuses.value.fns === 200
);

function formatDate(str?: string | null): string {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  if (!y || !m || !d) return str;
  return `${d}.${m}.${y}`;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const path = props.userId
      ? `/users/${props.userId}/taxation`
      : '/taxations/me';
    const data = await apiFetch<TaxationResponse>(path);
    taxation.value = data.taxation;
  } catch (e) {
    taxation.value = null;
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function resetCheckState(): void {
  preview.value = null;
  checkStatus.value = '';
  checkError.value = '';
  statuses.value = { dadata: null, fns: null };
}

function openModal(): void {
  if (!props.editable) return;
  resetCheckState();
  modal?.show();
  void runCheck();
}

async function runCheck(source: CheckSource = 'all'): Promise<void> {
  if (!props.editable) return;
  checkStatus.value = 'pending';
  const path = props.userId
    ? `/users/${props.userId}/taxation/check`
    : '/taxations/me/check';
  const url = source !== 'all' ? `${path}?source=${source}` : path;
  try {
    const data = await apiFetch<TaxationCheckResponse>(url, { method: 'POST' });
    preview.value = data.preview;
    statuses.value = data.preview.statuses ?? { dadata: null, fns: null };
    checkStatus.value = 'success';
  } catch (e) {
    checkStatus.value = 'error';
    checkError.value = e instanceof Error ? e.message : String(e);
  }
}

async function save(): Promise<void> {
  if (!props.editable) return;
  const path = props.userId
    ? `/users/${props.userId}/taxation`
    : '/taxations/me';
  try {
    const data = await apiFetch<TaxationResponse>(path, { method: 'POST' });
    taxation.value = data.taxation;
    emit('saved', data.taxation);
    modal?.hide();
  } catch (e) {
    checkError.value = e instanceof Error ? e.message : String(e);
  }
}

function hideModal(): void {
  modal?.hide();
}

onMounted(() => {
  if (props.editable) {
    modal = new Modal(modalRef.value);
  }
  void load();
});

onBeforeUnmount(() => {
  modal?.hide();
  modal?.dispose();
  modal = null;
});

watch(
  () => props.userId,
  () => {
    void load();
  }
);

defineExpose({ openModal });
</script>

<template>
  <div
    v-if="!props.modalOnly"
    class="card section-card tile fade-in shadow-sm mt-4"
  >
    <div class="card-body p-2">
      <div class="d-flex justify-content-between mb-3">
        <h2 class="card-title h5 mb-0">Налоговый статус</h2>
        <button
          v-if="props.editable"
          type="button"
          class="btn btn-link p-0"
          aria-label="Обновить статус"
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
              <span class="input-group-text"
                ><i class="bi bi-file-earmark-text"></i
              ></span>
              <div class="form-floating flex-grow-1">
                <input
                  id="taxType"
                  type="text"
                  class="form-control"
                  :value="taxation.type?.name"
                  readonly
                  placeholder="Тип"
                />
                <label for="taxType">Тип</label>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="input-group">
              <span class="input-group-text"
                ><i class="bi bi-calendar-check"></i
              ></span>
              <div class="form-floating flex-grow-1">
                <input
                  id="taxCheck"
                  type="text"
                  class="form-control"
                  :value="formatDate(taxation.check_date)"
                  readonly
                  placeholder="Проверено"
                />
                <label for="taxCheck">Проверено</label>
              </div>
            </div>
          </div>
          <div v-if="taxation.registration_date" class="col">
            <div class="input-group">
              <span class="input-group-text"
                ><i class="bi bi-calendar"></i
              ></span>
              <div class="form-floating flex-grow-1">
                <input
                  id="taxReg"
                  type="text"
                  class="form-control"
                  :value="formatDate(taxation.registration_date)"
                  readonly
                  placeholder="Регистрация"
                />
                <label for="taxReg">Регистрация</label>
              </div>
            </div>
          </div>
          <div v-if="taxation.ogrn" class="col">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-hash"></i></span>
              <div class="form-floating flex-grow-1">
                <input
                  id="taxOgrn"
                  type="text"
                  class="form-control"
                  :value="taxation.ogrn"
                  readonly
                  placeholder="ОГРН"
                />
                <label for="taxOgrn">ОГРН</label>
              </div>
            </div>
          </div>
          <div v-if="props.showOkved && taxation.okved" class="col">
            <div class="input-group">
              <span class="input-group-text"
                ><i class="bi bi-briefcase"></i
              ></span>
              <div class="form-floating flex-grow-1">
                <input
                  id="taxOkved"
                  type="text"
                  class="form-control"
                  :value="taxation.okved"
                  readonly
                  placeholder="ОКВЭД"
                />
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
          <h2 class="modal-title h5">Проверка налогового статуса</h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="hideModal"
          ></button>
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
            <button
              class="btn btn-link p-0 ms-auto"
              aria-label="Проверить статус"
              @click="runCheck()"
            >
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
                  <input
                    id="prevType"
                    type="text"
                    class="form-control"
                    :value="preview.type?.name"
                    readonly
                    placeholder="Тип"
                  />
                  <label for="prevType">Тип</label>
                </div>
              </div>
              <div class="col">
                <div class="form-floating">
                  <input
                    id="prevCheck"
                    type="text"
                    class="form-control"
                    :value="formatDate(preview.check_date)"
                    readonly
                    placeholder="Проверено"
                  />
                  <label for="prevCheck">Проверено</label>
                </div>
              </div>
              <div v-if="preview.registration_date" class="col">
                <div class="form-floating">
                  <input
                    id="prevReg"
                    type="text"
                    class="form-control"
                    :value="formatDate(preview.registration_date)"
                    readonly
                    placeholder="Регистрация"
                  />
                  <label for="prevReg">Регистрация</label>
                </div>
              </div>
              <div v-if="preview.ogrn" class="col">
                <div class="form-floating">
                  <input
                    id="prevOgrn"
                    type="text"
                    class="form-control"
                    :value="preview.ogrn"
                    readonly
                    placeholder="ОГРН"
                  />
                  <label for="prevOgrn">ОГРН</label>
                </div>
              </div>
              <div v-if="props.showOkved && preview.okved" class="col">
                <div class="form-floating">
                  <input
                    id="prevOkved"
                    type="text"
                    class="form-control"
                    :value="preview.okved"
                    readonly
                    placeholder="ОКВЭД"
                  />
                  <label for="prevOkved">ОКВЭД</label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="hideModal">
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-brand"
            :disabled="!canSave"
            @click="save"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Uses global .section-card from brand.css */

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
