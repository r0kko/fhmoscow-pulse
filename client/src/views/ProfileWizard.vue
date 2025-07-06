<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { auth } from '../auth.js'
import UserForm from '../components/UserForm.vue'
import PassportForm from '../components/PassportForm.vue'
import { cleanPassport, findBankByBic } from '../dadata.js'
import { isValidInn, isValidSnils, formatSnils } from '../utils/personal.js'
import { isValidAccountNumber } from '../utils/bank.js'

function calculateValidUntil(birthDate, issueDate) {
  if (!birthDate || !issueDate) return ''
  const birth = new Date(birthDate)
  const issue = new Date(issueDate)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(issue.getTime())) return ''
  const age = (issue - birth) / (365.25 * 24 * 3600 * 1000)
  let until
  if (age < 20) {
    until = new Date(birth)
    until.setFullYear(until.getFullYear() + 20)
  } else if (age < 45) {
    until = new Date(birth)
    until.setFullYear(until.getFullYear() + 45)
  } else {
    until = new Date(birth)
    until.setFullYear(until.getFullYear() + 100)
    return until.toISOString().slice(0, 10)
  }
  until.setDate(until.getDate() + 90)
  return until.toISOString().slice(0, 10)
}

const router = useRouter()
const step = ref(
  auth.user?.status?.startsWith('REGISTRATION_STEP_')
    ? parseInt(auth.user.status.split('_').pop()) || 1
    : 1
)
const total = 5
const user = ref({})
const inn = ref('')
const innLocked = ref(false)
const snilsDigits = ref('')
const snilsInput = ref('')
const snilsLocked = ref(false)
const passport = ref({})
const passportLocked = ref(false)
const passportLockFields = ref({})
function isExpired(p) {
  if (!p.valid_until) return false
  return new Date(p.valid_until) < new Date()
}
const regAddress = ref('')
const resAddress = ref('')
const sameAddress = ref(false)
const addrIds = ref({ REGISTRATION: null, RESIDENCE: null })
const bank = ref({ number: '', bic: '' })
const bankInfo = ref(null)
const bankCheckStatus = ref('')
const bankLocked = ref(false)
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
    const data = await apiFetch('/inns/me')
    inn.value = data.inn.number.replace(/\D/g, '')
    innLocked.value = Boolean(data.inn.id) || isValidInn(inn.value)
  } catch (_) {}
  try {
    const data = await apiFetch('/snils/me')
    snilsInput.value = formatSnils(data.snils.number.replace(/\D/g, ''))
    snilsDigits.value = data.snils.number.replace(/\D/g, '')
    snilsLocked.value = Boolean(data.snils.id) || isValidSnils(snilsDigits.value)
  } catch (_) {}
  try {
    const data = await apiFetch('/passports/me')
    passport.value = data.passport
    passportLockFields.value = {
      series: !!passport.value.series,
      number: !!passport.value.number,
      issue_date: !!passport.value.issue_date,
      valid_until:
        calculateValidUntil(
          user.value.birth_date,
          passport.value.issue_date
        ) === passport.value.valid_until,
      issuing_authority:
        !!passport.value.issuing_authority &&
        !!passport.value.issuing_authority_code,
      issuing_authority_code: !!passport.value.issuing_authority_code,
      place_of_birth: !!passport.value.place_of_birth,
    }
    if (passport.value.series && passport.value.number) {
      const cleaned = await cleanPassport(`${passport.value.series} ${passport.value.number}`)
      passportLocked.value =
        cleaned &&
        cleaned.qc === 0 &&
        !isExpired(passport.value) &&
        Object.values(passportLockFields.value).every(Boolean)
    }
  } catch (_) {}
  try {
    const data = await apiFetch('/addresses/REGISTRATION')
    addrIds.value.REGISTRATION = data.address.id || null
    regAddress.value = data.address.result
  } catch (_) {}
  try {
    const data = await apiFetch('/addresses/RESIDENCE')
    addrIds.value.RESIDENCE = data.address.id || null
    resAddress.value = data.address.result
  } catch (_) {}
  try {
    const data = await apiFetch('/bank-accounts/me')
    bank.value.number = data.account.number
    bank.value.bic = data.account.bic
    const info = await findBankByBic(bank.value.bic)
    if (info) {
      bankInfo.value = {
        bank_name: info.value,
        correspondent_account: info.data.correspondent_account,
      }
      bankCheckStatus.value = 'found'
      bankLocked.value = true
    }
  } catch (_) {}
  if (
    step.value === 3 &&
    passportLocked.value &&
    Object.values(passportLockFields.value).every(Boolean)
  ) {
    step.value = 4
  }
})

function onInnInput(e) {
  inn.value = e.target.value.replace(/\D/g, '').slice(0, 12)
}

function onSnilsInput(e) {
  let digits = e.target.value.replace(/\D/g, '').slice(0, 11)
  snilsDigits.value = digits
  snilsInput.value = formatSnils(digits)
}

watch(
  () => bank.value.bic,
  async (val) => {
    if (bankLocked.value) return
    if (val && val.length === 9) {
      await checkBank()
    } else {
      bankCheckStatus.value = ''
      bankInfo.value = null
    }
  }
)

