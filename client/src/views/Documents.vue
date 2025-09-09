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
import TabSelector from '../components/TabSelector.vue';
import DocumentSignModal from '../components/DocumentSignModal.vue';
import { useToast } from '../utils/toast.js';

const loading = ref(true);
const error = ref('');
const current = ref(null);
const signTypes = ref([]);
const documents = ref([]);
const activeTab = ref(localStorage.getItem('documentsTab') || 'all');
const search = ref(localStorage.getItem('documentsSearch') || '');
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

// Tabs and filtering
const tabs = computed(() => {
  const created = documents.value.filter(
    (d) => d.status?.alias === 'CREATED'
  ).length;
  const awaiting = documents.value.filter(
    (d) => d.status?.alias === 'AWAITING_SIGNATURE'
  ).length;
  const signed = documents.value.filter(
    (d) => d.status?.alias === 'SIGNED'
  ).length;
  return [
    { key: 'all', label: 'Все' },
    { key: 'created', label: 'Требуют подписи', badge: created },
    { key: 'awaiting', label: 'На подписи', badge: awaiting },
    { key: 'signed', label: 'Подписано', badge: signed },
  ];
});

const filteredDocuments = computed(() => {
  let list = documents.value;
  switch (activeTab.value) {
    case 'created':
      list = list.filter((d) => d.status?.alias === 'CREATED');
      break;
    case 'awaiting':
      list = list.filter((d) => d.status?.alias === 'AWAITING_SIGNATURE');
      break;
    case 'signed':
      list = list.filter((d) => d.status?.alias === 'SIGNED');
      break;
    default:
      break;
  }
  if (search.value) {
    const q = search.value.trim().toLowerCase();
    list = list.filter((d) => {
      const name = String(d.name || '').toLowerCase();
      const number = String(d.number || '').toLowerCase();
      return name.includes(q) || number.includes(q);
    });
  }
  return list;
});

