<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { apiFetch } from '../api';

const COMPETITION_ALIAS = 'PRO';

const metaSeason = ref(null);
const metaCompetitionType = ref(null);
const accesses = ref([]);
const candidates = ref([]);
const accessSearch = ref('');
const candidateSearch = ref('');
const selectedCandidateId = ref('');

const loadingMeta = ref(false);
const loadingAccesses = ref(false);
const loadingCandidates = ref(false);
const granting = ref(false);
const revokingId = ref('');

const error = ref('');
const actionError = ref('');
const actionSuccess = ref('');

let accessSearchTimer = null;
let candidateSearchTimer = null;

const loadingAny = computed(
  () => loadingMeta.value || loadingAccesses.value || loadingCandidates.value
);

const selectedCandidate = computed(() =>
  candidates.value.find(
    (candidate) => candidate.id === selectedCandidateId.value
  )
);

const canGrant = computed(
  () => Boolean(selectedCandidateId.value) && !granting.value
);

const seasonLabel = computed(() => {
  const season = metaSeason.value;
  if (!season) return 'Сезон не определён';
  return season.name || season.alias || 'Сезон не определён';
});

const competitionTypeLabel = computed(() => {
  const competitionType = metaCompetitionType.value;
  if (!competitionType) return 'Профессиональные лиги';
  return (
    competitionType.name || competitionType.alias || 'Профессиональные лиги'
  );
});

function normalizeSearch(value) {
  return String(value || '').trim();
}

function roleName(alias) {
  if (alias === 'REFEREE') return 'Судья в поле';
  if (alias === 'BRIGADE_REFEREE') return 'Судья в бригаде';
  return alias || '—';
}

function formatRoles(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (!roles.length) return '—';
  return roles.map((alias) => roleName(alias)).join(', ');
}

function formatName(user) {
  return [user?.last_name, user?.first_name, user?.patronymic]
    .filter(Boolean)
    .join(' ');
}

