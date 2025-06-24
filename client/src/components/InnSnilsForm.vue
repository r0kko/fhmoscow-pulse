<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../api.js'
import { isValidInn, isValidSnils, formatSnils } from '../utils/personal.js'

const props = defineProps({ userId: { type: String, required: true } })

const inn = ref('')
const snils = ref('')
const innDigits = ref('')
const snilsDigits = ref('')
const hasInn = ref(false)
const hasSnils = ref(false)
const error = ref('')

onMounted(loadData)

async function loadData() {
  error.value = ''
  try {
    const data = await apiFetch(`/users/${props.userId}/inn`)
    innDigits.value = data.inn.number
    hasInn.value = true
  } catch (_) {
    hasInn.value = false
  }
  try {
    const data = await apiFetch(`/users/${props.userId}/snils`)
    snilsDigits.value = data.snils.number.replace(/\D/g, '')
    hasSnils.value = true
  } catch (_) {
    hasSnils.value = false
  }
  inn.value = innDigits.value
  snils.value = formatSnils(snilsDigits.value)
}

function onInnInput(e) {
  let digits = e.target.value.replace(/\D/g, '')
  digits = digits.slice(0, 12)
  innDigits.value = digits
  inn.value = digits
}

function onSnilsInput(e) {
  let digits = e.target.value.replace(/\D/g, '')
  digits = digits.slice(0, 11)
  snilsDigits.value = digits
  snils.value = formatSnils(digits)
}

async function saveInn() {
  if (!isValidInn(innDigits.value)) {
    error.value = 'Неверный ИНН'
    return
  }
  const body = JSON.stringify({ number: innDigits.value })
  try {
    if (hasInn.value) await apiFetch(`/users/${props.userId}/inn`, { method: 'PUT', body })
    else await apiFetch(`/users/${props.userId}/inn`, { method: 'POST', body })
    hasInn.value = true
    error.value = ''
  } catch (e) {
    error.value = e.message
  }
}

async function deleteInn() {
  try {
    await apiFetch(`/users/${props.userId}/inn`, { method: 'DELETE' })
    innDigits.value = ''
    inn.value = ''
    hasInn.value = false
    error.value = ''
  } catch (e) {
    error.value = e.message
  }
}

async function saveSnils() {
  const formatted = formatSnils(snilsDigits.value)
  if (!isValidSnils(formatted)) {
    error.value = 'Неверный СНИЛС'
    return
  }
  const body = JSON.stringify({ number: formatted })
  try {
    if (hasSnils.value) await apiFetch(`/users/${props.userId}/snils`, { method: 'PUT', body })
    else await apiFetch(`/users/${props.userId}/snils`, { method: 'POST', body })
    hasSnils.value = true
    error.value = ''
  } catch (e) {
    error.value = e.message
  }
}

async function deleteSnils() {
  try {
    await apiFetch(`/users/${props.userId}/snils`, { method: 'DELETE' })
    snilsDigits.value = ''
    snils.value = ''
    hasSnils.value = false
    error.value = ''
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <h5 class="card-title mb-3">ИНН и СНИЛС</h5>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div class="row row-cols-1 row-cols-sm-2 g-3">
        <div class="col">
          <label class="form-label">ИНН</label>
          <input
            v-model="inn"
            @input="onInnInput"
            class="form-control"
            placeholder="12 цифр"
          />
          <div class="mt-2">
            <button class="btn btn-primary me-2" @click="saveInn">Сохранить</button>
            <button v-if="hasInn" class="btn btn-danger" @click="deleteInn">Удалить</button>
          </div>
        </div>
        <div class="col">
          <label class="form-label">СНИЛС</label>
          <input
            v-model="snils"
            @input="onSnilsInput"
            class="form-control"
            placeholder="XXX-XXX-XXX YY"
          />
          <div class="mt-2">
            <button class="btn btn-primary me-2" @click="saveSnils">Сохранить</button>
            <button v-if="hasSnils" class="btn btn-danger" @click="deleteSnils">Удалить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
