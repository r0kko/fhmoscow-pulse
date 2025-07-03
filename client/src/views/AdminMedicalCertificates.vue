<script setup>
import { ref, onMounted, watch } from 'vue'
import Modal from 'bootstrap/js/dist/modal'
import { apiFetch, apiFetchForm } from '../api.js'
import { findOrganizationByInn } from '../dadata.js'

const judges = ref([])
const judgesLoading = ref(false)
const judgesError = ref('')

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
const saving = ref(false)
const deleting = ref(false)

onMounted(() => {
  modal = new Modal(modalRef.value)
  loadJudges()
})

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
  saving.value = false
  deleting.value = false
  modal.show()
}

function openEdit(cert) {
  editing.value = cert
  Object.assign(form.value, cert)
  skipUserWatch = true
  userQuery.value = ''
  userSuggestions.value = []
  formError.value = ''
  saving.value = false
  deleting.value = false
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
  if (saving.value) return
  saving.value = true
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
    await loadJudges()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
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

async function removeCert() {
  if (!editing.value) return
  if (!confirm('Удалить справку?')) return
  if (deleting.value) return
  deleting.value = true
  try {
    await apiFetch(`/medical-certificates/${editing.value.id}`, { method: 'DELETE' })
    modal.hide()
    await loadJudges()
  } catch (e) {
    formError.value = e.message
  } finally {
    deleting.value = false
  }
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}.${m}.${y}`
}

function hasActive(judge) {
  const today = new Date().toISOString().slice(0, 10)
  return judge.certificates.some(
    (c) => c.issue_date <= today && c.valid_until >= today
  )
}

async function loadJudges() {
  judgesLoading.value = true
  try {
    const data = await apiFetch('/medical-certificates/role/REFEREE')
    judges.value = data.judges
    judgesError.value = ''
  } catch (e) {
    judgesError.value = e.message
    judges.value = []
  } finally {
    judgesLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="card tile fade-in shadow-sm mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Медицинские заключения</h5>
        <button class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Добавить
        </button>
      </div>
      <div class="card-body p-3">
        <div v-if="judgesError" class="alert alert-danger mb-3">{{ judgesError }}</div>
        <div v-if="judgesLoading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="judges.length" class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th class="d-none d-md-table-cell">Дата рождения</th>
                <th>Номер заключения</th>
                <th class="d-none d-lg-table-cell">Учреждение</th>
                <th class="d-none d-xl-table-cell">Период действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in judges" :key="j.user.id" :class="{ 'table-danger': !hasActive(j) }">
                <td>{{ j.user.last_name }} {{ j.user.first_name }} {{ j.user.patronymic }}</td>
                <td class="d-none d-md-table-cell">{{ formatDate(j.user.birth_date) }}</td>
                <td>
                  <div v-for="c in j.certificates" :key="c.id">
                    <button
                      type="button"
                      class="btn btn-link p-0"
                      @click="openEdit(c)"
                    >
                      {{ c.certificate_number }}
                    </button>
                  </div>
                </td>
                <td class="d-none d-lg-table-cell">
                  <div v-for="c in j.certificates" :key="c.id">
                    <button
                      type="button"
                      class="btn btn-link p-0"
                      @click="openEdit(c)"
                    >
                      {{ c.organization }}
                    </button>
                  </div>
                </td>
                <td class="d-none d-xl-table-cell">
                  <div v-for="c in j.certificates" :key="c.id" class="text-nowrap">
                    <button
                      type="button"
                      class="btn btn-link p-0"
                      @click="openEdit(c)"
                    >
                      {{ formatDate(c.issue_date) }} - {{ formatDate(c.valid_until) }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!judgesLoading" class="text-muted mb-0">Нет данных</p>
      </div>
    </div>

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
              <div class="mb-3 position-relative" v-if="!editing">
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
                <input
                  id="certNumber"
                  v-model="form.certificate_number"
                  class="form-control"
                  placeholder="Номер"
                  :disabled="editing"
                />
                <label for="certNumber">Номер</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="certInn"
                  v-model="form.inn"
                  class="form-control"
                  placeholder="ИНН"
                  :disabled="editing"
                />
                <label for="certInn">ИНН</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="certOrg"
                  v-model="form.organization"
                  class="form-control"
                  placeholder="Учреждение"
                  disabled
                />
                <label for="certOrg">Учреждение</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="issue"
                  type="date"
                  v-model="form.issue_date"
                  class="form-control"
                  :disabled="editing"
                />
                <label for="issue">Дата выдачи</label>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="valid"
                  type="date"
                  v-model="form.valid_until"
                  class="form-control"
                  :disabled="editing"
                />
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
                <button type="button" class="btn btn-brand" @click="uploadFile">Загрузить</button>
              </div>
            </div>
            <div class="modal-footer">
              <button
                v-if="editing"
                type="button"
                class="btn btn-danger me-auto"
                @click="removeCert"
                :disabled="deleting"
              >
                <span v-if="deleting" class="spinner-border spinner-border-sm me-2"></span>
                Удалить
              </button>
              <button type="button" class="btn btn-secondary" @click="modal.hide()">
                Отмена
              </button>
              <button type="submit" class="btn btn-brand" :disabled="editing || saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
