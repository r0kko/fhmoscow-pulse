<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'
import { Modal } from 'bootstrap'

const users = ref([])
const error = ref('')
const editUser = ref(null)
const modalRef = ref(null)
let modal

async function loadUsers() {
  try {
    const data = await apiFetch('/users')
    users.value = data.users
  } catch (e) {
    error.value = e.message
  }
}

onMounted(() => {
  modal = new Modal(modalRef.value)
  loadUsers()
})

function openCreate() {
  editUser.value = {
    last_name: '',
    first_name: '',
    patronymic: '',
    birth_date: '',
    phone: '',
    email: '',
    password: ''
  }
  modal.show()
}

function openEdit(user) {
  editUser.value = { ...user, password: '' }
  modal.show()
}

async function saveUser() {
  const payload = { ...editUser.value }
  const id = payload.id
  if (!id) {
    await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) })
  } else {
    delete payload.roles
    delete payload.status
    if (!payload.password) delete payload.password
    await apiFetch(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  }
  modal.hide()
  await loadUsers()
}

async function blockUser(id) {
  await apiFetch(`/users/${id}/block`, { method: 'POST' })
  await loadUsers()
}

async function unblockUser(id) {
  await apiFetch(`/users/${id}/unblock`, { method: 'POST' })
  await loadUsers()
}
</script>

<template>
  <div class="container mt-4">
    <h1 class="mb-4">Пользователи</h1>
    <button class="btn btn-primary mb-3" @click="openCreate">Добавить</button>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <table class="table table-striped" v-if="users.length">
      <thead>
        <tr>
          <th>Фамилия</th>
          <th>Имя</th>
          <th>Телефон</th>
          <th>Статус</th>
          <th>Роли</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.last_name }}</td>
          <td>{{ u.first_name }}</td>
          <td>{{ u.phone }}</td>
          <td>{{ u.status }}</td>
          <td>{{ u.roles?.join(', ') }}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-secondary me-2" @click="openEdit(u)">
              Редактировать
            </button>
            <button
              v-if="u.status === 'ACTIVE'"
              @click="blockUser(u.id)"
              class="btn btn-sm btn-danger me-2"
            >
              Заблокировать
            </button>
            <button
              v-if="u.status === 'INACTIVE'"
              @click="unblockUser(u.id)"
              class="btn btn-sm btn-success"
            >
              Разблокировать
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет пользователей.</p>

    <div ref="modalRef" class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="saveUser">
            <div class="modal-header">
              <h5 class="modal-title">
                {{ editUser?.id ? 'Редактирование' : 'Новый пользователь' }}
              </h5>
              <button type="button" class="btn-close" @click="modal.hide()"></button>
            </div>
            <div class="modal-body">
              <UserForm v-model="editUser" :isNew="!editUser?.id" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
