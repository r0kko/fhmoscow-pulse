<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import type { ApiError } from '../api';
import { findBankByBic } from '../dadata';
import type { BankSuggestion } from '../dadata';
import { isValidAccountNumber } from '../utils/bank';

type BootstrapModalInstance = InstanceType<typeof Modal> & {
  dispose?: () => void;
};

interface BankDetails {
  bank_name: string;
  correspondent_account?: string | null;
  swift?: string | null;
  inn?: string | null;
  kpp?: string | null;
  address?: string | null;
}

interface BankAccount extends BankDetails {
  number: string;
  bic: string;
}

interface BankAccountResponse {
  account: BankAccount | null;
}

interface BankFormState {
  number: string;
  bic: string;
}

type CheckStatus = '' | 'pending' | 'found' | 'not_found';

const props = defineProps<{ userId: string }>();

const account = ref<BankAccount | null>(null);
const bank = ref<BankDetails | null>(null);
const error = ref('');
const checkStatus = ref<CheckStatus>('');
const form = reactive<BankFormState>({ number: '', bic: '' });
const modalRef = ref<HTMLDivElement | null>(null);
const modalInstance = ref<BootstrapModalInstance | null>(null);

onMounted(() => {
  if (modalRef.value) {
    modalInstance.value = new Modal(modalRef.value);
  }
  void loadAccount();
});

onBeforeUnmount(() => {
  const instance = modalInstance.value;
  instance?.hide();
  instance?.dispose?.();
  modalInstance.value = null;
});

function toMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'Неизвестная ошибка';
}

function isBankNotFound(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'string') return err === 'bank_account_not_found';
  if (err instanceof Error) {
    const apiErr = err as ApiError;
    return (
      apiErr.message === 'bank_account_not_found' ||
      apiErr.code === 'bank_account_not_found'
    );
  }
  if (typeof (err as { code?: string }).code === 'string') {
    return (err as { code?: string }).code === 'bank_account_not_found';
  }
  return false;
}

function extractDetails(source: BankAccount | null): BankDetails | null {
  if (!source) return null;
  return {
    bank_name: source.bank_name,
    correspondent_account: source.correspondent_account ?? null,
    swift: source.swift ?? null,
    inn: source.inn ?? null,
    kpp: source.kpp ?? null,
    address: source.address ?? null,
  };
}

function mapSuggestion(suggestion: BankSuggestion): BankDetails {
  const data = suggestion.data ?? {};
  return {
    bank_name: suggestion.value ?? '',
    correspondent_account: data.correspondent_account ?? null,
    swift: data.swift ?? null,
    inn: data.inn ?? null,
    kpp: data.kpp ?? null,
    address: data.address?.unrestricted_value ?? null,
  };
}

async function loadAccount(): Promise<void> {
  try {
    const response = await apiFetch<BankAccountResponse>(
      `/users/${props.userId}/bank-account`
    );
    account.value = response.account;
    bank.value = extractDetails(account.value);
    error.value = '';
    checkStatus.value = account.value ? 'found' : '';
  } catch (err) {
    if (isBankNotFound(err)) {
      account.value = null;
      bank.value = null;
      error.value = '';
      checkStatus.value = '';
      return;
    }
    account.value = null;
    bank.value = null;
    error.value = toMessage(err);
    checkStatus.value = '';
  }
}

function resetLookup(): void {
  bank.value = null;
  checkStatus.value = '';
}

function open(): void {
  if (account.value) {
    form.number = account.value.number;
    form.bic = account.value.bic;
    bank.value = extractDetails(account.value);
    checkStatus.value = bank.value ? 'found' : '';
  } else {
    form.number = '';
    form.bic = '';
    resetLookup();
  }
  error.value = '';
  modalInstance.value?.show();
}

async function checkBank(): Promise<void> {
  const bic = form.bic.replace(/\s+/g, '').trim();
  if (!bic) {
    resetLookup();
    return;
  }
  checkStatus.value = 'pending';
  bank.value = null;
  const suggestion = await findBankByBic(bic);
  if (suggestion) {
    bank.value = mapSuggestion(suggestion);
    checkStatus.value = 'found';
  } else {
    checkStatus.value = 'not_found';
  }
}

function sanitizeForm(): BankFormState {
  return {
    number: form.number.replace(/\s+/g, '').trim(),
    bic: form.bic.replace(/\s+/g, '').trim(),
  };
}

async function save(): Promise<void> {
  const payload = sanitizeForm();
  if (!isValidAccountNumber(payload.number, payload.bic)) {
    error.value = 'Неверный счёт или БИК';
    return;
  }
  error.value = '';
  try {
    const method = account.value ? 'PUT' : 'POST';
    const response = await apiFetch<BankAccountResponse>(
      `/users/${props.userId}/bank-account`,
      {
        method,
        body: JSON.stringify(payload),
      }
    );
    account.value = response.account;
    bank.value = extractDetails(account.value);
    checkStatus.value = account.value ? 'found' : '';
    form.number = payload.number;
    form.bic = payload.bic;
    modalInstance.value?.hide();
  } catch (err) {
    error.value = toMessage(err);
  }
}

