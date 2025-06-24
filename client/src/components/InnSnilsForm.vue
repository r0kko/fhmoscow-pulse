<script setup>
import { ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { apiFetch } from '../api.js'
import { isValidInn, isValidSnils, formatSnils } from '../utils/personal.js'

const props = defineProps({ userId: { type: String, required: true } })

const inn = ref(null)
const snils = ref(null)
const error = ref('')

const modalRef = ref(null)
let modal
const mode = ref('') // 'inn' or 'snils'
const innInput = ref('')
const snilsDigits = ref('')
const snilsInput = ref('')

onMounted(() => {
  modal = new Modal(modalRef.value)
  loadData()
})

async function loadData() {
  error.value = ''
  try {
    const { inn: data } = await apiFetch(`/users/${props.userId}/inn`)
    inn.value = data
  } catch (_) {
    inn.value = null
  }
  try {
    const { snils: data } = await apiFetch(`/users/${props.userId}/snils`)
    snils.value = data
  } catch (_) {
    snils.value = null
  }
}

function openEdit(type) {
  error.value = ''
  mode.value = type
  if (type === 'inn') {
    innInput.value = inn.value ? inn.value.number : ''
  } else {
    snilsDigits.value = snils.value ? snils.value.number.replace(/\D/g, '') : ''
    snilsInput.value = formatSnils(snilsDigits.value)
  }
  modal.show()
}

function onInnInput(e) {
  let digits = e.target.value.replace(/\D/g, '')
  digits = digits.slice(0, 12)
  innInput.value = digits
}

function onSnilsInput(e) {
  let digits = e.target.value.replace(/\D/g, '')
  digits = digits.slice(0, 11)
  snilsDigits.value = digits
  snilsInput.value = formatSnils(digits)
}

async function save() {
  if (mode.value === 'inn') {
    if (!isValidInn(innInput.value)) {
      error.value = 'Неверный ИНН'
      return
    }
    const body = JSON.stringify({ number: innInput.value })
    try {
      if (inn.value) await apiFetch(`/users/${props.userId}/inn`, { method: 'PUT', body })
      else await apiFetch(`/users/${props.userId}/inn`, { method: 'POST', body })
      inn.value = { number: innInput.value }
      modal.hide()
    } catch (e) {
      error.value = e.message
    }
  } else {
    const formatted = formatSnils(snilsDigits.value)
    if (!isValidSnils(formatted)) {
      error.value = 'Неверный СНИЛС'
      return
    }
    const body = JSON.stringify({ number: formatted })
    try {
      if (snils.value) await apiFetch(`/users/${props.userId}/snils`, { method: 'PUT', body })
      else await apiFetch(`/users/${props.userId}/snils`, { method: 'POST', body })
      snils.value = { number: formatted }
      modal.hide()
    } catch (e) {
      error.value = e.message
    }
  }
}

async function removeItem() {
  if (!confirm('Удалить данные?')) return
  if (mode.value === 'inn') {
    try {
      await apiFetch(`/users/${props.userId}/inn`, { method: 'DELETE' })
      inn.value = null
      modal.hide()
    } catch (e) {
      error.value = e.message
    }
  } else {
    try {
      await apiFetch(`/users/${props.userId}/snils`, { method: 'DELETE' })
      snils.value = null
      modal.hide()
    } catch (e) {
      error.value = e.message
    }
  }
}
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <h5 class="card-title mb-3">ИНН и СНИЛС</h5>
      <div class="row row-cols-1 row-cols-sm-2 g-3">
        <div class="col">
          <label class="form-label">ИНН</label>
          <div class="input-group">
            <input type="text" class="form-control" :value="inn ? inn.number : ''" readonly />
            <button class="btn btn-outline-primary" @click="openEdit('inn')">
              <i class="bi" :class="inn ? 'bi-pencil' : 'bi-plus'"></i>
            </button>
          </div>
        </div>
        <div class="col">
          <label class="form-label">СНИЛС</label>
          <div class="input-group">
            <input type="text" class="form-control" :value="snils ? snils.number : ''" readonly />
            <button class="btn btn-outline-primary" @click="openEdit('snils')">
              <i class="bi" :class="snils ? 'bi-pencil' : 'bi-plus'"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form @submit.prevent="save">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ mode === 'inn' ? (inn ? 'Изменить ИНН' : 'Добавить ИНН') : (snils ? 'Изменить СНИЛС' : 'Добавить СНИЛС') }}
            </h5>
            <button type="button" class="btn-close" @click="modal.hide()"></button>
          </div>
          <div class="modal-body">
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <div v-if="mode === 'inn'">
              <input
                v-model="innInput"
                @input="onInnInput"
                class="form-control"
                placeholder="12 цифр"
              />
            </div>
            <div v-else>
              <input
                v-model="snilsInput"
                @input="onSnilsInput"
                class="form-control"
                placeholder="XXX-XXX-XXX YY"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button
              v-if="(mode === 'inn' && inn) || (mode === 'snils' && snils)"
              type="button"
              class="btn btn-danger me-auto"
              @click="removeItem"
            >
              Удалить
            </button>
            <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
            <button type="submit" class="btn btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
