<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'
import { Modal } from 'bootstrap'

const router = useRouter()

const user = ref({
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  phone: '',
  email: ''
})
const formRef = ref(null)
const generatedPassword = ref('')
const passwordModalRef = ref(null)
let passwordModal

function generatePassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

onMounted(() => {
  passwordModal = new Modal(passwordModalRef.value)
})

async function save() {
  if (!formRef.value.validate()) return
  const payload = { ...user.value }
  const pass = generatePassword()
  payload.password = pass
  await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) })
  generatedPassword.value = pass
  passwordModal.show()
}

function close() {
  router.push('/users')
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/admin">Администрирование</RouterLink></li>
        <li class="breadcrumb-item"><RouterLink to="/users">Пользователи</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Создание</li>
      </ol>
    </nav>
    <h1 class="mb-4">Новый пользователь</h1>
    <form @submit.prevent="save">
      <UserForm ref="formRef" v-model="user" :isNew="true" />
      <div class="mt-3">
        <button type="submit" class="btn btn-primary me-2">Сохранить</button>
        <button type="button" class="btn btn-secondary" @click="close">Отмена</button>
      </div>
    </form>

    <div ref="passwordModalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Пароль пользователя</h5>
            <button type="button" class="btn-close" @click="passwordModal.hide()"></button>
          </div>
          <div class="modal-body">
            <p>Сгенерированный пароль:</p>
            <div class="input-group">
              <input type="text" class="form-control" :value="generatedPassword" readonly />
              <button type="button" class="btn btn-outline-secondary" @click="navigator.clipboard.writeText(generatedPassword)">Копировать</button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" @click="passwordModal.hide()">OK</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
