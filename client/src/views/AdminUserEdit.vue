<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'
import AddPassportModal from '../components/AddPassportModal.vue'
import InnSnilsForm from '../components/InnSnilsForm.vue'

const route = useRoute()
const router = useRouter()

const user = ref(null)
const isLoading = ref(false)
const error = ref('')
const formRef = ref(null)
const passportModalRef = ref(null)
const passport = ref(null)
const passportError = ref('')
const placeholderSections = [
  'Банковские реквизиты',
  'Тип налогообложения',
  'Выданный инвентарь'
]

async function loadUser() {
  isLoading.value = true
  error.value = ''
  try {
    const data = await apiFetch(`/users/${route.params.id}`)
    user.value = data.user
  } catch (e) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadUser)

async function loadPassport() {
  try {
    const data = await apiFetch(`/users/${route.params.id}/passport`)
    passport.value = data.passport
    passportError.value = ''
  } catch (e) {
    if (e.message === 'passport_not_found') {
      passport.value = null
      passportError.value = ''
    } else {
      passportError.value = e.message
    }
  }
}

onMounted(loadPassport)

async function savePassport(data) {
  try {
    const { passport: saved } = await apiFetch(
      `/users/${route.params.id}/passport`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    )
    passport.value = saved
    passportError.value = ''
  } catch (e) {
    passportError.value = e.message
  }
}

async function deletePassport() {
  try {
    await apiFetch(`/users/${route.params.id}/passport`, { method: 'DELETE' })
    passport.value = null
    passportError.value = ''
  } catch (e) {
    passportError.value = e.message
  }
}

function openPassportModal() {
  passportModalRef.value.open()
}

async function save() {
  if (!formRef.value.validate()) return
  const payload = { ...user.value }
  delete payload.roles
  delete payload.status
  try {
    await apiFetch(`/users/${route.params.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
    router.push('/users')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/admin">Администрирование</RouterLink></li>
        <li class="breadcrumb-item"><RouterLink to="/users">Пользователи</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Редактирование</li>
      </ol>
    </nav>
    <h1 class="mb-4">Редактирование пользователя</h1>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <form v-if="user" @submit.prevent="save">
      <UserForm ref="formRef" v-model="user" />
      <div class="mt-3">
        <button type="submit" class="btn btn-primary me-2">Сохранить</button>
        <RouterLink to="/users" class="btn btn-secondary">Отмена</RouterLink>
      </div>
    </form>
    <p v-else-if="isLoading">Загрузка...</p>
    <InnSnilsForm v-if="user" :userId="route.params.id" />

    <div v-if="passport !== undefined" class="mt-4">
      <div v-if="passport" class="card">
        <div class="card-body">
          <h5 class="card-title mb-3">Паспорт</h5>
          <div class="row row-cols-1 row-cols-sm-2 g-3">
            <div class="col">
              <label class="form-label">Тип документа</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.document_type_name" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Страна</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.country_name" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Серия</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.series" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Номер</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.number" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Дата выдачи</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.issue_date" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Действителен до</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.valid_until" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Кем выдан</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.issuing_authority" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Код подразделения</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.issuing_authority_code" readonly />
              </div>
            </div>
            <div class="col">
              <label class="form-label">Место рождения</label>
              <div class="input-group">
                <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
                <input type="text" class="form-control" :value="passport.place_of_birth" readonly />
              </div>
            </div>
          </div>
          <button class="btn btn-danger mt-3" @click="deletePassport">Удалить</button>
        </div>
      </div>
      <div v-else class="mt-3">
        <button class="btn btn-primary" @click="openPassportModal">Добавить паспорт</button>
      </div>
      <AddPassportModal ref="passportModalRef" :user="user" @saved="savePassport" />
      <div v-if="passportError" class="text-danger mt-2">{{ passportError }}</div>
    </div>

    <div v-if="user" class="mt-4" v-for="section in placeholderSections" :key="section">
      <div class="card placeholder-card text-center">
        <div class="card-body d-flex flex-column align-items-center justify-content-center">
          <i class="bi bi-clock mb-2 fs-2"></i>
          <h5 class="card-title mb-1">{{ section }}</h5>
          <p class="mb-0">Информация будет доступна позже</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.placeholder-card {
  opacity: 0.6;
}
.input-group-text.bg-light {
  color: #6c757d;
}
</style>
