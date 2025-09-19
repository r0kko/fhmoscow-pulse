<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import Breadcrumbs from '../components/Breadcrumbs.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import Pagination from '../components/Pagination.vue';
import { apiFetch } from '../api.js';

const requests = ref([]);
const total = ref(0);
const perPage = ref(20);
const currentPage = ref(1);
const resolvedPage = ref(1);
const loading = ref(false);
const pageLoading = ref(false);
const error = ref('');
const actionError = ref('');
const actionLoading = ref(false);
const pendingActionId = ref(null);

const statusFilter = ref('pending');
const search = ref('');
let searchTimer = null;

const rejectReason = ref('');
const selectedRequest = ref(null);
const rejectModal = ref(null);

const statusOptions = [
  { value: 'pending', label: 'На модерации' },
  { value: 'approved', label: 'Подтверждённые' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'all', label: 'Все' },
];

const statusMeta = {
  pending: { label: 'На модерации', variant: 'warning' },
  approved: { label: 'Подтверждено', variant: 'success' },
  rejected: { label: 'Отклонено', variant: 'danger' },
};

const totalPages = computed(() => {
  if (!perPage.value) return 1;
  return Math.max(1, Math.ceil(total.value / perPage.value));
});
const isEmpty = computed(
  () => !loading.value && !pageLoading.value && requests.value.length === 0
);
const paginationDisabled = computed(
  () => loading.value || pageLoading.value || actionLoading.value
);

let skipPageWatch = false;
let pendingRequestFetch = null;

async function fetchRequests({ page = currentPage.value, reset = false } = {}) {
  if (loading.value || pageLoading.value) {
    pendingRequestFetch = { page, reset };
    return;
  }
  const usePageLoading = !reset && requests.value.length > 0 && page !== resolvedPage.value;
  if (usePageLoading) {
    pageLoading.value = true;
  } else {
    loading.value = true;
    if (reset) requests.value = [];
  }
  error.value = '';
  try {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(perPage.value));
    if (statusFilter.value) params.set('status', statusFilter.value);
    const query = search.value.trim();
    if (query) params.set('search', query);
    const res = await apiFetch(`/player-photo-requests?${params.toString()}`);
    const list = Array.isArray(res.requests) ? res.requests : [];
    perPage.value = Number(res.per_page || perPage.value);
    total.value = Number(res.total || 0);
    const resolved = Number(res.page || page);
    resolvedPage.value = resolved;
    skipPageWatch = true;
    currentPage.value = resolved;
    skipPageWatch = false;
    requests.value = list;
  } catch (err) {
    error.value = err?.message || 'Не удалось загрузить заявки';
  } finally {
    if (pageLoading.value) {
      pageLoading.value = false;
    } else {
      loading.value = false;
    }
    if (pendingRequestFetch) {
      const args = pendingRequestFetch;
      pendingRequestFetch = null;
      void fetchRequests(args);
    }
  }
}

function ensureFirstPage() {
  if (currentPage.value !== 1) {
    skipPageWatch = true;
    currentPage.value = 1;
    skipPageWatch = false;
    return true;
  }
  return false;
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    ensureFirstPage();
    void fetchRequests({ page: 1, reset: true });
  }, 350);
}

function clearSearch() {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  search.value = '';
  ensureFirstPage();
  void fetchRequests({ page: 1, reset: true });
}

watch(statusFilter, () => {
  ensureFirstPage();
  void fetchRequests({ page: 1, reset: true });
});

watch(search, onSearchInput);

watch(currentPage, (pageValue, previous) => {
  if (skipPageWatch) return;
  if (pageValue === previous) return;
  if (loading.value || pageLoading.value) {
    skipPageWatch = true;
    currentPage.value = previous;
    skipPageWatch = false;
    return;
  }
  void fetchRequests({ page: pageValue });
});

