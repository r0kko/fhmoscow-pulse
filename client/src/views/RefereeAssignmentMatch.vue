<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import InfoItem from '../components/InfoItem.vue';
import { apiFetch } from '../api';
import { auth } from '../auth';
import { formatKickoff, isMskMidnight } from '../utils/time';
import { formatRussianPhone, normalizeRussianPhone } from '../utils/personal';
import yandexLogo from '../assets/yandex-maps.svg';
import { withHttp } from '../utils/url';

const route = useRoute();
const match = ref(null);
const loading = ref(true);
const error = ref('');

const breadcrumbs = computed(() => [
  { label: 'Главная', to: '/' },
  { label: 'Назначения', to: '/referee-assignments' },
  { label: 'Матч', disabled: true },
]);

const kickoff = computed(() => formatKickoff(match.value?.date_start || null));
const kickoffHeader = computed(() => {
  const iso = match.value?.date_start || null;
  if (!iso) return '';
  if (isMskMidnight(iso)) return kickoff.value.date;
  return `${kickoff.value.time} • ${kickoff.value.date}`;
});

const matchTitle = computed(() => {
  const home = match.value?.team1?.name || '—';
  const away = match.value?.team2?.name || '—';
  return `${home} — ${away}`;
});

const statusChip = computed(() => {
  const text = match.value?.status?.name;
  if (!text) return null;
  const alias = (match.value?.status?.alias || '').toUpperCase();
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
const stadiumName = computed(() => match.value?.ground?.name || '');
const stadiumAddress = computed(() => match.value?.ground?.address || '');
const stadiumLink = computed(() =>
  withHttp(match.value?.ground?.yandex_url || '')
);
const arenaMetro = computed(() => {
  const raw = match.value?.ground?.metro;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => entry?.name || entry?.station || '')
    .filter(Boolean)
    .slice(0, 3);
});
const showStadiumCard = computed(() => {
  const name = stadiumName.value || '';
  if (!name) return true;
  return name !== 'Согласовывается';
});

const currentUserId = computed(() => auth.user?.id || '');

const crewEntries = computed(() => {
  const list = Array.isArray(match.value?.assignments)
    ? match.value.assignments
    : [];
  return list
    .filter((assignment) => assignment?.user?.id)
    .map((assignment) => {
      const user = assignment.user;
      const digits = normalizeRussianPhone(user?.phone);
      return {
        id: assignment.id,
        role: assignment.role || null,
        userId: user.id,
        userLabel: refereeLabel(user),
        phoneDigits: digits,
        phoneFormatted: formatRussianPhone(user?.phone),
      };
    })
    .sort((a, b) => {
      const groupA = a.role?.group_name || '';
      const groupB = b.role?.group_name || '';
      const groupCompare = groupA.localeCompare(groupB, 'ru', {
        sensitivity: 'base',
      });
      if (groupCompare !== 0) return groupCompare;
      const roleA = a.role?.name || '';
      const roleB = b.role?.name || '';
      const roleCompare = roleA.localeCompare(roleB, 'ru', {
        sensitivity: 'base',
      });
      if (roleCompare !== 0) return roleCompare;
      return a.userLabel.localeCompare(b.userLabel, 'ru', {
        sensitivity: 'base',
      });
    });
});

const crewGroups = computed(() => {
  const groups = new Map();
  crewEntries.value.forEach((entry) => {
    const title = entry.role?.group_name || 'Судейская бригада';
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(entry);
  });
  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    items,
  }));
});

const showGroupTitles = computed(() => crewGroups.value.length > 1);

