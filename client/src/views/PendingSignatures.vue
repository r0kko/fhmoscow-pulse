<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import { API_BASE, apiFetch } from '../api';
import { auth, fetchCurrentUser } from '../auth';
import BrandSpinner from '../components/BrandSpinner.vue';
import EmptyState from '../components/EmptyState.vue';
import { useToast } from '../utils/toast';

interface PendingDocument {
  id: string;
  number?: string;
  name?: string;
  description?: string | null;
  documentDate?: string;
  documentType?: {
    name?: string;
    alias?: string;
  } | null;
  status?: {
    name?: string;
    alias?: string;
  } | null;
  file?: {
    id?: string;
    url?: string;
  } | null;
}

interface PendingDocumentsResponse {
  documents?: PendingDocument[];
}

interface SignAllResponse {
  signed_count?: number;
  failed?: Array<{ document_id?: string; code?: string }>;
  remaining_count?: number;
}

const router = useRouter();
const { showToast } = useToast();
const documents = ref<PendingDocument[]>([]);
const selectedId = ref('');
const loading = ref(true);
const error = ref('');
const code = ref('');
const codeRequested = ref(false);
const signing = ref(false);
const sendingCode = ref(false);
const actionIds = ref<string[]>([]);
const resendCooldown = ref(0);
const codeInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref('');
const previewLoading = ref(false);
const previewError = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

const selectedDocument = computed(() => {
  return documents.value.find((doc) => doc.id === selectedId.value) || null;
});
const selectedIds = computed(() =>
  selectedDocument.value ? [selectedDocument.value.id] : []
);
const allIds = computed(() => documents.value.map((doc) => doc.id));
const actionLabel = computed(() => {
  if (!actionIds.value.length) return '';
  return actionIds.value.length === documents.value.length
    ? 'все документы'
    : 'выбранный документ';
});
const canConfirm = computed(
  () => code.value.length === 6 && actionIds.value.length > 0 && !signing.value
);
const userEmail = computed(() =>
  typeof auth.user?.email === 'string' ? auth.user.email : ''
);

function formatDate(value?: string) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function maskEmail(email: string) {
  if (!email) return '';
  const [name = '', domain] = email.split('@');
  if (!domain) return email;
  const safeName =
    name.length <= 2
      ? `${name[0] || '*'}*`
      : `${name[0]}${'*'.repeat(Math.max(1, name.length - 2))}${name.at(-1)}`;
  const [domainName = '', ...suffix] = domain.split('.');
  const safeDomain =
    domainName.length <= 2
      ? `${domainName[0] || '*'}*`
      : `${domainName[0]}${'*'.repeat(
          Math.max(1, domainName.length - 2)
        )}${domainName.at(-1)}`;
  return `${safeName}@${[safeDomain, ...suffix].filter(Boolean).join('.')}`;
}

function startCooldown(seconds = 30) {
  if (timer) clearInterval(timer);
  resendCooldown.value = seconds;
  timer = setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0) {
      if (timer) clearInterval(timer);
      timer = null;
      resendCooldown.value = 0;
    }
  }, 1000);
}

async function loadDocuments() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiFetch<PendingDocumentsResponse>(
      '/documents/pending-signatures'
    );
    documents.value = data.documents || [];
    if (!documents.value.some((doc) => doc.id === selectedId.value)) {
      selectedId.value = documents.value[0]?.id || '';
    }
    auth.pendingSimpleSignatureCount = documents.value.length;
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Не удалось загрузить документы';
  } finally {
    loading.value = false;
  }
}

async function requestCode(ids: string[]) {
  if (sendingCode.value || signing.value || resendCooldown.value > 0) return;
  actionIds.value = ids;
  sendingCode.value = true;
  error.value = '';
  try {
    await apiFetch('/documents/pending-signatures/send-code', {
      method: 'POST',
    });
    codeRequested.value = true;
    code.value = '';
    startCooldown();
    showToast('Код отправлен на e-mail', 'secondary');
    await nextTick();
    codeInput.value?.focus();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Не удалось отправить код';
  } finally {
    sendingCode.value = false;
  }
}

function beginSigning(ids: string[]) {
  if (!ids.length) return;
  if (codeRequested.value && resendCooldown.value > 0) {
    actionIds.value = ids;
    nextTick(() => codeInput.value?.focus());
    return;
  }
  void requestCode(ids);
}

