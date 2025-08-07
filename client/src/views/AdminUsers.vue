<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { apiFetch } from '../api.js'
import Toast from 'bootstrap/js/dist/toast'
import TaxationInfo from '../components/TaxationInfo.vue'

const users = ref([])
const total = ref(0)
const error = ref('')
const router = useRouter()

const activeTab = ref('users')
const completion = ref([])
const completionLoading = ref(false)
const completionError = ref('')

const isLoading = ref(false)
const search = ref('')
const statusFilter = ref('')
const roleFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(8)
const roles = ref([])
const sortField = ref('last_name')
const sortOrder = ref('asc')

const toastRef = ref(null)
const toastMessage = ref('')
let toast

const taxModal = ref(null)
const taxUserId = ref('')

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
)

const visiblePages = computed(() => {
  const totalVal = totalPages.value
  const current = currentPage.value
  const pages = []

  if (totalVal <= 7) {
    for (let i = 1; i <= totalVal; i++) pages.push(i)
    return pages
  }

  pages.push(1)

  const start = Math.max(2, current - 1)
  const end = Math.min(totalVal - 1, current + 1)

  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalVal - 1) pages.push('...')

  pages.push(totalVal)
  return pages
})

async function loadRoles() {
  try {
    const data = await apiFetch('/roles')
    roles.value = data.roles
  } catch (_e) {
    roles.value = []
  }
}


let searchTimeout
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadUsers()
  }, 300)
})

watch([sortField, sortOrder, statusFilter, roleFilter, pageSize], () => {
  currentPage.value = 1
  loadUsers()
})

watch(currentPage, () => {
  loadUsers()
})

watch(activeTab, (tab) => {
  if (tab === 'profiles' && completion.value.length === 0 && !completionLoading.value) {
    loadCompletion()
  }
})


