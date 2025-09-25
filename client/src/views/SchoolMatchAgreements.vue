<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import ContactModal from '../components/ContactModal.vue';
import { apiFetch } from '../api';
import yandexLogo from '../assets/yandex-maps.svg';
import {
  MOSCOW_TZ,
  toDateTimeLocal,
  fromDateTimeLocal,
  formatKickoff,
  isMskMidnight,
} from '../utils/time';
import InfoItem from '../components/InfoItem.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import AgreementTimeline from '../components/AgreementTimeline.vue';
import EmptyState from '../components/EmptyState.vue';

const route = useRoute();

const match = ref(null);
const agreements = ref([]);
const loading = ref(true);
const error = ref('');

const matchPermissions = computed(() => match.value?.permissions || null);
const isAgreementsAllowed = computed(
  () => matchPermissions.value?.agreements?.allowed !== false
);
const groups = ref([]); // grounds grouped by club (always home team grounds)
const groundId = ref('');
const timeStr = ref(''); // HH:MM in MSK
const submitting = ref(false);
const allowGuestGroundSelection = ref(false);

const pending = computed(() =>
  agreements.value.find((a) => a.MatchAgreementStatus?.alias === 'PENDING')
);
const acceptedExists = computed(() =>
  agreements.value.some((a) => a.MatchAgreementStatus?.alias === 'ACCEPTED')
);
const isHome = computed(() => Boolean(match.value?.is_home));
const isAway = computed(() => Boolean(match.value?.is_away));
const isParticipant = computed(() => isHome.value || isAway.value);
const isPast = computed(() => {
  const iso = match.value?.date_start;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t <= Date.now();
});
const isLocked = computed(() => Boolean(match.value?.schedule_locked_by_admin));
const statusAlias = computed(() =>
  (match.value?.status?.alias || '').toUpperCase()
);
const isCancelled = computed(() => statusAlias.value === 'CANCELLED');
const pageTitle = computed(() => {
  const a = match.value?.team1 || '';
  const b = match.value?.team2 || '';
  return [a, b].filter(Boolean).join(' — ');
});
const kickoffDate = computed(() => new Date(match.value?.date_start || 0));
const kickoff = computed(() => formatKickoff(match.value?.date_start));
const kickoffDateStr = computed(() => kickoff.value.date || '');
const kickoffTimeStr = computed(() => kickoff.value.time || '');
const kickoffHeader = computed(() => {
  const iso = match.value?.date_start;
  if (!iso) return '';
  if (isMskMidnight(iso)) return kickoffDateStr.value;
  return `${kickoffTimeStr.value || '—:—'} • ${kickoffDateStr.value}`;
});
const daysLeft = computed(() => {
  if (!kickoffDate.value || Number.isNaN(+kickoffDate.value)) return null;
  const now = new Date();
  const ms = kickoffDate.value.getTime() - now.getTime();
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  return d >= 0 ? d : null;
});
// Availability helpers
const hasAvailableGrounds = computed(() =>
  (groups.value || []).some(
    (grp) => Array.isArray(grp.grounds) && grp.grounds.length > 0
  )
);
const multiClubGrounds = computed(
  () =>
    (groups.value || []).filter(
      (grp) => Array.isArray(grp.grounds) && grp.grounds.length > 0
    ).length > 1
);
const statusChip = computed(() => {
  if (acceptedExists.value)
    return {
      text: 'Согласовано',
      cls: 'bg-success-subtle text-success border',
    };
  if (pending.value)
    return {
      text: 'Ожидает согласования',
      cls: 'bg-warning-subtle text-warning border',
    };
  return {
    text: 'Не согласовано',
    cls: 'bg-secondary-subtle text-secondary border',
  };
});
// Sticky compact header toggle
const compactHeader = ref(false);
function onScroll() {
  try {
    compactHeader.value =
      (typeof window !== 'undefined' ? window.scrollY : 0) > 140;
  } catch {
    compactHeader.value = false;
  }
}
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
});
const canShowHomeProposal = computed(
  () =>
    isHome.value &&
    !acceptedExists.value &&
    !pending.value &&
    hasAvailableGrounds.value &&
    Boolean(match.value?.date_start) &&
    !isPast.value &&
    !isLocked.value &&
    !isCancelled.value
);

