<script setup>
import { ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { apiFetch } from '../api.js'

const props = defineProps({
  userId: String,
  editable: { type: Boolean, default: false }
})

const documents = ref([])
const loading = ref(false)
const error = ref('')

const modalRef = ref(null)
let modal
const form = ref({ signing_date: '', valid_until: '' })

onMounted(() => {
  modal = new Modal(modalRef.value)
  load()
})

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('ru-RU')
}

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  return (
    d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  )
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const path = props.userId ? `/users/${props.userId}/documents` : '/documents/me'
    const data = await apiFetch(path)
    documents.value = data.documents
  } catch (e) {
    error.value = e.message
    documents.value = []
  } finally {
    loading.value = false
  }
}

function openModal() {
  form.value.signing_date = new Date().toISOString().slice(0, 16)
  form.value.valid_until = ''
  modal.show()
}

async function save() {
  try {
    const body = JSON.stringify({
      document: 'PDP_CONSENT',
      signing_date: new Date(form.value.signing_date).toISOString(),
      valid_until: form.value.valid_until ? new Date(form.value.valid_until).toISOString() : undefined
    })
    const data = await apiFetch(`/users/${props.userId}/documents`, { method: 'POST', body })
    documents.value.push(data.document)
    modal.hide()
  } catch (e) {
    error.value = e.message
  }
}

async function removeDoc(id) {
  if (!confirm('Удалить документ?')) return
  try {
    await apiFetch(`/users/${props.userId}/documents/${id}`, { method: 'DELETE' })
    documents.value = documents.value.filter(d => d.id !== id)
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <h5 class="card-title mb-3">Документы</h5>
      <div v-if="loading" class="text-center py-4">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else>
        <ul v-if="documents.length" class="list-group">
          <li
            class="list-group-item d-flex justify-content-between align-items-start"
            v-for="doc in documents"
            :key="doc.id"
          >
            <div class="me-auto">
              <div class="fw-bold">{{ doc.document_name }}</div>
              <small>
                Подписан: {{ formatDateTime(doc.signing_date) }}<span v-if="doc.valid_until">
                  , действует до {{ formatDate(doc.valid_until) }}</span
                >
              </small>
            </div>
            <button
              v-if="editable"
              type="button"
              class="btn btn-link text-danger p-0"
              @click="removeDoc(doc.id)"
            >
              <i class="bi bi-trash"></i>
            </button>
          </li>
        </ul>
        <p v-else class="text-muted mb-0">Документы не найдены.</p>
        <button v-if="editable" class="btn btn-primary mt-3" @click="openModal">Добавить</button>
        <div v-if="error" class="text-danger mt-2">{{ error }}</div>
      </div>
    </div>
  </div>

  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form @submit.prevent="save">
          <div class="modal-header">
            <h5 class="modal-title">Новый документ</h5>
            <button type="button" class="btn-close" @click="modal.hide()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Дата подписания</label>
              <input v-model="form.signing_date" type="datetime-local" class="form-control" />
            </div>
            <div class="mb-3">
              <label class="form-label">Действителен до</label>
              <input v-model="form.valid_until" type="datetime-local" class="form-control" />
            </div>
            <div v-if="error" class="text-danger">{{ error }}</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="modal.hide()">Отмена</button>
            <button type="submit" class="btn btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
