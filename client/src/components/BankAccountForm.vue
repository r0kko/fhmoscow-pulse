<script setup>
import { ref, onMounted } from 'vue'
import Modal from 'bootstrap/js/dist/modal'
import { apiFetch } from '../api.js'
import { findBankByBic } from '../dadata.js'
import { isValidAccountNumber } from '../utils/bank.js'

const props = defineProps({ userId: { type: String, required: true } })

const account = ref(null)
const error = ref('')
const modalRef = ref(null)
let modal
const form = ref({ number: '', bic: '' })
const bank = ref(null)
const checkStatus = ref('')

onMounted(() => {
  modal = new Modal(modalRef.value)
  loadAccount()
})

async function loadAccount() {
  try {
    const { account: acc } = await apiFetch(`/users/${props.userId}/bank-account`)
    account.value = acc
    error.value = ''
  } catch (e) {
    if (e.message === 'bank_account_not_found') {
      account.value = null
      error.value = ''
    } else {
      error.value = e.message
    }
  }
}

function open() {
  if (account.value) {
    form.value.number = account.value.number
    form.value.bic = account.value.bic
    bank.value = { ...account.value }
    checkStatus.value = 'found'
  } else {
    form.value.number = ''
    form.value.bic = ''
    bank.value = null
    checkStatus.value = ''
  }
  error.value = ''
  modal.show()
}

async function checkBank() {
  checkStatus.value = 'pending'
  bank.value = null
  const res = await findBankByBic(form.value.bic)
  if (res) {
    bank.value = {
      bank_name: res.value,
      correspondent_account: res.data.correspondent_account,
      swift: res.data.swift,
      inn: res.data.inn,
      kpp: res.data.kpp,
      address: res.data.address?.unrestricted_value,
    }
    checkStatus.value = 'found'
  } else {
    checkStatus.value = 'not_found'
  }
}

async function save() {
  if (!isValidAccountNumber(form.value.number, form.value.bic)) {
    error.value = 'Неверный счёт или БИК'
    return
  }
  const payload = { number: form.value.number, bic: form.value.bic }
  try {
    let res
    if (account.value) {
      res = await apiFetch(`/users/${props.userId}/bank-account`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    } else {
      res = await apiFetch(`/users/${props.userId}/bank-account`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
    account.value = res.account
    modal.hide()
  } catch (e) {
    error.value = e.message
  }
}

async function removeAccount() {
  if (!confirm('Удалить счёт?')) return
  try {
    await apiFetch(`/users/${props.userId}/bank-account`, { method: 'DELETE' })
    account.value = null
    modal.hide()
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <div class="d-flex justify-content-between mb-3">
        <h5 class="card-title mb-0">Банковский счёт</h5>
        <button type="button" class="btn btn-link p-0" @click="open">
          <i class="bi bi-pencil"></i>
        </button>
      </div>
      <div v-if="account">
        <div class="row row-cols-1 row-cols-sm-2 g-3 mb-3">
          <div class="col">
            <div class="form-floating">
              <input id="accountNumber" type="text" class="form-control" :value="account.number" readonly placeholder="Счёт" />
              <label for="accountNumber">Счёт</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input id="accountBic" type="text" class="form-control" :value="account.bic" readonly placeholder="БИК" />
              <label for="accountBic">БИК</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input id="bankName" type="text" class="form-control" :value="account.bank_name" readonly placeholder="Банк" />
              <label for="bankName">Банк</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input id="corrAcc" type="text" class="form-control" :value="account.correspondent_account" readonly placeholder="Корсчёт" />
              <label for="corrAcc">Корсчёт</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input id="swift" type="text" class="form-control" :value="account.swift" readonly placeholder="SWIFT" />
              <label for="swift">SWIFT</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input id="bankInn" type="text" class="form-control" :value="account.inn" readonly placeholder="ИНН" />
              <label for="bankInn">ИНН</label>
            </div>
          </div>
          <div class="col">
            <div class="form-floating">
              <input id="bankKpp" type="text" class="form-control" :value="account.kpp" readonly placeholder="КПП" />
              <label for="bankKpp">КПП</label>
            </div>
          </div>
          <div class="col-12">
            <div class="form-floating">
              <textarea id="bankAddress" class="form-control" rows="2" :value="account.address" readonly placeholder="Адрес"></textarea>
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
            <h5 class="modal-title">{{ account ? 'Изменить счёт' : 'Добавить счёт' }}</h5>
            <button type="button" class="btn-close" @click="modal.hide()"></button>
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
            <button type="button" class="btn btn-outline-secondary" @click="checkBank">
              Проверить
            </button>
            <div v-if="checkStatus === 'pending'" class="mt-2">Проверка...</div>
            <div v-if="checkStatus === 'not_found'" class="text-danger mt-2">Банк не найден</div>
            <div v-if="checkStatus === 'found' && bank" class="mt-3">
              <div class="mb-2 form-floating">
                <input id="checkBankName" type="text" class="form-control" :value="bank.bank_name" readonly placeholder="Банк" />
                <label for="checkBankName">Банк</label>
              </div>
              <div class="mb-2 form-floating">
                <input id="checkCorr" type="text" class="form-control" :value="bank.correspondent_account" readonly placeholder="Корсчёт" />
                <label for="checkCorr">Корсчёт</label>
              </div>
              <div class="mb-2 form-floating">
                <input id="checkSwift" type="text" class="form-control" :value="bank.swift" readonly placeholder="SWIFT" />
                <label for="checkSwift">SWIFT</label>
              </div>
              <div class="mb-2 form-floating">
                <input id="checkInn" type="text" class="form-control" :value="bank.inn" readonly placeholder="ИНН" />
                <label for="checkInn">ИНН</label>
              </div>
              <div class="mb-2 form-floating">
                <input id="checkKpp" type="text" class="form-control" :value="bank.kpp" readonly placeholder="КПП" />
                <label for="checkKpp">КПП</label>
              </div>
              <div class="mb-2 form-floating">
                <textarea id="checkAddress" class="form-control" rows="2" :value="bank.address" readonly placeholder="Адрес"></textarea>
                <label for="checkAddress">Адрес</label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button v-if="account" type="button" class="btn btn-danger me-auto" @click="removeAccount">
              <i class="bi bi-trash"></i>
            </button>
            <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
            <button type="submit" class="btn btn-brand">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

