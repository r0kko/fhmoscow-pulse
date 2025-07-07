<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import Modal from 'bootstrap/js/dist/modal'
import { apiFetch } from '../api.js'

const exams = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 8
const isLoading = ref(false)
const error = ref('')

const centers = ref([])
const form = ref({
  medical_center_id: '',
  start_at: '',
  end_at: '',
  capacity: ''
})
const editing = ref(null)
const modalRef = ref(null)
let modal
const formError = ref('')

const registrationModalRef = ref(null)
let registrationModal
const registrationExam = ref(null)
const registrationList = ref([])
const registrationTotal = ref(0)
const registrationPage = ref(1)
const registrationLoading = ref(false)
const registrationError = ref('')

const registrationsTotalPages = computed(() =>
  Math.max(1, Math.ceil(registrationTotal.value / pageSize))
)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

onMounted(() => {
  modal = new Modal(modalRef.value)
  load()
  loadCenters()
})

watch(currentPage, load)
watch(registrationPage, () => {
  if (registrationExam.value) loadRegistrations(registrationExam.value.id)
})

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
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

async function loadCenters() {
  try {
    const data = await apiFetch('/medical-centers?page=1&limit=100')
    centers.value = data.centers
  } catch (_e) {
    centers.value = []
  }
}


async function load() {
  try {
    isLoading.value = true
    const params = new URLSearchParams({ page: currentPage.value, limit: pageSize })
    const data = await apiFetch(`/medical-exams?${params}`)
    exams.value = data.exams
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form.value, { medical_center_id: '', start_at: '', end_at: '', capacity: '' })
  formError.value = ''
  modal.show()
}

function openEdit(exam) {
  editing.value = exam
  form.value.medical_center_id = exam.center?.id || ''
  form.value.start_at = exam.start_at?.slice(0, 16)
  form.value.end_at = exam.end_at?.slice(0, 16)
  form.value.capacity = exam.capacity || ''
  formError.value = ''
  modal.show()
}

