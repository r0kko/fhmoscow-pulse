<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { withHttp } from '../utils/url.js';
import yandexLogo from '../assets/yandex-maps.svg';
import metroIcon from '../assets/metro.svg';

const loading = ref(false);
const error = ref('');
const canSee = ref(true);
const groups = ref([]); // [{ club: {id,name}, grounds: [...] }]

onMounted(async () => {
  await checkAccess();
  if (!canSee.value) return;
  await loadGroups();
});

async function checkAccess() {
  try {
    const data = await apiFetch('/users/me/sport-schools');
    canSee.value = Boolean(data?.has_club || data?.has_team);
  } catch (_e) {
    canSee.value = false;
  }
}

async function loadGroups() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiFetch('/grounds/available');
    groups.value = Array.isArray(res.groups) ? res.groups : [];
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить площадки';
  } finally {
    loading.value = false;
  }
}

function metros(address) {
  if (!address || !Array.isArray(address.metro)) return [];
  return address.metro;
}
</script>

<template>
  <div class="py-3 school-grounds-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление спортивной школой</li>
          <li class="breadcrumb-item active" aria-current="page">Стадионы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Стадионы</h1>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else-if="loading" class="text-center py-3">
        <div class="spinner-border spinner-brand" role="status"></div>
      </div>
      <template v-else>
        <div v-if="!canSee" class="alert alert-info">
          Вам пока не назначены клубы или команды. Обратитесь к администратору
          спортивной школы для получения доступа к разделу «Стадионы».
        </div>
        <div v-else-if="!(groups && groups.length)" class="alert alert-warning">
          Для ваших клубов и команд пока нет доступных площадок.
        </div>
        <div
          v-for="group in groups"
          :key="group.club.id"
          class="card section-card tile fade-in shadow-sm mb-3"
        >
          <div class="card-body p-3">
            <h2 class="h5 mb-2">{{ group.club.name }}</h2>
            <ul
              v-if="group.grounds?.length"
              class="list-group list-group-flush"
            >
              <li
                v-for="st in group.grounds"
                :key="st.id"
                class="list-group-item py-3"
              >
                <div
                  class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between"
                >
                  <div class="me-md-3 flex-grow-1">
                    <div class="fw-semibold mb-1">{{ st.name }}</div>
                    <div
                      class="small text-muted d-flex align-items-start gap-2"
                    >
                      <a
                        v-if="st.yandex_url"
                        :href="withHttp(st.yandex_url)"
                        target="_blank"
                        rel="noopener noreferrer"
                        :aria-label="`Открыть в Яндекс.Картах: ${st.name}`"
                        class="me-1 flex-shrink-0 d-inline-flex align-items-center"
                      >
                        <img
                          :src="yandexLogo"
                          alt="Яндекс.Карты"
                          class="yandex-icon"
                        />
                      </a>
                      <a
                        v-if="st.address?.result"
                        :href="st.yandex_url ? withHttp(st.yandex_url) : null"
                        class="text-reset text-decoration-none flex-grow-1 address-link address-text"
                        :aria-label="`Адрес: ${st.address?.result}`"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ st.address.result }}
                      </a>
                      <span v-else class="flex-grow-1">—</span>
                    </div>
                    <div
                      v-if="st.address?.geo_lat && st.address?.geo_lon"
                      class="text-muted small mt-1 d-flex align-items-center"
                    >
                      <i
                        class="bi bi-geo-alt text-brand me-2"
                        aria-hidden="true"
                      ></i>
                      <span>
                        {{ Number(st.address.geo_lat).toFixed(6) }},
                        {{ Number(st.address.geo_lon).toFixed(6) }}
                      </span>
                    </div>
                  </div>
                  <div class="mt-2 mt-md-0 ms-md-3 text-md-end flex-shrink-0">
                    <div
                      v-if="metros(st.address).length"
                      class="metro-list d-flex flex-wrap gap-2 justify-content-md-end"
                    >
                      <span
                        v-for="(m, idx) in metros(st.address)"
                        :key="(m.name || '') + '-' + idx"
                        class="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-1"
                        :title="m.line ? `${m.line} · ${m.name}` : m.name"
                      >
                        <img :src="metroIcon" alt="Метро" class="metro-icon" />
                        <span class="metro-name">{{ m.name }}</span>
                        <span v-if="m.distance != null" class="text-muted"
                          >• {{ Number(m.distance).toFixed(1) }} км</span
                        >
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
            <div v-else class="text-muted">Нет данных.</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolGroundsView' };
</script>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
}
.address-link:hover {
  text-decoration: underline !important;
}

.metro-list .badge {
  background: #fff;
}
/* Improve mobile ergonomics */
.address-text {
  overflow-wrap: anywhere;
}
.yandex-icon {
  height: 18px;
}
.metro-icon {
  height: 12px;
}
@media (max-width: 575.98px) {
  .list-group-item {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
  .metro-list .badge {
    font-size: 0.75rem;
  }
}
@media (max-width: 575.98px) {
  /* Match other school pages full-bleed treatment on mobile */
  .school-grounds-page .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>
