<script setup>
import { ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
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
      <h5 class="card-title mb-3">Банковский счёт</h5>
      <div v-if="account">
        <div class="row row-cols-1 row-cols-sm-2 g-3 mb-3">
          <div class="col">
            <label class="form-label">Счёт</label>
            <input type="text" class="form-control" :value="account.number" readonly />
          </div>
          <div class="col">
            <label class="form-label">БИК</label>
            <input type="text" class="form-control" :value="account.bic" readonly />
          </div>
          <div class="col">
            <label class="form-label">Банк</label>
            <input type="text" class="form-control" :value="account.bank_name" readonly />
          </div>
          <div class="col">
            <label class="form-label">Корсчёт</label>
            <input type="text" class="form-control" :value="account.correspondent_account" readonly />
          </div>
          <div class="col">
            <label class="form-label">SWIFT</label>
            <input type="text" class="form-control" :value="account.swift" readonly />
          </div>
          <div class="col">
            <label class="form-label">ИНН</label>
            <input type="text" class="form-control" :value="account.inn" readonly />
          </div>
          <div class="col">
            <label class="form-label">КПП</label>
            <input type="text" class="form-control" :value="account.kpp" readonly />
          </div>
          <div class="col-12">
            <label class="form-label">Адрес</label>
            <textarea class="form-control" rows="2" :value="account.address" readonly />
          </div>
        </div>
      </div>
      <p v-else class="mb-2 text-muted">Счёт не указан.</p>
      <button class="btn btn-outline-primary" @click="open">
        {{ account ? 'Изменить' : 'Добавить' }}
      </button>
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
            <div class="mb-3">
              <label class="form-label">Расчётный счёт</label>
              <input v-model="form.number" class="form-control" placeholder="20 цифр" />
            </div>
            <div class="mb-3">
              <label class="form-label">БИК</label>
              <input v-model="form.bic" class="form-control" placeholder="9 цифр" />
            </div>
            <button type="button" class="btn btn-outline-secondary" @click="checkBank">
              Проверить
            </button>
            <div v-if="checkStatus === 'pending'" class="mt-2">Проверка...</div>
            <div v-if="checkStatus === 'not_found'" class="text-danger mt-2">Банк не найден</div>
            <div v-if="checkStatus === 'found' && bank" class="mt-3">
              <div class="mb-2">
                <label class="form-label">Банк</label>
                <input type="text" class="form-control" :value="bank.bank_name" readonly />
              </div>
              <div class="mb-2">
                <label class="form-label">Корсчёт</label>
                <input type="text" class="form-control" :value="bank.correspondent_account" readonly />
              </div>
              <div class="mb-2">
                <label class="form-label">SWIFT</label>
                <input type="text" class="form-control" :value="bank.swift" readonly />
              </div>
              <div class="mb-2">
                <label class="form-label">ИНН</label>
                <input type="text" class="form-control" :value="bank.inn" readonly />
              </div>
              <div class="mb-2">
                <label class="form-label">КПП</label>
                <input type="text" class="form-control" :value="bank.kpp" readonly />
              </div>
              <div class="mb-2">
                <label class="form-label">Адрес</label>
                <textarea class="form-control" rows="2" :value="bank.address" readonly />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button v-if="account" type="button" class="btn btn-danger me-auto" @click="removeAccount">Удалить</button>
            <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
            <button type="submit" class="btn btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

