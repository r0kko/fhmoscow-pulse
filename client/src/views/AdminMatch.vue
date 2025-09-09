<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import {
  formatKickoff,
  isMskMidnight,
  toDateTimeLocal,
  fromDateTimeLocal,
} from '../utils/time.js';
import InfoItem from '../components/InfoItem.vue';
import yandexLogo from '../assets/yandex-maps.svg';
import AgreementTimeline from '../components/AgreementTimeline.vue';
import vkLogo from '../assets/vkvideo.png';
import MenuTile from '../components/MenuTile.vue';
import PenaltyTimeline from '../components/PenaltyTimeline.vue';

const route = useRoute();
const match = ref(null);
const agreements = ref([]);
const loading = ref(true);
const error = ref('');

// Penalties
const penalties = ref([]);
const penaltiesLoading = ref(true);
const penaltiesError = ref('');

// Staff of both teams
const homeStaff = ref([]);
const awayStaff = ref([]);
const staffLoading = ref(false);
const staffError = ref('');

// Grounds for admin selection
const grounds = ref([]);
const scheduleForm = ref({ dtLocal: '', groundId: '' });
const submittingSchedule = ref(false);
const scheduleError = ref('');

// Broadcast links admin reconcile
const syncingBroadcast = ref(false);
const broadcastError = ref('');
async function syncBroadcasts() {
  if (!route.params.id) return;
  syncingBroadcast.value = true;
  broadcastError.value = '';
  try {
    await apiFetch(`/matches/${route.params.id}/sync-broadcasts`, {
      method: 'POST',
    });
    const mres = await apiFetch(`/matches/${route.params.id}`);
    match.value = mres.match || null;
  } catch (e) {
    broadcastError.value = e.message || 'Не удалось обновить трансляции';
  } finally {
    syncingBroadcast.value = false;
  }
}

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
    const labels = ['Первый состав', 'Второй состав'];
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

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    const mres = await apiFetch(`/matches/${route.params.id}`);
    match.value = mres.match || null;
    const ares = await apiFetch(`/matches/${route.params.id}/agreements`);
    agreements.value = Array.isArray(ares.agreements) ? ares.agreements : [];
    if (!penaltiesDisabled.value) {
      const pres = await apiFetch(
        `/matches/${route.params.id}/penalties`
      ).catch((e) => ({ items: [], _err: e }));
      penalties.value = Array.isArray(pres.items) ? pres.items : [];
      penaltiesError.value = pres._err
        ? pres._err.message || 'Не удалось загрузить штрафы'
        : '';
    } else {
      penalties.value = [];
      penaltiesError.value = '';
    }
    // Prefill schedule form
    scheduleForm.value.dtLocal = toDateTimeLocal(match.value?.date_start);
    scheduleForm.value.groundId = match.value?.ground_details?.id || '';
    // Load staff and grounds lazily
    loadAux();
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
  } finally {
    loading.value = false;
    penaltiesLoading.value = false;
  }
});

async function loadAux() {
  staffLoading.value = true;
  staffError.value = '';
  try {
    const [home, away, gr] = await Promise.all([
      match.value?.team1_id
        ? apiFetch(`/teams/${match.value.team1_id}/staff`)
        : Promise.resolve({ users: [] }),
      match.value?.team2_id
        ? apiFetch(`/teams/${match.value.team2_id}/staff`)
        : Promise.resolve({ users: [] }),
      apiFetch('/grounds?limit=1000&order_by=name&order=ASC'),
    ]);
    homeStaff.value = home.users || [];
    awayStaff.value = away.users || [];
    grounds.value = Array.isArray(gr.grounds) ? gr.grounds : [];
  } catch (e) {
    staffError.value = e.message || 'Ошибка загрузки связанных данных';
  } finally {
    staffLoading.value = false;
  }
}

const kickoff = computed(() => formatKickoff(match.value?.date_start));
const statusAlias = computed(() =>
  (match.value?.status?.alias || '').toUpperCase()
);
const isCancelled = computed(() => statusAlias.value === 'CANCELLED');
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