async function removeAccount(): Promise<void> {
  const confirmFn = typeof window !== 'undefined' ? window.confirm : undefined;
  if (confirmFn && !confirmFn('Удалить счёт?')) return;
  try {
    await apiFetch(`/users/${props.userId}/bank-account`, { method: 'DELETE' });
    account.value = null;
    resetLookup();
    modalInstance.value?.hide();
  } catch (err) {
    error.value = toMessage(err);
  }
}
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm mt-4">
    <div class="card-body p-2">
      <div class="d-flex justify-content-between mb-3">
        <h5 class="card-title mb-0">Банковский счёт</h5>
        <button
          type="button"
          class="btn btn-link p-0"
          aria-label="Редактировать банковский счёт"
          @click="open"
        >
          <i class="bi bi-pencil"></i>
        </button>
      </div>
      <div v-if="account">
        <div class="row row-cols-1 row-cols-sm-2 g-3 mb-3">
          <div class="col">
            <div class="form-floating">
              <input
                id="accountNumber"
                type="text"
                class="form-control"
                :value="account.number"
                readonly
                placeholder="Счёт"
              />
              <label for="accountNumber">Счёт</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input
                id="accountBic"
                type="text"
                class="form-control"
                :value="account.bic"
                readonly
                placeholder="БИК"
              />
              <label for="accountBic">БИК</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input
                id="bankName"
                type="text"
                class="form-control"
                :value="account.bank_name"
                readonly
                placeholder="Банк"
              />
              <label for="bankName">Банк</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input
                id="corrAcc"
                type="text"
                class="form-control"
                :value="account.correspondent_account"
                readonly
                placeholder="Корсчёт"
              />
              <label for="corrAcc">Корсчёт</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input
                id="swift"
                type="text"
                class="form-control"
                :value="account.swift"
                readonly
                placeholder="SWIFT"
              />
              <label for="swift">SWIFT</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input
                id="bankInn"
                type="text"
                class="form-control"
                :value="account.inn"
                readonly
                placeholder="ИНН"
              />
              <label for="bankInn">ИНН</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input
                id="bankKpp"
                type="text"
                class="form-control"
                :value="account.kpp"
                readonly
                placeholder="КПП"
              />
              <label for="bankKpp">КПП</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea
                id="bankAddress"
                class="form-control"
                rows="2"
                :value="account.address"
                readonly
                placeholder="Адрес"
              ></textarea>
              <label for="bankAddress">Адрес</label>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="alert alert-warning p-2 mb-2">Счёт не указан.</div>
      <div v-if="error" class="text-danger mt-2">{{ error }}</div>
    </div>
  </div>

  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form @submit.prevent="save">
          <div class="modal-header">
            <h2 class="modal-title h5">
              {{ account ? 'Изменить счёт' : 'Добавить счёт' }}
            </h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="modalInstance?.hide()"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <div class="form-floating mb-3">
              <input
                id="modalAccNumber"
                v-model="form.number"
                class="form-control"
                placeholder="Счёт"
              />
              <label for="modalAccNumber">Расчётный счёт</label>
            </div>
            <div class="form-floating mb-3">
              <input
                id="modalBic"
                v-model="form.bic"
                class="form-control"
                placeholder="БИК"
                :disabled="!form.number"
              />
              <label for="modalBic">БИК</label>
            </div>
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="checkBank"
            >
              Проверить
            </button>
            <div v-if="checkStatus === 'pending'" class="mt-2">Проверка...</div>
            <div v-if="checkStatus === 'not_found'" class="text-danger mt-2">
              Банк не найден
            </div>
            <div v-if="checkStatus === 'found' && bank" class="mt-3">
              <div class="mb-2 form-floating">
                <input
                  id="checkBankName"
                  type="text"
                  class="form-control"
                  :value="bank.bank_name"
                  readonly
                  placeholder="Банк"
                />
                <label for="checkBankName">Банк</label>
              </div>
              <div class="mb-2 form-floating">
                <input
                  id="checkCorr"
                  type="text"
                  class="form-control"
                  :value="bank.correspondent_account"
                  readonly
                  placeholder="Корсчёт"
                />
                <label for="checkCorr">Корсчёт</label>
              </div>
              <div class="mb-2 form-floating">
                <input
                  id="checkSwift"
                  type="text"
                  class="form-control"
                  :value="bank.swift"
                  readonly
                  placeholder="SWIFT"
                />
                <label for="checkSwift">SWIFT</label>
              </div>
              <div class="mb-2 form-floating">
                <input
                  id="checkInn"
                  type="text"
                  class="form-control"
                  :value="bank.inn"
                  readonly
                  placeholder="ИНН"
                />
                <label for="checkInn">ИНН</label>
              </div>
              <div class="mb-2 form-floating">
                <input
                  id="checkKpp"
                  type="text"
                  class="form-control"
                  :value="bank.kpp"
                  readonly
                  placeholder="КПП"
                />
                <label for="checkKpp">КПП</label>
              </div>
              <div class="mb-2 form-floating">
                <textarea
                  id="checkAddress"
                  class="form-control"
                  rows="2"
                  :value="bank.address"
                  readonly
                  placeholder="Адрес"
                ></textarea>
                <label for="checkAddress">Адрес</label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              v-if="account"
              type="button"
              class="btn btn-danger me-auto"
              aria-label="Удалить счёт"
              @click="removeAccount"
            >
              <i class="bi bi-trash"></i>
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              @click="modalInstance?.hide()"
            >
              Отмена
            </button>
            <button type="submit" class="btn btn-brand">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
