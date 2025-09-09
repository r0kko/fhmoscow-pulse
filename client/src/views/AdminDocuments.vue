<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import EmptyState from '../components/EmptyState.vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import { apiFetch } from '../api.js';
import TabSelector from '../components/TabSelector.vue';
import DocumentUploadModal from '../components/DocumentUploadModal.vue';
import DocumentFiltersModal from '../components/DocumentFiltersModal.vue';
import DocumentCreateModal from '../components/DocumentCreateModal.vue';
import ContractPrecheckModal from '../components/ContractPrecheckModal.vue';

const route = useRoute();
const router = useRouter();
const tab = ref(
  ['signatures', 'contracts'].includes(route.query.tab)
    ? route.query.tab
    : 'documents'
);

const documents = ref([]);
const documentsLoading = ref(false);
const documentsError = ref('');
const allSignTypes = ref([]);

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
const createModal = ref(null);
const contractPrecheckModal = ref(null);

const users = ref([]);
const usersLoading = ref(false);
const usersError = ref('');

// Contracts tab state
const contractsJudges = ref([]);
const contractsLoading = ref(false);
const contractsError = ref('');

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
    documents.value = data.documents.map((d) => ({
      ...d,
      signTypeId: d.signType?.id || null,
    }));
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

async function loadSignTypes() {
  try {
    const data = await apiFetch('/sign-types');
    allSignTypes.value = data.signTypes;
  } catch (_) {
    allSignTypes.value = [];
  }
}

const pageSizeUsers = ref(loadPageSize('adminSignaturesPageSize', 10));
const currentPageUsers = ref(1);
const totalPagesUsers = computed(() =>
  Math.max(1, Math.ceil(users.value.length / pageSizeUsers.value))
);
watch(pageSizeUsers, () => {
  currentPageUsers.value = 1;
  savePageSize('adminSignaturesPageSize', pageSizeUsers.value);
});
const pagedUsers = computed(() => {
  const start = (currentPageUsers.value - 1) * pageSizeUsers.value;
  return users.value.slice(start, start + pageSizeUsers.value);
});

watch(users, () => {
  if (currentPageUsers.value > totalPagesUsers.value)
    currentPageUsers.value = totalPagesUsers.value;
});

onMounted(() => {
  const saved = localStorage.getItem('adminDocFilters');
  if (saved) Object.assign(filters, JSON.parse(saved));
  loadDocuments();
  loadUsers();
  loadSignTypes();
  loadContractsJudges();
});

watch(
  () => filters.search,
  () => localStorage.setItem('adminDocFilters', JSON.stringify(filters))
);

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

// keep tab in sync with route changes (e.g., back/forward)
watch(
  () => route.query.tab,
  (val) => {
    tab.value = ['signatures', 'contracts'].includes(val) ? val : 'documents';
  }
);

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

const pageSizeDocs = ref(loadPageSize('adminDocumentsPageSize', 10));
const currentPageDocs = ref(1);
const totalPagesDocs = computed(() =>
  Math.max(1, Math.ceil(filteredDocuments.value.length / pageSizeDocs.value))
);
watch(pageSizeDocs, () => {
  currentPageDocs.value = 1;
  savePageSize('adminDocumentsPageSize', pageSizeDocs.value);
});
const pagedDocuments = computed(() => {
  const start = (currentPageDocs.value - 1) * pageSizeDocs.value;
  return filteredDocuments.value.slice(start, start + pageSizeDocs.value);
});

watch(filteredDocuments, () => {
  if (currentPageDocs.value > totalPagesDocs.value)
    currentPageDocs.value = totalPagesDocs.value;
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
      map.set(d.documentType.alias, {
        id: d.documentType.id,
        name: d.documentType.name,
      });
  });
  return Array.from(map, ([alias, info]) => ({
    alias,
    name: info.name,
    id: info.id,
  }));
});

function openUpload(doc) {
  uploadModal.value.open(doc);
}

function openCreate() {
  createModal.value.open();
}

function openContractPrecheck(user) {
  contractPrecheckModal.value?.open?.(user);
}

function downloadName(d) {
  const fio = `${d.recipient.lastName} ${d.recipient.firstName}${
    d.recipient.patronymic ? ` ${d.recipient.patronymic}` : ''
  }`.trim();
  return `${d.documentType?.name || 'Документ'} · ${fio}`;
}

async function updateSignType(doc) {
  try {
    await apiFetch(`/documents/${doc.id}`, {
      method: 'PUT',
      body: JSON.stringify({ signTypeId: doc.signTypeId }),
    });
    const st = allSignTypes.value.find((s) => s.id === doc.signTypeId);
    doc.signType = st || null;
  } catch (e) {
    actionError.value = e.message;
  }
}

