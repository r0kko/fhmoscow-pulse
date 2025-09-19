<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import Breadcrumbs from '../components/Breadcrumbs.vue';
import Pagination from '../components/Pagination.vue';
import { apiFetch, apiUpload } from '../api.js';

const players = ref([]);
const total = ref(0);
const perPage = ref(40);
const currentPage = ref(1);
const resolvedPage = ref(1);
const loading = ref(false);
const pageLoading = ref(false);
const error = ref('');
const search = ref('');
const clubOptions = ref([]);
const teamYearOptions = ref([]);
const selectedClub = ref('');
const selectedTeamYear = ref('');
const photoFilter = ref('all');
const photoFilterOptions = [
  { value: 'all', label: 'Все игроки' },
  { value: 'with', label: 'Только с фото' },
  { value: 'without', label: 'Без фото' },
];
const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
];
const IMAGE_EXTENSION_RE = /\.(png|jpe?g)$/i;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 800;
const uploadStates = ref({});
const dropStates = ref({});
const successTimers = new Map();
const fileInputMap = new Map();
const totalPages = computed(() => {
  if (!perPage.value) return 1;
  return Math.max(1, Math.ceil(total.value / perPage.value));
});
const paginationDisabled = computed(() => loading.value || pageLoading.value);

const uploadRequirementsText = `PNG или JPEG, до 5 МБ, не менее ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} пикс.`;

let searchTimer = null;
let isBootstrapping = true;
const photoIndexByPlayer = ref({});
let isApplyingFilterOptions = false;
let skipPageWatch = false;
let pendingPlayerFetch = null;

function ensureUploadState(playerId) {
  if (!uploadStates.value[playerId]) {
    uploadStates.value = {
      ...uploadStates.value,
      [playerId]: {
        uploading: false,
        progress: 0,
        error: '',
        success: false,
      },
    };
  }
  return uploadStates.value[playerId];
}

function getUploadState(playerId) {
  return (
    uploadStates.value[playerId] || {
      uploading: false,
      progress: 0,
      error: '',
      success: false,
    }
  );
}

function updateUploadState(playerId, patch) {
  const base = ensureUploadState(playerId);
  const next = { ...base, ...patch };
  uploadStates.value = {
    ...uploadStates.value,
    [playerId]: next,
  };
  return next;
}

function clearUploadState(playerId) {
  if (uploadStates.value[playerId]) {
    uploadStates.value = {
      ...uploadStates.value,
      [playerId]: {
        uploading: false,
        progress: 0,
        error: '',
        success: false,
      },
    };
  }
}

function scheduleSuccessReset(playerId) {
  if (successTimers.has(playerId)) {
    clearTimeout(successTimers.get(playerId));
  }
  successTimers.set(
    playerId,
    setTimeout(() => {
      updateUploadState(playerId, { success: false, progress: 0 });
      successTimers.delete(playerId);
    }, 4000)
  );
}

function updateDropState(playerId, isActive) {
  dropStates.value = {
    ...dropStates.value,
    [playerId]: Boolean(isActive),
  };
}

function isDropActive(playerId) {
  return Boolean(dropStates.value[playerId]);
}

function registerFileInput(playerId, el) {
  if (el) {
    fileInputMap.set(playerId, el);
  } else {
    fileInputMap.delete(playerId);
  }
}

function resetUploadHelpers() {
  uploadStates.value = {};
  dropStates.value = {};
  for (const timer of successTimers.values()) {
    clearTimeout(timer);
  }
  successTimers.clear();
  fileInputMap.clear();
}

function statusAlias(player) {
  return player?.photo_request?.status_alias || null;
}

function isPendingRequest(player) {
  return statusAlias(player) === 'pending';
}

function isApprovedRequest(player) {
  return statusAlias(player) === 'approved';
}

function isRejectedRequest(player) {
  return statusAlias(player) === 'rejected';
}

function isUploadDisabled(player) {
  return isPendingRequest(player) || isApprovedRequest(player);
}

