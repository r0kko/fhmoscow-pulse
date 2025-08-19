<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import SchoolMatchesTable from '../components/SchoolMatchesTable.vue';

const matches = ref([]);
const loading = ref(false);
const error = ref('');
const extUnavailable = ref(false);
const activeTab = ref('home'); // 'home' | 'away'
const search = ref('');
const homePage = ref(1);
const awayPage = ref(1);
const pageSize = ref(loadPageSize('schoolMatchesPageSize', 20));

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [homeRes, awayRes] = await Promise.all([
      apiFetch('/matches/upcoming?type=home&all=true'),
      apiFetch('/matches/upcoming?type=away&all=true'),
    ]);
    extUnavailable.value =
      homeRes.external_available === false ||
      awayRes.external_available === false;
    const home = Array.isArray(homeRes.matches) ? homeRes.matches : [];
    const away = Array.isArray(awayRes.matches) ? awayRes.matches : [];
    matches.value = [...home, ...away];
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
}

// Fallback: if server doesn't provide is_home, show all in 'Домашние'
const homeMatches = computed(() =>
  matches.value.filter((m) => m.is_home !== false)
);
const awayMatches = computed(() =>
  matches.value.filter((m) => m.is_home === false)
);

const filteredHome = computed(() => filterByQuery(homeMatches.value));
const filteredAway = computed(() => filterByQuery(awayMatches.value));

const totalHomePages = computed(() =>
  Math.max(1, Math.ceil(filteredHome.value.length / pageSize.value))
);
const totalAwayPages = computed(() =>
  Math.max(1, Math.ceil(filteredAway.value.length / pageSize.value))
);

const paginatedHome = computed(() => {
  const start = (homePage.value - 1) * pageSize.value;
  return filteredHome.value.slice(start, start + pageSize.value);
});
const paginatedAway = computed(() => {
  const start = (awayPage.value - 1) * pageSize.value;
  return filteredAway.value.slice(start, start + pageSize.value);
});

watch(search, () => {
  homePage.value = 1;
  awayPage.value = 1;
});

watch([filteredHome, pageSize], () => {
  const total = totalHomePages.value;
  if (homePage.value > total) homePage.value = total;
  if (homePage.value < 1) homePage.value = 1;
});
watch([filteredAway, pageSize], () => {
  const total = totalAwayPages.value;
  if (awayPage.value > total) awayPage.value = total;
  if (awayPage.value < 1) awayPage.value = 1;
});

function filterByQuery(list) {
  const q = search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (m) =>
      (m.team1 || '').toLowerCase().includes(q) ||
      (m.team2 || '').toLowerCase().includes(q)
  );
}

function onChangePageSize(val) {
  pageSize.value = val;
  savePageSize('schoolMatchesPageSize', val);
  // reset to first page for both tabs for consistency
  homePage.value = 1;
  awayPage.value = 1;
}

function formatDate(d) {
  return new Date(d).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
}
</script>

<template>
  <div class="py-3 school-matches-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление спортивной школой</li>
          <li class="breadcrumb-item active" aria-current="page">
            Ближайшие матчи
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Ближайшие матчи</h1>

      <div v-if="extUnavailable" class="alert alert-warning" role="alert">
        Внешняя база недоступна. Список матчей может быть неполным.
      </div>

      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body p-2">
          <ul class="nav nav-pills nav-fill mb-0 tab-selector" role="tablist">
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'home' }"
                role="tab"
                :aria-selected="activeTab === 'home'"
                @click="activeTab = 'home'"
              >
                Домашние матчи
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'away' }"
                role="tab"
                :aria-selected="activeTab === 'away'"
                @click="activeTab = 'away'"
              >
                Матчи на выезде
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-sm-6 col-md-4">
              <input
                v-model="search"
                type="text"
                class="form-control"
                placeholder="Поиск по названию команд"
              />
            </div>
          </div>

          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center py-3">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>

          <template v-else>
            <div v-show="activeTab === 'home'">
              <SchoolMatchesTable :items="paginatedHome" />
              <p v-if="!filteredHome.length" class="mb-0">
                Нет домашних матчей.
              </p>
              <PageNav
                v-if="filteredHome.length > 0"
                v-model:page="homePage"
                :total-pages="totalHomePages"
                :page-size="pageSize"
                @update:page-size="onChangePageSize"
              />
            </div>
            <div v-show="activeTab === 'away'">
              <SchoolMatchesTable :items="paginatedAway" />
              <p v-if="!filteredAway.length" class="mb-0">
                Нет матчей на выезде.
              </p>
              <PageNav
                v-if="filteredAway.length > 0"
                v-model:page="awayPage"
                :total-pages="totalAwayPages"
                :page-size="pageSize"
                @update:page-size="onChangePageSize"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolMatchesView' };
</script>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
</style>
