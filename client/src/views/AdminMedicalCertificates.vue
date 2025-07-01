<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Modal } from 'bootstrap'
import { apiFetch, apiFetchForm } from '../api.js'
import { findOrganizationByInn } from '../dadata.js'

const certificates = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 8
const isLoading = ref(false)
const error = ref('')

const form = ref({
  user_id: '',
  inn: '',
  organization: '',
  certificate_number: '',
  issue_date: '',
  valid_until: ''
})
const editing = ref(null)
const modalRef = ref(null)
let modal
const formError = ref('')
const userQuery = ref('')
const userSuggestions = ref([])
let userTimeout
let skipUserWatch = false
const files = ref([])
const filesLoading = ref(false)
const fileError = ref('')
const fileType = ref('CONCLUSION')
const fileInput = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

onMounted(() => {
  modal = new Modal(modalRef.value)
  load()
})

watch(currentPage, load)

watch(userQuery, () => {
  clearTimeout(userTimeout)
  if (skipUserWatch) {
    skipUserWatch = false
    return
  }
  form.value.user_id = ''
  if (!userQuery.value || userQuery.value.length < 2) {
    userSuggestions.value = []
    return
  }
  userTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ search: userQuery.value, limit: 5 })
      const data = await apiFetch(`/users?${params}`)
      userSuggestions.value = data.users
    } catch (_err) {
      userSuggestions.value = []
    }
  }, 300)
})

watch(
  () => form.value.inn,
  async (val) => {
    if (!val || val.length < 3) {
      form.value.organization = ''
      return
    }
    const res = await findOrganizationByInn(val)
    form.value.organization = res?.value || ''
  }
)

watch(
  () => form.value.issue_date,
  (val) => {
    if (!val || editing.value) return
    const d = new Date(val)
    d.setDate(d.getDate() + 180)
    form.value.valid_until = d.toISOString().slice(0, 10)
  }
)