async function fetchPlayers({ page = currentPage.value, reset = false } = {}) {
  if (loading.value || pageLoading.value) {
    pendingPlayerFetch = { page, reset };
    return;
  }
  const needsPageLoading =
    !reset && players.value.length > 0 && page !== resolvedPage.value;
  if (needsPageLoading) {
    pageLoading.value = true;
  } else {
    loading.value = true;
    if (reset) {
      players.value = [];
      total.value = 0;
      photoIndexByPlayer.value = {};
      resetUploadHelpers();
    }
  }
  if (!reset && page !== resolvedPage.value) {
    photoIndexByPlayer.value = {};
    resetUploadHelpers();
  }
  error.value = '';

  try {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(perPage.value));
    params.set('mine', 'true');
    const query = search.value.trim();
    if (query) params.set('search', query);
    if (selectedClub.value) params.set('club_id', selectedClub.value);
    if (selectedTeamYear.value)
      params.set('team_birth_year', selectedTeamYear.value);
    if (photoFilter.value === 'with') {
      params.set('photo_filter', 'with');
    } else if (photoFilter.value === 'without') {
      params.set('photo_filter', 'without');
    }
    params.set('require_contract', 'true');

    const res = await apiFetch(`/players/gallery?${params.toString()}`);
    const list = Array.isArray(res.players) ? res.players : [];
    perPage.value = Number(res.per_page || perPage.value);
    total.value = Number(res.total || 0);
    const resolved = Number(res.page || page);
    resolvedPage.value = resolved;
    skipPageWatch = true;
    currentPage.value = resolved;
    skipPageWatch = false;
    players.value = list;

    const updatedIndex = {};
    for (const player of list) {
      ensureUploadState(player.id);
      const urls = getPhotoUrls(player);
      updatedIndex[player.id] = urls.length ? 0 : -1;
    }
    photoIndexByPlayer.value = updatedIndex;
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить фотографии игроков';
  } finally {
    if (needsPageLoading) {
      pageLoading.value = false;
    } else {
      loading.value = false;
    }
    if (pendingPlayerFetch) {
      const nextParams = pendingPlayerFetch;
      pendingPlayerFetch = null;
      void fetchPlayers(nextParams);
    }
  }
}

async function loadFilterOptions({ clubId = '', refreshClubs = false } = {}) {
  try {
    const params = new URLSearchParams();
    params.set('mine', 'true');
    if (clubId) params.set('club_id', clubId);

    const res = await apiFetch(`/players/gallery/filters?${params.toString()}`);

    if (refreshClubs && Array.isArray(res.clubs)) {
      const normalizedClubs = res.clubs.map((club) => ({
        id: String(club.id),
        name: club.name || 'Клуб',
      }));
      clubOptions.value = normalizedClubs;
      if (
        selectedClub.value &&
        !normalizedClubs.some((club) => club.id === String(selectedClub.value))
      ) {
        isApplyingFilterOptions = true;
        selectedClub.value = '';
        isApplyingFilterOptions = false;
      }
    }

    if (Array.isArray(res.team_birth_years)) {
      const normalizedYears = res.team_birth_years
        .map((year) => String(year))
        .filter(Boolean);
      teamYearOptions.value = normalizedYears;
      if (
        selectedTeamYear.value &&
        !normalizedYears.includes(String(selectedTeamYear.value))
      ) {
        isApplyingFilterOptions = true;
        selectedTeamYear.value = '';
        isApplyingFilterOptions = false;
      }
    } else {
      teamYearOptions.value = [];
    }
  } catch (err) {
    console.warn('Не удалось загрузить фильтры для галереи игроков', err);
    if (refreshClubs) clubOptions.value = [];
    teamYearOptions.value = [];
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
    void fetchPlayers({ page: 1, reset: true });
  }, 350);
}

function clearSearch() {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  search.value = '';
  ensureFirstPage();
  void fetchPlayers({ page: 1, reset: true });
}

function formatDate(val) {
  return val ? new Date(val).toLocaleDateString('ru-RU') : '—';
}

function clubNames(player) {
  return (player?.clubs || [])
    .map((club) => (club?.name || '').trim())
    .filter(Boolean);
}

function teamBirthYears(player) {
  const years = (player?.teams || [])
    .map((team) => team?.birth_year)
    .filter((year) => Number.isFinite(Number(year)))
    .map((year) => Number(year));
  if (!years.length) return [];
  const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b);
  return uniqueYears.map((year) => String(year));
}

function clubYearSummary(player) {
  const parts = [];
  const clubs = clubNames(player);
  if (clubs.length) {
    parts.push(clubs.join(', '));
  }
  parts.push(...teamBirthYears(player));
  if (!parts.length) {
    return '—';
  }
  return parts.join(' · ');
}

function profileUrl(player) {
  const id = player?.external_id;
  return id ? `https://fhmoscow.com/player/${id}` : null;
}

