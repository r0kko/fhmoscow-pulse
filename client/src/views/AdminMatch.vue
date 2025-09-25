<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api';
import { formatKickoff, isMskMidnight } from '../utils/time';
import InfoItem from '../components/InfoItem.vue';
import MenuTile from '../components/MenuTile.vue';
import PenaltyTimeline from '../components/PenaltyTimeline.vue';
import yandexLogo from '../assets/yandex-maps.svg';
import vkLogo from '../assets/vkvideo.png';

const route = useRoute();
const matchId = computed(() => String(route.params.id || ''));

const match = ref(null);
const agreements = ref([]);
const penalties = ref([]);
const penaltiesLoading = ref(true);
const loading = ref(true);
const error = ref('');

const reschedDate = ref('');
const reschedError = ref('');
const reschedLoading = ref(false);

const syncingBroadcast = ref(false);
const broadcastError = ref('');

const hasPenalties = computed(
  () => Array.isArray(penalties.value) && penalties.value.length > 0
);

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
  if (!name) return true;
  return name !== 'Согласовывается';
});

function normalizeUrl(u) {
  const s = (u || '').toString().trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

const streamLinks = computed(() => {
  try {
    const urls = (match.value?.broadcast_links || [])
      .filter(Boolean)
      .map(normalizeUrl)
      .filter((x) => /^https?:\/\//i.test(x));
    if (!urls.length) return [];
    if (urls.length === 1)
      return [
        {
          url: urls[0],
          label: 'Прямая трансляция',
          aria: 'Открыть прямую трансляцию',
        },
      ];
    const res = [];
    const labels = ['Трансляция (1-й состав)', 'Трансляция (2-й состав)'];
    for (let i = 0; i < Math.min(2, urls.length); i += 1) {
      res.push({
        url: urls[i],
        label: labels[i],
        aria: `Открыть трансляцию: ${labels[i]}`,
      });
    }
    for (let i = 2; i < urls.length; i += 1) {
      res.push({
        url: urls[i],
        label: `Трансляция #${i + 1}`,
        aria: `Открыть трансляцию #${i + 1}`,
      });
    }
    return res;
  } catch {
    return [];
  }
});

const pendingAgreement = computed(() =>
  agreements.value.find((a) => a.MatchAgreementStatus?.alias === 'PENDING')
);
const acceptedExists = computed(() =>
  agreements.value.some((a) => a.MatchAgreementStatus?.alias === 'ACCEPTED')
);

const kickoff = computed(() => formatKickoff(match.value?.date_start));
const kickoffHeader = computed(() => {
  const iso = match.value?.date_start;
  if (!iso) return '';
  if (isMskMidnight(iso)) return kickoff.value.date;
  return `${kickoff.value.time} • ${kickoff.value.date}`;
});

const statusAlias = computed(() =>
  (match.value?.status?.alias || '').toUpperCase()
);
const isCancelled = computed(() => statusAlias.value === 'CANCELLED');
const isPostponed = computed(() => statusAlias.value === 'POSTPONED');

const penaltiesDisabled = computed(
  () => !!match.value?.double_protocol && match.value?.season_active === false
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

const isPastMatch = computed(() => {
  try {
    const ts = new Date(match.value?.date_start || '').getTime();
    return Number.isFinite(ts) && ts < Date.now();
  } catch {
    return false;
  }
});
const technicalStatus = computed(() => {
  if (!isPastMatch.value) return null;
  const winner = String(match.value?.technical_winner || '').toLowerCase();
  if (winner !== 'home' && winner !== 'away') return null;
  const isHome = !!match.value?.is_home;
  const isAway = !!match.value?.is_away;
  const won = (isHome && winner === 'home') || (isAway && winner === 'away');
  const lost = (isHome && winner === 'away') || (isAway && winner === 'home');
  if (won) return { text: 'Тех. победа', cls: 'alert-success' };
  if (lost) return { text: 'Тех. поражение', cls: 'alert-danger' };
  return { text: 'Технический результат', cls: 'alert-secondary' };
});

const minDate = computed(() => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
});

const breadcrumbs = computed(() => [
  { label: 'Главная', to: '/' },
  { label: 'Администрирование', to: '/admin' },
  { label: 'Календарь игр', to: '/admin/sports-calendar' },
  { label: 'Матч' },
]);

const agreementsTileDisabled = computed(() => isCancelled.value);
const agreementsTileNote = computed(() => (isCancelled.value ? 'Отмена' : ''));
const agreementsTileLocked = computed(() => false);
const lineupsTileDisabled = computed(() => isCancelled.value);
const lineupsTileNote = computed(() => (isCancelled.value ? 'Отмена' : ''));
const lineupsTileLocked = computed(() => false);

async function loadAgreements() {
  if (!matchId.value) return;
  try {
    const ares = await apiFetch(`/matches/admin/${matchId.value}/agreements`);
    agreements.value = Array.isArray(ares.agreements) ? ares.agreements : [];
  } catch (e) {
    agreements.value = [];
  }
}

async function loadPenalties() {
  penaltiesLoading.value = true;
  try {
    if (penaltiesDisabled.value) {
      penalties.value = [];
      return;
    }
    const pres = await apiFetch(`/matches/${matchId.value}/penalties`).catch(
      () => ({ items: [] })
    );
    penalties.value = Array.isArray(pres.items) ? pres.items : [];
  } finally {
    penaltiesLoading.value = false;
  }
}

async function loadMatchPage() {
  loading.value = true;
  penaltiesLoading.value = true;
  error.value = '';
  try {
    const mres = await apiFetch(`/matches/${matchId.value}`);
    match.value = mres.match || null;
    reschedDate.value = '';
    reschedError.value = '';
    await loadAgreements();
    await loadPenalties();
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
    penaltiesLoading.value = false;
  } finally {
    loading.value = false;
  }
}

async function submitReschedule() {
  reschedError.value = '';
  if (!reschedDate.value) {
    reschedError.value = 'Выберите дату';
    return;
  }
  reschedLoading.value = true;
  try {
    await apiFetch(`/matches/${matchId.value}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: reschedDate.value }),
    });
    await loadMatchPage();
  } catch (e) {
    reschedError.value = e.message || 'Не удалось обновить дату';
  } finally {
    reschedLoading.value = false;
  }
}

async function syncBroadcasts() {
  if (!matchId.value) return;
  syncingBroadcast.value = true;
  broadcastError.value = '';
  try {
    await apiFetch(`/matches/${matchId.value}/sync-broadcasts`, {
      method: 'POST',
    });
    const refreshed = await apiFetch(`/matches/${matchId.value}`);
    match.value = refreshed.match || null;
  } catch (e) {
    broadcastError.value = e.message || 'Не удалось обновить трансляции';
  } finally {
    syncingBroadcast.value = false;
  }
}

onMounted(loadMatchPage);
</script>

<template>
  <div class="py-3 admin-match-page">
    <div class="container">
      <Breadcrumbs :items="breadcrumbs" />
      <h1 class="mb-3">{{ match?.team1 }} — {{ match?.team2 }}</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-else class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <div
            v-if="technicalStatus"
            class="alert"
            :class="technicalStatus.cls"
            role="alert"
          >
            Матч завершён: {{ technicalStatus.text }}.
          </div>
          <div v-if="isCancelled" class="alert alert-warning" role="alert">
            Матч отменён. Для уточнения сведений обращайтесь в отдел проведения
            соревнований ФХМ.
          </div>
          <div v-else-if="isPostponed" class="alert alert-info" role="alert">
            Матч перенесён. После выбора даты согласование времени будет
            доступно в обычном порядке.
          </div>
          <div
            class="d-flex justify-content-between align-items-start flex-wrap gap-2"
          >
            <div>
              <div class="kickoff-display m-0 lh-1">{{ kickoffHeader }}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge" :class="statusChip.cls">{{
                statusChip.text
              }}</span>
              <span
                v-if="match?.schedule_locked_by_admin"
                class="badge bg-secondary-subtle text-secondary border"
                title="Расписание утверждено администратором"
              >
                Заблокировано администратором
              </span>
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
        v-if="isPostponed"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-body">
          <h2 class="h5 mb-3">Выбор новой даты</h2>
          <div v-if="reschedError" class="alert alert-danger" role="alert">
            {{ reschedError }}
          </div>
          <div class="row g-2 align-items-end">
            <div class="col-12 col-md-4">
              <label for="resched-date" class="form-label small text-muted"
                >Дата (МСК)</label
              >
              <input
                id="resched-date"
                v-model="reschedDate"
                type="date"
                class="form-control"
                :min="minDate"
                :disabled="reschedLoading"
              />
            </div>
            <div class="col-12 col-md-3">
              <button
                class="btn btn-brand"
                :disabled="reschedLoading || !reschedDate"
                @click="submitReschedule"
              >
                <span
                  v-if="reschedLoading"
                  class="spinner-border spinner-border-sm me-1"
                ></span>
                Подтвердить дату
              </button>
            </div>
          </div>
          <p class="text-muted small mt-2 mb-0">
            Новая дата будет записана во внешнюю систему (время 00:00 МСК),
            после чего можно приступить к согласованию точного времени.
          </p>
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
              <span v-if="arenaCoords" class="text-muted small"
                >Координаты: {{ arenaCoords }}</span
              >
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
              :to="`/admin/matches/${matchId}/agreements`"
              :placeholder="agreementsTileDisabled"
              :note="agreementsTileNote"
              :locked="agreementsTileLocked"
            />
            <MenuTile
              title="Составы на матч"
              icon="bi-people"
              :to="`/admin/matches/${matchId}/lineups`"
              :placeholder="lineupsTileDisabled"
              :note="lineupsTileNote"
              :locked="lineupsTileLocked"
            />
            <MenuTile
              title="Судьи матча"
              icon="bi-person-badge"
              :to="`/admin/matches/${matchId}/referees`"
              :placeholder="isCancelled"
              :note="isCancelled ? 'Отмена' : ''"
            />
            <MenuTile
              title="Обращения по матчу"
              icon="bi-chat-dots"
              :to="`/admin/matches/${matchId}/appeals`"
              :placeholder="isCancelled"
              :note="isCancelled ? 'Отмена' : ''"
            />
          </div>
        </div>
      </div>

      <div
        v-if="streamLinks.length"
        id="media"
        class="card section-card mb-2 menu-section"
      >
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="card-title h5 mb-0">Медиа по матчу</h2>
            <button
              class="btn btn-outline-secondary btn-sm"
              :disabled="syncingBroadcast"
              aria-label="Синхронизировать трансляции матча"
              @click="syncBroadcasts"
            >
              <span
                v-if="syncingBroadcast"
                class="spinner-border spinner-border-sm me-1"
              ></span>
              Обновить ссылки
            </button>
          </div>
          <div v-if="broadcastError" class="alert alert-danger" role="alert">
            {{ broadcastError }}
          </div>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              v-for="(s, idx) in streamLinks"
              :key="s.url + '-' + idx"
              :title="s.label"
              :to="s.url"
              :image-src="vkLogo"
              image-alt="VK Видео"
            />
          </div>
        </div>
      </div>

      <div
        v-if="!penaltiesDisabled && hasPenalties"
        id="penalties"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-body">
          <h2 class="h5 mb-3">Штрафы в матче</h2>
          <PenaltyTimeline
            :items="penalties"
            :double-protocol="!!match?.double_protocol"
            :home-label="`Хозяева: ${match?.team1 || ''}`"
            :away-label="`Гости: ${match?.team2 || ''}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kickoff-display {
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 400;
}
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