async function confirmSigning() {
  if (!canConfirm.value) return;
  signing.value = true;
  error.value = '';
  try {
    const result = await apiFetch<SignAllResponse>(
      '/documents/pending-signatures/sign-all',
      {
        method: 'POST',
        body: JSON.stringify({
          code: code.value,
          documentIds: actionIds.value,
        }),
      }
    );
    const signedCount = Number(result.signed_count || 0);
    const failedCount = Array.isArray(result.failed) ? result.failed.length : 0;
    auth.pendingSimpleSignatureCount = Number(result.remaining_count || 0);
    if (signedCount > 0) {
      showToast(
        signedCount === 1 ? 'Документ подписан' : `Подписано: ${signedCount}`,
        'success'
      );
    }
    if (failedCount > 0) {
      showToast(`Не подписано: ${failedCount}`, 'warning');
    }
    code.value = '';
    codeRequested.value = false;
    actionIds.value = [];
    await loadDocuments();
    await fetchCurrentUser().catch(() => {});
    if (!documents.value.length) {
      await router.replace('/');
    }
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Не удалось подписать документы';
  } finally {
    signing.value = false;
  }
}

function openDocument(doc: PendingDocument | null) {
  const url = previewUrl.value || doc?.file?.url;
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

function releasePreviewUrl() {
  if (!previewUrl.value) return;
  URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}

async function loadPreview(doc: PendingDocument | null) {
  releasePreviewUrl();
  previewError.value = '';
  if (!doc?.id) return;
  previewLoading.value = true;
  try {
    const headers: Record<string, string> = {};
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    const response = await fetch(
      `${API_BASE}/documents/pending-signatures/${encodeURIComponent(
        doc.id
      )}/preview`,
      {
        method: 'GET',
        headers,
        credentials: 'include',
      }
    );
    if (!response.ok) {
      throw new Error('preview_failed');
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error('preview_empty');
    }
    previewUrl.value = URL.createObjectURL(
      blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' })
    );
  } catch {
    previewError.value =
      'Не удалось подготовить встроенный просмотр. Откройте документ в новой вкладке.';
  } finally {
    previewLoading.value = false;
  }
}

watch(code, (value) => {
  const digits = String(value || '')
    .replace(/\D+/g, '')
    .slice(0, 6);
  if (digits !== value) code.value = digits;
});

watch(selectedDocument, (doc) => {
  void loadPreview(doc);
});

onMounted(loadDocuments);

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  releasePreviewUrl();
});
</script>

