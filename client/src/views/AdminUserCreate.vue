<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'
import Modal from 'bootstrap/js/dist/modal'
import Toast from 'bootstrap/js/dist/toast'

const sexes = ref([])

const router = useRouter()

const user = ref({
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  sex_id: '',
  phone: '',
  email: ''
})
const formRef = ref(null)
const generatedPassword = ref('')
const passwordModalRef = ref(null)
const toastRef = ref(null)
const toastMessage = ref('')
let passwordModal
let toast

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
  loadSexes()
})

async function loadSexes() {
  try {
    const data = await apiFetch('/sexes')
    sexes.value = data.sexes
  } catch (_) {
    sexes.value = []
  }
}

async function save() {
  if (!formRef.value?.validate || !formRef.value.validate()) return
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

function showToast(message) {
  toastMessage.value = message
  if (!toast) {
    toast = new Toast(toastRef.value)
  }
  toast.show()
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('Скопировано')
  } catch (_err) {
    showToast('Не удалось скопировать')
  }
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
    <h1 class="mb-3">Новый пользователь</h1>
    <form @submit.prevent="save">
      <UserForm ref="formRef" v-model="user" :isNew="true" :sexes="sexes" />
      <div class="mt-3">
        <button type="submit" class="btn btn-brand me-2">Сохранить</button>
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
              <button type="button" class="btn btn-outline-secondary" @click="copyToClipboard(generatedPassword)">Копировать</button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-brand" @click="passwordModal.hide()">OK</button>
          </div>
        </div>
    </div>
  </div>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div
      ref="toastRef"
      class="toast text-bg-secondary"
      role="status"
      data-bs-delay="1500"
      data-bs-autohide="true"
    >
      <div class="toast-body">{{ toastMessage }}</div>
    </div>
  </div>
</div>
</template>
