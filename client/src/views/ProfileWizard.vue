<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { auth } from '../auth.js'
import UserForm from '../components/UserForm.vue'
import PassportForm from '../components/PassportForm.vue'
import { cleanPassport, findBankByBic } from '../dadata.js'
import { isValidInn, isValidSnils, formatSnils } from '../utils/personal.js'
import { isValidAccountNumber } from '../utils/bank.js'

const router = useRouter()
const step = ref(auth.user?.status === 'REGISTRATION_STEP_2' ? 2 : 1)
const total = 4
const user = ref({})
const inn = ref('')
const snilsDigits = ref('')
const snilsInput = ref('')
const passport = ref({})
const passportLocked = ref(false)
const passportLockFields = ref({})
function isExpired(p) {
  if (!p.valid_until) return false
  return new Date(p.valid_until) < new Date()
}
const bank = ref({ number: '', bic: '' })
const bankInfo = ref(null)
const bankCheckStatus = ref('')
const error = ref('')
const loading = ref(false)
const formRef = ref(null)
const passportRef = ref(null)

onMounted(async () => {
  try {
    const data = await apiFetch('/users/me')
    user.value = data.user
  } catch (_) {}
  try {
    const data = await apiFetch('/inns/me?prefill=1')
    inn.value = data.inn.number.replace(/\D/g, '')
  } catch (_) {}
  try {
    const data = await apiFetch('/snils/me?prefill=1')
    snilsInput.value = formatSnils(data.snils.number.replace(/\D/g, ''))
    snilsDigits.value = data.snils.number.replace(/\D/g, '')
  } catch (_) {}
  try {
    const data = await apiFetch('/passports/me?prefill=1')
    passport.value = data.passport
    if (passport.value.series && passport.value.number) {
      const cleaned = await cleanPassport(`${passport.value.series} ${passport.value.number}`)
      passportLocked.value = cleaned && cleaned.qc === 0 && !isExpired(passport.value)
      if (passportLocked.value) {
        passportLockFields.value = {
          series: true,
          number: true,
          issue_date: true,
          issuing_authority_code: !!passport.value.issuing_authority_code,
        }
      }
    }
  } catch (_) {}
  try {
    const data = await apiFetch('/bank-accounts/me?prefill=1')
    bank.value.number = data.account.number
    bank.value.bic = data.account.bic
    const info = await findBankByBic(bank.value.bic)
    if (info) {
      bankInfo.value = {
        bank_name: info.value,
        correspondent_account: info.data.correspondent_account,
      }
      bankCheckStatus.value = 'found'
    }
  } catch (_) {}
})

function onInnInput(e) {
  inn.value = e.target.value.replace(/\D/g, '').slice(0, 12)
}

function onSnilsInput(e) {
  let digits = e.target.value.replace(/\D/g, '').slice(0, 11)
  snilsDigits.value = digits
  snilsInput.value = formatSnils(digits)
}

async function checkBank() {
  bankCheckStatus.value = 'pending'
  bankInfo.value = null
  const info = await findBankByBic(bank.value.bic)
  if (info) {
    bankInfo.value = {
      bank_name: info.value,
      correspondent_account: info.data.correspondent_account,
    }
    bankCheckStatus.value = 'found'
  } else {
    bankCheckStatus.value = 'not_found'
  }
}

