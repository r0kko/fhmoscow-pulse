<script setup>
import { reactive, watch, ref, computed } from 'vue'
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
    return ''
  }
  return until.toISOString().slice(0, 10)
}

const autoValidUntil = computed(() =>
  calculateValidUntil(props.birthDate, form.issue_date)
)

const validUntilLocked = computed(
  () =>
    isLocked('valid_until') ||
    (form.country === 'RU' &&
      form.document_type === 'CIVIL' &&
      autoValidUntil.value &&
      autoValidUntil.value === form.valid_until)
)

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
  form.valid_until = calculateValidUntil(props.birthDate, form.issue_date)
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
      <div class="row row-cols-1 row-cols-md-2 g-3">
        <div class="col">
          <div class="form-floating">
            <input
              id="docType"
              class="form-control"
              value="Паспорт гражданина"
              readonly
              placeholder="Тип документа"
            />
            <label for="docType">Тип документа</label>
          </div>
        </div>
        <div class="col">
          <div class="form-floating">
            <input
              id="country"
              class="form-control"
              value="Российская Федерация"
              readonly
              placeholder="Страна"
            />
            <label for="country">Страна</label>
          </div>
        </div>
        <div class="col">
          <div class="form-floating">
            <input
              id="series"
              v-model="form.series"
              @input="onSeriesInput"
              class="form-control"
              :class="{ 'is-invalid': errors.series }"
              :disabled="isLocked('series')"
              placeholder="Серия"
            />
            <label for="series">Серия</label>
            <div class="invalid-feedback">{{ errors.series }}</div>
          </div>
        </div>
        <div class="col">
          <div class="form-floating">
            <input
              id="number"
              v-model="form.number"
              @input="onNumberInput"
              class="form-control"
              :class="{ 'is-invalid': errors.number }"
              :disabled="isLocked('number')"
              placeholder="Номер"
            />
            <label for="number">Номер</label>
            <div class="invalid-feedback">{{ errors.number }}</div>
          </div>
        </div>
        <div class="col">
          <div class="form-floating">
            <input
              id="issueDate"
              type="date"
              v-model="form.issue_date"
              class="form-control"
              :class="{ 'is-invalid': errors.issue_date }"
              :disabled="isLocked('issue_date')"
              placeholder="Дата выдачи"
            />
            <label for="issueDate">Дата выдачи</label>
            <div class="invalid-feedback">{{ errors.issue_date }}</div>
          </div>
        </div>
        <div class="col">
          <div class="form-floating">
            <input
              id="validUntil"
              type="date"
              v-model="form.valid_until"
              class="form-control"
              :disabled="validUntilLocked"
              placeholder="Действителен до"
            />
            <label for="validUntil">Действителен до</label>
          </div>
        </div>
        <div class="col position-relative">
          <div class="form-floating">
            <input
              id="issuedBy"
              v-model="form.issuing_authority"
              class="form-control"
              :class="{ 'is-invalid': errors.issuing_authority }"
              :disabled="isLocked('issuing_authority')"
              placeholder="Кем выдан"
            />
            <label for="issuedBy">Кем выдан</label>
            <div class="invalid-feedback d-block">{{ errors.issuing_authority }}</div>
          </div>
        </div>
        <div class="col position-relative">
          <div class="form-floating">
            <input
              id="issuingCode"
              v-model="form.issuing_authority_code"
              class="form-control"
              :class="{ 'is-invalid': errors.issuing_authority_code }"
              :disabled="isLocked('issuing_authority_code')"
              placeholder="Код подразделения"
            />
            <label for="issuingCode">Код подразделения</label>
            <div class="invalid-feedback">{{ errors.issuing_authority_code }}</div>
          </div>
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
          <div class="form-floating">
            <input
              id="birthPlace"
              v-model="form.place_of_birth"
              class="form-control"
              :class="{ 'is-invalid': errors.place_of_birth }"
              :disabled="isLocked('place_of_birth')"
              placeholder="Место рождения"
            />
            <label for="birthPlace">Место рождения</label>
            <div class="invalid-feedback">{{ errors.place_of_birth }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
