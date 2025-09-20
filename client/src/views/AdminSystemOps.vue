<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch, API_BASE } from '../api.js';
import BrandSpinner from '../components/BrandSpinner.vue';

const loading = ref(true);
const error = ref('');
const jobs = ref({});
const running = ref({ syncAll: false });
const triggering = ref(false);
const notice = ref('');
const history = ref([]);

// Taxation block state
const taxJobs = ref({});
const taxRunning = ref({ taxation: false });
const taxTriggering = ref(false);
const taxNotice = ref('');
let refreshTimer = null;

// Penalties backfill & deletion actions
const penaltyTriggering = ref(false);
const penaltyNotice = ref('');
const deletionTriggering = ref(false);
const deletionNotice = ref('');
const penaltyParams = ref({ daysBack: 14, daysAhead: 7, limit: 400 });
const deletionParams = ref({ batchSize: 1000, maxBatches: 50 });

const reports = {
  jobRuns(days = 30) {
    return `${API_BASE}/reports/job-runs.csv?days=${days}`;
  },
};

function resolveGrafanaBase() {
  const raw =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_GRAFANA_URL) ||
    '';
  if (!raw) return '';
  try {
    const base = raw.startsWith('http')
      ? new URL(raw)
      : new URL(raw, 'http://localhost');
    const origin = `${base.protocol}//${base.host}`;
    const pathname = base.pathname.replace(/\/+$/, '');
    return `${origin}${pathname}`.replace(/\/+$/, '');
  } catch (_e) {
    return raw.replace(/\/+$/, '');
  }
}

const grafanaHttpErrorsLink = computed(() => {
  const direct =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_GRAFANA_HTTP_ERRORS_DASHBOARD) ||
    '';
  if (direct) return direct;
  const base = resolveGrafanaBase();
  if (!base) return '';
  const path =
    '/d/pulse-app-http-drill/app-http-drill?var-status=5xx&from=now-7d&to=now';
  return `${base}${path}`;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [syncRes, taxRes] = await Promise.all([
      apiFetch('/admin-ops/sync/status'),
      apiFetch('/admin-ops/taxation/status'),
    ]);
    jobs.value = syncRes.jobs || {};
    running.value = syncRes.running || { syncAll: false };
    history.value = Array.isArray(syncRes.logs) ? syncRes.logs : [];
    taxJobs.value = taxRes.jobs || {};
    taxRunning.value = taxRes.running || { taxation: false };
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
}

function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleString('ru-RU', { hour12: false });
}

async function runPenaltyWindowSync() {
  penaltyTriggering.value = true;
  error.value = '';
  penaltyNotice.value = '';
  try {
    await apiFetch('/admin-ops/penalties/sync-window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...penaltyParams.value }),
    });
    penaltyNotice.value = 'Синхронизация нарушений поставлена в очередь.';
    await load();
  } catch (e) {
    error.value = e.message || 'Не удалось запустить синхронизацию нарушений';
  } finally {
    penaltyTriggering.value = false;
  }
}

