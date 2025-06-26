<script setup>
import { reactive, watch, ref } from 'vue'
import { suggestFmsUnit } from '../dadata.js'

const props = defineProps({
  modelValue: Object,
  locked: { type: Boolean, default: false },
  lockedFields: Object,
  birthDate: String
})
const emit = defineEmits(['update:modelValue'])

const form = reactive({
  document_type: 'CIVIL',
  country: 'RU',
  series: '',
  number: '',
  issue_date: '',
  valid_until: '',
  issuing_authority: '',
  issuing_authority_code: '',
  place_of_birth: ''
})

const errors = reactive({
  series: '',
  number: '',
  issue_date: '',
  issuing_authority: '',
  issuing_authority_code: '',
  place_of_birth: '',
})
const suggestions = ref([])
const timeout = ref(null)

function isLocked(field) {
  return props.locked || (props.lockedFields && props.lockedFields[field])
}

watch(
  () => props.modelValue,
  (val) => {
    Object.assign(form, val || {})
  },
  { immediate: true }
)

watch(form, (val) => {
  emit('update:modelValue', { ...val })
})

function updateSuggestions() {
  if (isLocked('issuing_authority') && isLocked('issuing_authority_code')) return
  clearTimeout(timeout.value)
  const q = form.issuing_authority_code || form.issuing_authority
  if (!q || q.length < 3) {
    suggestions.value = []
    return
  }
  timeout.value = setTimeout(async () => {
    suggestions.value = await suggestFmsUnit(q)
  }, 300)
}

watch(
  () => [form.issuing_authority, form.issuing_authority_code],
  updateSuggestions
)

function onSeriesInput(e) {
  form.series = e.target.value.replace(/\D/g, '').slice(0, 4)
}

function onNumberInput(e) {
  form.number = e.target.value.replace(/\D/g, '').slice(0, 6)
}

function applySuggestion(s) {
  form.issuing_authority = s.data.name
  form.issuing_authority_code = s.data.code
  suggestions.value = []
}

function calcValid() {
  if (form.country !== 'RU' || form.document_type !== 'CIVIL') return
  if (!props.birthDate || !form.issue_date) return
  const birth = new Date(props.birthDate)
  const issue = new Date(form.issue_date)
  const age = (issue - birth) / (365.25 * 24 * 3600 * 1000)
  let until
  if (age < 20) {
    until = new Date(birth)
    until.setFullYear(until.getFullYear() + 20)
  } else if (age < 45) {
    until = new Date(birth)
    until.setFullYear(until.getFullYear() + 45)
  } else {
    until = ''
  }
  form.valid_until = until ? until.toISOString().slice(0, 10) : ''
}

watch(
  () => [form.issue_date, form.country, form.document_type, props.birthDate],
  calcValid
)

function validate() {
  errors.series = form.series ? '' : 'Введите серию'
  errors.number = form.number ? '' : 'Введите номер'
  errors.issue_date = form.issue_date ? '' : 'Введите дату'
  errors.issuing_authority_code = form.issuing_authority_code
    ? ''
    : 'Укажите код'
  errors.issuing_authority = form.issuing_authority
    ? ''
    : 'Выберите подразделение'
  errors.place_of_birth = form.place_of_birth ? '' : 'Введите место рождения'
  return !Object.values(errors).some(Boolean)
}

defineExpose({ validate })
</script>

<template>
  <div class="card">
    <div class="card-body">
      <h5 class="card-title mb-3">Паспорт</h5>
      <div v-if="props.locked || Object.keys(props.lockedFields || {}).length" class="alert alert-success">Паспорт подтвержден</div>
      <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
        <div class="col">
          <label class="form-label">Тип документа</label>
          <input
            class="form-control"
            value="Паспорт гражданина"
            readonly
          />
        </div>
        <div class="col">
          <label class="form-label">Страна</label>
          <input class="form-control" value="Российская Федерация" readonly />
        </div>
        <div class="col">
          <label class="form-label">Серия</label>
          <input
            v-model="form.series"
            @input="onSeriesInput"
            class="form-control"
            :class="{ 'is-invalid': errors.series }"
            :disabled="isLocked('series')"
          />
          <div class="invalid-feedback">{{ errors.series }}</div>
        </div>
        <div class="col">
          <label class="form-label">Номер</label>
          <input
            v-model="form.number"
            @input="onNumberInput"
            class="form-control"
            :class="{ 'is-invalid': errors.number }"
            :disabled="isLocked('number')"
          />
          <div class="invalid-feedback">{{ errors.number }}</div>
        </div>
        <div class="col">
          <label class="form-label">Дата выдачи</label>
          <input
            type="date"
            v-model="form.issue_date"
            class="form-control"
            :class="{ 'is-invalid': errors.issue_date }"
            :disabled="isLocked('issue_date')"
          />
          <div class="invalid-feedback">{{ errors.issue_date }}</div>
        </div>
        <div class="col">
          <label class="form-label">Действителен до</label>
          <input type="date" v-model="form.valid_until" class="form-control" />
        </div>
        <div class="col position-relative">
          <label class="form-label">Кем выдан</label>
          <input
            v-model="form.issuing_authority"
            class="form-control"
            :class="{ 'is-invalid': errors.issuing_authority }"
            :disabled="isLocked('issuing_authority')"
          />
          <div class="invalid-feedback d-block">{{ errors.issuing_authority }}</div>
        </div>
        <div class="col position-relative">
          <label class="form-label">Код подразделения</label>
          <input
            v-model="form.issuing_authority_code"
            class="form-control"
            :class="{ 'is-invalid': errors.issuing_authority_code }"
            :disabled="isLocked('issuing_authority_code')"
          />
          <div class="invalid-feedback">{{ errors.issuing_authority_code }}</div>
          <ul
            v-if="suggestions.length"
            class="list-group position-absolute w-100"
            style="z-index: 1050"
          >
            <li
              v-for="s in suggestions"
              :key="s.value"
              class="list-group-item list-group-item-action"
              @mousedown.prevent="applySuggestion(s)"
            >
              {{ s.value }}
            </li>
          </ul>
        </div>
        <div class="col">
          <label class="form-label">Место рождения</label>
          <input
            v-model="form.place_of_birth"
            class="form-control"
            :class="{ 'is-invalid': errors.place_of_birth }"
            :disabled="isLocked('place_of_birth')"
          />
          <div class="invalid-feedback">{{ errors.place_of_birth }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
