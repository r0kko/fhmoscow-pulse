<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api.js';

const players = ref([]);
const total = ref(0);
const perPage = ref(40);
const currentPage = ref(0);
const loading = ref(false);
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
const hasMore = computed(
  () => currentPage.value * perPage.value < total.value
);

let searchTimer = null;
let isBootstrapping = true;
const photoIndexByPlayer = ref({});
let isApplyingFilterOptions = false;

function resetPagination() {
  players.value = [];
  total.value = 0;
  currentPage.value = 0;
  photoIndexByPlayer.value = {};
}

async function fetchPlayers({ reset = false } = {}) {
  if (loading.value) return;
  const nextPage = reset ? 1 : currentPage.value + 1;
  loading.value = true;
  if (reset) {
    resetPagination();
  }
  error.value = '';

  try {
    const params = new URLSearchParams();
    params.set('page', String(nextPage));
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
    currentPage.value = Number(res.page || nextPage);
    const merged = reset ? list : [...players.value, ...list];
    players.value = merged;

    const updatedIndex = reset
      ? {}
      : { ...photoIndexByPlayer.value };
    for (const player of list) {
      const urls = getPhotoUrls(player);
      if (!(player.id in updatedIndex)) {
        updatedIndex[player.id] = urls.length ? 0 : -1;
      } else if (!urls.length) {
        updatedIndex[player.id] = -1;
      }
    }
    photoIndexByPlayer.value = updatedIndex;
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить фотографии игроков';
  } finally {
    loading.value = false;
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

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void fetchPlayers({ reset: true });
  }, 350);
}

function clearSearch() {
  search.value = '';
  void fetchPlayers({ reset: true });
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

onMounted(async () => {
  await loadFilterOptions({ refreshClubs: true });
  await fetchPlayers({ reset: true });
  isBootstrapping = false;
});

watch(search, onSearchInput);
watch(selectedClub, (newClub) => {
  if (isBootstrapping || isApplyingFilterOptions) return;
  void (async () => {
    await loadFilterOptions({ clubId: newClub, refreshClubs: false });
    await fetchPlayers({ reset: true });
  })();
});
watch(selectedTeamYear, () => {
  if (isBootstrapping || isApplyingFilterOptions) return;
  void fetchPlayers({ reset: true });
});
watch(photoFilter, () => {
  if (isBootstrapping) return;
  void fetchPlayers({ reset: true });
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="py-3 school-player-photos-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Фотографии игроков' },
        ]"
      />
      <h1 class="mb-3">Фотографии игроков</h1>

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
              <label for="playerGalleryClub" class="form-label small text-muted mb-1"
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
              <label for="playerGalleryPhoto" class="form-label small text-muted mb-1"
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
                <div class="player-roster-photo" role="presentation">
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
                </div>
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
                </div>
              </article>
            </div>

            <div v-if="hasMore && players.length" class="text-center mt-4">
              <button
                class="btn btn-outline-secondary"
                type="button"
                :disabled="loading"
                @click="fetchPlayers()"
              >
                {{ loading ? 'Загрузка…' : 'Показать ещё' }}
              </button>
            </div>
          </template>
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
  width: 120px;
  height: 120px;
  border: none;
  background: none;
  padding: 0;
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

@media (max-width: 576px) {
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