<template>
  <div class="pending-signatures-page py-4">
    <div class="container">
      <div class="d-flex align-items-start gap-3 mb-3">
        <div
          class="pending-signatures-page__icon d-inline-flex align-items-center justify-content-center"
          aria-hidden="true"
        >
          <i class="bi bi-pen"></i>
        </div>
        <div>
          <h1 class="h3 mb-1">Подпишите документы</h1>
          <p class="mb-0 text-muted">
            После подписания доступ к рабочим разделам откроется автоматически.
          </p>
        </div>
      </div>

      <BrandSpinner v-if="loading" label="Загрузка документов" />

      <div v-else-if="error && !documents.length" class="alert alert-danger">
        {{ error }}
      </div>

      <EmptyState
        v-else-if="!documents.length"
        icon="bi-check-circle"
        title="Документы подписаны"
        description="Ожидающих документов с простой электронной подписью нет."
      />

      <div v-else class="row g-3 align-items-start">
        <div class="col-12 col-lg-5">
          <div class="card section-card">
            <div class="card-body">
              <div
                class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-3"
              >
                <div>
                  <h2 class="h5 mb-1">Ожидают подписи</h2>
                  <p class="text-muted mb-0 small">
                    {{ documents.length }} документ(ов)
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="sendingCode || signing || !allIds.length"
                  @click="beginSigning(allIds)"
                >
                  <span
                    v-if="sendingCode && actionIds.length === allIds.length"
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  ></span>
                  Подписать все
                </button>
              </div>

              <div v-if="error" class="alert alert-danger py-2" role="alert">
                {{ error }}
              </div>

              <div class="list-group pending-signatures-page__list">
                <button
                  v-for="doc in documents"
                  :key="doc.id"
                  type="button"
                  class="list-group-item list-group-item-action text-start pending-signatures-page__doc-item"
                  :class="{
                    'pending-signatures-page__doc-item--active':
                      selectedId === doc.id,
                  }"
                  @click="selectedId = doc.id"
                >
                  <span class="pending-signatures-page__doc-copy">
                    <span class="pending-signatures-page__doc-title">
                      {{ doc.name || doc.documentType?.name || 'Документ' }}
                    </span>
                    <span class="pending-signatures-page__doc-meta">
                      № {{ doc.number || 'без номера' }} ·
                      {{ formatDate(doc.documentDate) }}
                    </span>
                  </span>
                </button>
              </div>

              <div
                v-if="codeRequested"
                class="pending-signatures-page__code mt-3 p-3"
              >
                <label for="pendingSignCode" class="form-label fw-semibold">
                  Код из письма
                </label>
                <input
                  id="pendingSignCode"
                  ref="codeInput"
                  v-model="code"
                  class="form-control"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  autocomplete="one-time-code"
                  maxlength="6"
                  aria-describedby="pendingSignCodeHelp"
                  @keyup.enter="confirmSigning"
                />
                <div id="pendingSignCodeHelp" class="form-text">
                  <span v-if="userEmail">
                    Код отправлен на {{ maskEmail(userEmail) }}.
                  </span>
                  Подтвердите подписание: {{ actionLabel }}.
                </div>
                <div class="d-flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    class="btn btn-brand"
                    :disabled="!canConfirm"
                    @click="confirmSigning"
                  >
                    <span
                      v-if="signing"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="resendCooldown > 0 || sendingCode || signing"
                    @click="requestCode(actionIds)"
                  >
                    <span v-if="resendCooldown > 0">
                      Отправить код ({{ resendCooldown }} с)
                    </span>
                    <span v-else>Отправить код повторно</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <div class="card section-card">
            <div class="card-body">
              <div
                class="d-flex flex-column flex-sm-row justify-content-between gap-2 mb-3"
              >
                <div>
                  <h2 class="h5 mb-1">
                    {{
                      selectedDocument?.name ||
                      selectedDocument?.documentType?.name ||
                      'Документ'
                    }}
                  </h2>
                  <p class="mb-0 text-muted small">
                    № {{ selectedDocument?.number || 'без номера' }}
                  </p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!previewUrl && !selectedDocument?.file?.url"
                    @click="openDocument(selectedDocument)"
                  >
                    <i
                      class="bi bi-box-arrow-up-right me-1"
                      aria-hidden="true"
                    ></i>
                    Открыть
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-brand"
                    :disabled="sendingCode || signing || !selectedIds.length"
                    @click="beginSigning(selectedIds)"
                  >
                    Подписать выбранный
                  </button>
                </div>
              </div>

              <div
                v-if="previewLoading || previewUrl"
                class="pending-signatures-page__preview"
              >
                <BrandSpinner v-if="previewLoading" label="Загрузка превью" />
                <iframe
                  v-else
                  :src="previewUrl"
                  title="Просмотр документа"
                ></iframe>
              </div>
              <EmptyState
                v-else
                icon="bi-file-earmark"
                title="Превью недоступно"
                :description="
                  previewError ||
                  'Документ можно открыть в новой вкладке, если файл доступен.'
                "
              >
                <button
                  v-if="selectedDocument?.file?.url"
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="openDocument(selectedDocument)"
                >
                  Открыть документ
                </button>
              </EmptyState>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-signatures-page__icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-tile);
  background: #eef6ff;
  color: var(--brand-color);
  font-size: 1.35rem;
  flex: 0 0 auto;
}

.pending-signatures-page__list {
  display: grid;
  gap: 0.5rem;
  max-height: 28rem;
  overflow: auto;
}

.pending-signatures-page__doc-item {
  margin-bottom: 0;
  padding: 0.85rem 0.95rem;
  border: 1px solid transparent;
  border-radius: var(--radius-tile);
}

.pending-signatures-page__doc-item:hover,
.pending-signatures-page__doc-item:focus {
  border-color: rgba(17, 56, 103, 0.18);
}

.pending-signatures-page__doc-item--active,
.pending-signatures-page__doc-item--active:hover,
.pending-signatures-page__doc-item--active:focus {
  background-color: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}

.pending-signatures-page__doc-copy {
  display: block;
  min-width: 0;
}

.pending-signatures-page__doc-title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.pending-signatures-page__doc-meta {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.875rem;
  line-height: 1.25;
  opacity: 0.82;
}

.pending-signatures-page__code {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-tile);
  background: #f8fafc;
}

.pending-signatures-page__preview {
  width: 100%;
  min-height: 68vh;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-tile);
  overflow: hidden;
  background: #f8fafc;
}

.pending-signatures-page__preview iframe {
  display: block;
  width: 100%;
  height: 68vh;
  border: 0;
}

@media (max-width: 991.98px) {
  .pending-signatures-page__preview,
  .pending-signatures-page__preview iframe {
    min-height: 32rem;
    height: 32rem;
  }
}

@media (max-width: 575.98px) {
  .pending-signatures-page__doc-item {
    padding: 0.8rem;
  }

  .pending-signatures-page__doc-title {
    font-size: 0.95rem;
    line-height: 1.28;
    -webkit-line-clamp: 3;
  }

  .pending-signatures-page__doc-meta {
    font-size: 0.82rem;
  }
}
</style>