watch(
  () => bank.value.number,
  (val) => {
    if (!bankLocked.value && bankCheckStatus.value === 'found' && isValidAccountNumber(val, bank.value.bic)) {
      bankLocked.value = true
    }
  }
)

watch(
  () => sameAddress.value,
  (val) => {
    if (val) {
      resAddress.value = regAddress.value
    }
  }
)

watch(
  () => regAddress.value,
  (val) => {
    if (sameAddress.value) {
      resAddress.value = val
    }
  }
)

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
    if (isValidAccountNumber(bank.value.number, bank.value.bic)) {
      bankLocked.value = true
    }
  } else {
    bankCheckStatus.value = 'not_found'
  }
}

async function saveStep() {
  loading.value = true
  error.value = ''
  try {
    if (step.value === 1) {
      if (!formRef.value?.validate || !formRef.value.validate()) {
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
      await apiFetch('/profile/progress', {
        method: 'POST',
        body: JSON.stringify({ status: 'REGISTRATION_STEP_3' })
      })
      auth.user.status = 'REGISTRATION_STEP_3'
      snilsLocked.value = true
      innLocked.value = true
      step.value = 3
      loading.value = false
      return
    }
    if (step.value === 3) {
      if (
        passportLocked.value &&
        Object.values(passportLockFields.value).every(Boolean)
      ) {
        step.value = 4
        loading.value = false
        return
      }
      if (passportRef.value && (!passportRef.value.validate || !passportRef.value.validate())) {
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
      passportLockFields.value = {
        series: !!passport.value.series,
        number: !!passport.value.number,
        issue_date: !!passport.value.issue_date,
        valid_until:
          calculateValidUntil(
            user.value.birth_date,
            passport.value.issue_date
          ) === passport.value.valid_until,
        issuing_authority:
          !!passport.value.issuing_authority &&
          !!passport.value.issuing_authority_code,
        issuing_authority_code: !!passport.value.issuing_authority_code,
        place_of_birth: !!passport.value.place_of_birth,
      }
      step.value = 4
      loading.value = false
      return
    }
    if (step.value === 4) {
      if (regAddress.value) {
        const body = JSON.stringify({ result: regAddress.value })
        if (addrIds.value.REGISTRATION) {
          await apiFetch(`/addresses/REGISTRATION`, { method: 'PUT', body })
        } else {
          const res = await apiFetch(`/addresses/REGISTRATION`, {
            method: 'POST',
            body,
          })
          addrIds.value.REGISTRATION = res.address.id
        }
      }
      const resVal = sameAddress.value ? regAddress.value : resAddress.value
      if (resVal) {
        const body = JSON.stringify({ result: resVal })
        if (addrIds.value.RESIDENCE) {
          await apiFetch(`/addresses/RESIDENCE`, { method: 'PUT', body })
        } else {
          const res = await apiFetch(`/addresses/RESIDENCE`, {
            method: 'POST',
            body,
          })
          addrIds.value.RESIDENCE = res.address.id
        }
      }
      step.value = 5
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
            :disabled="snilsLocked"
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
            :disabled="innLocked"
          />
          <label for="inn">ИНН</label>
        </div>
        <div v-if="innLocked && snilsLocked" class="alert alert-success mt-3">
          Данные импортированы корректно
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
          <textarea
            id="regAddr"
            v-model="regAddress"
            class="form-control"
            rows="3"
            placeholder="Адрес регистрации"
          ></textarea>
          <label for="regAddr">Адрес регистрации</label>
        </div>
        <div class="form-check mb-3">
          <input
            id="sameAddr"
            v-model="sameAddress"
            class="form-check-input"
            type="checkbox"
          />
          <label for="sameAddr" class="form-check-label">Совпадает с адресом проживания</label>
        </div>
        <div class="form-floating">
          <textarea
            id="resAddr"
            v-model="resAddress"
            class="form-control"
            rows="3"
            placeholder="Адрес проживания"
            :disabled="sameAddress"
          ></textarea>
          <label for="resAddr">Адрес проживания</label>
        </div>
      </div>
      <div v-else-if="step === 5" class="mb-4">
        <div class="form-floating mb-3">
          <input
            id="accNum"
            v-model="bank.number"
            class="form-control"
            placeholder="Счёт"
            :disabled="bankLocked"
          />
          <label for="accNum">Расчётный счёт</label>
        </div>
        <div class="form-floating">
          <input
            id="bic"
            v-model="bank.bic"
            class="form-control"
            placeholder="БИК"
            :disabled="bankLocked"
          />
          <label for="bic">БИК</label>
        </div>
        <button
          v-if="!bankLocked"
          type="button"
          class="btn btn-outline-secondary mt-3"
          @click="checkBank"
        >
          Проверить
        </button>
        <div v-if="bankCheckStatus === 'pending'" class="mt-2">Проверка...</div>
        <div v-if="bankCheckStatus === 'not_found'" class="text-danger mt-2">Банк не найден</div>
        <div v-if="bankLocked && bankInfo" class="alert alert-success mt-3">Данные импортированы корректно</div>
        <div v-else-if="bankCheckStatus === 'found' && bankInfo" class="mt-3">
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
      <button type="submit" class="btn btn-brand w-100" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ step < total ? 'Все верно, продолжить' : 'Завершить' }}
      </button>
    </form>
  </div>
</template>
