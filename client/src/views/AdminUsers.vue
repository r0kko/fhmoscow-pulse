<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../api.js'
import { Toast } from 'bootstrap'

const users = ref([])
const total = ref(0)
const error = ref('')
const router = useRouter()

const isLoading = ref(false)
const search = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = 8
const sortField = ref('last_name')
const sortOrder = ref('asc')

const toastRef = ref(null)
let toast

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

watch([search, sortField, sortOrder, statusFilter], () => {
  currentPage.value = 1
  loadUsers()
})

watch(currentPage, () => {
  loadUsers()
})


async function loadUsers() {
  try {
    const params = new URLSearchParams({
      search: search.value,
      status: statusFilter.value,
      page: currentPage.value,
      limit: pageSize,
      sort: sortField.value,
      order: sortOrder.value,
    })
    isLoading.value = true
    const data = await apiFetch(`/users?${params}`)
    users.value = data.users
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadUsers)

function openCreate() {
  router.push('/users/new')
}

function openEdit(user) {
  router.push(`/users/${user.id}`)
}


async function blockUser(id) {
  if (!confirm('Заблокировать пользователя?')) return
  await apiFetch(`/users/${id}/block`, { method: 'POST' })
  await loadUsers()
}

async function unblockUser(id) {
  if (!confirm('Разблокировать пользователя?')) return
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

function showToast() {
  if (!toast) {
    toast = new Toast(toastRef.value)
  }
  toast.show()
}

function copy(text) {
  navigator.clipboard.writeText(text)
  showToast()
}
</script>

<template>
  <div class="container mt-4">
    <h1 class="mb-4">Пользователи</h1>
    <div class="row g-2 mb-3">
      <div class="col">
        <input
          type="text"
          class="form-control"
          placeholder="Поиск"
          v-model="search"
        />
      </div>
      <div class="col-auto">
        <select v-model="statusFilter" class="form-select">
          <option value="">Все статусы</option>
          <option value="ACTIVE">Активные</option>
          <option value="INACTIVE">Заблокированные</option>
        </select>
      </div>
      <div class="col-auto">
        <button class="btn btn-primary w-100" @click="openCreate">Добавить</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="isLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div class="table-responsive" v-if="users.length">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th @click="toggleSort('last_name')" class="sortable">
              ФИО
              <i
                v-if="sortField === 'last_name'"
                :class="sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'"
              ></i>
            </th>
            <th
              class="sortable d-none d-md-table-cell"
              @click="toggleSort('phone')"
            >
              Телефон
              <i
                v-if="sortField === 'phone'"
                :class="sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'"
              ></i>
            </th>
            <th
              class="sortable d-none d-lg-table-cell"
              @click="toggleSort('email')"
            >
              Email
              <i
                v-if="sortField === 'email'"
                :class="sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'"
              ></i>
            </th>
            <th
              class="sortable d-none d-lg-table-cell"
              @click="toggleSort('birth_date')"
            >
              Дата рождения
              <i
                v-if="sortField === 'birth_date'"
                :class="sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'"
              ></i>
            </th>
            <th class="d-none d-lg-table-cell">Роли</th>
            <th @click="toggleSort('status')" class="sortable">
              Статус
              <i
                v-if="sortField === 'status'"
                :class="sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'"
              ></i>
            </th>
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
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div
        ref="toastRef"
        class="toast text-bg-secondary"
        role="status"
        data-bs-delay="1500"
        data-bs-autohide="true"
      >
        <div class="toast-body">Скопировано</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sortable {
  cursor: pointer;
}
.sortable i {
  margin-left: 4px;
}
</style>
