<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { RouterLink } from 'vue-router'
import Modal from 'bootstrap/js/dist/modal'
import { apiFetch } from '../api.js'

const exams = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 8
const isLoading = ref(false)
const error = ref('')

const centers = ref([])
const statuses = ref([])

const form = ref({
  medical_center_id: '',
  start_at: '',
  end_at: '',
  capacity: '',
  status: ''
})
const editing = ref(null)
const modalRef = ref(null)
let modal
const formError = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

onMounted(() => {
  modal = new Modal(modalRef.value)
  load()
  loadCenters()
  loadStatuses()
})

watch(currentPage, load)

async function loadCenters() {
  try {
    const data = await apiFetch('/medical-centers?page=1&limit=100')
    centers.value = data.centers
  } catch (_e) {
    centers.value = []
  }
}

async function loadStatuses() {
  try {
    const data = await apiFetch('/medical-exams/statuses')
    statuses.value = data.statuses
  } catch (_e) {
    statuses.value = []
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
  Object.assign(form.value, { medical_center_id: '', start_at: '', end_at: '', capacity: '', status: '' })
  formError.value = ''
  modal.show()
}

function openEdit(exam) {
  editing.value = exam
  form.value.medical_center_id = exam.center?.id || ''
  form.value.start_at = exam.start_at
  form.value.end_at = exam.end_at
  form.value.capacity = exam.capacity || ''
  form.value.status = exam.status?.alias || ''
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
      if (form.value.status) body.status = form.value.status
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
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">Расписание медосмотров</h1>
      <button class="btn btn-brand" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Добавить
      </button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="isLoading" class="text-center my-3"><div class="spinner-border" role="status"></div></div>
    <div v-if="exams.length" class="card tile fade-in mb-4">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-striped align-middle mb-0">
        <thead>
          <tr>
            <th>Центр</th>
            <th>Период</th>
            <th>Места</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ex in exams" :key="ex.id">
            <td>{{ ex.center?.name }}</td>
            <td>{{ ex.start_at }} - {{ ex.end_at }}</td>
            <td>{{ ex.capacity }}</td>
            <td>{{ ex.status?.name }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-secondary me-2" @click="openEdit(ex)">Изменить</button>
              <button class="btn btn-sm btn-danger" @click="removeExam(ex)">Удалить</button>
            </td>
          </tr>
        </tbody>
          </table>
        </div>
      </div>
    </div>
    <p v-else-if="!isLoading" class="text-muted">Записей нет.</p>
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
                <input id="exStart" type="date" v-model="form.start_at" class="form-control" required />
                <label for="exStart">Начало</label>
              </div>
              <div class="form-floating mb-3">
                <input id="exEnd" type="date" v-model="form.end_at" class="form-control" required />
                <label for="exEnd">Окончание</label>
              </div>
              <div class="form-floating mb-3">
                <input id="exCap" type="number" min="0" v-model="form.capacity" class="form-control" />
                <label for="exCap">Количество мест</label>
              </div>
              <div class="mb-3" v-if="editing">
                <label class="form-label">Статус</label>
                <select v-model="form.status" class="form-select">
                  <option value="" disabled>Выберите статус</option>
                  <option v-for="s in statuses" :key="s.alias" :value="s.alias">{{ s.name }}</option>
                </select>
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
  </div>
</template>
