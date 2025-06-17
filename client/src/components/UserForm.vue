<script setup>
import { reactive, watch, ref } from 'vue'

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

function validate() {
  errors.last_name = form.last_name ? '' : 'Введите фамилию'
  errors.first_name = form.first_name ? '' : 'Введите имя'
  errors.birth_date = form.birth_date ? '' : 'Введите дату рождения'
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
    <div class="mb-3">
      <label class="form-label">Фамилия</label>
      <input v-model="form.last_name" class="form-control" :class="{ 'is-invalid': errors.last_name }" required />
      <div class="invalid-feedback">{{ errors.last_name }}</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Имя</label>
      <input v-model="form.first_name" class="form-control" :class="{ 'is-invalid': errors.first_name }" required />
      <div class="invalid-feedback">{{ errors.first_name }}</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Отчество</label>
      <input v-model="form.patronymic" class="form-control" />
    </div>
    <div class="mb-3">
      <label class="form-label">Дата рождения</label>
      <input type="date" v-model="form.birth_date" class="form-control" :class="{ 'is-invalid': errors.birth_date }" required />
      <div class="invalid-feedback">{{ errors.birth_date }}</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Телефон</label>
      <input v-model="phoneInput" @input="onPhoneInput" @keydown="onPhoneKeydown" class="form-control" :class="{ 'is-invalid': errors.phone }" placeholder="+7 (___) ___-__-__" required />
      <div class="invalid-feedback">{{ errors.phone }}</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Email</label>
      <input type="email" v-model="form.email" class="form-control" :class="{ 'is-invalid': errors.email }" required />
      <div class="invalid-feedback">{{ errors.email }}</div>
    </div>
    <p v-if="isNew" class="text-muted">Пароль будет сгенерирован автоматически</p>
  </div>
</template>
