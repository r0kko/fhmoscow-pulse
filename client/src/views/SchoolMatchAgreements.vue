<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import ContactModal from '../components/ContactModal.vue';
import { apiFetch } from '../api.js';
import {
  MOSCOW_TZ,
  toDateTimeLocal,
  fromDateTimeLocal,
} from '../utils/time.js';
import BrandSpinner from '../components/BrandSpinner.vue';
import AgreementTimeline from '../components/AgreementTimeline.vue';

const route = useRoute();

const match = ref(null);
const agreements = ref([]);
const loading = ref(true);
const error = ref('');

const groups = ref([]); // grounds grouped by club (always home team grounds)
const groundId = ref('');
const timeStr = ref(''); // HH:MM in MSK
const submitting = ref(false);

const pending = computed(() =>
  agreements.value.find((a) => a.MatchAgreementStatus?.alias === 'PENDING')
);
const acceptedExists = computed(() =>
  agreements.value.some((a) => a.MatchAgreementStatus?.alias === 'ACCEPTED')
);
const isHome = computed(() => Boolean(match.value?.is_home));
const isAway = computed(() => Boolean(match.value?.is_away));
const isPast = computed(() => {
  const iso = match.value?.date_start;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t <= Date.now();
});
// Availability helpers
const hasAvailableGrounds = computed(() =>
  (groups.value || []).some(
    (grp) => Array.isArray(grp.grounds) && grp.grounds.length > 0
  )
);
const canShowHomeProposal = computed(
  () =>
    isHome.value &&
    !acceptedExists.value &&
    !pending.value &&
    hasAvailableGrounds.value &&
    Boolean(match.value?.date_start) &&
    !isPast.value
);

function formatMoscowTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MOSCOW_TZ,
  });
}

const clubOptions = computed(() => {
  const map = new Map();
  for (const grp of groups.value || []) {
    const club = grp.club?.name || '';
    if (!map.has(club)) map.set(club, []);
    for (const g of grp.grounds || [])
      map.get(club).push({ id: g.id, name: g.name });
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

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const [mres, ares, gres] = await Promise.all([
      apiFetch(`/matches/${route.params.id}`),
      apiFetch(`/matches/${route.params.id}/agreements`),
      apiFetch(`/matches/${route.params.id}/available-grounds`),
    ]);
    match.value = mres.match || null;
    agreements.value = (ares.agreements || []).map((a) => a);
    const gg = Array.isArray(gres.grounds) ? gres.grounds : [];
    const clubName = gres.club?.name || '';
    groups.value = gg.length ? [{ club: { name: clubName }, grounds: gg }] : [];
    groundId.value = gg[0]?.id || '';
    if (match.value?.date_start) {
      const local = toDateTimeLocal(match.value.date_start, MOSCOW_TZ);
      timeStr.value = local?.slice(11, 16) || '';
    }
    await loadContacts();
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
  } finally {
    loading.value = false;
  }
}

async function submitProposal(parentId = null) {
  submitting.value = true;
  error.value = '';
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
      <!-- Breadcrumbs and page title intentionally removed per requirements -->

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>
      <BrandSpinner v-else-if="loading" label="Загрузка" />

      <template v-else>
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div
              class="d-flex justify-content-between align-items-start flex-wrap gap-2"
            >
              <div>
                <div class="h5 mb-1">
                  {{ match?.team1 }} — {{ match?.team2 }}
                </div>
                <div class="text-muted small">
                  {{
                    new Date(match?.date_start).toLocaleDateString('ru-RU', {
                      dateStyle: 'long',
                      timeZone: MOSCOW_TZ,
                    })
                  }},
                  {{
                    new Date(match?.date_start).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: MOSCOW_TZ,
                    })
                  }}
                  <span class="ms-2">{{ match?.ground || '—' }}</span>
                </div>
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
              </div>
            </div>
            <div
              v-if="acceptedExists"
              class="alert alert-success d-flex align-items-center py-2 px-3 mt-3"
              role="status"
            >
              <i class="bi bi-check-circle-fill me-2" aria-hidden="true"></i>
              <div>Согласование завершено.</div>
            </div>
            <div
              v-else-if="pending"
              class="alert alert-warning d-flex align-items-center py-2 px-3 mt-3"
              role="status"
            >
              <i class="bi bi-hourglass-split me-2" aria-hidden="true"></i>
              <div>
                Ожидает согласования
                {{
                  pending.MatchAgreementType?.alias === 'HOME_PROPOSAL'
                    ? 'командой гостей'
                    : 'командой хозяев'
                }}.
              </div>
            </div>
            <div
              v-if="isPast"
              class="alert alert-secondary d-flex align-items-center py-2 px-3 mt-3"
              role="status"
            >
              <i class="bi bi-info-circle me-2" aria-hidden="true"></i>
              <div>Матч уже прошёл. Действия по согласованию недоступны.</div>
            </div>
          </div>
        </div>

        <div class="row g-3">
          <div v-if="canShowHomeProposal" class="col-12 col-lg-6">
            <div class="card section-card tile fade-in shadow-sm h-100">
              <div
                class="card-header d-flex justify-content-between align-items-center"
              >
                <span>Новое предложение</span>
                <small class="text-muted"
                  >Дата матча фиксирована; указывается время (МСК)</small
                >
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Стадион</label>
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
                <div class="mb-3">
                  <label class="form-label">Время (МСК)</label>
                  <input
                    v-model="timeStr"
                    type="time"
                    step="60"
                    class="form-control"
                  />
                </div>
                <div class="d-flex gap-2">
                  <button
                    class="btn btn-brand"
                    :disabled="submitting || !groundId || !timeStr"
                    @click="submitProposal(null)"
                  >
                    <span
                      v-if="submitting"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Отправить предложение
                  </button>
                </div>
                <p class="text-muted small mb-0 mt-2">
                  Вы можете отправить одновремéнно только одно ожидающее
                  предложение.
                </p>
              </div>
            </div>
          </div>

          <div class="col-12 col-lg-6">
            <div class="card section-card tile fade-in shadow-sm h-100">
              <div class="card-header">История согласований</div>
              <div class="card-body">
                <AgreementTimeline
                  :items="agreements"
                  :is-home="isHome"
                  :is-away="isAway"
                  :submitting="submitting"
                  :actions-disabled="isPast"
                  @approve="approve"
                  @decline="confirmDecline"
                  @withdraw="withdraw"
                />
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
    </div>
  </div>
</template>

<style scoped>
/* Mobile full-bleed like Home/Camps */
@media (max-width: 575.98px) {
  .school-match-agreements-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }
  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>