watch(activeTab, (v) => localStorage.setItem('documentsTab', v));
watch(search, (v) => localStorage.setItem('documentsSearch', v));
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
            <div class="row">
              <div class="col-md-8 col-lg-6">
                <div class="card section-card tile fade-in mb-3">
                  <div class="card-body">
                    <h2 class="h6 mb-3">Ваш способ подписания</h2>
                    <template v-if="current.alias === 'HANDWRITTEN'">
                      <p class="mb-2">
                        <span
                          class="badge rounded-pill text-bg-light fw-semibold badge-sign-type"
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
                          class="badge rounded-pill text-bg-light fw-semibold badge-sign-type"
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
                          @click="
                            copyToClipboard(current.inn, 'ИНН скопирован')
                          "
                          aria-label="Скопировать ИНН"
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
                          class="badge rounded-pill text-bg-light fw-semibold badge-sign-type"
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
                      <p class="mb-1 d-flex align-items-center flex-wrap gap-2">
                        <span class="fw-semibold">ID:</span>
                        <span class="ms-1">{{ current.id }}</span>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary"
                          @click="copyToClipboard(current.id, 'ID скопирован')"
                          aria-label="Скопировать ID"
                        >
                          <i class="bi bi-clipboard" aria-hidden="true"></i>
                        </button>
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
            <div class="row g-3 mt-2">
              <div class="col-12">
                <div class="card section-card tile fade-in">
                  <div class="card-body">
                    <div
                      class="d-flex flex-column flex-sm-row gap-2 align-items-stretch align-items-sm-center mb-3"
                    >
                      <h2 class="h6 mb-0 flex-grow-1">Ваши документы</h2>
                      <div
                        class="ms-sm-auto w-100 w-sm-auto"
                        style="min-width: 240px"
                      >
                        <label for="docSearch" class="visually-hidden"
                          >Поиск</label
                        >
                        <input
                          id="docSearch"
                          v-model="search"
                          type="search"
                          class="form-control form-control-sm"
                          placeholder="Поиск по названию или номеру"
                          autocomplete="off"
                        />
                      </div>
                    </div>
                    <TabSelector
                      v-model="activeTab"
                      :tabs="tabs"
                      aria-label="Фильтрация документов"
                    />
                    <div class="table-responsive d-none d-sm-block">
                      <table class="table align-middle mb-0">
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
                            <th scope="col" class="text-end">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="d in filteredDocuments" :key="d.id">
                            <td>{{ d.number }}</td>
                            <td>{{ d.name }}</td>
                            <td>{{ formatDate(d.documentDate) }}</td>
                            <td>{{ d.signType?.name || '-' }}</td>
                            <td>
                              <span
                                v-if="d.status?.alias"
                                class="badge"
                                :class="statusBadge(d.status.alias)"
                              >
                                {{ d.status?.name }}
                              </span>
                              <span v-else class="text-muted">—</span>
                            </td>
                            <td class="text-end">
                              <button
                                v-if="
                                  d.signType?.alias === 'SIMPLE_ELECTRONIC' &&
                                  d.status?.alias === 'AWAITING_SIGNATURE'
                                "
                                class="btn btn-sm btn-primary me-2"
                                :disabled="
                                  signing === d.id ||
                                  current?.alias !== 'SIMPLE_ELECTRONIC'
                                "
                                @click="openSignDialog(d)"
                                :title="
                                  current?.alias !== 'SIMPLE_ELECTRONIC'
                                    ? 'Выберите простую электронную подпись вверху, чтобы подписывать документы онлайн'
                                    : 'Подписать документ'
                                "
                              >
                                <span
                                  v-if="signing === d.id"
                                  class="spinner-border spinner-border-sm me-1"
                                  aria-hidden="true"
                                ></span>
                                Подписать
                              </button>
                              <a
                                v-if="d.file"
                                class="btn btn-sm btn-outline-secondary"
                                :href="d.file.url"
                                target="_blank"
                                rel="noopener"
                                title="Скачать"
                                :aria-label="`Скачать документ ${d.name}`"
                                :download="downloadName(d)"
                              >
                                <i
                                  class="bi bi-download"
                                  aria-hidden="true"
                                ></i>
                              </a>
                              <div
                                v-if="signCodeDocId === d.id"
                                class="mt-2 text-start"
                              >
                                <div class="border rounded p-2 bg-light">
                                  <div class="row g-2 align-items-end">
                                    <div class="col-12 col-sm-auto">
                                      <label
                                        for="signCodeInput"
                                        class="form-label mb-1"
                                        >Код из письма</label
                                      >
                                      <input
                                        id="signCodeInput"
                                        v-model="signCode"
                                        class="form-control form-control-sm"
                                        type="text"
                                        inputmode="numeric"
                                        pattern="[0-9]*"
                                        autocomplete="one-time-code"
                                        maxlength="6"
                                        @keyup.enter="
                                          signCode.length === 6 &&
                                          !signConfirming
                                            ? confirmSign()
                                            : null
                                        "
                                      />
                                    </div>
                                    <div class="col-12 col-sm-auto">
                                      <button
                                        class="btn btn-sm btn-brand w-100"
                                        :disabled="
                                          signCode.length !== 6 ||
                                          signConfirming
                                        "
                                        @click="confirmSign"
                                      >
                                        <span
                                          v-if="signConfirming"
                                          class="spinner-border spinner-border-sm me-1"
                                          aria-hidden="true"
                                        ></span>
                                        Подтвердить
                                      </button>
                                    </div>
                                    <div class="col-12 col-sm-auto">
                                      <button
                                        class="btn btn-sm btn-outline-secondary w-100"
                                        :disabled="
                                          signResendCooldown > 0 ||
                                          signConfirming
                                        "
                                        @click="requestSignCode(d)"
                                      >
                                        <span v-if="signResendCooldown > 0"
                                          >Отправить код ({{
                                            signResendCooldown
                                          }}
                                          с)</span
                                        >
                                        <span v-else>Отправить код</span>
                                      </button>
                                    </div>
                                    <div class="col-12 col-sm-auto">
                                      <button
                                        class="btn btn-sm btn-outline-secondary w-100"
                                        @click="signCodeDocId = ''"
                                      >
                                        Отмена
                                      </button>
                                    </div>
                                    <div class="col-12" v-if="signError">
                                      <div class="alert alert-danger py-2 mb-0">
                                        {{ signError }}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                          <tr v-if="!filteredDocuments.length">
                            <td colspan="6" class="p-0">
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
                        v-for="d in filteredDocuments"
                        :key="d.id"
                        class="card mb-2"
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
                          <p class="mb-1 small d-flex align-items-center gap-2">
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
                          <div class="d-flex flex-wrap gap-2 mt-2">
                            <button
                              v-if="
                                d.signType?.alias === 'SIMPLE_ELECTRONIC' &&
                                d.status?.alias === 'AWAITING_SIGNATURE'
                              "
                              class="btn btn-sm btn-primary"
                              :disabled="
                                signing === d.id ||
                                current?.alias !== 'SIMPLE_ELECTRONIC'
                              "
                              @click="openSignDialog(d)"
                              :title="
                                current?.alias !== 'SIMPLE_ELECTRONIC'
                                  ? 'Выберите простую электронную подпись вверху, чтобы подписывать документы онлайн'
                                  : 'Подписать документ'
                              "
                            >
                              <span
                                v-if="signing === d.id"
                                class="spinner-border spinner-border-sm me-1"
                                aria-hidden="true"
                              ></span>
                              Подписать
                            </button>
                            <a
                              v-if="d.file"
                              :href="d.file.url"
                              class="btn btn-sm btn-outline-secondary"
                              target="_blank"
                              rel="noopener"
                              title="Скачать"
                              :aria-label="`Скачать документ ${d.name}`"
                              :download="downloadName(d)"
                            >
                              <i class="bi bi-download" aria-hidden="true"></i>
                            </a>
                          </div>
                          <div v-if="signCodeDocId === d.id" class="mt-2">
                            <div class="border rounded p-2 bg-light">
                              <label
                                for="signCodeInputM"
                                class="form-label mb-1"
                                >Код из письма</label
                              >
                              <div class="d-flex gap-2">
                                <input
                                  id="signCodeInputM"
                                  v-model="signCode"
                                  class="form-control form-control-sm"
                                  type="text"
                                  inputmode="numeric"
                                  pattern="[0-9]*"
                                  autocomplete="one-time-code"
                                  maxlength="6"
                                  @keyup.enter="
                                    signCode.length === 6 && !signConfirming
                                      ? confirmSign()
                                      : null
                                  "
                                />
                                <button
                                  class="btn btn-sm btn-brand"
                                  :disabled="
                                    signCode.length !== 6 || signConfirming
                                  "
                                  @click="confirmSign"
                                >
                                  <span
                                    v-if="signConfirming"
                                    class="spinner-border spinner-border-sm me-1"
                                    aria-hidden="true"
                                  ></span>
                                  ОК
                                </button>
                                <button
                                  class="btn btn-sm btn-outline-secondary"
                                  :disabled="
                                    signResendCooldown > 0 || signConfirming
                                  "
                                  @click="requestSignCode(d)"
                                >
                                  <span v-if="signResendCooldown > 0"
                                    >Код ({{ signResendCooldown }} с)</span
                                  >
                                  <span v-else>Код</span>
                                </button>
                                <button
                                  class="btn btn-sm btn-outline-secondary"
                                  @click="signCodeDocId = ''"
                                >
                                  Отмена
                                </button>
                              </div>
                              <div
                                v-if="signError"
                                class="alert alert-danger py-2 mb-0 mt-2"
                              >
                                {{ signError }}
                              </div>
                            </div>
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
              </div>
            </div>
            <DocumentSignModal ref="signModal" @signed="onSigned" />
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
                        @click="choose(t.alias)"
                        :aria-label="`Выбрать способ: ${t.name}`"
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
                    @keyup.enter="
                      code.length === 6 && !confirming ? submit() : null
                    "
                    aria-describedby="codeHelp"
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
</style>