onMounted(() => {
  void fetchRequests({ page: 1, reset: true });
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

function getPhotoUrls(request) {
  const urls = [];
  const append = (val) => {
    const trimmed = (val || '').trim();
    if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
  };
  const player = request?.player;
  if (Array.isArray(player?.photo?.urls)) {
    player.photo.urls.forEach(append);
  }
  if (Array.isArray(player?.photo_url_candidates)) {
    player.photo_url_candidates.forEach(append);
  }
  append(player?.photo?.url);
  append(player?.photo_url);
  return urls;
}

function currentPlayerPhotoUrl(request) {
  const urls = getPhotoUrls(request);
  return urls.length ? urls[0] : '';
}

function requestPhotoUrl(request) {
  return request?.file?.download_url || '';
}

function externalPlayerUpdateUrl(request) {
  const rawId = request?.player?.external_id;
  if (!rawId) return '';
  const extId = String(rawId).trim();
  if (!extId) return '';
  return `https://admin.fhmoscow.com/players/${encodeURIComponent(extId)}/update`;
}

function playerClubsSummary(request) {
  const clubs = (request?.player?.clubs || [])
    .map((club) => (club?.name || '').trim())
    .filter(Boolean);

  const teams = (request?.player?.teams || [])
    .map((team) => {
      const year = team?.birth_year;
      if (year !== undefined && year !== null) {
        const normalized = String(year).trim();
        if (normalized) return normalized;
      }
      const name = (team?.name || '').trim();
      return name || null;
    })
    .filter(Boolean);

  const parts = [...clubs, ...teams];
  return parts.length ? parts.join(' · ') : '—';
}

function statusBadge(request) {
  const alias = request?.status_alias;
  return statusMeta[alias] || null;
}

function statusMessage(request) {
  const alias = request?.status_alias;
  if (alias === 'approved') return 'Фото подтверждено. Перенесите в основную систему.';
  if (alias === 'rejected') {
    return request?.decision_reason
      ? `Отклонено: ${request.decision_reason}`
      : 'Фото отклонено.';
  }
  return '';
}

function hasPendingStatus(request) {
  return request?.status_alias === 'pending';
}

function isProcessing(request) {
  return actionLoading.value && pendingActionId.value === request?.id;
}

function updateRequestInList(updated) {
  requests.value = requests.value.map((item) =>
    item.id === updated.id ? updated : item
  );
}

function handleActionError(err) {
  actionError.value = err?.message || 'Не удалось выполнить действие';
}

async function approveRequest(request) {
  if (!hasPendingStatus(request)) return;
  actionError.value = '';
  actionLoading.value = true;
  pendingActionId.value = request.id;
  try {
    const res = await apiFetch(`/player-photo-requests/${request.id}/approve`, {
      method: 'POST',
    });
    if (res?.request) updateRequestInList(res.request);
  } catch (err) {
    handleActionError(err);
  } finally {
    actionLoading.value = false;
    pendingActionId.value = null;
  }
}

function openRejectModal(request) {
  if (!hasPendingStatus(request) || actionLoading.value) return;
  selectedRequest.value = request;
  rejectReason.value = '';
  actionError.value = '';
  rejectModal.value?.open();
}

function onRejectCancel() {
  selectedRequest.value = null;
  rejectReason.value = '';
}

async function submitReject() {
  if (!selectedRequest.value) return;
  actionError.value = '';
  actionLoading.value = true;
  pendingActionId.value = selectedRequest.value.id;
  try {
    const res = await apiFetch(
      `/player-photo-requests/${selectedRequest.value.id}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason.value.trim() || undefined,
        }),
      }
    );
    if (res?.request) updateRequestInList(res.request);
    selectedRequest.value = null;
    rejectReason.value = '';
  } catch (err) {
    handleActionError(err);
  } finally {
    actionLoading.value = false;
    pendingActionId.value = null;
  }
}
</script>

<template>
  <div class="py-3 admin-player-photo-requests">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Администрирование', to: '/admin' },
          { label: 'Фото игроков' },
        ]"
      />
      <h1 class="mb-3">Заявки на фотографии игроков</h1>

      <div class="card section-card shadow-sm mb-3">
        <div class="card-body">
          <form class="filters-bar" @submit.prevent>
            <div class="filters-group">
              <label
                for="adminPlayerPhotoSearch"
                class="form-label small text-muted mb-1"
                >Поиск по фамилии или имени</label
              >
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  id="adminPlayerPhotoSearch"
                  v-model="search"
                  type="search"
                  class="form-control"
                  placeholder="Например: Петров"
                  autocomplete="off"
                />
                <button
                  v-if="search"
                  type="button"
                  class="btn btn-outline-secondary"
                  aria-label="Очистить поиск"
                  @click="clearSearch"
                >
                  Очистить
                </button>
              </div>
            </div>
            <div class="filters-group">
              <label
                for="adminPlayerPhotoStatus"
                class="form-label small text-muted mb-1"
                >Статус</label
              >
              <select
                id="adminPlayerPhotoStatus"
                v-model="statusFilter"
                class="form-select"
              >
                <option
                  v-for="option in statusOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="filters-actions">
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="loading"
                @click="fetchRequests({ reset: true })"
              >
                Обновить
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="actionError" class="alert alert-danger" role="alert">
        {{ actionError }}
      </div>
      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div class="card section-card shadow-sm">
        <div class="card-body">
          <div v-if="loading && !requests.length" class="text-center py-4">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>

          <template v-else>
            <div
              v-if="pageLoading"
              class="text-center py-3"
              aria-live="polite"
            >
              <div class="spinner-border spinner-brand" role="status"></div>
            </div>
            <div v-if="isEmpty" class="alert alert-info mb-0">
              Нет заявок по выбранному фильтру.
            </div>
            <div v-else class="requests-roster-list">
              <article
                v-for="request in requests"
                :key="request.id"
                class="player-roster-item shadow-sm"
                role="article"
              >
                <div class="player-roster-photo has-photo">
                  <img
                    v-if="requestPhotoUrl(request)"
                    :src="requestPhotoUrl(request)"
                    :alt="`Загруженное фото игрока ${request.player?.full_name || ''}`"
                    loading="lazy"
                  />
                  <img
                    v-else-if="currentPlayerPhotoUrl(request)"
                    :src="currentPlayerPhotoUrl(request)"
                    :alt="`Текущее фото игрока ${request.player?.full_name || ''}`"
                    loading="lazy"
                  />
                  <div v-else class="photo-placeholder">
                    <i class="bi bi-person" aria-hidden="true"></i>
                    <span class="visually-hidden">Фотография отсутствует</span>
                  </div>
                </div>
                <div class="player-roster-body">
                  <div class="player-roster-header">
                    <span class="player-name-text">
                      {{ request.player?.full_name || 'Игрок' }}
                    </span>
                    <span
                      v-if="statusBadge(request)"
                      class="badge"
                      :class="`bg-${statusBadge(request).variant}`"
                    >
                      {{ statusBadge(request).label }}
                    </span>
                  </div>
                  <div class="player-roster-meta">
                    <p class="player-roster-meta-line player-roster-meta-date">
                      {{ request.player?.date_of_birth ? new Date(request.player.date_of_birth).toLocaleDateString('ru-RU') : '—' }}
                    </p>
                    <p class="player-roster-meta-line">
                      {{ playerClubsSummary(request) }}
                    </p>
                  </div>
                  <p
                    v-if="statusMessage(request)"
                    class="status-note small mb-1"
                    :class="{
                      'text-success': request.status_alias === 'approved',
                      'text-danger': request.status_alias === 'rejected',
                    }"
                  >
                    {{ statusMessage(request) }}
                  </p>
                  <div class="request-actions">
                    <a
                      v-if="request.file?.download_url"
                      :href="request.file.download_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-outline-secondary btn-sm btn-icon"
                      :aria-label="`Скачать фото игрока ${request.player?.full_name || ''}`"
                      title="Скачать фото"
                    >
                      <i class="bi bi-cloud-arrow-down" aria-hidden="true"></i>
                    </a>
                    <a
                      v-if="externalPlayerUpdateUrl(request)"
                      :href="externalPlayerUpdateUrl(request)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-outline-primary btn-sm"
                      title="Открыть карточку игрока во внешней системе"
                    >
                      <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>
                      <span>Открыть в ФХМ</span>
                    </a>
                    <button
                      v-if="hasPendingStatus(request)"
                      type="button"
                      class="btn btn-success btn-sm"
                      :disabled="isProcessing(request)"
                      @click="approveRequest(request)"
                    >
                      {{ isProcessing(request) ? 'Сохранение…' : 'Подтвердить' }}
                    </button>
                    <button
                      v-if="hasPendingStatus(request)"
                      type="button"
                      class="btn btn-outline-danger btn-sm"
                      :disabled="isProcessing(request)"
                      @click="openRejectModal(request)"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <div v-if="totalPages > 1" class="d-flex justify-content-center mt-3">
    <div
      :class="{ 'pagination-disabled': paginationDisabled }"
      :aria-disabled="paginationDisabled ? 'true' : 'false'"
    >
      <Pagination v-model="currentPage" :total-pages="totalPages" />
    </div>
  </div>

  <ConfirmModal
    ref="rejectModal"
    title="Отклонить заявку"
    confirm-text="Отклонить"
    confirm-variant="danger"
    @confirm="submitReject"
    @cancel="onRejectCancel"
  >
    <p class="mb-3">
      Укажите причину. Она будет показана сотруднику спортивной школы.
    </p>
    <textarea
      v-model="rejectReason"
      class="form-control"
      rows="3"
      placeholder="Например: необходимо фото на нейтральном фоне"
    ></textarea>
  </ConfirmModal>
</template>

<style scoped>
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.filters-group {
  flex: 1 1 280px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filters-actions {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.requests-roster-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.player-roster-item {
  display: flex;
  gap: 1rem;
  border-radius: 1rem;
  border: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
  padding: 1rem;
  background: var(--bs-body-bg, #ffffff);
}

.player-roster-photo {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 1rem;
  overflow: hidden;
  flex-shrink: 0;
}

.player-roster-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--bs-secondary-bg, #f1f3f5);
  color: var(--bs-secondary-color, #6c757d);
  font-size: 2rem;
}

.player-roster-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
  min-width: 0;
}

.player-roster-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.player-name-text {
  font-weight: 600;
  font-size: 1.05rem;
  color: inherit;
}

.player-roster-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
}

.player-roster-meta-line {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.35;
}

.player-roster-meta-date {
  color: var(--bs-secondary-color, #6c757d);
  font-size: 0.9rem;
}

.status-note {
  margin-bottom: 0.25rem;
}

.request-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pagination-disabled {
  pointer-events: none;
  opacity: 0.6;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0.25rem;
  line-height: 1;
  border-radius: 0.5rem;
}

.btn-icon .bi {
  font-size: 1rem;
}

@media (max-width: 575.98px) {
  .filters-group {
    flex: 1 1 100%;
  }

  .filters-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .player-roster-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .player-roster-photo {
    width: 100%;
    height: 200px;
  }
}
</style>
