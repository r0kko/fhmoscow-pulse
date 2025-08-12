<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { apiFetch } from '../api.js';
import DocumentUploadModal from '../components/DocumentUploadModal.vue';
import DocumentFiltersModal from '../components/DocumentFiltersModal.vue';

const route = useRoute();
const router = useRouter();
const tab = ref(route.query.tab === 'signatures' ? 'signatures' : 'documents');

const documents = ref([]);
const documentsLoading = ref(false);
const documentsError = ref('');

const filters = reactive({
  search: '',
  number: '',
  signType: '',
  status: '',
  docType: '',
  dateFrom: '',
  dateTo: '',
});
const filtersModal = ref(null);

const uploadModal = ref(null);

const users = ref([]);
const usersLoading = ref(false);
const usersError = ref('');

const actionId = ref('');
const actionError = ref('');

function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

async function loadDocuments() {
  documentsLoading.value = true;
  try {
    const data = await apiFetch('/documents/admin');
    documents.value = data.documents;
  } catch (_) {
    documentsError.value = 'Не удалось загрузить документы';
  } finally {
    documentsLoading.value = false;
  }
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    const data = await apiFetch('/sign-types/users');
    users.value = data.users;
  } catch (e) {
    usersError.value = e.message;
  } finally {
    usersLoading.value = false;
  }
}

onMounted(() => {
  const saved = localStorage.getItem('adminDocFilters');
  if (saved) Object.assign(filters, JSON.parse(saved));
  loadDocuments();
  loadUsers();
});

function applyFilters(newFilters) {
  Object.assign(filters, newFilters);
  localStorage.setItem('adminDocFilters', JSON.stringify(filters));
}

function openFilters() {
  filtersModal.value.open();
}

function setTab(value) {
  tab.value = value;
  router.replace({ query: value === 'documents' ? {} : { tab: value } });
}

async function requestSignature(doc) {
  if (actionId.value) return;
  actionId.value = doc.id;
  actionError.value = '';
  try {
    const res = await apiFetch(`/documents/${doc.id}/request-sign`, {
      method: 'POST',
    });
    doc.status = res.status;
  } catch (e) {
    actionError.value = e.message;
  } finally {
    actionId.value = '';
  }
}

async function regenerateDocument(doc) {
  if (actionId.value) return;
  actionId.value = doc.id;
  actionError.value = '';
  try {
    const res = await apiFetch(`/documents/${doc.id}/regenerate`, {
      method: 'POST',
    });
    doc.file = res.file;
  } catch (e) {
    actionError.value = e.message;
  } finally {
    actionId.value = '';
  }
}

const filteredDocuments = computed(() => {
  return documents.value.filter((d) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const fio =
        `${d.recipient.lastName} ${d.recipient.firstName} ${d.recipient.patronymic}`.toLowerCase();
      if (!fio.includes(q)) return false;
    }
    if (filters.number && !String(d.number).includes(filters.number)) {
      return false;
    }
    if (filters.signType && d.signType?.alias !== filters.signType) {
      return false;
    }
    if (filters.status && d.status?.alias !== filters.status) {
      return false;
    }
    if (filters.docType && d.documentType?.alias !== filters.docType) {
      return false;
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (new Date(d.documentDate) < from) return false;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setDate(to.getDate() + 1);
      if (new Date(d.documentDate) >= to) return false;
    }
    return true;
  });
});

const signTypes = computed(() => {
  const map = new Map();
  documents.value.forEach((d) => {
    if (d.signType?.alias) map.set(d.signType.alias, d.signType.name);
  });
  return Array.from(map, ([alias, name]) => ({ alias, name }));
});

const statuses = computed(() => {
  const map = new Map();
  documents.value.forEach((d) => {
    if (d.status?.alias) map.set(d.status.alias, d.status.name);
  });
  return Array.from(map, ([alias, name]) => ({ alias, name }));
});

const docTypes = computed(() => {
  const map = new Map();
  documents.value.forEach((d) => {
    if (d.documentType?.alias)
      map.set(d.documentType.alias, d.documentType.name);
  });
  return Array.from(map, ([alias, name]) => ({ alias, name }));
});