function getPhotoUrls(player) {
  const urls = [];
  const append = (value) => {
    const trimmed = (value || '').trim();
    if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
  };
  if (Array.isArray(player?.photo?.urls)) {
    for (const url of player.photo.urls) append(url);
  }
  if (Array.isArray(player?.photo_url_candidates)) {
    for (const url of player.photo_url_candidates) append(url);
  }
  append(player?.photo?.url);
  append(player?.photo_url);
  return urls;
}

function photoStateKey(player) {
  const idx = photoIndexByPlayer.value[player.id] ?? 0;
  return `${player.id}:${idx}`;
}

function currentPhotoUrl(player) {
  const idx = photoIndexByPlayer.value[player.id] ?? 0;
  if (idx < 0) return '';
  const urls = getPhotoUrls(player);
  return urls[idx] || '';
}

function handlePhotoError(player) {
  const urls = getPhotoUrls(player);
  if (!urls.length) return;
  const idx = photoIndexByPlayer.value[player.id] ?? 0;
  if (idx < urls.length - 1) {
    photoIndexByPlayer.value = {
      ...photoIndexByPlayer.value,
      [player.id]: idx + 1,
    };
  } else {
    photoIndexByPlayer.value = {
      ...photoIndexByPlayer.value,
      [player.id]: -1,
    };
  }
}

function hasActivePhoto(player) {
  return Boolean(currentPhotoUrl(player));
}

function updatePlayerRequest(playerId, request) {
  players.value = players.value.map((player) =>
    player.id === playerId ? { ...player, photo_request: request } : player
  );
}

function validateUploadFile(file) {
  if (!file) return 'Файл не выбран';
  const type = (file.type || '').toLowerCase();
  const name = file.name || '';
  const isAllowedType =
    ACCEPTED_IMAGE_TYPES.includes(type) || IMAGE_EXTENSION_RE.test(name);
  if (!isAllowedType) {
    return 'Допустимы изображения в формате PNG или JPEG';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Максимальный размер файла — 5 МБ';
  }
  return '';
}

function loadImageDimensions(file) {
  if (
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined'
  ) {
    return Promise.resolve({
      width: MIN_IMAGE_DIMENSION,
      height: MIN_IMAGE_DIMENSION,
    });
  }
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const result = {
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
          };
          resolve(result);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image_load_failed'));
      };
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

async function validateImageDimensions(file) {
  try {
    const { width, height } = await loadImageDimensions(file);
    if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
      return `Минимальное разрешение фото — ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} пикселей`;
    }
    return '';
  } catch (_err) {
    return 'Не удалось определить разрешение изображения. Выберите другое фото.';
  }
}

async function handleSelectedFiles(playerId, fileList) {
  const player = players.value.find((p) => p.id === playerId);
  if (!player) return;
  if (isUploadDisabled(player)) {
    updateUploadState(playerId, {
      error: isApprovedRequest(player)
        ? 'Фото уже подтверждено администратором'
        : 'Заявка уже отправлена и ожидает проверки',
      success: false,
    });
    return;
  }
  updateUploadState(playerId, { error: '', success: false });
  if (!fileList || !fileList.length) return;
  const files = Array.from(fileList);
  const preferred = files.find((file) => {
    const type = (file.type || '').toLowerCase();
    return (
      ACCEPTED_IMAGE_TYPES.includes(type) ||
      IMAGE_EXTENSION_RE.test(file.name || '')
    );
  });
  const file = preferred || files[0];
  const validationError = validateUploadFile(file);
  if (validationError) {
    updateUploadState(playerId, { error: validationError });
    return;
  }
  const dimensionError = await validateImageDimensions(file);
  if (dimensionError) {
    updateUploadState(playerId, { error: dimensionError });
    return;
  }
  void uploadPlayerPhoto(playerId, file);
}

function openFilePicker(playerId) {
  const player = players.value.find((p) => p.id === playerId);
  if (!player || isUploadDisabled(player)) return;
  const state = getUploadState(playerId);
  if (state.uploading) return;
  const input = fileInputMap.get(playerId);
  if (input) input.click();
}

function onPhotoInputChange(playerId, event) {
  void handleSelectedFiles(playerId, event?.target?.files || []);
}

function onPhotoAreaKeydown(playerId, event) {
  const player = players.value.find((p) => p.id === playerId);
  if (!player) return;
  if (isUploadDisabled(player)) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openFilePicker(playerId);
  }
}

function onPhotoAreaClick(playerId) {
  openFilePicker(playerId);
}