async function deleteDocument(doc) {
  if (!confirm('Удалить документ?')) return;
  try {
    await apiFetch(`/documents/${doc.id}`, { method: 'DELETE' });
    documents.value = documents.value.filter((d) => d.id !== doc.id);
  } catch (e) {
    actionError.value = e.message;
  }
}

function onCreated() {
  loadDocuments();
}

async function loadContractsJudges() {
  contractsLoading.value = true;
  try {
    const data = await apiFetch('/documents/admin/contracts/judges');
    contractsJudges.value = data.judges;
  } catch (e) {
    contractsError.value = e.message || 'Не удалось загрузить список судей';
  } finally {
    contractsLoading.value = false;
  }
}

const pageSizeContracts = ref(loadPageSize('adminContractsPageSize', 10));
const currentPageContracts = ref(1);
const totalPagesContracts = computed(() =>
  Math.max(1, Math.ceil(contractsJudges.value.length / pageSizeContracts.value))
);
watch(pageSizeContracts, () => {
  currentPageContracts.value = 1;
  savePageSize('adminContractsPageSize', pageSizeContracts.value);
});
const pagedContracts = computed(() => {
  const start = (currentPageContracts.value - 1) * pageSizeContracts.value;
  return contractsJudges.value.slice(start, start + pageSizeContracts.value);
});
watch(contractsJudges, () => {
  if (currentPageContracts.value > totalPagesContracts.value)
    currentPageContracts.value = totalPagesContracts.value;
});
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

    <div class="mb-4">
      <TabSelector
        v-model="tab"
        :tabs="[
          { key: 'documents', label: 'Документы' },
          { key: 'signatures', label: 'Типы подписей' },
          { key: 'contracts', label: 'Заключение договоров' },
        ]"
        @change="setTab"
        justify="between"
      />
    </div>

    <div v-if="tab === 'documents'">
      <div v-if="documentsError" class="alert alert-danger" role="alert">
        {{ documentsError }}
      </div>
      <BrandSpinner v-else-if="documentsLoading" label="Загрузка" />
      <div v-else>
        <div v-if="actionError" class="alert alert-danger mb-3" role="alert">
          {{ actionError }}
        </div>
        <div class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <div class="row g-2 align-items-end mb-3">
              <div class="col-12 col-sm">
                <input
                  v-model="filters.search"
                  type="search"
                  class="form-control"
                  placeholder="Поиск по получателю"
                />
              </div>
              <div class="col-6 col-sm-auto">
                <button
                  class="btn btn-outline-secondary w-100"
                  @click="openFilters"
                >
                  <i class="bi bi-funnel" aria-hidden="true"></i>
                  <span class="visually-hidden">Фильтры</span>
                </button>
              </div>

              <div class="col-12 col-sm-auto">
                <button class="btn btn-brand w-100" @click="openCreate">
                  <i class="bi bi-plus-lg me-1"></i>Добавить
                </button>
              </div>
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
                  <tr v-for="d in pagedDocuments" :key="d.id">
                    <td>{{ d.number }}</td>
                    <td>{{ d.name }}</td>
                    <td>
                      {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                      {{ d.recipient.patronymic }}
                    </td>
                    <td>
                      <select
                        v-model="d.signTypeId"
                        class="form-select form-select-sm"
                        @change="updateSignType(d)"
                      >
                        <option
                          v-for="st in allSignTypes"
                          :key="st.id"
                          :value="st.id"
                        >
                          {{ st.name }}
                        </option>
                      </select>
                    </td>
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
                          :download="downloadName(d)"
                          :aria-label="`Скачать документ ${downloadName(d)}`"
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
                            class="spinner-border spinner-border-sm spinner-brand"
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
                            class="spinner-border spinner-border-sm spinner-brand me-1"
                            aria-hidden="true"
                          ></span>
                          Отправить
                        </button>
                        <button
                          class="btn btn-sm btn-outline-danger"
                          title="Удалить"
                          @click="deleteDocument(d)"
                        >
                          <i class="bi bi-trash" aria-hidden="true"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!filteredDocuments.length">
                    <td colspan="7" class="p-0">
                      <EmptyState
                        icon="bi-file-earmark"
                        title="Документы отсутствуют"
                        description="Измените фильтры или создайте новый документ"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="filteredDocuments.length" class="d-block d-sm-none">
              <div v-for="d in pagedDocuments" :key="d.id" class="card mb-2">
                <div class="card-body">
                  <h3 class="h6 mb-1">{{ d.name }}</h3>
                  <p class="mb-1 small">№ {{ d.number }}</p>
                  <p class="mb-1 small">
                    {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                    {{ d.recipient.patronymic }}
                  </p>
                  <div class="mb-1 small">
                    <select
                      v-model="d.signTypeId"
                      class="form-select form-select-sm"
                      @change="updateSignType(d)"
                    >
                      <option
                        v-for="st in allSignTypes"
                        :key="st.id"
                        :value="st.id"
                      >
                        {{ st.name }}
                      </option>
                    </select>
                  </div>
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
                      :download="downloadName(d)"
                      :aria-label="`Скачать документ ${downloadName(d)}`"
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
                    <button
                      class="btn btn-sm btn-outline-danger"
                      title="Удалить"
                      @click="deleteDocument(d)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <PageNav
          v-if="filteredDocuments.length"
          v-model:page="currentPageDocs"
          v-model:page-size="pageSizeDocs"
          :total-pages="totalPagesDocs"
        />
      </div>
    </div>

    <div v-else-if="tab === 'signatures'">
      <div v-if="usersError" class="alert alert-danger" role="alert">
        {{ usersError }}
      </div>
      <BrandSpinner v-else-if="usersLoading" label="Загрузка" />
      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="table-responsive d-none d-sm-block">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">ФИО</th>
                  <th scope="col">Email / ИНН</th>
                  <th scope="col">Тип подписи</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in pagedUsers" :key="u.id">
                  <td>{{ u.lastName }} {{ u.firstName }} {{ u.patronymic }}</td>
                  <td>
                    {{ u.email }}<br />
                    <small class="text-muted">{{ u.inn || '—' }}</small>
                  </td>
                  <td>{{ u.signType ? u.signType.name : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="users.length" class="d-block d-sm-none">
            <div v-for="u in pagedUsers" :key="u.id" class="card mb-2">
              <div class="card-body">
                <h3 class="h6 mb-1">
                  {{ u.lastName }} {{ u.firstName }} {{ u.patronymic }}
                </h3>
                <p class="mb-1 small">
                  {{ u.email || '—' }}<br />
                  <span class="text-muted">{{ u.inn || '—' }}</span>
                </p>
                <p class="mb-0 small">Подпись: {{ u.signType?.name || '—' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PageNav
        v-if="users.length"
        v-model:page="currentPageUsers"
        v-model:page-size="pageSizeUsers"
        :total-pages="totalPagesUsers"
      />
    </div>

    <div v-else>
      <div v-if="contractsError" class="alert alert-danger" role="alert">
        {{ contractsError }}
      </div>
      <BrandSpinner v-else-if="contractsLoading" label="Загрузка" />
      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="table-responsive d-none d-sm-block">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">ФИО</th>
                  <th scope="col">Дата рождения</th>
                  <th scope="col">Тип электронной подписи</th>
                  <th scope="col">Договор</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in pagedContracts" :key="u.id">
                  <td>
                    {{ u.lastName }} {{ u.firstName }}
                    {{ u.patronymic || '' }}
                  </td>
                  <td>
                    {{ new Date(u.birthDate).toLocaleDateString('ru-RU') }}
                  </td>
                  <td>{{ u.signType ? u.signType.name : '—' }}</td>
                  <td>
                    <button
                      class="btn btn-sm btn-primary"
                      @click="openContractPrecheck(u)"
                      :aria-label="`Сформировать договор для ${u.lastName} ${u.firstName}`"
                      title="Формирование договора"
                    >
                      Сформировать договор
                    </button>
                  </td>
                </tr>
                <tr v-if="!contractsJudges.length">
                  <td colspan="4" class="p-0">
                    <EmptyState
                      icon="bi-people"
                      title="Нет подходящих судей"
                      description="Список пуст. Проверьте статусы и роли пользователей."
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="contractsJudges.length" class="d-block d-sm-none">
            <div v-for="u in pagedContracts" :key="u.id" class="card mb-2">
              <div class="card-body">
                <h3 class="h6 mb-1">
                  {{ u.lastName }} {{ u.firstName }} {{ u.patronymic || '' }}
                </h3>
                <p class="mb-1 small">
                  Дата рождения:
                  {{ new Date(u.birthDate).toLocaleDateString('ru-RU') }}
                </p>
                <p class="mb-2 small">
                  Подпись: <strong>{{ u.signType?.name || '—' }}</strong>
                </p>
                <button
                  class="btn btn-sm btn-primary w-100"
                  @click="openContractPrecheck(u)"
                  :aria-label="`Сформировать договор для ${u.lastName} ${u.firstName}`"
                  title="Формирование договора"
                >
                  Сформировать договор
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PageNav
        v-if="contractsJudges.length"
        v-model:page="currentPageContracts"
        v-model:page-size="pageSizeContracts"
        :total-pages="totalPagesContracts"
      />
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
  <DocumentCreateModal
    ref="createModal"
    :users="users"
    :doc-types="docTypes"
    :sign-types="allSignTypes"
    @created="onCreated"
  />
  <ContractPrecheckModal ref="contractPrecheckModal" />
</template>

<style scoped>
/* Component-specific styles are centralized in brand.css. */
</style>
