<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';

const emit = defineEmits(['signed']);
const props = defineProps({
  userEmail: { type: String, default: '' },
});

const modalRef = ref(null);
let modal;
const doc = ref(null);
const code = ref('');
const sending = ref(false);
const error = ref('');
const resendCooldown = ref(0);
let timer = null;
const { showToast } = useToast();
const inputRef = ref(null);

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const maskedName =
    name.length <= 2
      ? name[0] + '*'
      : name[0] + '*'.repeat(Math.max(1, name.length - 2)) + name.at(-1);
  const [d1, ...rest] = domain.split('.');
  const maskedDomain =
    d1.length <= 2
      ? d1[0] + '*'
      : d1[0] + '*'.repeat(Math.max(1, d1.length - 2)) + d1.at(-1);
  return `${maskedName}@${[maskedDomain, ...rest].filter(Boolean).join('.')}`;
}

function startCooldown(seconds = 30) {
  clearInterval(timer);
  resendCooldown.value = seconds;
  timer = setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0) {
      clearInterval(timer);
      timer = null;
      resendCooldown.value = 0;
    }
  }, 1000);
}

async function sendCode() {
  if (!doc.value) return;
  try {
    await apiFetch(`/documents/${doc.value.id}/send-code`, { method: 'POST' });
    startCooldown();
    showToast('Код отправлен на e-mail', 'secondary');
  } catch (e) {
    error.value = e.message || 'Не удалось отправить код';
  }
}

async function confirm() {
  if (!doc.value || sending.value) return;
  sending.value = true;
  error.value = '';
  try {
    await apiFetch(`/documents/${doc.value.id}/sign`, {
      method: 'POST',
      body: JSON.stringify({ code: code.value }),
    });
    showToast('Документ подписан', 'success');
    modal.hide();
    emit('signed');
  } catch (e) {
    error.value = e.message || 'Не удалось подписать документ';
  } finally {
    sending.value = false;
  }
}

function open(d) {
  doc.value = d;
  code.value = '';
  error.value = '';
  resendCooldown.value = 0;
  modal.show();
  // Request code immediately on open
  sendCode();
  // Focus input for quick entry
  nextTick(() => {
    try {
      inputRef.value?.focus?.();
    } catch {
      /* ignore focus errors */
    }
  });
}

function close() {
  if (!sending.value) modal.hide();
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});

// Keep only digits; auto-submit when length is 6
watch(code, (v) => {
  const digits = String(v || '')
    .replace(/\D+/g, '')
    .slice(0, 6);
  if (digits !== v) code.value = digits;
  if (digits.length === 6 && !sending.value) {
    setTimeout(() => confirm(), 0);
  }
});

defineExpose({ open });
</script>

<template>
  <div
    ref="modalRef"
    class="modal fade"
    tabindex="-1"
    aria-hidden="true"
    role="dialog"
    aria-modal="true"
    aria-labelledby="docSignModalTitle"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="docSignModalTitle" class="modal-title">
            Подписание документа
            <span v-if="doc" class="text-muted">· № {{ doc.number }}</span>
          </h5>
          <button
            type="button"
            class="btn-close"
            :disabled="sending"
            aria-label="Close"
            @click="close"
          ></button>
        </div>
        <div class="modal-body">
          <p v-if="doc" class="mb-2">
            Документ: <strong>{{ doc.name }}</strong>
          </p>
          <p v-if="props.userEmail" class="text-muted small mb-3">
            Код отправлен на e‑mail
            <strong>{{ maskEmail(props.userEmail) }}</strong>
          </p>
          <div
            v-if="error"
            class="alert alert-danger"
            role="alert"
            aria-live="assertive"
          >
            {{ error }}
          </div>

          <label for="docSignCode" class="form-label">Код из письма</label>
          <input
            id="docSignCode"
            ref="inputRef"
            v-model="code"
            class="form-control"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="one-time-code"
            maxlength="6"
            aria-describedby="docSignHelp"
            @keyup.enter="code.length === 6 && !sending ? confirm() : null"
          />
          <div id="docSignHelp" class="form-text" aria-live="polite">
            Введите 6-значный код подтверждения, отправленный на вашу почту
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="sending"
            @click="close"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="resendCooldown > 0 || sending"
            @click="sendCode"
          >
            <span v-if="resendCooldown > 0"
              >Отправить код ({{ resendCooldown }} с)</span
            >
            <span v-else>Отправить код</span>
          </button>
          <button
            type="button"
            class="btn btn-brand"
            :disabled="code.length !== 6 || sending"
            @click="confirm"
          >
            <span
              v-if="sending"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