async function submitSchedule() {
  scheduleError.value = '';
  submittingSchedule.value = true;
  try {
    const iso = fromDateTimeLocal(scheduleForm.value.dtLocal);
    await apiFetch(`/matches/admin/${route.params.id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_start: iso,
        ground_id: scheduleForm.value.groundId,
      }),
    });
    // Reload match and agreements to reflect updated state
    const [mres, ares] = await Promise.all([
      apiFetch(`/matches/${route.params.id}`),
      apiFetch(`/matches/${route.params.id}/agreements`),
    ]);
    match.value = mres.match || null;
    agreements.value = Array.isArray(ares.agreements) ? ares.agreements : [];
  } catch (e) {
    scheduleError.value = e.message || 'Не удалось сохранить расписание';
  } finally {
    submittingSchedule.value = false;
  }
}

// No side split/filters — timeline shows both teams

const penaltiesDisabled = computed(
  () => !!match.value?.double_protocol && match.value?.season_active === false
);
</script>

<template>
  <div class="py-3 admin-match-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/admin/sports-calendar">Календарь игр</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Матч</li>
        </ol>
      </nav>

      <h1 class="mb-3">{{ match?.team1 }} — {{ match?.team2 }}</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <!-- Admin menu tiles (structure aligned with client) -->
      <div class="card section-card mb-2 menu-section">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Управление матчем</h2>
          <div v-edge-fade class="scroll-container">
            <MenuTile
              title="Согласование времени"
              icon="bi-calendar-check"
              :to="`/school-matches/${route.params.id}/agreements`"
              :placeholder="isCancelled"
              :note="isCancelled ? 'Отмена' : ''"
            />
            <MenuTile
              title="Составы на матч"
              icon="bi-people"
              :to="`/school-matches/${route.params.id}/lineups`"
              :placeholder="isCancelled"
              :note="isCancelled ? 'Отмена' : ''"
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

      <!-- Broadcast links moved to stadium card below for unified UX -->

      <div v-if="!error" class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
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
            <!-- Broadcast links moved to a separate tile section -->
          </div>
        </div>
      </div>

      <!-- Schedule management -->
      <div id="schedule" class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="h5 mb-0">Управление расписанием</h2>
          </div>
          <div v-if="scheduleError" class="alert alert-danger">
            {{ scheduleError }}
          </div>
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-4">
              <label for="dt" class="form-label small text-muted"
                >Дата и время (МСК)</label
              >
              <input
                id="dt"
                v-model="scheduleForm.dtLocal"
                type="datetime-local"
                class="form-control"
                :disabled="submittingSchedule"
              />
            </div>
            <div class="col-12 col-md-5">
              <label for="ground" class="form-label small text-muted"
                >Стадион</label
              >
              <select
                id="ground"
                v-model="scheduleForm.groundId"
                class="form-select"
                :disabled="submittingSchedule"
              >
                <option value="">Выберите стадион</option>
                <option v-for="g in grounds" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
            </div>
            <div class="col-12 col-md-3 d-flex gap-2">
              <button
                class="btn btn-brand flex-grow-1"
                :disabled="
                  !scheduleForm.dtLocal ||
                  !scheduleForm.groundId ||
                  submittingSchedule
                "
                @click="submitSchedule"
              >
                <span
                  v-if="submittingSchedule"
                  class="spinner-border spinner-border-sm me-1"
                ></span>
                Утвердить расписание
              </button>
            </div>
          </div>
          <p class="text-muted small mt-2 mb-0">
            После утверждения расписание станет недоступным для изменения
            клубами и будет записано во внешнюю систему.
          </p>
        </div>
      </div>

      <!-- Broadcast section as tiles (admin) -->
      <div
        v-if="streamLinks.length"
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
              :title="
                streamLinks.length === 1
                  ? 'Прямой эфир'
                  : idx === 0
                    ? 'Трансляция (1-й состав)'
                    : idx === 1
                      ? 'Трансляция (2-й состав)'
                      : `Трансляция #${idx + 1}`
              "
              :to="s.url"
              :image-src="vkLogo"
              image-alt="VK Видео"
            />
          </div>
        </div>
      </div>

      <!-- Agreements timeline -->
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <h2 class="h5 mb-3">История согласований</h2>
          <AgreementTimeline :items="agreements" :actions-disabled="true" />
        </div>
      </div>

      <!-- Penalties block -->
      <div
        v-if="!penaltiesDisabled"
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

      <!-- Club staff -->
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <h2 class="h5 mb-3">Сотрудники клубов</h2>
          <div v-if="staffError" class="alert alert-danger">
            {{ staffError }}
          </div>
          <div v-else class="row g-3">
            <div class="col-12 col-md-6">
              <div class="mb-2 fw-semibold">
                Хозяева: {{ match?.home_club || match?.team1 }}
              </div>
              <ul class="list-unstyled mb-0">
                <li v-for="u in homeStaff" :key="u.id" class="mb-1">
                  {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                  <span v-if="u.email" class="text-muted small ms-1"
                    >· {{ u.email }}</span
                  >
                  <span v-if="u.phone" class="text-muted small ms-1"
                    >· {{ u.phone }}</span
                  >
                </li>
                <li v-if="!homeStaff.length" class="text-muted small">
                  Нет данных.
                </li>
              </ul>
            </div>
            <div class="col-12 col-md-6">
              <div class="mb-2 fw-semibold">
                Гости: {{ match?.away_club || match?.team2 }}
              </div>
              <ul class="list-unstyled mb-0">
                <li v-for="u in awayStaff" :key="u.id" class="mb-1">
                  {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                  <span v-if="u.email" class="text-muted small ms-1"
                    >· {{ u.email }}</span
                  >
                  <span v-if="u.phone" class="text-muted small ms-1"
                    >· {{ u.phone }}</span
                  >
                </li>
                <li v-if="!awayStaff.length" class="text-muted small">
                  Нет данных.
                </li>
              </ul>
            </div>
          </div>
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
</style>