async function loadUsers() {
  try {
    const params = new URLSearchParams({
      search: search.value,
      status: statusFilter.value,
      role: roleFilter.value,
      page: currentPage.value,
      limit: pageSize.value,
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

async function loadCompletion() {
  try {
    completionLoading.value = true
    const data = await apiFetch('/users/profile-completion')
    completion.value = data.profiles
  } catch (e) {
    completionError.value = e.message
  } finally {
    completionLoading.value = false
  }
}

onMounted(() => {
  loadUsers()
  loadRoles()
  if (activeTab.value === 'profiles') loadCompletion()
})

function openCreate() {
  router.push('/admin/users/new')
}

function openEdit(user) {
  router.push(`/admin/users/${user.id}`)
}

function openTaxStatus(id) {
  taxUserId.value = id
  nextTick(() => {
    taxModal.value.openModal()
  })
}

async function onTaxSaved() {
  await loadCompletion()
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

async function approveUser(id) {
  if (!confirm('Подтвердить пользователя?')) return
  await apiFetch(`/users/${id}/approve`, { method: 'POST' })
  await loadUsers()
}

function statusClass(status) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-success'
    case 'INACTIVE':
      return 'bg-danger'
    case 'AWAITING_CONFIRMATION':
      return 'bg-warning text-dark'
    default:
      return 'bg-secondary'
  }
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

function showToast(message) {
  toastMessage.value = message
  if (!toast) {
    toast = new Toast(toastRef.value)
  }
  toast.show()
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('Скопировано')
  } catch (_err) {
    showToast('Не удалось скопировать')
  }
}
</script>

<template>
  <div class="py-3 admin-users-page">
    <div class="container">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/admin">Администрирование</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Пользователи</li>
      </ol>
    </nav>
    <h1 class="mb-3">Пользователи</h1>
    <div class="card tile mb-3">
      <div class="card-body p-2">
        <ul class="nav nav-pills nav-fill mb-0 tab-selector">
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">Пользователи</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'profiles' }" @click="activeTab = 'profiles'">Заполнение профиля</button>
          </li>
        </ul>
      </div>
    </div>
    <div v-show="activeTab === 'users'" class="card section-card tile fade-in shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="h5 mb-0">Пользователи</h2>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div class="row g-2 align-items-end mb-3">
          <div class="col-12 col-sm">
            <input
              type="text"
              class="form-control"
              placeholder="Поиск"
              v-model="search"
            />
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model="statusFilter" class="form-select">
              <option value="">Все статусы</option>
              <option value="ACTIVE">Активные</option>
              <option value="INACTIVE">Заблокированные</option>
              <option value="AWAITING_CONFIRMATION">Требуют подтверждения</option>
            </select>
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model="roleFilter" class="form-select">
              <option value="">Все роли</option>
              <option v-for="r in roles" :key="r.id" :value="r.alias">{{ r.name }}</option>
            </select>
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model.number="pageSize" class="form-select">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
            </select>
          </div>
        </div>
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="users.length" class="table-responsive">
          <table class="table admin-table table-hover table-striped align-middle mb-0">
        <thead>
          <tr>
            <th @click="toggleSort('last_name')" class="sortable">
              ФИО
              <i
                v-if="sortField === 'last_name'"
                :class="[
                  sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill',
                  'icon-brand'
                ]"
              ></i>
            </th>
            <th
              class="sortable d-none d-md-table-cell"
              @click="toggleSort('phone')"
            >
              Телефон
              <i
                v-if="sortField === 'phone'"
                :class="[
                  sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill',
                  'icon-brand'
                ]"
              ></i>
            </th>
            <th
              class="sortable d-none d-lg-table-cell"
              @click="toggleSort('email')"
            >
              Email
              <i
                v-if="sortField === 'email'"
                :class="[
                  sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill',
                  'icon-brand'
                ]"
              ></i>
            </th>
            <th
              class="sortable d-none d-lg-table-cell"
              @click="toggleSort('birth_date')"
            >
              Дата рождения
              <i
                v-if="sortField === 'birth_date'"
                :class="[
                  sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill',
                  'icon-brand'
                ]"
              ></i>
            </th>
            <th class="d-none d-lg-table-cell">Роли</th>
            <th @click="toggleSort('status')" class="sortable">
              Статус
              <i
                v-if="sortField === 'status'"
                :class="[
                  sortOrder === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill',
                  'icon-brand'
                ]"
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
            <td><span class="badge" :class="statusClass(u.status)">{{ u.status_name }}</span></td>
            <td class="text-end">
              <button class="btn btn-sm btn-secondary me-2" @click="openEdit(u)">
                <i class="bi bi-pencil"></i>
              </button>
              <button
                v-if="u.status === 'ACTIVE'"
                @click="blockUser(u.id)"
                class="btn btn-sm btn-danger me-2"
              >
                <i class="bi bi-lock-fill"></i>
              </button>
              <button
                v-if="u.status === 'INACTIVE'"
                @click="unblockUser(u.id)"
                class="btn btn-sm btn-success me-2"
              >
                <i class="bi bi-unlock-fill"></i>
              </button>
              <button
                v-if="u.status === 'AWAITING_CONFIRMATION'"
                @click="approveUser(u.id)"
                class="btn btn-sm btn-success"
              >
                <i class="bi bi-check-lg"></i>
              </button>
            </td>
          </tr>
        </tbody>
          </table>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Нет пользователей.</p>
      </div>
    </div>
    <nav class="mt-3" v-if="activeTab === 'users' && totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">Пред</button>
        </li>
        <li
          class="page-item"
          v-for="page in visiblePages"
          :key="page + '-page'"
          :class="{ active: page === currentPage, disabled: page === '...' }"
        >
          <span v-if="page === '...'" class="page-link">&hellip;</span>
          <button
            v-else
            class="page-link"
            @click="currentPage = page"
          >
            {{ page }}
          </button>
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
        <div class="toast-body">{{ toastMessage }}</div>
      </div>
    </div>
    <div v-show="activeTab === 'profiles'" class="card section-card tile fade-in shadow-sm mt-3">
      <div class="card-header">
        <h2 class="h5 mb-0">Заполнение профиля</h2>
      </div>
      <div class="card-body p-3">
        <div v-if="completionError" class="alert alert-danger mb-3">{{ completionError }}</div>
        <div v-if="completionLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="completion.length" class="table-responsive d-none d-sm-block">
          <table class="table admin-table table-hover table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th class="d-none d-sm-table-cell">Дата рождения</th>
                <th class="text-center">Паспорт</th>
                <th class="text-center">ИНН</th>
                <th class="text-center">СНИЛС</th>
                <th class="text-center">Банк</th>
                <th class="text-center">Адрес</th>
                <th class="d-none d-md-table-cell">Налоговый статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in completion" :key="p.id">
                <td>{{ p.last_name }} {{ p.first_name }} {{ p.patronymic }}</td>
                <td class="d-none d-sm-table-cell">{{ formatDate(p.birth_date) }}</td>
                <td class="text-center"><i :class="p.passport ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i></td>
                <td class="text-center"><i :class="p.inn ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i></td>
                <td class="text-center"><i :class="p.snils ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i></td>
                <td class="text-center"><i :class="p.bank_account ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i></td>
                <td class="text-center"><i :class="p.addresses ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i></td>
                <td class="d-none d-md-table-cell">
                  <span v-if="p.taxation_type">{{ p.taxation_type }}</span>
                  <button
                    v-else-if="p.inn"
                    class="btn btn-link p-0"
                    @click="openTaxStatus(p.id)"
                  >
                    <i class="bi bi-arrow-clockwise"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="completion.length" class="d-block d-sm-none">
          <div v-for="p in completion" :key="p.id" class="card profile-card mb-2">
            <div class="card-body p-2">
              <h6 class="mb-1">{{ p.last_name }} {{ p.first_name }} {{ p.patronymic }}</h6>
              <p class="mb-1 small">{{ formatDate(p.birth_date) }}</p>
              <div class="d-flex flex-wrap gap-1">
                <span><i :class="p.passport ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i> Паспорт</span>
                <span><i :class="p.inn ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i> ИНН</span>
                <span><i :class="p.snils ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i> СНИЛС</span>
                <span><i :class="p.bank_account ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i> Банк</span>
                <span><i :class="p.addresses ? 'bi bi-check-lg text-success' : 'bi bi-x-lg text-danger'"></i> Адрес</span>
                <span>
                  <i class="bi"></i>
                  <span v-if="p.taxation_type">{{ p.taxation_type }}</span>
                  <button
                    v-else-if="p.inn"
                    class="btn btn-link p-0 align-baseline"
                    @click="openTaxStatus(p.id)"
                  >
                    <i class="bi bi-arrow-clockwise"></i>
                  </button>
                  <span v-else>—</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!completionLoading" class="text-muted mb-0">Нет данных.</p>
    </div>
    </div>
    </div>
  </div>
  <TaxationInfo
    ref="taxModal"
    :userId="taxUserId"
    modalOnly
    @saved="onTaxSaved"
  />
</template>

<style scoped>
.sortable {
  cursor: pointer;
}
.sortable:hover {
  color: var(--brand-color);
}
.sortable i {
  margin-left: 4px;
}
.tab-selector {
  gap: 0.5rem;
}

.tab-selector .nav-link {
  border-radius: 0.5rem;
}
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
.profile-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

@media (max-width: 575.98px) {
  .admin-users-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }


  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>