async function saveStep() {
  loading.value = true
  error.value = ''
  try {
    if (step.value === 1) {
      if (!formRef.value.validate()) {
        loading.value = false
        return
      }
      const payload = {
        first_name: user.value.first_name,
        last_name: user.value.last_name,
        patronymic: user.value.patronymic,
        birth_date: user.value.birth_date,
        phone: user.value.phone,
        email: user.value.email
      }
      await apiFetch('/users/me', {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      await apiFetch('/profile/progress', {
        method: 'POST',
        body: JSON.stringify({ status: 'REGISTRATION_STEP_2' })
      })
      auth.user.status = 'REGISTRATION_STEP_2'
      step.value = 2
      loading.value = false
      return
    }
    if (step.value === 2) {
      if (!isValidSnils(snilsInput.value)) {
        error.value = 'Неверный СНИЛС'
        return
      }
      if (!isValidInn(inn.value)) {
        error.value = 'Неверный ИНН'
        return
      }
      await apiFetch('/snils', {
        method: 'POST',
        body: JSON.stringify({ number: snilsInput.value })
      })
      await apiFetch('/inns', {
        method: 'POST',
        body: JSON.stringify({ number: inn.value })
      })
      step.value = 3
      loading.value = false
      return
    }
    if (step.value === 3) {
      if (passportLocked.value) {
        step.value = 4
        loading.value = false
        return
      }
      if (passportRef.value && !passportRef.value.validate()) {
        loading.value = false
        return
      }
      const cleaned = await cleanPassport(`${passport.value.series} ${passport.value.number}`)
      if (!cleaned || cleaned.qc !== 0) {
        error.value = 'Паспорт недействителен'
        return
      }
      if (passport.value.id) {
        await apiFetch('/passports', { method: 'DELETE' })
      }
      await apiFetch('/passports', {
        method: 'POST',
        body: JSON.stringify(passport.value)
      })
      passportLocked.value = !isExpired(passport.value)
      if (passportLocked.value) {
        passportLockFields.value = {
          series: true,
          number: true,
          issue_date: true,
          issuing_authority_code: !!passport.value.issuing_authority_code,
        }
      }
      step.value = 4
      loading.value = false
      return
    }
    if (!isValidAccountNumber(bank.value.number, bank.value.bic)) {
      error.value = 'Неверные банковские данные'
      return
    }
    if (bankCheckStatus.value !== 'found') {
      await checkBank()
      if (bankCheckStatus.value !== 'found') {
        error.value = 'Банк не найден'
        return
      }
    }
    if (!bank.value.id) {
      await apiFetch('/bank-accounts', {
        method: 'POST',
        body: JSON.stringify(bank.value)
      })
    }
    await apiFetch('/profile/complete', { method: 'POST' })
    auth.user.status = 'AWAITING_CONFIRMATION'
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 600px">
    <h1 class="mb-4 text-center">Заполнение профиля</h1>
    <div class="progress mb-4">
      <div class="progress-bar" role="progressbar" :style="{ width: (step / total) * 100 + '%' }"></div>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <form @submit.prevent="saveStep">
      <div v-if="step === 1" class="mb-4">
        <UserForm ref="formRef" v-model="user" :locked="true" />
      </div>
      <div v-else-if="step === 2" class="mb-4">
        <div class="form-floating mb-3">
          <input
            id="snils"
            v-model="snilsInput"
            @input="onSnilsInput"
            class="form-control"
            placeholder="СНИЛС"
          />
          <label for="snils">СНИЛС</label>
        </div>
        <div class="form-floating">
          <input
            id="inn"
            v-model="inn"
            @input="onInnInput"
            class="form-control"
            placeholder="ИНН"
          />
          <label for="inn">ИНН</label>
        </div>
      </div>
      <div v-else-if="step === 3" class="mb-4">
        <PassportForm
          ref="passportRef"
          v-model="passport"
          :birth-date="user.birth_date"
          :locked-fields="passportLockFields"
        />
        <div v-if="passportLocked" class="alert alert-success mt-3">Паспорт проверен</div>
      </div>
      <div v-else-if="step === 4" class="mb-4">
        <div class="form-floating mb-3">
          <input
            id="accNum"
            v-model="bank.number"
            class="form-control"
            placeholder="Счёт"
          />
          <label for="accNum">Расчётный счёт</label>
        </div>
        <div class="form-floating">
          <input
            id="bic"
            v-model="bank.bic"
            class="form-control"
            placeholder="БИК"
          />
          <label for="bic">БИК</label>
        </div>
        <button type="button" class="btn btn-outline-secondary mt-3" @click="checkBank">Проверить</button>
        <div v-if="bankCheckStatus === 'pending'" class="mt-2">Проверка...</div>
        <div v-if="bankCheckStatus === 'not_found'" class="text-danger mt-2">Банк не найден</div>
        <div v-if="bankCheckStatus === 'found' && bankInfo" class="mt-3">
          <div class="form-floating mb-2">
            <input class="form-control" :value="bankInfo.bank_name" readonly placeholder="Банк" />
            <label>Банк</label>
          </div>
          <div class="form-floating">
            <input class="form-control" :value="bankInfo.correspondent_account" readonly placeholder="Корсчёт" />
            <label>Корсчёт</label>
          </div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary w-100" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ step < total ? 'Все верно, продолжить' : 'Завершить' }}
      </button>
    </form>
  </div>
</template>
