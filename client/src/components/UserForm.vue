<script setup>
import { reactive, watch, ref } from 'vue'
import { suggestFio, cleanFio } from '../dadata.js'

const props = defineProps({
  modelValue: Object,
  isNew: Boolean
})
const emit = defineEmits(['update:modelValue'])

const form = reactive({
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  phone: '',
  email: '',
})

const phoneInput = ref('')
const errors = reactive({})
const suggestions = reactive({
  last_name: [],
  first_name: [],
  patronymic: []
})
const timeouts = {
  last_name: null,
  first_name: null,
  patronymic: null
}

watch(
  () => props.modelValue,
  (val) => {
    Object.assign(form, val || {})
    phoneInput.value = formatPhone(form.phone || '')
  },
  { immediate: true }
)

watch(form, (val) => {
  emit('update:modelValue', { ...val })
})


function updateSuggestions(field, part) {
  clearTimeout(timeouts[field])
  const value = form[field]
  if (!value || value.length < 2) {
    suggestions[field] = []
    return
  }
  const query = `${form.last_name} ${form.first_name} ${form.patronymic}`.trim()
  timeouts[field] = setTimeout(async () => {
    suggestions[field] = await suggestFio(query, [part])
  }, 300)
}

watch(() => form.last_name, () => updateSuggestions('last_name', 'SURNAME'))
watch(() => form.first_name, () => updateSuggestions('first_name', 'NAME'))
watch(() => form.patronymic, () => updateSuggestions('patronymic', 'PATRONYMIC'))

function formatPhone(digits) {
  if (!digits) return ''
  let out = '+7'
  if (digits.length > 1) out += ' (' + digits.slice(1, 4)
  if (digits.length >= 4) out += ') '
  if (digits.length >= 4) out += digits.slice(4, 7)
  if (digits.length >= 7) out += '-' + digits.slice(7, 9)
  if (digits.length >= 9) out += '-' + digits.slice(9, 11)
  return out
}

function onPhoneInput(e) {
  let digits = e.target.value.replace(/\D/g, '')
  if (!digits.startsWith('7')) digits = '7' + digits.replace(/^7*/, '')
  digits = digits.slice(0, 11)
  form.phone = digits
  phoneInput.value = formatPhone(digits)
}

function onPhoneKeydown(e) {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    form.phone = form.phone.slice(0, -1)
    phoneInput.value = formatPhone(form.phone)
  }
}

async function onFioBlur() {
  const query = `${form.last_name} ${form.first_name} ${form.patronymic}`.trim()
  const cleaned = await cleanFio(query)
  if (cleaned) {
    if (cleaned.surname) form.last_name = cleaned.surname
    if (cleaned.name) form.first_name = cleaned.name
    if (cleaned.patronymic) form.patronymic = cleaned.patronymic
  }
  suggestions.last_name = []
  suggestions.first_name = []
  suggestions.patronymic = []
}

function applySuggestion(sug) {
  if (sug.data.surname) form.last_name = sug.data.surname
  if (sug.data.name) form.first_name = sug.data.name
  if (sug.data.patronymic) form.patronymic = sug.data.patronymic
  suggestions.last_name = []
  suggestions.first_name = []
  suggestions.patronymic = []
}

function validate() {
  errors.last_name = form.last_name ? '' : 'Введите фамилию'
  errors.first_name = form.first_name ? '' : 'Введите имя'
  if (!form.birth_date) {
    errors.birth_date = 'Введите дату рождения'
  } else {
    const date = new Date(form.birth_date)
    errors.birth_date = date <= new Date() ? '' : 'Введите корректную дату'
  }
  errors.phone = form.phone.length === 11 ? '' : 'Неверный номер'
  errors.email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
    ? ''
    : 'Неверный email'
  return !Object.values(errors).some(Boolean)
}

defineExpose({ validate })
</script>

<template>
  <div>
    <div class="mb-4">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title mb-3">Основные данные</h5>
          <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
            <div class="col position-relative">
              <label class="form-label">Фамилия</label>
              <input
                v-model="form.last_name"
                @blur="onFioBlur"
                class="form-control"
                :class="{ 'is-invalid': errors.last_name }"
                required
              />
              <div class="invalid-feedback">{{ errors.last_name }}</div>
              <ul
                v-if="suggestions.last_name.length"
                class="list-group position-absolute w-100"
              >
                <li
                  v-for="s in suggestions.last_name"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.data.surname }}
                </li>
              </ul>
            </div>
            <div class="col position-relative">
              <label class="form-label">Имя</label>
              <input
                v-model="form.first_name"
                @blur="onFioBlur"
                class="form-control"
                :class="{ 'is-invalid': errors.first_name }"
                required
              />
              <div class="invalid-feedback">{{ errors.first_name }}</div>
              <ul
                v-if="suggestions.first_name.length"
                class="list-group position-absolute w-100"
              >
                <li
                  v-for="s in suggestions.first_name"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.data.name }}
                </li>
              </ul>
            </div>
            <div class="col position-relative">
              <label class="form-label">Отчество</label>
              <input v-model="form.patronymic" @blur="onFioBlur" class="form-control" />
              <ul
                v-if="suggestions.patronymic.length"
                class="list-group position-absolute w-100"
              >
                <li
                  v-for="s in suggestions.patronymic"
                  :key="s.value"
                  class="list-group-item list-group-item-action"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  {{ s.data.patronymic }}
                </li>
              </ul>
            </div>
            <div class="col">
              <label class="form-label">Дата рождения</label>
              <input
                type="date"
                v-model="form.birth_date"
                class="form-control"
                :class="{ 'is-invalid': errors.birth_date }"
                required
              />
              <div class="invalid-feedback">{{ errors.birth_date }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-4">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title mb-3">Контакты</h5>
          <div class="row row-cols-1 row-cols-sm-2 g-3">
            <div class="col">
              <label class="form-label">Телефон</label>
              <input
                v-model="phoneInput"
                @input="onPhoneInput"
                @keydown="onPhoneKeydown"
                class="form-control"
                :class="{ 'is-invalid': errors.phone }"
                placeholder="+7 (___) ___-__-__"
                required
              />
              <div class="invalid-feedback">{{ errors.phone }}</div>
            </div>
            <div class="col">
              <label class="form-label">Email</label>
              <input
                type="email"
                v-model="form.email"
                class="form-control"
                :class="{ 'is-invalid': errors.email }"
                required
              />
              <div class="invalid-feedback">{{ errors.email }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>



    <p v-if="isNew" class="text-muted">Пароль будет сгенерирован автоматически</p>
  </div>
</template>
