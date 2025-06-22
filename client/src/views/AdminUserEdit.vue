<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'

const route = useRoute()
const router = useRouter()

const user = ref(null)
const isLoading = ref(false)
const error = ref('')
const formRef = ref(null)

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
  </div>
</template>
