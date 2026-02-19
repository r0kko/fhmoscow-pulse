<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import InfoItem from '../components/InfoItem.vue';
import MenuTile from '../components/MenuTile.vue';
import { apiFetch } from '../api';
import { formatKickoff, isMskMidnight } from '../utils/time';
import { withHttp } from '../utils/url';
import yandexLogo from '../assets/yandex-maps.svg';

const route = useRoute();
const match = ref(null);
const loading = ref(true);
const error = ref('');

const matchId = computed(() => String(route.params.id || ''));

const breadcrumbs = computed(() => [
  { label: 'Главная', to: '/' },
  { label: 'Администрирование', to: '/admin' },
  {
    label: 'Назначение судей (профлиги)',
    to: '/admin/professional-leagues/referee-assignments',
  },
  { label: 'Матч', disabled: true },
]);

const matchTitle = computed(() => {
  const home = match.value?.team1 || '—';
  const away = match.value?.team2 || '—';
  return `${home} — ${away}`;
});

const kickoff = computed(() => formatKickoff(match.value?.date_start || null));
const kickoffHeader = computed(() => {
  const iso = match.value?.date_start || null;
  if (!iso) return '';
  if (isMskMidnight(iso)) return kickoff.value.date;
  return `${kickoff.value.time} • ${kickoff.value.date}`;
});

const isProfessionalCompetition = computed(
  () => match.value?.competition_type?.alias === 'PRO'
);
const isCancelled = computed(
  () => String(match.value?.status?.alias || '').toUpperCase() === 'CANCELLED'
);

const refereesTileDisabled = computed(
  () => !isProfessionalCompetition.value || isCancelled.value
);
const refereesTileNote = computed(() => {
  if (!isProfessionalCompetition.value) return 'Только для профсоревнований';
  if (isCancelled.value) return 'Матч отменен';
  return '';
});

const statusChip = computed(() => {
  const text = match.value?.status?.name;
  if (!text) return null;
  const alias = String(match.value?.status?.alias || '').toUpperCase();
  if (alias === 'CANCELLED') {
    return { text, cls: 'bg-warning-subtle text-warning border' };
  }
  if (alias === 'POSTPONED') {
    return { text, cls: 'bg-info-subtle text-info border' };
  }
  if (alias === 'FINISHED') {
    return { text, cls: 'bg-success-subtle text-success border' };
  }
  return { text, cls: 'bg-secondary-subtle text-secondary border' };
});

const stadiumName = computed(
  () => match.value?.ground_details?.name || match.value?.ground || ''
);
const stadiumAddress = computed(
  () => match.value?.ground_details?.address || ''
);
const stadiumLink = computed(() =>
  withHttp(match.value?.ground_details?.yandex_url || '')
);

const showStadiumCard = computed(() => {
  const name = stadiumName.value || '';
  if (!name) return true;
  return name !== 'Согласовывается';
});

async function loadMatch() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiFetch(`/matches/${matchId.value}`);
    match.value = data.match || null;
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить матч';
    match.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadMatch();
});
</script>

<template>
  <div class="py-3 admin-pro-league-match-page">
    <div class="container">
      <Breadcrumbs :items="breadcrumbs" />
      <h1 class="mb-3">{{ matchTitle }}</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-else-if="loading" class="text-center py-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        >
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>

      <div v-else-if="!match" class="alert alert-light border small">
        Матч не найден.
      </div>

      <template v-else>
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div
              class="d-flex justify-content-between align-items-start flex-wrap gap-2"
            >
              <div class="kickoff-display m-0 lh-1">{{ kickoffHeader }}</div>
              <span v-if="statusChip" class="badge" :class="statusChip.cls">
                {{ statusChip.text }}
              </span>
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
          class="card section-card tile fade-in shadow-sm mb-3"
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
              <div class="mt-2 d-flex align-items-center gap-3 flex-wrap">
                <a
                  v-if="stadiumLink"
                  :href="stadiumLink"
                  target="_blank"
                  rel="noopener noreferrer"
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

        <div
          v-if="!isProfessionalCompetition"
          class="alert alert-warning"
          role="alert"
        >
          Этот матч не относится к профессиональным соревнованиям.
        </div>

        <div class="card section-card mb-2 menu-section">
          <div class="card-body">
            <h2 class="card-title h5 mb-3">Управление матчем</h2>
            <div v-edge-fade class="scroll-container">
              <MenuTile
                title="Судьи матча"
                icon="bi-person-badge"
                :to="`/admin/professional-leagues/matches/${matchId}/referees`"
                :placeholder="refereesTileDisabled"
                :note="refereesTileNote"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.kickoff-display {
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 400;
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