async function load() {
  try {
    isLoading.value = true
    const params = new URLSearchParams({ page: currentPage.value, limit: pageSize })
    const data = await apiFetch(`/medical-certificates?${params}`)
    certificates.value = data.certificates
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.keys(form.value).forEach(k => (form.value[k] = ''))
  skipUserWatch = true
  userQuery.value = ''
  userSuggestions.value = []
  formError.value = ''
  files.value = []
  fileType.value = 'CONCLUSION'
  fileError.value = ''
  modal.show()
}

function openEdit(cert) {
  editing.value = cert
  Object.assign(form.value, cert)
  skipUserWatch = true
  userQuery.value = cert.user
    ? `${cert.user.last_name} ${cert.user.first_name}`
    : ''
  userSuggestions.value = []
  formError.value = ''
  loadFiles()
  modal.show()
}


function selectUser(u) {
  form.value.user_id = u.id
  skipUserWatch = true
  userQuery.value = `${u.last_name} ${u.first_name}`
  userSuggestions.value = []
}

async function save() {
  try {
    formError.value = ''
    if (!form.value.user_id) {
      formError.value = 'Выберите пользователя'
      return
    }
    const path = `/users/${form.value.user_id}/medical-certificate`
    const method = editing.value ? 'PUT' : 'POST'
    await apiFetch(path, { method, body: JSON.stringify(form.value) })
    modal.hide()
    await load()
  } catch (e) {
    formError.value = e.message
  }
}

async function loadFiles() {
  if (!editing.value) return
  filesLoading.value = true
  fileError.value = ''
  try {
    const data = await apiFetch(`/medical-certificates/${editing.value.id}/files`)
    files.value = data.files
  } catch (e) {
    fileError.value = e.message
    files.value = []
  } finally {
    filesLoading.value = false
  }
}

async function uploadFile() {
  const f = fileInput.value?.files[0]
  if (!f || !editing.value) return
  const formData = new FormData()
  formData.append('file', f)
  formData.append('type', fileType.value)
  try {
    await apiFetchForm(`/medical-certificates/${editing.value.id}/files`, formData, {
      method: 'POST',
    })
    fileInput.value.value = ''
    fileError.value = ''
    await loadFiles()
  } catch (e) {
    fileError.value = e.message
  }
}

async function removeFile(file) {
  if (!editing.value) return
  if (!confirm('Удалить файл?')) return
  try {
    await apiFetch(
      `/medical-certificates/${editing.value.id}/files/${file.id}`,
      { method: 'DELETE' }
    )
    await loadFiles()
  } catch (e) {
    fileError.value = e.message
  }
}

async function removeCert(cert) {
  if (!confirm('Удалить запись?')) return
  await apiFetch(`/medical-certificates/${cert.id}`, { method: 'DELETE' })
  await load()
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}.${m}.${y}`
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/admin">Администрирование</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Медицинские справки</li>
      </ol>
    </nav>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">Медицинские заключения</h1>
      <button class="btn btn-brand" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Добавить
      </button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="isLoading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div v-if="certificates.length" class="table-responsive">
      <table class="table table-striped align-middle">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Номер</th>
            <th>Учреждение</th>
            <th>ИНН</th>
            <th>Период действия</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in certificates" :key="c.id">
            <td>{{ c.user ? c.user.last_name + ' ' + c.user.first_name : c.user_id }}</td>
            <td>{{ c.certificate_number }}</td>
            <td>{{ c.organization }}</td>
            <td>{{ c.inn }}</td>
            <td>{{ formatDate(c.issue_date) }} - {{ formatDate(c.valid_until) }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-secondary me-2" @click="openEdit(c)">Изменить</button>
              <button class="btn btn-sm btn-danger" @click="removeCert(c)">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
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
              <h5 class="modal-title">{{ editing ? 'Изменить' : 'Добавить' }} справку</h5>
              <button type="button" class="btn-close" @click="modal.hide()"></button>
            </div>
            <div class="modal-body">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div class="mb-3 position-relative">
                <div class="form-floating">
                  <input
                    id="userId"
                    v-model="userQuery"
                    class="form-control"
                    placeholder="Пользователь"
                  />
                  <label for="userId">Пользователь</label>
                </div>
                <ul
                  v-if="userSuggestions.length"
                  class="list-group position-absolute w-100"
                  style="z-index: 1050"
                >
                  <li
                    v-for="u in userSuggestions"
                    :key="u.id"
                    class="list-group-item list-group-item-action"
                    @mousedown.prevent="selectUser(u)"
                  >
                    {{ u.last_name }} {{ u.first_name }}
                  </li>
                </ul>
              </div>
              <div class="form-floating mb-3">
                <input id="certNumber" v-model="form.certificate_number" class="form-control" placeholder="Номер" />
                <label for="certNumber">Номер</label>
              </div>
              <div class="form-floating mb-3">
                <input id="certInn" v-model="form.inn" class="form-control" placeholder="ИНН" />
                <label for="certInn">ИНН</label>
              </div>
              <div class="form-floating mb-3">
                <input id="certOrg" v-model="form.organization" class="form-control" placeholder="Учреждение" disabled />
                <label for="certOrg">Учреждение</label>
              </div>
              <div class="form-floating mb-3">
                <input id="issue" type="date" v-model="form.issue_date" class="form-control" />
                <label for="issue">Дата выдачи</label>
              </div>
              <div class="form-floating mb-3">
                <input id="valid" type="date" v-model="form.valid_until" class="form-control" />
                <label for="valid">Действительно до</label>
              </div>
              <div v-if="editing" class="border-top pt-3 mt-3">
                <h6 class="mb-2">Файлы</h6>
                <div v-if="fileError" class="alert alert-danger">{{ fileError }}</div>
                <div v-if="filesLoading" class="text-center py-2">Загрузка...</div>
                <ul v-if="files.length" class="list-group mb-3">
                  <li v-for="f in files" :key="f.id" class="list-group-item d-flex justify-content-between align-items-center">
                    <a :href="f.url" target="_blank">{{ f.name }}</a>
                    <button type="button" class="btn-close" aria-label="Удалить" @click="removeFile(f)"></button>
                  </li>
                </ul>
                <p v-else-if="!filesLoading" class="text-muted">Нет файлов</p>
                <div class="mb-3">
                  <label class="form-label" for="fileType">Тип документа</label>
                  <select id="fileType" class="form-select" v-model="fileType">
                    <option value="CONCLUSION">Заключение</option>
                    <option value="RESULTS">Результаты исследований</option>
                  </select>
                </div>
                <div class="mb-3">
                  <input type="file" class="form-control" ref="fileInput" />
                </div>
                <button type="button" class="btn btn-primary" @click="uploadFile">Загрузить</button>
              </div>
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