function openUpload(doc) {
  uploadModal.value.open(doc);
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Документы</li>
      </ol>
    </nav>
    <h1 class="mb-3">Документы</h1>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <a
          href="#"
          class="nav-link"
          :class="{ active: tab === 'documents' }"
          @click.prevent="setTab('documents')"
          >Документы</a
        >
      </li>
      <li class="nav-item">
        <a
          href="#"
          class="nav-link"
          :class="{ active: tab === 'signatures' }"
          @click.prevent="setTab('signatures')"
          >Документы и подписи</a
        >
      </li>
    </ul>

    <div v-if="tab === 'documents'">
      <div v-if="documentsError" class="alert alert-danger" role="alert">
        {{ documentsError }}
      </div>
      <div v-else-if="documentsLoading" class="text-center p-3">
        <div
          class="spinner-border text-primary"
          role="status"
          aria-label="loading"
        ></div>
      </div>
      <div v-else>
        <div v-if="actionError" class="alert alert-danger mb-3" role="alert">
          {{ actionError }}
        </div>
        <div class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <div class="d-flex justify-content-end mb-3">
              <button class="btn btn-outline-secondary" @click="openFilters">
                <i class="bi bi-funnel" aria-hidden="true"></i>
                <span class="visually-hidden">Фильтры</span>
              </button>
            </div>
            <div class="table-responsive d-none d-sm-block">
              <table class="table mb-0">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Документ</th>
                    <th>Получатель</th>
                    <th>Тип подписи</th>
                    <th>Статус</th>
                    <th>Дата документа</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in filteredDocuments" :key="d.id">
                    <td>{{ d.number }}</td>
                    <td>{{ d.name }}</td>
                    <td>
                      {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                      {{ d.recipient.patronymic }}
                    </td>
                    <td>{{ d.signType?.name }}</td>
                    <td>{{ d.status?.name }}</td>
                    <td>{{ formatDateTime(d.documentDate) }}</td>
                    <td>
                      <div class="d-flex flex-wrap gap-2">
                        <a
                          v-if="d.file"
                          :href="d.file.url"
                          class="btn btn-sm btn-outline-secondary"
                          target="_blank"
                          rel="noopener"
                          title="Скачать"
                        >
                          <i class="bi bi-download" aria-hidden="true"></i>
                        </a>
                        <button
                          v-if="
                            d.documentType?.generated &&
                            ['CREATED', 'AWAITING_SIGNATURE'].includes(
                              d.status?.alias
                            )
                          "
                          class="btn btn-sm btn-outline-secondary"
                          :disabled="actionId === d.id"
                          title="Перегенерировать"
                          @click="regenerateDocument(d)"
                        >
                          <span
                            v-if="actionId === d.id"
                            class="spinner-border spinner-border-sm"
                            aria-hidden="true"
                          ></span>
                          <i
                            v-else
                            class="bi bi-arrow-clockwise"
                            aria-hidden="true"
                          ></i>
                        </button>
                        <button
                          v-if="
                            ['HANDWRITTEN', 'KONTUR_SIGN'].includes(
                              d.signType?.alias
                            ) && d.status?.alias === 'AWAITING_SIGNATURE'
                          "
                          class="btn btn-sm btn-primary"
                          title="Загрузить подписанный файл"
                          @click="openUpload(d)"
                        >
                          <i class="bi bi-upload" aria-hidden="true"></i>
                        </button>
                        <button
                          v-else-if="
                            ['HANDWRITTEN', 'KONTUR_SIGN'].includes(
                              d.signType?.alias
                            ) && d.status?.alias === 'CREATED'
                          "
                          class="btn btn-sm btn-primary"
                          :disabled="actionId === d.id"
                          @click="requestSignature(d)"
                        >
                          <span
                            v-if="actionId === d.id"
                            class="spinner-border spinner-border-sm me-1"
                            aria-hidden="true"
                          ></span>
                          Отправить
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!filteredDocuments.length">
                    <td colspan="7" class="text-center">
                      Документы отсутствуют
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="filteredDocuments.length" class="d-block d-sm-none">
              <div v-for="d in filteredDocuments" :key="d.id" class="card mb-2">
                <div class="card-body p-2">
                  <h3 class="h6 mb-1">{{ d.name }}</h3>
                  <p class="mb-1 small">№ {{ d.number }}</p>
                  <p class="mb-1 small">
                    {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                    {{ d.recipient.patronymic }}
                  </p>
                  <p class="mb-1 small">
                    Подпись: {{ d.signType?.name || '—' }}
                  </p>
                  <p class="mb-1 small">Статус: {{ d.status?.name || '—' }}</p>
                  <p class="mb-2 small">
                    Дата: {{ formatDateTime(d.documentDate) }}
                  </p>
                  <div class="d-flex flex-wrap gap-2">
                    <a
                      v-if="d.file"
                      :href="d.file.url"
                      class="btn btn-sm btn-outline-secondary"
                      target="_blank"
                      rel="noopener"
                      title="Скачать"
                    >
                      <i class="bi bi-download" aria-hidden="true"></i>
                    </a>
                    <button
                      v-if="
                        d.documentType?.generated &&
                        ['CREATED', 'AWAITING_SIGNATURE'].includes(
                          d.status?.alias
                        )
                      "
                      class="btn btn-sm btn-outline-secondary"
                      :disabled="actionId === d.id"
                      title="Перегенерировать"
                      @click="regenerateDocument(d)"
                    >
                      <span
                        v-if="actionId === d.id"
                        class="spinner-border spinner-border-sm"
                        aria-hidden="true"
                      ></span>
                      <i
                        v-else
                        class="bi bi-arrow-clockwise"
                        aria-hidden="true"
                      ></i>
                    </button>
                    <button
                      v-if="
                        ['HANDWRITTEN', 'KONTUR_SIGN'].includes(
                          d.signType?.alias
                        ) && d.status?.alias === 'AWAITING_SIGNATURE'
                      "
                      class="btn btn-sm btn-primary"
                      title="Загрузить подписанный файл"
                      @click="openUpload(d)"
                    >
                      <i class="bi bi-upload" aria-hidden="true"></i>
                    </button>
                    <button
                      v-else-if="
                        ['HANDWRITTEN', 'KONTUR_SIGN'].includes(
                          d.signType?.alias
                        ) && d.status?.alias === 'CREATED'
                      "
                      class="btn btn-sm btn-primary"
                      :disabled="actionId === d.id"
                      @click="requestSignature(d)"
                    >
                      <span
                        v-if="actionId === d.id"
                        class="spinner-border spinner-border-sm me-1"
                        aria-hidden="true"
                      ></span>
                      Отправить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <div v-if="usersError" class="alert alert-danger" role="alert">
        {{ usersError }}
      </div>
      <div v-else-if="usersLoading" class="text-center p-3">
        <div
          class="spinner-border text-primary"
          role="status"
          aria-label="loading"
        ></div>
      </div>
      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="table-responsive d-none d-sm-block">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">ФИО</th>
                  <th scope="col">Email</th>
                  <th scope="col">Тип подписи</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id">
                  <td>{{ u.lastName }} {{ u.firstName }} {{ u.patronymic }}</td>
                  <td>{{ u.email }}</td>
                  <td>{{ u.signType ? u.signType.name : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="users.length" class="d-block d-sm-none">
            <div v-for="u in users" :key="u.id" class="card mb-2">
              <div class="card-body p-2">
                <h3 class="h6 mb-1">
                  {{ u.lastName }} {{ u.firstName }} {{ u.patronymic }}
                </h3>
                <p class="mb-1 small">{{ u.email || '—' }}</p>
                <p class="mb-0 small">Подпись: {{ u.signType?.name || '—' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <DocumentUploadModal ref="uploadModal" />
  <DocumentFiltersModal
    ref="filtersModal"
    :filters="filters"
    :sign-types="signTypes"
    :statuses="statuses"
    :doc-types="docTypes"
    @apply="applyFilters"
  />
</template>

<style scoped>
/* Component-specific styles are centralized in brand.css. */
</style>
