<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { formatKickoff, isMskMidnight } from '../utils/time.js';
import InfoItem from '../components/InfoItem.vue';
import yandexLogo from '../assets/yandex-maps.svg';
import MenuTile from '../components/MenuTile.vue';

const route = useRoute();
const match = ref(null);
const agreements = ref([]);
const loading = ref(true);
const error = ref('');

const stadiumName = computed(
  () => match.value?.ground_details?.name || match.value?.ground || ''
);
const stadiumAddress = computed(
  () => match.value?.ground_details?.address || ''
);
const stadiumLink = computed(
  () => match.value?.ground_details?.yandex_url || ''
);
const arenaMetro = computed(() => {
  const meta = match.value?.ground_details?.address_metro;
  if (!meta) return [];
  try {
    const arr = Array.isArray(meta) ? meta : [];
    return arr
      .map((m) => m?.name || m?.station || '')
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
});
const arenaCoords = computed(() => {
  const lat = match.value?.ground_details?.geo?.lat;
  const lon = match.value?.ground_details?.geo?.lon;
  return lat && lon ? `${lat}, ${lon}` : '';
});

const showStadiumCard = computed(() => {
  const name = stadiumName.value || '';
  if (!name) return true; // show default card when unknown
  return name !== 'Согласовывается';
});

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    const [mres, ares] = await Promise.all([
      apiFetch(`/matches/${route.params.id}`),
      apiFetch(`/matches/${route.params.id}/agreements`),
    ]);
    match.value = mres.match || null;
    agreements.value = Array.isArray(ares.agreements) ? ares.agreements : [];
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
  } finally {
    loading.value = false;
  }
});

const kickoff = computed(() => formatKickoff(match.value?.date_start));
const kickoffHeader = computed(() => {
  const iso = match.value?.date_start;
  if (!iso) return '';
  if (isMskMidnight(iso)) return kickoff.value.date;
  return `${kickoff.value.time} • ${kickoff.value.date}`;
});

const pendingAgreement = computed(() =>
  agreements.value.find((a) => a.MatchAgreementStatus?.alias === 'PENDING')
);
const acceptedExists = computed(() =>
  agreements.value.some((a) => a.MatchAgreementStatus?.alias === 'ACCEPTED')
);
const statusChip = computed(() => {
  if (acceptedExists.value)
    return {
      text: 'Согласовано',
      cls: 'bg-success-subtle text-success border',
    };
  if (pendingAgreement.value)
    return {
      text: 'Ожидает согласования',
      cls: 'bg-warning-subtle text-warning border',
    };
  return {
    text: 'Не согласовано',
    cls: 'bg-secondary-subtle text-secondary border',
  };
});
</script>

<template>
  <div class="py-3 school-match-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">Спортивная школа</li>
          <li class="breadcrumb-item">
            <RouterLink to="/school-matches">Матчи школы</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Матч</li>
        </ol>
      </nav>
      <h1 class="mb-3">{{ match?.team1 }} — {{ match?.team2 }}</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-else class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <div
            class="d-flex justify-content-between align-items-start flex-wrap gap-2"
          >
            <div>
              <div class="kickoff-display m-0 lh-1">{{ kickoffHeader }}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span
                v-if="match?.is_home"
                class="badge bg-primary-subtle text-primary border"
                >Вы — хозяева</span
              >
              <span
                v-if="match?.is_away"
                class="badge bg-info-subtle text-info border"
                >Вы — гости</span
              >
              <span class="badge" :class="statusChip.cls">{{
                statusChip.text
              }}</span>
            </div>
          </div>
          <div class="mt-2">
            <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-2">
              <div v-if="match?.season" class="col">
                <InfoItem label="Сезон" :value="match.season" />
              </div>
              <div v-if="match?.tournament" class="col">
                <InfoItem label="Турнир" :value="match.tournament" />
              </div>
              <div v-if="match?.stage" class="col">
                <InfoItem label="Этап" :value="match.stage" />
              </div>
              <div v-if="match?.group" class="col">
                <InfoItem label="Группа" :value="match.group" />
              </div>
              <div v-if="match?.tour" class="col">
                <InfoItem label="Тур" :value="match.tour" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showStadiumCard"
        class="card section-card tile fade-in shadow-sm mb-3 ground-card"
      >
        <div
          class="card-body d-flex flex-column flex-sm-row gap-3 align-items-start"
        >
          <div class="icon-box" aria-hidden="true">
            <i class="bi bi-geo-alt text-muted" aria-hidden="true"></i>
          </div>
          <div class="flex-grow-1">
            <div class="stadium-title mb-1">
              {{ stadiumName || 'Стадион не указан' }}
            </div>
            <div v-if="stadiumAddress" class="text-muted small">
              {{ stadiumAddress }}
            </div>
            <div
              v-if="arenaMetro.length"
              class="text-muted small d-inline-flex align-items-center gap-1 mt-2"
            >
              <i class="bi bi-subway" aria-hidden="true"></i>
              <span>{{ arenaMetro.join(' • ') }}</span>
            </div>
            <div class="mt-2 d-flex align-items-center gap-3 flex-wrap">
              <a
                v-if="stadiumLink"
                :href="stadiumLink"
                target="_blank"
                rel="noopener"
                class="btn btn-sm btn-outline-brand d-inline-flex align-items-center gap-2"
                :aria-label="`Показать локацию стадиона на карте: ${stadiumName}`"
              >
                <img :src="yandexLogo" alt="Яндекс.Карты" height="18" />
                Показать на карте
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Управление матчем</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              title="Согласование времени"
              icon="bi-calendar-check"
              :to="`/school-matches/${route.params.id}/agreements`"
            />
            <MenuTile
              title="Составы на матч"
              icon="bi-people"
              :to="null"
              :placeholder="true"
              note="Скоро"
            />
            <MenuTile
              title="Судьи матча"
              icon="bi-person-badge"
              :to="null"
              :placeholder="true"
              note="Скоро"
            />
            <MenuTile
              title="Обращения по матчу"
              icon="bi-chat-dots"
              :to="null"
              :placeholder="true"
              note="Скоро"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kickoff-display {
  /* Smaller, calmer typography under the page title */
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 400;
}
/* Стадион — оформление в стиле страницы "Сборы" */
.ground-card {
  border-radius: 0.75rem;
  border: 0;
  overflow: hidden;
}
.icon-box {
  width: 56px;
  height: 56px;
  border-radius: 0.5rem;
  background: var(--bs-light, #f8f9fa);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}
.stadium-title {
  line-height: 1.2;
  font-size: 1rem;
  font-weight: 400;
}
@media (max-width: 575.98px) {
  .menu-section {
    margin-left: calc(var(--bs-gutter-x) * -0.5);
    margin-right: calc(var(--bs-gutter-x) * -0.5);
    border-radius: 0;
  }
}
</style>