function onDragEnter(playerId, event) {
  const player = players.value.find((p) => p.id === playerId);
  if (!player || isUploadDisabled(player)) return;
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  if (!getUploadState(playerId).uploading) {
    updateDropState(playerId, true);
  }
}

function onDragLeave(playerId) {
  updateDropState(playerId, false);
}

async function onDrop(playerId, event) {
  updateDropState(playerId, false);
  const player = players.value.find((p) => p.id === playerId);
  if (!player || isUploadDisabled(player)) return;
  if (getUploadState(playerId).uploading) return;
  await handleSelectedFiles(playerId, event?.dataTransfer?.files || []);
}

async function uploadPlayerPhoto(playerId, file) {
  updateUploadState(playerId, {
    uploading: true,
    progress: 0,
    error: '',
    success: false,
  });
  const form = new FormData();
  form.append('file', file, file.name || `player-${playerId}.jpg`);
  try {
    const res = await apiUpload(`/players/${playerId}/photo-request`, form, {
      onProgress: (progressEvent) => {
        const progress = Number.isFinite(progressEvent)
          ? progressEvent
          : progressEvent?.loaded && progressEvent?.total
            ? progressEvent.loaded / progressEvent.total
            : 0;
        const percent = Math.min(100, Math.round(progress * 100));
        updateUploadState(playerId, { progress: percent });
      },
    });
    updatePlayerRequest(playerId, res?.request || null);
    updateUploadState(playerId, {
      uploading: false,
      progress: 100,
      success: true,
    });
    scheduleSuccessReset(playerId);
  } catch (err) {
    updateUploadState(playerId, {
      uploading: false,
      progress: 0,
      success: false,
      error: err?.message || 'Не удалось загрузить фото',
    });
  } finally {
    const input = fileInputMap.get(playerId);
    if (input) input.value = '';
  }
}

function photoRequestStatus(player) {
  if (!isPendingRequest(player)) return null;
  return {
    label: 'На модерации',
    variant: 'warning',
  };
}

function photoRequestMessage(player) {
  const request = player?.photo_request;
  if (!request) return '';
  if (isApprovedRequest(player)) {
    return '';
  }
  if (isRejectedRequest(player)) {
    return request.decision_reason
      ? `Отклонено: ${request.decision_reason}`
      : 'Фото отклонено администратором';
  }
  return '';
}

function photoActionLabel(player) {
  const base = hasActivePhoto(player)
    ? 'Обновить фотографию игрока'
    : 'Добавить фотографию игрока';
  if (isPendingRequest(player)) {
    return `${base}. Текущая заявка на модерации.`;
  }
  return base;
}

onMounted(async () => {
  await loadFilterOptions({ refreshClubs: true });
  await fetchPlayers({ page: 1, reset: true });
  isBootstrapping = false;
});

watch(search, onSearchInput);
watch(selectedClub, (newClub) => {
  if (isBootstrapping || isApplyingFilterOptions) return;
  ensureFirstPage();
  void (async () => {
    await loadFilterOptions({ clubId: newClub, refreshClubs: false });
    await fetchPlayers({ page: 1, reset: true });
  })();
});
watch(selectedTeamYear, () => {
  if (isBootstrapping || isApplyingFilterOptions) return;
  ensureFirstPage();
  void fetchPlayers({ page: 1, reset: true });
});
watch(photoFilter, () => {
  if (isBootstrapping) return;
  ensureFirstPage();
  void fetchPlayers({ page: 1, reset: true });
});

watch(currentPage, (page, prev) => {
  if (skipPageWatch) return;
  if (isBootstrapping || page === prev) return;
  if (loading.value || pageLoading.value) {
    skipPageWatch = true;
    currentPage.value = prev;
    skipPageWatch = false;
    return;
  }
  void fetchPlayers({ page });
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  resetUploadHelpers();
});
</script>

