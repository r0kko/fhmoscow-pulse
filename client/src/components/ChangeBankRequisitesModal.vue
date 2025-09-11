<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { isValidAccountNumber } from '../utils/bank.js';
import { findBankByBic } from '../dadata.js';
import { useToast } from '../utils/toast.js';

const emit = defineEmits(['created']);

const modalRef = ref(null);
let modal;
const step = ref(1);
const number = ref('');
const bic = ref('');
const bank = ref(null);
const error = ref('');
const loading = ref(false);
const { showToast } = useToast();
const bicChecking = ref(false);
const canSubmit = computed(() => {
  if (loading.value) return false;
  if (step.value !== 2) return false;
  if (bicChecking.value) return false;
  if (bic.value.length !== 9) return false;
  if (!bank.value) return false;
  return isValidAccountNumber(number.value, bic.value);
});

function reset() {
  step.value = 1;
  number.value = '';
  bic.value = '';
  bank.value = null;
  error.value = '';
}

function open() {
  reset();
  modal.show();
}

function close() {
  if (!loading.value) modal.hide();
}

function onNumberInput(e) {
  const digits = String(e.target.value || '')
    .replace(/\D+/g, '')
    .slice(0, 20);
  number.value = digits;
}

function onBicInput(e) {
  const digits = String(e.target.value || '')
    .replace(/\D+/g, '')
    .slice(0, 9);
  bic.value = digits;
}

async function nextStep() {
  // Require 20 digits first
  if (number.value.length !== 20) {
    error.value = 'Введите номер счёта из 20 цифр';
    return;
  }
  error.value = '';
  step.value = 2;
}

async function validateBic() {
  bank.value = null;
  if (bic.value.length !== 9) return;
  bicChecking.value = true;
  try {
    const res = await findBankByBic(bic.value);
    bank.value = res;
  } catch (_) {
    bank.value = null;
  } finally {
    bicChecking.value = false;
  }
}

watch(bic, async (val, prev) => {
  if (val.length === 9 && val !== prev) {
    await validateBic();
  } else if (val.length < 9) {
    bank.value = null;
  }
});

async function submit() {
  if (loading.value) return;
  error.value = '';
  if (number.value.length !== 20) {
    error.value = 'Введите номер счёта из 20 цифр';
    return;
  }
  if (bic.value.length !== 9) {
    error.value = 'Введите БИК из 9 цифр';
    return;
  }
  if (!isValidAccountNumber(number.value, bic.value)) {
    error.value = 'Проверьте номер счёта и БИК';
    return;
  }
  if (!bank.value) {
    error.value = 'Банк не найден по указанному БИК';
    return;
  }
  loading.value = true;
  try {
    const res = await apiFetch('/bank-accounts/change-request', {
      method: 'POST',
      body: JSON.stringify({ number: number.value, bic: bic.value }),
    });
    showToast('Создано заявление на изменение реквизитов', 'success');
    modal.hide();
    emit('created', res.document);
  } catch (e) {
    if (e?.message === 'sign_type_simple_required') {
      error.value =
        'Требуется простая электронная подпись. Настройте её в разделе «Документы»';
    } else {
      error.value = e.message || 'Не удалось отправить запрос';
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  modal = new Modal(modalRef.value);
});

defineExpose({ open, close });
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Изменение банковских реквизитов</h5>
          <button
            type="button"
            class="btn-close"
            :disabled="loading"
            @click="close"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
          </div>

          <div v-if="step === 1">
            <label for="accNumber" class="form-label">Номер счёта</label>
            <input
              id="accNumber"
              class="form-control"
              :value="number"
              @input="onNumberInput"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="20"
              placeholder="20 цифр"
              autocomplete="off"
            />
            <div class="form-text">Введите 20-значный номер счёта</div>
          </div>

          <div v-else>
            <label for="accBic" class="form-label">БИК</label>
            <input
              id="accBic"
              class="form-control"
              :value="bic"
              @input="onBicInput"
              @change="validateBic"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="9"
              placeholder="9 цифр"
              autocomplete="off"
            />
            <div class="form-text">Введите БИК банка (9 цифр)</div>
            <div v-if="bicChecking" class="small text-muted mt-1">
              Проверяем БИК…
            </div>
            <div v-if="bank" class="mt-2 small text-muted">
              Банк: <strong>{{ bank.value }}</strong>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="loading"
            @click="close"
          >
            Отмена
          </button>
          <button
            v-if="step === 1"
            type="button"
            class="btn btn-brand"
            :disabled="number.length !== 20 || loading"
            @click="nextStep"
          >
            Далее
          </button>
          <button
            v-else
            type="button"
            class="btn btn-brand"
            :disabled="!canSubmit"
            @click="submit"
          >
            Отправить запрос
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