function refereeLabel(user) {
  if (!user) return '—';
  const last = user.last_name || '';
  const first = user.first_name || '';
  const patronymic = user.patronymic || '';
  const initials = [first, patronymic]
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}.`)
    .join(' ');
  return [last, initials].filter(Boolean).join(' ').trim() || '—';
}

async function loadMatch() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiFetch(
      `/referee-assignments/my/matches/${route.params.id}`
    );
    match.value = data.match || null;
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить матч';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadMatch();
});
</script>

<template>
  <div class="py-3 referee-match-page">
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
      <div v-else-if="!match" class="alert alert-light border small mb-0">
        Матч не найден.
      </div>
      <template v-else>
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div
              class="d-flex justify-content-between align-items-start flex-wrap gap-2"
            >
              <div>
                <div class="kickoff-display m-0 lh-1">
                  {{ kickoffHeader }}
                </div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span v-if="statusChip" class="badge" :class="statusChip.cls">
                  {{ statusChip.text }}
                </span>
              </div>
            </div>
            <div class="mt-2">
              <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-2">
                <div v-if="match?.season?.name" class="col">
                  <InfoItem label="Сезон" :value="match.season.name" />
                </div>
                <div
                  v-if="
                    match?.tournament?.short_name || match?.tournament?.name
                  "
                  class="col"
                >
                  <InfoItem
                    label="Турнир"
                    :value="
                      match.tournament.short_name || match.tournament.name
                    "
                  />
                </div>
                <div v-if="match?.stage?.name" class="col">
                  <InfoItem label="Этап" :value="match.stage.name" />
                </div>
                <div v-if="match?.group?.name" class="col">
                  <InfoItem label="Группа" :value="match.group.name" />
                </div>
                <div v-if="match?.tour?.name" class="col">
                  <InfoItem label="Тур" :value="match.tour.name" />
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

        <div class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <div class="crew-header">
              <h2 class="h5 mb-0">Судейская бригада</h2>
            </div>
            <div v-if="crewEntries.length === 0" class="text-muted small">
              Состав бригады пока не опубликован.
            </div>
            <div v-else>
              <div
                v-for="group in crewGroups"
                :key="group.title"
                class="crew-group"
              >
                <div v-if="showGroupTitles" class="crew-group-title">
                  {{ group.title }}
                </div>
                <div class="crew-list">
                  <div
                    v-for="entry in group.items"
                    :key="entry.id"
                    class="crew-row"
                  >
                    <div class="crew-role">
                      {{ entry.role?.name || 'Роль не указана' }}
                    </div>
                    <div
                      class="crew-name"
                      :class="{
                        'is-current-user': entry.userId === currentUserId,
                      }"
                    >
                      {{ entry.userLabel }}
                    </div>
                    <div class="crew-phone text-muted">
                      {{ entry.phoneFormatted || 'Телефон не указан' }}
                    </div>
                    <a
                      v-if="entry.phoneDigits"
                      :href="`tel:+${entry.phoneDigits}`"
                      class="btn btn-sm btn-outline-brand crew-call"
                      :aria-label="`Позвонить ${entry.userLabel}`"
                    >
                      <i class="bi bi-telephone me-1" aria-hidden="true"></i>
                      Позвонить
                    </a>
                    <button
                      v-else
                      type="button"
                      class="btn btn-sm btn-outline-secondary crew-call"
                      disabled
                    >
                      Телефон не указан
                    </button>
                  </div>
                </div>
              </div>
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

.crew-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.crew-group + .crew-group {
  margin-top: 1rem;
}

.crew-group-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  margin-bottom: 0.35rem;
}

.crew-list {
  display: grid;
  gap: 0.5rem;
}

.crew-row {
  display: grid;
  grid-template-columns:
    minmax(140px, 1fr) minmax(160px, 1.2fr)
    minmax(140px, 1fr) auto;
  gap: 0.5rem 1rem;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.crew-row:last-child {
  border-bottom: 0;
}

.crew-role {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
}

.crew-name {
  font-weight: 600;
}

.crew-name.is-current-user {
  color: var(--brand-color, #113867);
}

.crew-phone {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.crew-call {
  justify-self: end;
  white-space: nowrap;
}

@media (max-width: 767.98px) {
  .crew-row {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
  .crew-call {
    justify-self: start;
  }
}
</style>
