<script setup>
import {
  ref,
  onMounted,
  onBeforeUnmount,
  nextTick,
  computed,
  watch,
} from 'vue';
// RouterLink not needed here; breadcrumbs component handles links
import { apiFetch } from '../api.js';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import EmptyState from '../components/EmptyState.vue';
import DocumentFiltersModal from '../components/DocumentFiltersModal.vue';
import PageNav from '../components/PageNav.vue';
import DocumentSignModal from '../components/DocumentSignModal.vue';
import { useToast } from '../utils/toast.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import BaseTile from '../components/BaseTile.vue';
import { auth } from '../auth.js';
import { hasRole, REFEREE_ROLES } from '../utils/roles.js';

const loading = ref(true);
const error = ref('');
const current = ref(null);
const signTypes = ref([]);
const documents = ref([]);
const search = ref(localStorage.getItem('documentsSearch') || '');
const filters = ref({
  number: localStorage.getItem('documentsFilter:number') || '',
  signType: localStorage.getItem('documentsFilter:signType') || '',
  status: localStorage.getItem('documentsFilter:status') || '',
  docType: localStorage.getItem('documentsFilter:docType') || '',
  dateFrom: localStorage.getItem('documentsFilter:dateFrom') || '',
  dateTo: localStorage.getItem('documentsFilter:dateTo') || '',
});
const filtersModal = ref(null);
const selected = ref('');
const selectedType = ref(null);
const code = ref('');
const verifyError = ref('');
const success = ref(false);
const loadingAlias = ref('');
const confirming = ref(false);
const resendCooldown = ref(0);
let resendTimer = null;
const { showToast } = useToast();
const userEmail = ref('');
const showServiceContractTile = computed(() =>
  hasRole(auth.roles, REFEREE_ROLES)
);

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const d = date.toLocaleDateString('ru-RU');
  const t = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${d} в ${t}`;
}

const signInfo = {
  HANDWRITTEN: [
    'Нужно приехать в офис в рабочее время',
    'Потребуется оригинал паспорта для идентификации личности',
    'Подтверждение займет некоторое время',
  ],
  KONTUR_SIGN: [
    'Можно сделать не выходя из дома, в любое время',
    {
      before: 'Потребуется ',
      linkText: 'регистрация в сервисе',
      after: ' с дистанционной проверкой документов в МВД',
      url: 'https://support.kontur.ru/sign/53303-pep',
    },
    'Юридическая значимость гарантируется СКБ Контур',
  ],
};

onMounted(async () => {
  try {
    const [me, types, docs, userMe] = await Promise.all([
      apiFetch('/sign-types/me'),
      apiFetch('/sign-types'),
      apiFetch('/documents'),
      apiFetch('/users/me').catch(() => ({ user: null })),
    ]);
    current.value = me.signType;
    signTypes.value = (types.signTypes || []).filter((t) =>
      ['HANDWRITTEN', 'KONTUR_SIGN'].includes(t.alias)
    );
    documents.value = (docs.documents || []).slice().sort((a, b) => {
      const ad = new Date(a.documentDate || 0).getTime();
      const bd = new Date(b.documentDate || 0).getTime();
      return bd - ad;
    });
    userEmail.value = userMe?.user?.email || '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

async function reloadDocuments() {
  try {
    const docs = await apiFetch('/documents');
    documents.value = (docs.documents || []).slice().sort((a, b) => {
      const ad = new Date(a.documentDate || 0).getTime();
      const bd = new Date(b.documentDate || 0).getTime();
      return bd - ad;
    });
  } catch (e) {
    // Silently ignore to not interrupt the flow; page will still work
  }
}

async function choose(alias) {
  if (loadingAlias.value) return;
  loadingAlias.value = alias;
  code.value = '';
  verifyError.value = '';
  success.value = false;
  try {
    await apiFetch('/sign-types/send-code', { method: 'POST' });
    selected.value = alias;
    selectedType.value = signTypes.value.find((t) => t.alias === alias);
    // Start cooldown for resend and focus input for better flow
    startResendCooldown();
    await nextTick();
    const el = document.getElementById('code');
    if (el) el.focus();
  } catch (e) {
    verifyError.value = e.message;
  } finally {
    loadingAlias.value = '';
  }
}

async function submit() {
  if (confirming.value) return;
  confirming.value = true;
  try {
    await apiFetch('/sign-types/select', {
      method: 'POST',
      body: JSON.stringify({ alias: selected.value, code: code.value }),
    });
    const res = await apiFetch('/sign-types/me');
    current.value = res.signType;
    success.value = true;
    await reloadDocuments();
    showToast('Способ подписания сохранён', 'success');
  } catch (e) {
    verifyError.value = e.message;
  } finally {
    confirming.value = false;
  }
}

function startResendCooldown(seconds = 30) {
  clearInterval(resendTimer);
  resendCooldown.value = seconds;
  resendTimer = setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;
      resendCooldown.value = 0;
    }
  }, 1000);
}

async function resendCode() {
  if (resendCooldown.value > 0) return;
  try {
    await apiFetch('/sign-types/send-code', { method: 'POST' });
    startResendCooldown();
    showToast('Код повторно отправлен', 'secondary');
  } catch (e) {
    verifyError.value = e.message;
  }
}

onBeforeUnmount(() => {
  if (resendTimer) clearInterval(resendTimer);
});

function downloadName(d) {
  const base = d.documentType?.name || 'Документ';
  return `${base} · №${d.number}`;
}

function downloadFile(d) {
  if (!d?.file?.url) return;
  try {
    const a = document.createElement('a');
    a.href = d.file.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('download', downloadName(d));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (_) {
    window.open(d.file.url, '_blank', 'noopener');
  }
}

function cardInteractionBindings(doc) {
  return {
    role: 'button',
    tabindex: 0,
    onClick: () => downloadFile(doc),
    onKeydown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        downloadFile(doc);
      }
    },
  };
}

const statusBadge = computed(() => (alias) => {
  switch (alias) {
    case 'SIGNED':
      return 'bg-success-subtle text-success border';
    case 'AWAITING_SIGNATURE':
      return 'bg-warning-subtle text-warning border';
    case 'CREATED':
    default:
      return 'bg-secondary-subtle text-secondary border';
  }
});

const signing = ref('');
const signModal = ref(null);
function openSignDialog(doc) {
  signModal.value?.open?.(doc);
}
function onSigned() {
  reloadDocuments();
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const maskedName =
    name.length <= 2
      ? name[0] + '*'
      : name[0] + '*'.repeat(Math.max(1, name.length - 2)) + name.at(-1);
  const [d1, ...rest] = domain.split('.');
  const maskedDomain =
    d1.length <= 2
      ? d1[0] + '*'
      : d1[0] + '*'.repeat(Math.max(1, d1.length - 2)) + d1.at(-1);
  return `${maskedName}@${[maskedDomain, ...rest].filter(Boolean).join('.')}`;
}

async function copyToClipboard(text, label = 'Скопировано') {
  try {
    await navigator.clipboard?.writeText?.(String(text) || '');
    showToast(label, 'secondary');
  } catch {
    // ignore
  }
}

function cancelSelection() {
  selected.value = '';
  selectedType.value = null;
  code.value = '';
  verifyError.value = '';
  success.value = false;
}

// Filtering
const filteredDocuments = computed(() => {
  let list = documents.value;
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter((d) => {
      const name = String(d.name || '').toLowerCase();
      const number = String(d.number || '').toLowerCase();
      return name.includes(q) || number.includes(q);
    });
  }
  if (filters.value.number) {
    const n = filters.value.number.trim().toLowerCase();
    list = list.filter((d) =>
      String(d.number || '')
        .toLowerCase()
        .includes(n)
    );
  }
  if (filters.value.signType) {
    list = list.filter(
      (d) => (d.signType?.alias || '') === filters.value.signType
    );
  }
  if (filters.value.status) {
    list = list.filter((d) => (d.status?.alias || '') === filters.value.status);
  }
  if (filters.value.docType) {
    list = list.filter(
      (d) => (d.documentType?.alias || '') === filters.value.docType
    );
  }
  if (filters.value.dateFrom) {
    const from = new Date(filters.value.dateFrom);
    list = list.filter((d) => new Date(d.documentDate) >= from);
  }
  if (filters.value.dateTo) {
    const to = new Date(filters.value.dateTo);
    to.setDate(to.getDate() + 1);
    list = list.filter((d) => new Date(d.documentDate) < to);
  }
  return list;
});

watch(search, (v) => localStorage.setItem('documentsSearch', v));
watch(
  filters,
  (f) => {
    try {
      localStorage.setItem('documentsFilter:number', f.number || '');
      localStorage.setItem('documentsFilter:signType', f.signType || '');
      localStorage.setItem('documentsFilter:status', f.status || '');
      localStorage.setItem('documentsFilter:docType', f.docType || '');
      localStorage.setItem('documentsFilter:dateFrom', f.dateFrom || '');
      localStorage.setItem('documentsFilter:dateTo', f.dateTo || '');
    } catch (_) {}
  },
  { deep: true }
);

// Options for filters
const filterSignTypes = computed(() => {
  const map = new Map();
  documents.value.forEach((d) => {
    if (d.signType?.alias) map.set(d.signType.alias, d.signType.name);
  });
  return Array.from(map, ([alias, name]) => ({ alias, name }));
});
const filterStatuses = computed(() => {
  const map = new Map();
  documents.value.forEach((d) => {
    if (d.status?.alias) map.set(d.status.alias, d.status.name);
  });
  return Array.from(map, ([alias, name]) => ({ alias, name }));
});
const filterDocTypes = computed(() => {
  const map = new Map();
  documents.value.forEach((d) => {
    if (d.documentType?.alias)
      map.set(d.documentType.alias, d.documentType.name);
  });
  return Array.from(map, ([alias, name]) => ({ alias, name }));
});

function openFilters() {
  filtersModal.value?.open?.();
}
function applyFilters(next) {
  filters.value = { ...filters.value, ...next };
}

// Pagination
const pageSize = ref(loadPageSize('documentsPageSize', 10));
const currentPage = ref(1);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredDocuments.value.length / pageSize.value))
);
watch(pageSize, () => {
  currentPage.value = 1;
  savePageSize('documentsPageSize', pageSize.value);
});
const pagedDocuments = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredDocuments.value.slice(start, start + pageSize.value);
});
watch(filteredDocuments, () => {
  if (currentPage.value > totalPages.value)
    currentPage.value = totalPages.value;
});
</script>

<template>
  <div class="py-3">
    <div class="container">
      <Breadcrumbs
        :items="[{ label: 'Главная', to: '/' }, { label: 'Документы' }]"
      />
      <h1 class="mb-3">Документы</h1>
      <BrandSpinner v-if="loading" label="Загрузка" />
      <div v-else>
        <div v-if="error" class="text-danger">{{ error }}</div>
        <div v-else>
          <div v-if="current">
            <div class="row g-3 g-lg-2 align-items-stretch">
              <div
                v-if="showServiceContractTile"
                class="col-12 col-md-5 col-lg-5 order-2 order-md-1"
              >
                <BaseTile
                  to="https://disk.360.yandex.ru/d/1Ayq7JNB19biLw"
                  :section="true"
                  :aria-label="'Договор оказания услуг по судейству хоккейных матчей'"
                  class="w-100 h-100"
                >
                  <div
                    class="card-body d-flex flex-column justify-content-between"
                  >
                    <div>
                      <h2 class="h6 mb-2">Договор оказания услуг</h2>
                      <p class="mb-0 text-muted small">
                        Судейство хоккейных матчей · PDF
                      </p>
                    </div>
                    <div
                      class="d-flex align-items-center justify-content-between mt-3"
                    >
                      <span class="text-muted small"
                        >Откроется в новой вкладке</span
                      >
                      <i
                        class="bi bi-file-earmark-text fs-3"
                        aria-hidden="true"
                      ></i>
                    </div>
                  </div>
                </BaseTile>
              </div>
              <div
                :class="[
                  'col-12',
                  showServiceContractTile
                    ? 'col-md-7 col-lg-7 order-1 order-md-2'
                    : '',
                ]"
              >
                <div
                  class="card section-card tile fade-in h-100 signature-card"
                >
                  <div class="card-body">
                    <h2 class="h6 mb-3">Ваш способ подписания</h2>
                    <template v-if="current.alias === 'HANDWRITTEN'">
                      <p class="mb-2">
                        <span
                          class="badge rounded-pill text-bg-danger fw-semibold badge-sign-type"
                        >
                          Собственноручная подпись
                        </span>
                      </p>
                      <p class="text-muted mb-0 small">
                        <span class="fw-semibold">Где оформить:</span>
                        офис Федерации в будние дни с 10:00 до 17:00
                      </p>
                    </template>
                    <template v-else-if="current.alias === 'KONTUR_SIGN'">
                      <p class="mb-2">
                        <span
                          class="badge rounded-pill text-bg-warning fw-semibold badge-sign-type"
                        >
                          Подписание через Контур.Сайн
                        </span>
                      </p>
                      <p class="mb-1 d-flex align-items-center flex-wrap gap-2">
                        <span class="fw-semibold">ИНН:</span>
                        <span class="ms-1">{{ current.inn }}</span>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary"
                          aria-label="Скопировать ИНН"
                          @click="
                            copyToClipboard(current.inn, 'ИНН скопирован')
                          "
                        >
                          <i class="bi bi-clipboard" aria-hidden="true"></i>
                        </button>
                      </p>
                      <p class="mb-1">
                        <span class="fw-semibold">Эмитент сертификата:</span>
                        <span class="ms-1">СКБ Контур</span>
                      </p>
                      <a
                        href="https://sign.kontur.ru"
                        target="_blank"
                        rel="noopener"
                        class="btn btn-sm btn-brand mt-2"
                      >
                        Перейти в Контур.Сайн
                      </a>
                    </template>
                    <template v-else-if="current.alias === 'SIMPLE_ELECTRONIC'">
                      <p class="mb-2">
                        <span
                          class="badge rounded-pill text-bg-success fw-semibold badge-sign-type"
                        >
                          Простая электронная подпись
                        </span>
                      </p>
                      <p class="mb-1">
                        <span class="fw-semibold">ИНН:</span>
                        <span class="ms-1">{{ current.inn }}</span>
                      </p>
                      <p class="mb-1">
                        <span class="fw-semibold">Эмитент сертификата:</span>
                        <span class="ms-1">Федерация хоккея Москвы</span>
                      </p>
                      <p class="text-muted mb-0">
                        <span class="fw-semibold">Дата создания подписи:</span>
                        <span class="ms-1">{{
                          formatDate(current.signCreatedDate)
                        }}</span>
                      </p>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <div class="row g-3 mt-2 mt-lg-1">
              <div class="col-12">
                <div class="card section-card tile fade-in">
                  <div class="card-body">
                    <div class="row g-2 align-items-end mb-3">
                      <div class="col-12 col-sm">
                        <label for="docSearch" class="visually-hidden"
                          >Поиск</label
                        >
                        <input
                          id="docSearch"
                          v-model="search"
                          type="search"
                          class="form-control"
                          placeholder="Поиск по названию или номеру"
                          autocomplete="off"
                          aria-label="Поиск по названию или номеру"
                        />
                      </div>
                      <div class="col-6 col-sm-auto">
                        <button
                          class="btn btn-outline-secondary w-100"
                          aria-label="Открыть фильтры"
                          @click="openFilters"
                        >
                          <i class="bi bi-funnel" aria-hidden="true"></i>
                          <span class="visually-hidden">Фильтры</span>
                        </button>
                      </div>
                    </div>
                    <div class="table-responsive d-none d-sm-block">
                      <table class="table table-hover align-middle mb-0">
                        <caption class="visually-hidden">
                          Список ваших документов с номером, датой, типом
                          подписи и статусом
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Номер</th>
                            <th scope="col">Название</th>
                            <th scope="col">Дата</th>
                            <th scope="col">Тип подписи</th>
                            <th scope="col">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="d in pagedDocuments"
                            :key="d.id"
                            :class="{ 'table-row-click': d.file }"
                            role="button"
                            :tabindex="d.file ? 0 : -1"
                            @click="d.file ? downloadFile(d) : null"
                            @keydown.enter="d.file ? downloadFile(d) : null"
                          >
                            <td>{{ d.number }}</td>
                            <td>{{ d.name }}</td>
                            <td>{{ formatDate(d.documentDate) }}</td>
                            <td>{{ d.signType?.name || '-' }}</td>
                            <td>
                              <template
                                v-if="
                                  d.signType?.alias === 'SIMPLE_ELECTRONIC' &&
                                  d.status?.alias === 'AWAITING_SIGNATURE' &&
                                  current?.alias === 'SIMPLE_ELECTRONIC'
                                "
                              >
                                <button
                                  class="btn btn-sm btn-brand"
                                  :disabled="
                                    current?.alias !== 'SIMPLE_ELECTRONIC'
                                  "
                                  :title="
                                    current?.alias !== 'SIMPLE_ELECTRONIC'
                                      ? 'Выберите простую электронную подпись вверху, чтобы подписывать документы онлайн'
                                      : 'Подписать документ'
                                  "
                                  @click.stop="openSignDialog(d)"
                                >
                                  Подписать
                                </button>
                              </template>
                              <template v-else>
                                <span
                                  v-if="d.status?.alias"
                                  class="badge"
                                  :class="statusBadge(d.status.alias)"
                                >
                                  {{ d.status?.name }}
                                </span>
                                <span v-else class="text-muted">—</span>
                              </template>
                            </td>
                          </tr>
                          <tr v-if="!filteredDocuments.length">
                            <td colspan="5" class="p-0">
                              <EmptyState
                                icon="bi-file-earmark"
                                title="Документы отсутствуют"
                                :description="
                                  search
                                    ? 'Не найдено по заданным критериям'
                                    : 'После оформления появятся в этом списке'
                                "
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div
                      v-if="filteredDocuments.length"
                      class="d-block d-sm-none"
                    >
                      <div
                        v-for="d in pagedDocuments"
                        :key="d.id"
                        class="card mb-2"
                        :class="{ 'table-row-click': d.file }"
                        v-bind="d.file ? cardInteractionBindings(d) : {}"
                      >
                        <div class="card-body">
                          <h3 class="h6 mb-1">{{ d.name }}</h3>
                          <p class="mb-1 small">№ {{ d.number }}</p>
                          <p class="mb-1 small">
                            Дата: {{ formatDate(d.documentDate) }}
                          </p>
                          <p class="mb-1 small">
                            Подпись: {{ d.signType?.name || '—' }}
                          </p>
                          <div class="mt-2">
                            <template
                              v-if="
                                d.signType?.alias === 'SIMPLE_ELECTRONIC' &&
                                d.status?.alias === 'AWAITING_SIGNATURE' &&
                                current?.alias === 'SIMPLE_ELECTRONIC'
                              "
                            >
                              <button
                                class="btn btn-sm btn-brand"
                                :disabled="
                                  current?.alias !== 'SIMPLE_ELECTRONIC'
                                "
                                :title="
                                  current?.alias !== 'SIMPLE_ELECTRONIC'
                                    ? 'Выберите простую электронную подпись вверху, чтобы подписывать документы онлайн'
                                    : 'Подписать документ'
                                "
                                @click.stop="openSignDialog(d)"
                              >
                                Подписать
                              </button>
                            </template>
                            <template v-else>
                              <p
                                class="mb-1 small d-flex align-items-center gap-2"
                              >
                                <span>Статус:</span>
                                <span
                                  v-if="d.status?.alias"
                                  class="badge"
                                  :class="statusBadge(d.status.alias)"
                                >
                                  {{ d.status?.name }}
                                </span>
                                <span v-else class="text-muted">—</span>
                              </p>
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="d-block d-sm-none">
                      <EmptyState
                        icon="bi-file-earmark"
                        title="Документы отсутствуют"
                        :description="
                          search
                            ? 'Не найдено по заданным критериям'
                            : 'После оформления появятся в этом списке'
                        "
                      />
                    </div>
                  </div>
                </div>
                <PageNav
                  v-if="filteredDocuments.length"
                  v-model:page="currentPage"
                  v-model:page-size="pageSize"
                  :total-pages="totalPages"
                />
              </div>
            </div>
            <DocumentSignModal
              ref="signModal"
              :user-email="userEmail"
              @signed="onSigned"
            />
          </div>
          <div v-else>
            <p class="mb-3">Выберите способ подписания первичных документов</p>
            <div class="row row-cols-1 row-cols-md-2 gx-3 gy-4">
              <div v-for="t in signTypes" :key="t.alias" class="col">
                <div class="card section-card tile fade-in h-100">
                  <div class="card-body d-flex flex-column">
                    <h2 class="h6 mb-3">{{ t.name }}</h2>
                    <ul class="list-unstyled flex-grow-1 mb-3">
                      <li
                        v-for="(item, i) in signInfo[t.alias]"
                        :key="i"
                        class="d-flex"
                        :class="
                          i !== signInfo[t.alias].length - 1 ? 'mb-2' : ''
                        "
                      >
                        <i
                          class="bi bi-check-circle text-brand me-2"
                          aria-hidden="true"
                        ></i>
                        <span v-if="typeof item === 'string'">{{ item }}</span>
                        <span v-else>
                          {{ item.before }}
                          <a :href="item.url" target="_blank" rel="noopener">{{
                            item.linkText
                          }}</a
                          >{{ item.after }}
                        </span>
                      </li>
                    </ul>
                    <div class="text-end mt-auto">
                      <button
                        type="button"
                        class="btn btn-brand"
                        :disabled="loadingAlias || confirming"
                        :aria-label="`Выбрать способ: ${t.name}`"
                        @click="choose(t.alias)"
                      >
                        <span
                          v-if="loadingAlias === t.alias"
                          class="spinner-border spinner-border-sm me-2"
                          aria-hidden="true"
                        ></span>
                        Выбрать
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selected" class="card section-card tile fade-in mt-2">
              <div class="card-body">
                <h2 class="h6 mb-3">
                  Подтвердите выбор: {{ selectedType?.name }}
                </h2>
                <p class="mb-1">
                  Мы отправили код на вашу почту
                  <strong v-if="userEmail">{{ maskEmail(userEmail) }}</strong>
                </p>
                <p class="mb-3 text-muted small">
                  Если письмо не пришло, проверьте папку «Спам» или отправьте
                  код повторно.
                </p>
                <div class="mb-3">
                  <label for="code" class="form-label">Код из письма</label>
                  <input
                    id="code"
                    v-model="code"
                    class="form-control"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    autocomplete="one-time-code"
                    maxlength="6"
                    aria-describedby="codeHelp"
                    @keyup.enter="
                      code.length === 6 && !confirming ? submit() : null
                    "
                  />
                  <div id="codeHelp" class="form-text">
                    Введите 6-значный код подтверждения
                  </div>
                </div>
                <div aria-live="polite">
                  <div
                    v-if="verifyError"
                    class="alert alert-danger py-2 mb-2"
                    role="alert"
                  >
                    {{ verifyError }}
                  </div>
                  <div
                    v-if="success"
                    class="alert alert-success py-2 mb-2"
                    role="status"
                  >
                    Подпись сохранена
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="code.length !== 6 || confirming"
                  @click="submit"
                >
                  <span
                    v-if="confirming"
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  ></span>
                  Подтвердить
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary ms-2"
                  :disabled="resendCooldown > 0 || confirming"
                  @click="resendCode"
                >
                  <span v-if="resendCooldown > 0"
                    >Отправить код повторно ({{ resendCooldown }} с)</span
                  >
                  <span v-else>Отправить код повторно</span>
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary ms-2"
                  @click="cancelSelection"
                >
                  Выбрать другой способ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <DocumentFiltersModal
      ref="filtersModal"
      :filters="filters"
      :sign-types="filterSignTypes"
      :statuses="filterStatuses"
      :doc-types="filterDocTypes"
      @apply="applyFilters"
    />
  </div>
</template>

<style scoped>
/* Slightly increase signature type pill font for better hierarchy */
.badge-sign-type {
  font-size: 0.95rem;
}
.table-row-click {
  cursor: pointer;
}
/* Keep the signature tile visually compact on wide screens */
.signature-card {
  width: 100%;
  max-width: 520px;
}
@media (min-width: 992px) {
  .signature-card {
    max-width: 500px;
  }
}
@media (min-width: 1200px) {
  .signature-card {
    max-width: 480px;
  }
}
/* On mobile, let the signature block span full width for clean stacking */
@media (max-width: 767.98px) {
  .signature-card {
    max-width: none;
  }
}
</style>