function formatCandidateLabel(user) {
  const name = formatName(user) || 'Без ФИО';
  const roles = formatRoles(user);
  const contacts = [user?.phone, user?.email].filter(Boolean).join(' · ');
  return [name, roles, contacts].filter(Boolean).join(' — ');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildBaseParams() {
  return new URLSearchParams({
    competition_alias: COMPETITION_ALIAS,
  });
}

function applyMeta(data) {
  if (!data || typeof data !== 'object') return;
  if (data.season) metaSeason.value = data.season;
  if (data.competition_type) metaCompetitionType.value = data.competition_type;
}

async function loadMeta() {
  loadingMeta.value = true;
  try {
    const params = buildBaseParams();
    const data = await apiFetch(`/leagues-access/meta/current?${params}`);
    applyMeta(data);
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные сезона';
  } finally {
    loadingMeta.value = false;
  }
}

async function loadAccesses() {
  loadingAccesses.value = true;
  try {
    const params = buildBaseParams();
    const search = normalizeSearch(accessSearch.value);
    if (search) params.set('search', search);
    const data = await apiFetch(`/leagues-access?${params}`);
    accesses.value = Array.isArray(data?.accesses) ? data.accesses : [];
    applyMeta(data);
  } catch (e) {
    accesses.value = [];
    error.value = e.message || 'Не удалось загрузить список допусков';
  } finally {
    loadingAccesses.value = false;
  }
}

async function loadCandidates() {
  loadingCandidates.value = true;
  try {
    const params = buildBaseParams();
    const search = normalizeSearch(candidateSearch.value);
    if (search) params.set('search', search);
    const data = await apiFetch(`/leagues-access/candidates?${params}`);
    candidates.value = Array.isArray(data?.users) ? data.users : [];
    applyMeta(data);
    if (
      selectedCandidateId.value &&
      !candidates.value.some((user) => user.id === selectedCandidateId.value)
    ) {
      selectedCandidateId.value = '';
    }
  } catch (e) {
    candidates.value = [];
    error.value = e.message || 'Не удалось загрузить кандидатов';
  } finally {
    loadingCandidates.value = false;
  }
}

async function grantAccess() {
  if (!selectedCandidateId.value || granting.value) return;
  granting.value = true;
  actionError.value = '';
  actionSuccess.value = '';
  try {
    await apiFetch('/leagues-access', {
      method: 'POST',
      body: JSON.stringify({
        user_id: selectedCandidateId.value,
        competition_alias: COMPETITION_ALIAS,
        season_mode: 'current',
      }),
    });
    selectedCandidateId.value = '';
    await Promise.all([loadAccesses(), loadCandidates()]);
    actionSuccess.value = 'Допуск выдан';
  } catch (e) {
    actionError.value = e.message || 'Не удалось выдать допуск';
  } finally {
    granting.value = false;
  }
}

async function revokeAccess(accessId) {
  if (!accessId || revokingId.value) return;
  revokingId.value = accessId;
  actionError.value = '';
  actionSuccess.value = '';
  try {
    await apiFetch(`/leagues-access/${accessId}`, {
      method: 'DELETE',
    });
    await Promise.all([loadAccesses(), loadCandidates()]);
    actionSuccess.value = 'Допуск отозван';
  } catch (e) {
    actionError.value = e.message || 'Не удалось отозвать допуск';
  } finally {
    revokingId.value = '';
  }
}

function queueAccessSearch() {
  if (accessSearchTimer) clearTimeout(accessSearchTimer);
  accessSearchTimer = setTimeout(() => {
    loadAccesses();
  }, 250);
}

function queueCandidateSearch() {
  if (candidateSearchTimer) clearTimeout(candidateSearchTimer);
  candidateSearchTimer = setTimeout(() => {
    loadCandidates();
  }, 250);
}

watch(accessSearch, () => {
  queueAccessSearch();
});

watch(candidateSearch, () => {
  queueCandidateSearch();
});

onMounted(async () => {
  await loadMeta();
  await Promise.all([loadAccesses(), loadCandidates()]);
});

onBeforeUnmount(() => {
  if (accessSearchTimer) clearTimeout(accessSearchTimer);
  if (candidateSearchTimer) clearTimeout(candidateSearchTimer);
});
</script>

<template>
  <div class="py-3 pro-leagues-access">
    <div class="container-fluid px-4">
      <h1 class="mb-2">Список судей</h1>
      <p class="text-muted mb-3">
        Управление допуском судей к матчам профессиональных лиг текущего сезона.
      </p>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
            <span class="badge bg-secondary-subtle text-secondary">
              Сезон: {{ seasonLabel }}
            </span>
            <span class="badge bg-primary-subtle text-primary">
              Соревнование: {{ competitionTypeLabel }}
            </span>
            <span class="badge bg-light text-muted">
              Допущено: {{ accesses.length }}
            </span>
            <span class="badge bg-light text-muted">
              Кандидатов: {{ candidates.length }}
            </span>
            <span
              v-if="loadingAny"
              class="badge bg-warning-subtle text-warning-emphasis"
            >
              Загрузка...
            </span>
          </div>

          <div class="row g-3 align-items-end">
            <div class="col-12 col-xl-4">
              <label class="form-label" for="candidate-search"
                >Поиск кандидатов</label
              >
              <input
                id="candidate-search"
                v-model="candidateSearch"
                type="search"
                class="form-control"
                placeholder="ФИО, телефон или email"
              />
            </div>
            <div class="col-12 col-xl-6">
              <label class="form-label" for="candidate-select"
                >Кандидат на допуск</label
              >
              <select
                id="candidate-select"
                v-model="selectedCandidateId"
                class="form-select"
              >
                <option value="">Выберите судью</option>
                <option
                  v-for="user in candidates"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ formatCandidateLabel(user) }}
                </option>
              </select>
            </div>
            <div class="col-12 col-xl-2 d-grid">
              <button
                type="button"
                class="btn btn-primary"
                :disabled="!canGrant"
                @click="grantAccess"
              >
                {{ granting ? 'Сохранение...' : 'Выдать допуск' }}
              </button>
            </div>
          </div>

          <div v-if="selectedCandidate" class="small text-muted mt-2">
            Выбран: {{ formatCandidateLabel(selectedCandidate) }}
          </div>

          <div v-if="actionError" class="text-danger small mt-2">
            {{ actionError }}
          </div>
          <div v-else-if="actionSuccess" class="text-success small mt-2">
            {{ actionSuccess }}
          </div>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="row g-3 align-items-end mb-3">
            <div class="col-12 col-xl-5">
              <label class="form-label" for="access-search"
                >Поиск допущенных судей</label
              >
              <input
                id="access-search"
                v-model="accessSearch"
                type="search"
                class="form-control"
                placeholder="ФИО, телефон или email"
              />
            </div>
          </div>

          <div v-if="accesses.length" class="table-responsive">
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Судья</th>
                  <th>Роли</th>
                  <th>Контакты</th>
                  <th>Добавлен</th>
                  <th class="text-end">Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="access in accesses" :key="access.id">
                  <td>{{ formatName(access.user) || '—' }}</td>
                  <td>{{ formatRoles(access.user) }}</td>
                  <td>
                    <div>{{ access.user?.phone || '—' }}</div>
                    <div class="text-muted small">
                      {{ access.user?.email || '—' }}
                    </div>
                  </td>
                  <td>{{ formatDateTime(access.created_at) }}</td>
                  <td class="text-end">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger"
                      :disabled="revokingId === access.id"
                      @click="revokeAccess(access.id)"
                    >
                      {{
                        revokingId === access.id ? 'Удаление...' : 'Отозвать'
                      }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-muted mb-0">
            Для текущего сезона допущенные судьи не найдены.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pro-leagues-access .table th,
.pro-leagues-access .table td {
  vertical-align: middle;
}
</style>
