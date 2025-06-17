<script setup>
import { reactive, watch } from 'vue'

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
  password: ''
})

watch(() => props.modelValue, (val) => {
  Object.assign(form, val || {})
})

watch(form, (val) => {
  emit('update:modelValue', { ...val })
})
</script>

<template>
  <div>
    <div class="mb-3">
      <label class="form-label">Фамилия</label>
      <input v-model="form.last_name" class="form-control" required />
    </div>
    <div class="mb-3">
      <label class="form-label">Имя</label>
      <input v-model="form.first_name" class="form-control" required />
    </div>
    <div class="mb-3">
      <label class="form-label">Отчество</label>
      <input v-model="form.patronymic" class="form-control" />
    </div>
    <div class="mb-3">
      <label class="form-label">Дата рождения</label>
      <input type="date" v-model="form.birth_date" class="form-control" required />
    </div>
    <div class="mb-3">
      <label class="form-label">Телефон</label>
      <input v-model="form.phone" class="form-control" required />
    </div>
    <div class="mb-3">
      <label class="form-label">Email</label>
      <input type="email" v-model="form.email" class="form-control" required />
    </div>
    <div class="mb-3" v-if="isNew">
      <label class="form-label">Пароль</label>
      <input type="password" v-model="form.password" class="form-control" required />
    </div>
  </div>
</template>
