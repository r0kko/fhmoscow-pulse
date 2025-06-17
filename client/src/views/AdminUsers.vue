<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'
import { Modal } from 'bootstrap'

const users = ref([])
const error = ref('')
const editUser = ref(null)
const modalRef = ref(null)
const formRef = ref(null)
const passwordModalRef = ref(null)
const generatedPassword = ref('')
let modal
let passwordModal

const search = ref('')
const currentPage = ref(1)
const pageSize = 8

const filteredUsers = computed(() => {
  if (!search.value) return users.value
  return users.value.filter((u) => {
    const term = search.value.toLowerCase()
    return (
      u.last_name.toLowerCase().includes(term) ||
      u.first_name.toLowerCase().includes(term) ||
      u.phone.includes(term) ||
      u.email.toLowerCase().includes(term)
    )
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredUsers.value.length / pageSize))
)

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredUsers.value.slice(start, start + pageSize)
})

watch(search, () => {
  currentPage.value = 1
})

function generatePassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

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
  passwordModal = new Modal(passwordModalRef.value)
  loadUsers()
})

function openCreate() {
  editUser.value = {
    last_name: '',
    first_name: '',
    patronymic: '',
    birth_date: '',
    phone: '',
    email: ''
  }
  generatedPassword.value = ''
  modal.show()
}

function openEdit(user) {
  editUser.value = { ...user }
  generatedPassword.value = ''
  modal.show()
}

async function saveUser() {
  if (!formRef.value.validate()) return
  const payload = { ...editUser.value }
  const id = payload.id
  if (!id) {
    const pass = generatePassword()
    payload.password = pass
    await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) })
    generatedPassword.value = pass
    passwordModal.show()
  } else {
    delete payload.roles
    delete payload.status
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
    <div class="d-flex flex-wrap align-items-center mb-3">
      <button class="btn btn-primary me-3" @click="openCreate">Добавить</button>
      <input
        type="text"
        class="form-control flex-grow-1"
        placeholder="Поиск"
        v-model="search"
      />
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="paginatedUsers.length" class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
      <div class="col" v-for="u in paginatedUsers" :key="u.id">
        <div class="card h-100 shadow-sm">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">{{ u.last_name }} {{ u.first_name }}</h5>
            <p class="text-muted mb-1">{{ u.phone }}</p>
            <p class="mb-1"><span class="badge bg-secondary">{{ u.status }}</span></p>
            <p class="mb-3" v-if="u.roles && u.roles.length">
              <span class="badge bg-info me-1" v-for="r in u.roles" :key="r">{{ r }}</span>
            </p>
            <div class="mt-auto text-end">
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
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-else>Нет пользователей.</p>
    <nav class="mt-3" v-if="totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">Пред</button>
        </li>
        <li
          class="page-item"
          v-for="page in totalPages"
          :key="page"
          :class="{ active: currentPage === page }"
        >
          <button class="page-link" @click="currentPage = page">{{ page }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">След</button>
        </li>
      </ul>
    </nav>

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
              <UserForm ref="formRef" v-model="editUser" :isNew="!editUser?.id" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>

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

<style scoped>
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
</style>