async function save() {
  try {
    formError.value = ''
    const body = {
      medical_center_id: form.value.medical_center_id,
      start_at: form.value.start_at,
      end_at: form.value.end_at,
      capacity: form.value.capacity
    }
    if (editing.value) {
      await apiFetch(`/medical-exams/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(body) })
    } else {
      await apiFetch('/medical-exams', { method: 'POST', body: JSON.stringify(body) })
    }
    modal.hide()
    await load()
  } catch (e) {
    formError.value = e.message
  }
}

async function removeExam(exam) {
  if (!confirm('Удалить запись?')) return
  try {
    await apiFetch(`/medical-exams/${exam.id}`, { method: 'DELETE' })
    await load()
  } catch (e) {
    alert(e.message)
  }
}

async function loadRegistrations(id) {
  try {
    registrationLoading.value = true
    const params = new URLSearchParams({ page: registrationPage.value, limit: pageSize })
    const data = await apiFetch(`/medical-exams/${id}/registrations?${params}`)
    registrationList.value = data.registrations
    registrationTotal.value = data.total
  } catch (e) {
    registrationError.value = e.message
  } finally {
    registrationLoading.value = false
  }
}

function openRegistrations(exam) {
  if (!registrationModal) registrationModal = new Modal(registrationModalRef.value)
  registrationExam.value = exam
  registrationPage.value = 1
  registrationError.value = ''
  loadRegistrations(exam.id)
  registrationModal.show()
}

async function setStatus(userId, status) {
  if (!registrationExam.value) return
  try {
    await apiFetch(
      `/medical-exams/${registrationExam.value.id}/registrations/${userId}`,
      { method: 'PUT', body: JSON.stringify({ status }) }
    )
    await loadRegistrations(registrationExam.value.id)
    await load()
  } catch (e) {
    alert(e.message)
  }
}
</script>

<template>
  <div>
    <div class="card tile fade-in shadow-sm mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Расписание медосмотров</h5>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
        <div v-if="isLoading" class="text-center my-3"><div class="spinner-border" role="status"></div></div>
        <div v-if="exams.length" class="table-responsive">
          <table class="table table-striped align-middle mb-0">
        <thead>
          <tr>
            <th>Центр</th>
            <th>Период</th>
            <th>Места</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ex in exams" :key="ex.id">
            <td>{{ ex.center?.name }}</td>
            <td>{{ formatDateTime(ex.start_at) }} - {{ formatDateTime(ex.end_at) }}</td>
            <td>{{ ex.capacity }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-primary me-2" @click="openRegistrations(ex)">
                <i class="bi bi-people"></i>
              </button>
              <button class="btn btn-sm btn-secondary me-2" @click="openEdit(ex)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-danger" @click="removeExam(ex)">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
          </table>
        </div>
        <p v-else-if="!isLoading" class="text-muted mb-0">Записей нет.</p>
      </div>
    </div>
    <nav class="mt-3" v-if="totalPages > 1">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link" @click="currentPage--" :disabled="currentPage === 1">Пред</button>
        </li>
        <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: currentPage === p }">
          <button class="page-link" @click="currentPage = p">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button class="page-link" @click="currentPage++" :disabled="currentPage === totalPages">След</button>
        </li>
      </ul>
    </nav>

  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form @submit.prevent="save">
            <div class="modal-header">
              <h5 class="modal-title">{{ editing ? 'Изменить запись' : 'Добавить запись' }}</h5>
              <button type="button" class="btn-close" @click="modal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div class="mb-3">
                <label class="form-label">Медицинский центр</label>
                <select v-model="form.medical_center_id" class="form-select" required>
                  <option value="" disabled>Выберите центр</option>
                  <option v-for="c in centers" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exStart"
                  type="datetime-local"
                  v-model="form.start_at"
                  class="form-control"
                  required
                />
                <label for="exStart">Начало</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="exEnd"
                  type="datetime-local"
                  v-model="form.end_at"
                  class="form-control"
                  required
                />
                <label for="exEnd">Окончание</label>
              </div>
              <div class="form-floating mb-3">
                <input id="exCap" type="number" min="0" v-model="form.capacity" class="form-control" />
                <label for="exCap">Количество мест</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
              <button type="submit" class="btn btn-brand">Сохранить</button>
            </div>
          </form>
      </div>
    </div>
  </div>

  <div ref="registrationModalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Заявки</h5>
          <button type="button" class="btn-close" @click="registrationModal.hide()"></button>
        </div>
        <div class="modal-body">
          <div v-if="registrationError" class="alert alert-danger">{{ registrationError }}</div>
          <div v-if="registrationLoading" class="text-center my-3"><div class="spinner-border" role="status"></div></div>
          <div v-if="registrationList.length" class="table-responsive">
            <table class="table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Дата заявки</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in registrationList" :key="r.user.id">
                  <td>{{ r.user.last_name }} {{ r.user.first_name }} {{ r.user.patronymic }}</td>
                  <td>{{ formatDateTime(r.created_at) }}</td>
                  <td>{{ r.user.email }}</td>
                  <td>{{ formatPhone(r.user.phone) }}</td>
                  <td>
                    {{
                      r.status === 'PENDING'
                        ? 'На рассмотрении'
                        : r.status === 'APPROVED'
                        ? 'Подтверждена'
                        : r.status === 'COMPLETED'
                        ? 'Завершена'
                        : 'Отменена'
                    }}
                  </td>
                  <td class="text-end">
                    <button
                      v-if="r.status === 'PENDING'"
                      class="btn btn-sm btn-success me-2"
                      @click="setStatus(r.user.id, 'APPROVED')"
                    >✓</button>
                    <button
                      v-if="r.status === 'APPROVED'"
                      class="btn btn-sm btn-primary me-2"
                      @click="setStatus(r.user.id, 'COMPLETED')"
                    >
                      <i class="bi bi-check2-all"></i>
                    </button>
                    <button
                      v-if="r.status !== 'COMPLETED' && r.status !== 'CANCELED'"
                      class="btn btn-sm btn-danger"
                      @click="setStatus(r.user.id, 'CANCELED')"
                    >✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else-if="!registrationLoading" class="text-muted mb-0">Нет заявок.</p>
        </div>
        <div class="modal-footer" v-if="registrationsTotalPages > 1">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: registrationPage === 1 }">
              <button class="page-link" @click="registrationPage--" :disabled="registrationPage === 1">Пред</button>
            </li>
            <li class="page-item" v-for="p in registrationsTotalPages" :key="p" :class="{ active: registrationPage === p }">
              <button class="page-link" @click="registrationPage = p">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: registrationPage === registrationsTotalPages }">
              <button class="page-link" @click="registrationPage++" :disabled="registrationPage === registrationsTotalPages">След</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
</template>