<template>
  <div class="py-3 school-player-photos-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление медиа и контентом', disabled: true },
          { label: 'Фотографии игроков' },
        ]"
      />
      <h1 class="mb-3">Фотографии игроков</h1>

      <div class="alert alert-secondary upload-guidelines" role="note">
        <i class="bi bi-shield-check me-2" aria-hidden="true"></i>
        <div>
          <strong class="d-block">Требования к загружаемым фото</strong>
          <span>{{ uploadRequirementsText }}</span>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <form class="search-form" @submit.prevent>
            <div class="search-control">
              <label
                for="playerGallerySearch"
                class="form-label small text-muted mb-1"
                >Поиск по фамилии или имени</label
              >
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  id="playerGallerySearch"
                  v-model="search"
                  type="search"
                  class="form-control"
                  placeholder="Например: Иванов"
                  autocomplete="off"
                  aria-describedby="playerGallerySearchHelp"
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
              <div id="playerGallerySearchHelp" class="form-text">
                Поиск осуществляется по фамилии, имени и отчеству игроков
              </div>
            </div>
          </form>
          <div class="filters-bar mt-3">
            <div class="filters-group">
              <label
                for="playerGalleryClub"
                class="form-label small text-muted mb-1"
                >Клуб</label
              >
              <select
                id="playerGalleryClub"
                v-model="selectedClub"
                class="form-select"
              >
                <option value="">Все клубы</option>
                <option
                  v-for="club in clubOptions"
                  :key="club.id"
                  :value="club.id"
                >
                  {{ club.name }}
                </option>
              </select>
            </div>
            <div class="filters-group">
              <label
                for="playerGalleryTeamYear"
                class="form-label small text-muted mb-1"
                >Год рождения команды</label
              >
              <select
                id="playerGalleryTeamYear"
                v-model="selectedTeamYear"
                class="form-select"
              >
                <option value="">Все команды</option>
                <option
                  v-for="year in teamYearOptions"
                  :key="year"
                  :value="year"
                >
                  {{ year }}
                </option>
              </select>
            </div>
            <div class="filters-group">
              <label
                for="playerGalleryPhoto"
                class="form-label small text-muted mb-1"
                >Фотографии</label
              >
              <select
                id="playerGalleryPhoto"
                v-model="photoFilter"
                class="form-select"
              >
                <option
                  v-for="option in photoFilterOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div v-if="loading && !players.length" class="text-center py-4">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>

          <template v-else>
            <div v-if="pageLoading" class="text-center py-3" aria-live="polite">
              <div class="spinner-border spinner-brand" role="status"></div>
            </div>
            <div v-if="!players.length" class="alert alert-info mb-0">
              Нет доступных игроков в закрепленных командах.
            </div>
            <div v-else class="player-roster-list">
              <article
                v-for="player in players"
                :key="player.id"
                class="player-roster-item shadow-sm"
                role="article"
              >
                <div
                  class="player-roster-photo"
                  role="button"
                  tabindex="0"
                  :aria-label="photoActionLabel(player)"
                  :aria-disabled="isUploadDisabled(player)"
                  :class="{
                    'is-drop': isDropActive(player.id),
                    'is-uploading': getUploadState(player.id).uploading,
                    'is-disabled': isUploadDisabled(player),
                    'has-photo': hasActivePhoto(player),
                  }"
                  @click="onPhotoAreaClick(player.id)"
                  @keydown="onPhotoAreaKeydown(player.id, $event)"
                  @dragenter.prevent="onDragEnter(player.id, $event)"
                  @dragover.prevent="onDragEnter(player.id, $event)"
                  @dragleave.prevent="onDragLeave(player.id)"
                  @drop.prevent="onDrop(player.id, $event)"
                >
                  <img
                    v-if="hasActivePhoto(player)"
                    :key="photoStateKey(player)"
                    :src="currentPhotoUrl(player)"
                    :alt="`Фото игрока ${player.full_name || ''}`"
                    loading="lazy"
                    @error.stop="handlePhotoError(player)"
                  />
                  <div v-else class="photo-placeholder">
                    <i class="bi bi-person" aria-hidden="true"></i>
                    <span class="visually-hidden">Фотография отсутствует</span>
                  </div>
                  <div
                    v-if="getUploadState(player.id).uploading"
                    class="upload-overlay"
                  >
                    <div
                      class="spinner-border spinner-brand"
                      role="status"
                    ></div>
                    <div class="upload-progress">
                      {{ getUploadState(player.id).progress }}%
                    </div>
                  </div>
                  <div
                    v-else
                    class="photo-hint"
                    :class="{ hidden: isUploadDisabled(player) }"
                  >
                    <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                    <span>Нажмите или перетащите</span>
                  </div>
                </div>
                <input
                  :ref="(el) => registerFileInput(player.id, el)"
                  type="file"
                  class="visually-hidden"
                  accept="image/png,image/jpeg,image/jpg"
                  @change="onPhotoInputChange(player.id, $event)"
                />
                <div class="player-roster-body">
                  <div class="player-roster-header">
                    <a
                      v-if="profileUrl(player)"
                      :href="profileUrl(player)"
                      target="_blank"
                      rel="noopener"
                      class="player-name-link"
                    >
                      {{ player.full_name || '—' }}
                    </a>
                    <span v-else class="player-name-text">
                      {{ player.full_name || '—' }}
                    </span>
                  </div>
                  <div class="player-roster-meta">
                    <p class="player-roster-meta-line player-roster-meta-date">
                      {{ formatDate(player.date_of_birth) }}
                    </p>
                    <p class="player-roster-meta-line">
                      {{ clubYearSummary(player) }}
                    </p>
                  </div>
                  <div
                    v-if="photoRequestStatus(player)"
                    class="player-roster-status"
                  >
                    <span
                      class="badge"
                      :class="`bg-${photoRequestStatus(player).variant}`"
                    >
                      {{ photoRequestStatus(player).label }}
                    </span>
                  </div>
                  <p
                    v-if="photoRequestMessage(player)"
                    class="status-note small mb-1"
                    :class="{
                      'text-success': isApprovedRequest(player),
                      'text-danger': isRejectedRequest(player),
                      'text-muted': isPendingRequest(player),
                    }"
                  >
                    {{ photoRequestMessage(player) }}
                  </p>
                  <p
                    v-if="getUploadState(player.id).error"
                    class="text-danger small mb-0"
                    aria-live="polite"
                  >
                    {{ getUploadState(player.id).error }}
                  </p>
                  <p
                    v-else-if="getUploadState(player.id).success"
                    class="text-success small mb-0"
                    aria-live="polite"
                  >
                    Фото отправлено на модерацию
                  </p>
                </div>
              </article>
            </div>
          </template>
        </div>
      </div>

      <div v-if="totalPages > 1" class="d-flex justify-content-center mt-4">
        <div
          :class="{ 'pagination-disabled': paginationDisabled }"
          :aria-disabled="paginationDisabled ? 'true' : 'false'"
        >
          <Pagination v-model="currentPage" :total-pages="totalPages" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
}