const stadiumAddress = computed(
  () => match.value?.ground_details?.address || ''
);
const stadiumName = computed(
  () => match.value?.ground_details?.name || match.value?.ground || ''
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
const showArenaCard = computed(() => {
  const name = (stadiumName.value || '').trim().toLowerCase();
  return Boolean(stadiumName.value) && name !== 'согласовывается';
});

const clubOptions = computed(() => {
  const map = new Map();
  for (const grp of groups.value || []) {
    const clubName = grp.club?.name || '';
    const suffix =
      typeof grp.club?.is_moscow === 'boolean'
        ? grp.club.is_moscow
          ? ' (Москва)'
          : ' (Регион)'
        : '';
    const label = `${clubName}${suffix}`.trim();
    if (!map.has(label)) map.set(label, []);
    for (const g of grp.grounds || [])
      map.get(label).push({ id: g.id, name: g.name });
  }
  const res = [];
  for (const [club, list] of map.entries()) {
    res.push({
      club,
      grounds: list.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    });
  }
  return res.sort((a, b) => a.club.localeCompare(b.club, 'ru'));
});

function buildDateStartUtc() {
  if (!match.value || !timeStr.value) return null;
  const local = toDateTimeLocal(match.value.date_start, MOSCOW_TZ); // YYYY-MM-DDTHH:MM
  const dateOnly = local ? local.slice(0, 10) : '';
  if (!dateOnly) return null;
  return fromDateTimeLocal(`${dateOnly}T${timeStr.value}`);
}

function normalizeGroup(rawGroup) {
  if (!rawGroup) return null;
  const club =
    rawGroup.club && typeof rawGroup.club === 'object'
      ? {
          id: rawGroup.club.id || null,
          name: rawGroup.club.name || '',
          is_moscow:
            typeof rawGroup.club.is_moscow === 'boolean'
              ? rawGroup.club.is_moscow
              : null,
        }
      : null;
  const grounds = Array.isArray(rawGroup.grounds)
    ? rawGroup.grounds
        .map((g) => ({ id: g.id, name: g.name }))
        .filter((g) => g.id && g.name)
    : [];
  if (!grounds.length) return null;
  return { club, grounds };
}

function setGroundGroups(rawGroups) {
  const previous = groundId.value;
  const normalized = (Array.isArray(rawGroups) ? rawGroups : [])
    .map(normalizeGroup)
    .filter(Boolean);

  if (!normalized.length) {
    groups.value = [];
    groundId.value = '';
    return;
  }

  groups.value = normalized;
  const flat = normalized.flatMap((grp) => grp.grounds);
  const stillAvailable = flat.some((g) => g.id === previous);
  groundId.value = stillAvailable ? previous : flat[0]?.id || '';
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const mres = await apiFetch(`/matches/${route.params.id}`);
    match.value = mres.match || null;
    if (!isAgreementsAllowed.value) {
      agreements.value = [];
      groups.value = [];
      groundId.value = '';
      return;
    }
    const ares = await apiFetch(`/matches/${route.params.id}/agreements`);
    agreements.value = (ares.agreements || []).map((a) => a);
    // Fetch available grounds only for participants (to avoid 403 and noisy UX)
    if (isParticipant.value) {
      try {
        const gres = await apiFetch(
          `/matches/${route.params.id}/available-grounds`
        );
        allowGuestGroundSelection.value = Boolean(
          gres.allow_guest_ground_selection
        );
        const rawGroups =
          Array.isArray(gres.groups) && gres.groups.length
            ? gres.groups
            : (() => {
                const gg = Array.isArray(gres.grounds) ? gres.grounds : [];
                if (!gg.length) return [];
                return [
                  {
                    club: gres.club || null,
                    grounds: gg,
                  },
                ];
              })();
        setGroundGroups(rawGroups);
      } catch (e) {
        // Do not surface error to user; keep grounds empty if forbidden
        groups.value = [];
        groundId.value = '';
        allowGuestGroundSelection.value = false;
      }
    } else {
      groups.value = [];
      groundId.value = '';
      allowGuestGroundSelection.value = false;
    }
    if (match.value?.date_start) {
      const local = toDateTimeLocal(match.value.date_start, MOSCOW_TZ);
      timeStr.value = local?.slice(11, 16) || '';
    }
    await loadContacts();
  } catch (e) {
    // Show friendly error; mask low-level forbidden
    const msg = String(e?.message || 'Ошибка загрузки данных');
    error.value = /forbidden/i.test(msg)
      ? 'Недоступно: вы не участник этого матча'
      : msg;
  } finally {
    loading.value = false;
  }
}

