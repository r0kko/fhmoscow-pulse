<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { apiFetch } from '../api.js'
import UserForm from '../components/UserForm.vue'
import { Modal } from 'bootstrap'

const users = ref([])
const total = ref(0)
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
const sortField = ref('last_name')
const sortOrder = ref('asc')

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

watch([search, sortField, sortOrder], () => {
  currentPage.value = 1
  loadUsers()
})

watch(currentPage, () => {
  loadUsers()
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
    const params = new URLSearchParams({
      search: search.value,
      page: currentPage.value,
      limit: pageSize,
      sort: sortField.value,
      order: sortOrder.value,
    })
    const data = await apiFetch(`/users?${params}`)
    users.value = data.users
    total.value = data.total
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

function toggleSort(field) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'asc'
  }
}

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

function formatDate(str) {
  if (!str) return ''
  const [year, month, day] = str.split('-')
  return `${day}.${month}.${year}`
}

function copy(text) {
  navigator.clipboard.writeText(text)
}
</script>

<template>
  <div class="container mt-4">
    <h1 class="mb-4">Пользователи</h1>
    <div class="input-group mb-3">
      <input
        type="text"
        class="form-control"
        placeholder="Поиск"
        v-model="search"
      />
      <button class="btn btn-primary" @click="openCreate">Добавить</button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div class="table-responsive" v-if="users.length">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th @click="toggleSort('last_name')" class="sortable">ФИО</th>
            <th
              class="sortable d-none d-md-table-cell"
              @click="toggleSort('phone')"
            >
              Телефон
            </th>
            <th
              class="sortable d-none d-lg-table-cell"
              @click="toggleSort('email')"
            >
              Email
            </th>
            <th
              class="sortable d-none d-lg-table-cell"
              @click="toggleSort('birth_date')"
            >
              Дата рождения
            </th>
            <th class="d-none d-lg-table-cell">Роли</th>
            <th @click="toggleSort('status')" class="sortable">Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}</td>
            <td class="d-none d-md-table-cell">
              <span class="cursor-pointer" @click="copy(u.phone)">
                {{ formatPhone(u.phone) }}
              </span>
            </td>
            <td class="d-none d-lg-table-cell">{{ u.email }}</td>
            <td class="d-none d-lg-table-cell">{{ formatDate(u.birth_date) }}</td>
            <td class="d-none d-lg-table-cell">
              <span
                class="badge bg-info me-1"
                v-for="(name, idx) in u.role_names"
                :key="u.roles[idx]"
                >{{ name }}</span
              >
            </td>
            <td><span class="badge bg-secondary">{{ u.status_name }}</span></td>
            <td class="text-end">
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
.sortable {
  cursor: pointer;
}
</style>