async function runPenaltyReapOrphans() {
  deletionTriggering.value = true;
  error.value = '';
  deletionNotice.value = '';
  try {
    await apiFetch('/admin-ops/penalties/reap-orphans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...deletionParams.value }),
    });
    deletionNotice.value = 'Очистка устаревших нарушений запущена.';
    await load();
  } catch (e) {
    error.value = e.message || 'Не удалось запустить очистку нарушений';
  } finally {
    deletionTriggering.value = false;
  }
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  const s = Math.round(Number(ms) / 1000);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m} мин ${rs} с`;
}

async function triggerSync() {
  triggering.value = true;
  error.value = '';
  notice.value = '';
  try {
    const res = await apiFetch('/admin-ops/sync/run', { method: 'POST' });
    if (res.already_running) {
      notice.value =
        'Синхронизация уже выполняется. Повторный запуск не требуется.';
    } else {
      notice.value =
        'Синхронизация поставлена в очередь. Обновите страницу через минуту.';
    }
    await load();
  } catch (e) {
    error.value = e.message || 'Не удалось запустить синхронизацию';
  } finally {
    triggering.value = false;
  }
}

async function resetJob(job) {
  if (!window.confirm(`Сбросить блокировку для задачи «${job}»?`)) return;
  try {
    await apiFetch('/admin-ops/jobs/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job }),
    });
    notice.value = `Сброшена блокировка для ${job}.`;
    await load();
  } catch (e) {
    error.value = e.message || 'Не удалось сбросить блокировку';
  }
}

async function restartCron(job) {
  if (!window.confirm(`Перезапустить планировщик для «${job}»?`)) return;
  try {
    await apiFetch('/admin-ops/jobs/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job }),
    });
    notice.value = `Перезапущен планировщик ${job}.`;
    await load();
  } catch (e) {
    error.value = e.message || 'Не удалось перезапустить планировщик';
  }
}

async function triggerTaxation() {
  taxTriggering.value = true;
  error.value = '';
  taxNotice.value = '';
  try {
    const res = await apiFetch('/admin-ops/taxation/run', { method: 'POST' });
    if (res.already_running) {
      taxNotice.value = 'Проверка налогового статуса уже выполняется.';
    } else {
      taxNotice.value =
        'Проверка поставлена в очередь. Обновите страницу позже.';
    }
    await load();
  } catch (e) {
    error.value =
      e.message || 'Не удалось запустить проверку налогового статуса';
  } finally {
    taxTriggering.value = false;
  }
}

onMounted(() => {
  load();
  // auto-refresh every 30s
  refreshTimer = window.setInterval(load, 30000);
});
onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});
</script>

<template>
  <div class="py-3 admin-system-ops-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление сущностями системы</li>
          <li class="breadcrumb-item active" aria-current="page">
            Синхронизация
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Системные операции</h1>

      <div
        v-if="error"
        class="alert alert-danger"
        role="alert"
        aria-live="assertive"
      >
        {{ error }}
      </div>
      <div
        v-if="notice"
        class="alert alert-success"
        role="status"
        aria-live="polite"
      >
        {{ notice }}
      </div>
      <BrandSpinner v-if="loading" label="Загрузка" />

      <div v-else class="row g-3 align-items-stretch">
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body d-flex flex-column">
              <h2 class="h6">Полная синхронизация</h2>
              <div class="small text-muted mb-2">
                Запускает подряд синхронизацию клубов, площадок, команд,
                персонала, игроков и турнирных данных.
              </div>
              <div class="mt-auto d-flex align-items-center gap-2">
                <button
                  class="btn btn-brand"
                  :disabled="triggering || running.syncAll"
                  aria-label="Запустить полную синхронизацию"
                  @click="triggerSync"
                >
                  <span
                    v-if="triggering"
                    class="spinner-border spinner-border-sm me-1"
                  ></span>
                  {{ running.syncAll ? 'Выполняется…' : 'Запустить сейчас' }}
                </button>
                <button
                  class="btn btn-outline-secondary"
                  :disabled="triggering"
                  aria-label="Обновить состояние"
                  @click="load"
                >
                  Обновить
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body d-flex flex-column">
              <h2 class="h6">Нарушения (штрафы)</h2>
              <div class="small text-muted mb-2">
                Синхронизация событий типа «Нарушение» и регулярная очистка
                удалённых записей.
              </div>
              <div class="mb-2">
                <label class="form-label small mb-1">Окно, дней</label>
                <div class="row g-2">
                  <div class="col">
                    <input
                      v-model.number="penaltyParams.daysBack"
                      type="number"
                      min="0"
                      class="form-control form-control-sm"
                      placeholder="Назад"
                    />
                  </div>
                  <div class="col">
                    <input
                      v-model.number="penaltyParams.daysAhead"
                      type="number"
                      min="0"
                      class="form-control form-control-sm"
                      placeholder="Вперёд"
                    />
                  </div>
                  <div class="col">
                    <input
                      v-model.number="penaltyParams.limit"
                      type="number"
                      min="1"
                      class="form-control form-control-sm"
                      placeholder="Лимит матчей"
                    />
                  </div>
                </div>
              </div>
              <div class="mt-auto d-flex flex-wrap gap-2 align-items-center">
                <button
                  class="btn btn-brand"
                  :disabled="penaltyTriggering"
                  @click="runPenaltyWindowSync"
                >
                  <span
                    v-if="penaltyTriggering"
                    class="spinner-border spinner-border-sm me-1"
                  ></span>
                  Синхронизировать окно
                </button>
                <button
                  class="btn btn-outline-danger"
                  :disabled="deletionTriggering"
                  @click="runPenaltyReapOrphans"
                >
                  <span
                    v-if="deletionTriggering"
                    class="spinner-border spinner-border-sm me-1"
                  ></span>
                  Очистить удалённые
                </button>
              </div>
              <div
                v-if="penaltyNotice"
                class="alert alert-success mt-2 py-1 px-2 small"
                role="status"
              >
                {{ penaltyNotice }}
              </div>
              <div
                v-if="deletionNotice"
                class="alert alert-success mt-2 py-1 px-2 small"
                role="status"
              >
                {{ deletionNotice }}
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-body d-flex flex-column">
              <h2 class="h6">Проверка налогового статуса</h2>
              <div class="small text-muted mb-2">
                Пошаговая проверка ИНН и статуса самозанятости для
                пользователей.
              </div>
              <div class="mt-auto d-flex align-items-center gap-2">
                <button
                  class="btn btn-brand"
                  :disabled="taxTriggering || taxRunning.taxation"
                  aria-label="Запустить проверку налогового статуса"
                  @click="triggerTaxation"
                >
                  <span
                    v-if="taxTriggering"
                    class="spinner-border spinner-border-sm me-1"
                  ></span>
                  {{
                    taxRunning.taxation ? 'Выполняется…' : 'Проверить сейчас'
                  }}
                </button>
                <button
                  class="btn btn-outline-secondary"
                  :disabled="taxTriggering"
                  aria-label="Обновить состояние"
                  @click="load"
                >
                  Обновить
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-8">
          <div class="card h-100">
            <div class="card-body">
              <div
                class="d-flex justify-content-between align-items-center mb-2"
              >
                <h2 class="h6 mb-0">Состояние джоб</h2>
                <div class="btn-group">
                  <a
                    class="btn btn-sm btn-outline-secondary"
                    :href="reports.jobRuns(30)"
                    target="_blank"
                    rel="noopener"
                  >
                    Экспорт запусков (30 дн)
                  </a>
                  <a
                    v-if="grafanaHttpErrorsLink"
                    class="btn btn-sm btn-outline-secondary"
                    :href="grafanaHttpErrorsLink"
                    target="_blank"
                    rel="noopener"
                  >
                    HTTP ошибки (Grafana)
                  </a>
                  <span
                    v-else
                    class="btn btn-sm btn-outline-secondary disabled"
                    tabindex="-1"
                    role="status"
                  >
                    Grafana не настроена
                  </span>
                </div>
              </div>

              <div class="table-responsive">
                <table
                  class="table table-striped align-middle mb-0 admin-table"
                >
                  <thead>
                    <tr>
                      <th>Джоба</th>
                      <th class="text-center">Статус</th>
                      <th class="d-none d-sm-table-cell">Последний запуск</th>
                      <th class="d-none d-md-table-cell">Последний успех</th>
                      <th class="text-end d-none d-lg-table-cell">Успехов</th>
                      <th class="text-end d-none d-lg-table-cell">Ошибок</th>
                      <th class="text-end">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="name in [
                        'syncAll',
                        'clubSync',
                        'groundSync',
                        'teamSync',
                        'staffSync',
                        'playerSync',
                        'tournamentSync',
                        'broadcastLinkSync',
                        'gamePenaltySync',
                        'gameEventDeletionSync',
                      ]"
                      :key="name"
                    >
                      <td class="nowrap">
                        <code>{{ name }}</code>
                      </td>
                      <td class="text-center nowrap">
                        <span
                          :class="[
                            'badge',
                            jobs[name]?.in_progress
                              ? 'bg-info'
                              : 'bg-secondary-subtle text-secondary border',
                          ]"
                        >
                          {{
                            jobs[name]?.in_progress ? 'Выполняется' : 'Ожидание'
                          }}
                        </span>
                      </td>
                      <td class="d-none d-sm-table-cell">
                        {{ fmt(jobs[name]?.last_run) }}
                      </td>
                      <td class="d-none d-md-table-cell">
                        {{ fmt(jobs[name]?.last_success) }}
                      </td>
                      <td class="text-end d-none d-lg-table-cell nowrap">
                        {{ jobs[name]?.runs?.success ?? 0 }}
                      </td>
                      <td class="text-end d-none d-lg-table-cell nowrap">
                        {{ jobs[name]?.runs?.error ?? 0 }}
                      </td>
                      <td class="text-end">
                        <div class="dropdown">
                          <button
                            class="btn btn-sm btn-outline-secondary dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                            :aria-label="`Действия для ${name}`"
                          ></button>
                          <ul class="dropdown-menu dropdown-menu-end">
                            <li>
                              <button
                                class="dropdown-item text-danger"
                                @click="resetJob(name)"
                              >
                                Сбросить блокировку
                              </button>
                            </li>
                            <li v-if="name === 'syncAll'">
                              <button
                                class="dropdown-item"
                                @click="restartCron('syncAll')"
                              >
                                Перезапустить
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="nowrap"><code>taxation</code></td>
                      <td class="text-center nowrap">
                        <span
                          :class="[
                            'badge',
                            taxJobs['taxation']?.in_progress
                              ? 'bg-info'
                              : 'bg-secondary-subtle text-secondary border',
                          ]"
                        >
                          {{
                            taxJobs['taxation']?.in_progress
                              ? 'Выполняется'
                              : 'Ожидание'
                          }}
                        </span>
                      </td>
                      <td class="d-none d-sm-table-cell">
                        {{ fmt(taxJobs['taxation']?.last_run) }}
                      </td>
                      <td class="d-none d-md-table-cell">
                        {{ fmt(taxJobs['taxation']?.last_success) }}
                      </td>
                      <td class="text-end d-none d-lg-table-cell nowrap">
                        {{ taxJobs['taxation']?.runs?.success ?? 0 }}
                      </td>
                      <td class="text-end d-none d-lg-table-cell nowrap">
                        {{ taxJobs['taxation']?.runs?.error ?? 0 }}
                      </td>
                      <td class="text-end">
                        <div class="dropdown">
                          <button
                            class="btn btn-sm btn-outline-secondary dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                            aria-label="Действия для taxation"
                          ></button>
                          <ul class="dropdown-menu dropdown-menu-end">
                            <li>
                              <button
                                class="dropdown-item text-danger"
                                @click="resetJob('taxation')"
                              >
                                Сбросить блокировку
                              </button>
                            </li>
                            <li>
                              <button
                                class="dropdown-item"
                                @click="restartCron('taxation')"
                              >
                                Перезапустить
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <hr />
              <h2 class="h6 mb-3">Последние запуски</h2>
              <div class="table-responsive">
                <table
                  class="table table-striped align-middle mb-0 admin-table"
                >
                  <thead>
                    <tr>
                      <th>Джоба</th>
                      <th>Статус</th>
                      <th>Начало</th>
                      <th class="d-none d-md-table-cell">Окончание</th>
                      <th class="text-end d-none d-lg-table-cell">
                        Длительность
                      </th>
                      <th class="d-none d-xl-table-cell">Ошибка</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in history" :key="row.id">
                      <td class="nowrap">
                        <code>{{ row.job }}</code>
                      </td>
                      <td>
                        <span
                          :class="[
                            'badge',
                            row.status === 'SUCCESS'
                              ? 'bg-success'
                              : row.status === 'ERROR'
                                ? 'bg-danger'
                                : 'bg-secondary-subtle text-secondary border',
                          ]"
                        >
                          {{ row.status }}
                        </span>
                      </td>
                      <td>
                        {{
                          new Date(row.started_at).toLocaleString('ru-RU', {
                            hour12: false,
                          })
                        }}
                      </td>
                      <td class="d-none d-md-table-cell">
                        {{
                          row.finished_at
                            ? new Date(row.finished_at).toLocaleString(
                                'ru-RU',
                                { hour12: false }
                              )
                            : '—'
                        }}
                      </td>
                      <td class="text-end d-none d-lg-table-cell nowrap">
                        {{ fmtDuration(row.duration_ms) }}
                      </td>
                      <td
                        class="small text-muted d-none d-xl-table-cell ellipsis"
                        :title="row.error_message || ''"
                      >
                        {{ row.error_message || '—' }}
                      </td>
                    </tr>
                    <tr v-if="!history.length">
                      <td colspan="6" class="text-muted small">
                        Нет данных о запусках.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-table code {
  white-space: nowrap;
}
.nowrap {
  white-space: nowrap;
}
.ellipsis {
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Reduce density on small screens */
@media (max-width: 575.98px) {
  .admin-table {
    font-size: 0.9rem;
  }
}
</style>