async function submitProposal(parentId = null) {
  submitting.value = true;
  error.value = '';
  if (!isParticipant.value) {
    error.value = 'Недоступно: вы не участник этого матча';
    submitting.value = false;
    return;
  }
  try {
    const body = {
      ground_id: groundId.value,
      date_start: buildDateStartUtc(),
      ...(parentId ? { parent_id: parentId } : {}),
    };
    await apiFetch(`/matches/${route.params.id}/agreements`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await loadAll();
  } catch (e) {
    error.value = e.message || 'Не удалось создать предложение';
  } finally {
    submitting.value = false;
  }
}

async function approve(agreementId) {
  submitting.value = true;
  error.value = '';
  if (!isParticipant.value) {
    error.value = 'Недоступно: вы не участник этого матча';
    submitting.value = false;
    return;
  }
  try {
    await apiFetch(
      `/matches/${route.params.id}/agreements/${agreementId}/approve`,
      { method: 'POST' }
    );
    await loadAll();
  } catch (e) {
    error.value = e.message || 'Не удалось согласовать';
  } finally {
    submitting.value = false;
  }
}

function confirmDecline(agreementId) {
  if (typeof window !== 'undefined') {
    const ok = window.confirm('Отклонить это предложение?');
    if (!ok) return;
  }
  decline(agreementId);
}

async function decline(agreementId) {
  submitting.value = true;
  error.value = '';
  if (!isParticipant.value) {
    error.value = 'Недоступно: вы не участник этого матча';
    submitting.value = false;
    return;
  }
  try {
    await apiFetch(
      `/matches/${route.params.id}/agreements/${agreementId}/decline`,
      { method: 'POST' }
    );
    await loadAll();
  } catch (e) {
    error.value = e.message || 'Не удалось отклонить';
  } finally {
    submitting.value = false;
  }
}

async function withdraw(agreementId) {
  submitting.value = true;
  error.value = '';
  if (!isParticipant.value) {
    error.value = 'Недоступно: вы не участник этого матча';
    submitting.value = false;
    return;
  }
  try {
    await apiFetch(
      `/matches/${route.params.id}/agreements/${agreementId}/withdraw`,
      { method: 'POST' }
    );
    await loadAll();
  } catch (e) {
    error.value = e.message || 'Не удалось отозвать предложение';
  } finally {
    submitting.value = false;
  }
}

onMounted(loadAll);

// Contacts modal & helpers (opponent team contacts)
const contactModalRef = ref(null);
const contacts = ref([]);

function openContactModal(c) {
  contactModalRef.value?.open(c);
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  return digits ? `tel:+${digits}` : '#';
}

async function loadContacts() {
  try {
    const data = await apiFetch(
      `/matches/${route.params.id}/opponent-contacts`
    );
    const list = Array.isArray(data.users) ? data.users : [];
    contacts.value = list.map((u) => ({
      name: [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' '),
      title: 'Сотрудник команды',
      phone: u.phone || '',
      email: u.email || '',
    }));
  } catch {
    // ignore errors
  }
}
</script>

<template>
  <div class="py-3 school-match-agreements-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Матчи', to: '/school-matches' },
          { label: 'Матч', to: `/school-matches/${route.params.id}` },
          { label: 'Время и место' },
        ]"
      />
      <h1 class="mb-3">{{ pageTitle || 'Матч' }}</h1>
      <div
        v-if="!loading && match && !isParticipant"
        class="alert alert-warning d-flex align-items-center"
        role="alert"
      >
        <i class="bi bi-info-circle me-2" aria-hidden="true"></i>
        <div>
          Недоступно: вы не участник этого матча. Для действий по согласованию
          требуется привязка к команде.
        </div>
      </div>

      <!-- Sticky compact status bar -->
      <div v-if="compactHeader" class="sticky-status shadow-sm">
        <div
          class="d-flex align-items-center justify-content-between gap-2 flex-wrap"
        >
          <div class="text-truncate">
            <span class="me-2">{{ pageTitle || 'Матч' }}</span>
            <span class="text-muted small me-2">{{ kickoffHeader }}</span>
          </div>
          <span class="badge" :class="statusChip.cls">{{
            statusChip.text
          }}</span>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>
      <BrandSpinner v-else-if="loading" label="Загрузка" />

      <template v-else-if="isAgreementsAllowed">
        <!-- Header: Teams, datetime, meta, side marker -->
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div v-if="isCancelled" class="alert alert-warning" role="alert">
              Матч отменён. Действия по согласованию недоступны.
            </div>
            <div
              class="d-flex justify-content-between align-items-start flex-wrap gap-2"
            >
              <div>
                <div class="kickoff-display m-0 lh-1">{{ kickoffHeader }}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span
                  v-if="isHome"
                  class="badge bg-primary-subtle text-primary border"
                  >Вы — хозяева</span
                >
                <span
                  v-if="isAway"
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

        <!-- Stadium details merged into header to reduce duplication -->

        <!-- Arena card (single source of truth for venue) -->
        <div
          v-if="showArenaCard"
          class="card section-card tile fade-in shadow-sm mb-3 ground-card"
          aria-label="Площадка проведения"
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
              <div class="d-flex gap-3 flex-wrap mt-2 align-items-center">
                <a
                  v-if="stadiumLink"
                  :href="stadiumLink"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-sm btn-outline-brand d-inline-flex align-items-center gap-2"
                  :aria-label="`Открыть локацию стадиона в Яндекс.Картах: ${stadiumName}`"
                >
                  <img :src="yandexLogo" alt="Яндекс.Карты" height="18" />
                  Показать на карте
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Two-column layout: propose (left) and decision/history (right) -->
        <div class="row g-3" :aria-disabled="!isParticipant">
          <div v-if="canShowHomeProposal" class="col-12 col-xl-5">
            <div class="card section-card tile fade-in shadow-sm h-100">
              <div
                class="card-header d-flex justify-content-between align-items-center"
              >
                <span>Предложить время и площадку</span>
                <small v-if="!isPast" class="text-muted"
                  >Дата фиксирована</small
                >
              </div>
              <div class="card-body">
                <div
                  v-if="isPast"
                  class="alert alert-secondary d-flex align-items-center py-2 px-3 mb-3"
                  role="status"
                >
                  <i class="bi bi-info-circle me-2" aria-hidden="true"></i>
                  <div>
                    Матч уже прошёл. Действия по согласованию недоступны.
                  </div>
                </div>

                <div class="mb-3">
                  <div class="row g-3">
                    <div class="col-12">
                      <label class="form-label">Площадка</label>
                      <select
                        v-model="groundId"
                        class="form-select"
                        aria-label="Выбор стадиона"
                      >
                        <optgroup
                          v-for="grp in clubOptions"
                          :key="grp.club || '—'"
                          :label="grp.club || '—'"
                        >
                          <option
                            v-for="g in grp.grounds"
                            :key="g.id"
                            :value="g.id"
                          >
                            {{ g.name }}
                          </option>
                        </optgroup>
                      </select>
                    </div>
                    <div
                      v-if="allowGuestGroundSelection && multiClubGrounds"
                      class="col-12"
                    >
                      <p class="text-muted small mb-0">
                        Доступны площадки обеих команд: можно выбрать стадион
                        хозяев или гостей.
                      </p>
                    </div>
                    <div class="col-12">
                      <label class="form-label">Время</label>
                      <input
                        v-model="timeStr"
                        type="time"
                        step="60"
                        class="form-control"
                      />
                    </div>
                  </div>
                  <div class="d-flex gap-2 mt-3">
                    <button
                      class="btn btn-brand"
                      :disabled="submitting || !groundId || !timeStr"
                      @click="submitProposal(null)"
                    >
                      <span
                        v-if="submitting"
                        class="spinner-border spinner-border-sm me-2"
                      ></span>
                      Предложить
                    </button>
                  </div>
                  <p class="text-muted small mb-0 mt-2">
                    Одновременно может быть только одно ожидающее предложение.
                  </p>
                </div>

                <!-- removed mini-timeline to avoid duplication -->
              </div>
            </div>
          </div>

          <div :class="[canShowHomeProposal ? 'col-12 col-xl-7' : 'col-12']">
            <div class="card section-card tile fade-in shadow-sm h-100">
              <div
                class="card-header d-flex justify-content-between align-items-center"
              >
                <span>Принять решение</span>
                <small class="text-muted"
                  >Выберите один из предложенных вариантов</small
                >
              </div>
              <div class="card-body">
                <div
                  v-if="isLocked"
                  class="alert alert-secondary d-flex align-items-center py-2 px-3 mb-3"
                  role="status"
                >
                  <i class="bi bi-shield-lock me-2" aria-hidden="true"></i>
                  <div>
                    Расписание утверждено администратором. Действия по
                    согласованию недоступны.
                  </div>
                </div>
                <div
                  v-else-if="!isParticipant"
                  class="alert alert-warning d-flex align-items-center py-2 px-3 mb-3"
                  role="status"
                >
                  <i class="bi bi-info-circle me-2" aria-hidden="true"></i>
                  <div>
                    Недоступно: вы не участник этого матча. Действия по
                    согласованию скрыты.
                  </div>
                </div>
                <AgreementTimeline
                  :items="agreements"
                  :is-home="isHome"
                  :is-away="isAway"
                  :submitting="submitting"
                  :actions-disabled="
                    !isParticipant || isPast || isLocked || isCancelled
                  "
                  @approve="approve"
                  @decline="confirmDecline"
                  @withdraw="withdraw"
                />
                <!-- removed hint to reduce noise -->
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="contacts.length"
          class="card section-card tile fade-in shadow-sm mt-3"
        >
          <div class="card-body p-0">
            <h2 class="h6 mb-0 px-3 pt-3">Контакты команды</h2>
            <div
              v-for="c in contacts"
              :key="c.email + c.phone + c.name"
              class="d-flex align-items-center p-3 cursor-pointer"
              role="button"
              tabindex="0"
              :aria-label="`Открыть контакты: ${c.name}`"
              @click="openContactModal(c)"
              @keydown.enter.prevent="openContactModal(c)"
              @keydown.space.prevent="openContactModal(c)"
            >
              <div
                class="flex-shrink-0 me-3 rounded-circle bg-light d-flex align-items-center justify-content-center"
                style="width: 3rem; height: 3rem"
              >
                <i class="bi bi-person-fill text-muted fs-3"></i>
              </div>
              <div>
                <div>{{ c.name }}</div>
                <div class="text-muted small">{{ c.title }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modals -->
        <ContactModal ref="contactModalRef" />
      </template>

      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <EmptyState
            icon="bi-lock-fill"
            title="Доступ ограничен"
            description="Раздел доступен сотрудникам с расширенными правами."
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mobile spacing handled globally */
</style>
<style scoped>
.kickoff-display {
  /* Smaller, calmer typography under the page title */
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 400;
}
.sticky-status {
  position: sticky;
  top: 0;
  z-index: 1020;
  background: var(--bs-body-bg, #fff);
  border: 1px solid var(--border-subtle, #dfe5ec);
  border-radius: var(--radius-tile, 0.5rem);
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
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
}
</style>