.search-form .search-control {
  flex: 1 1 260px;
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.upload-guidelines {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
  background: var(--bs-secondary-bg, #f1f3f5);
  color: var(--bs-body-color);
  padding: 0.75rem 1rem;
}

.upload-guidelines .bi {
  font-size: 1.2rem;
  margin-top: 0.15rem;
}

.filters-group {
  flex: 1 1 200px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.player-roster-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.player-roster-item {
  display: flex;
  gap: 1rem;
  border-radius: 1rem;
  background: var(--bs-body-bg, #ffffff);
  padding: 1rem;
}

.player-roster-item:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

.player-roster-photo {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 1rem;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  border: 2px dashed transparent;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.player-roster-photo:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 4px rgba(17, 109, 209, 0.25);
  border-color: rgba(17, 109, 209, 0.45);
}

.player-roster-photo.is-drop {
  border-color: var(--bs-primary, #0d6efd);
  background: rgba(13, 110, 253, 0.08);
}

.player-roster-photo.is-disabled {
  cursor: not-allowed;
  border-style: solid;
  border-color: transparent;
}

.player-roster-photo.is-disabled:hover .photo-hint,
.player-roster-photo.is-disabled:focus-visible .photo-hint {
  opacity: 0;
}

.player-roster-photo.is-uploading {
  cursor: progress;
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

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-weight: 600;
}

.upload-progress {
  font-size: 0.95rem;
  letter-spacing: 0.03em;
}

.photo-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 0.6rem;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 0.8rem;
  text-align: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-hint i {
  font-size: 1rem;
}

.photo-hint small {
  color: rgba(255, 255, 255, 0.75);
}

.photo-hint.hidden {
  opacity: 0;
}

.player-roster-photo:hover .photo-hint,
.player-roster-photo:focus-visible .photo-hint,
.player-roster-photo.is-drop .photo-hint,
.player-roster-photo:not(.has-photo) .photo-hint {
  opacity: 1;
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

.player-name-link,
.player-name-text {
  font-weight: 600;
  font-size: 1.05rem;
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.player-name-link:hover {
  text-decoration: underline;
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

.player-roster-status {
  margin-top: 0.75rem;
}

.player-roster-status .badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
}

.status-note {
  margin-bottom: 0.25rem;
}

@media (max-width: 576px) {
  .upload-guidelines {
    flex-direction: column;
    align-items: stretch;
  }

  .player-roster-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .player-roster-photo {
    width: 100%;
    height: 200px;
  }

  .photo-hint {
    font-size: 0.85rem;
  }
}

.pagination-disabled {
  pointer-events: none;
  opacity: 0.6;
}
</style>
