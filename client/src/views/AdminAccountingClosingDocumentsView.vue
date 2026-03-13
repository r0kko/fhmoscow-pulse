<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

import BrandSpinner from '../components/BrandSpinner.vue';
import PageNav from '../components/PageNav.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api';

interface TournamentRow {
  id: string;
  name: string | null;
  has_customer_profile: boolean;
  ready_accruals: number;
  awaiting_signature_count: number;
  posted_count: number;
  draft_act_count: number;
  amount_total_rub: string;
  blocking_issues: string[];
}

const loading = ref(false);
const error = ref('');
const rows = ref<TournamentRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filters = reactive({
  search: '',
});

const breadcrumbs = [
  { label: 'Администрирование', to: '/admin' },
  { label: 'Бухгалтерия', to: '/admin/accounting' },
  { label: 'Закрывающие документы' },
];

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(total.value || 0) / limit.value))
);

const pageSummary = computed(() =>
  rows.value.reduce(
    (acc, row) => {
      acc.readyAccruals += Number(row.ready_accruals || 0);
      acc.awaiting += Number(row.awaiting_signature_count || 0);
      acc.posted += Number(row.posted_count || 0);
      acc.drafts += Number(row.draft_act_count || 0);
      acc.amount += Number(String(row.amount_total_rub || 0).replace(',', '.'));
      acc.readyTournaments += row.blocking_issues.length ? 0 : 1;
      return acc;
    },
    {
      readyAccruals: 0,
      awaiting: 0,
      posted: 0,
      drafts: 0,
      amount: 0,
      readyTournaments: 0,
    }
  )
);

function formatRub(value: unknown) {
  const number = Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(number)) return '0,00';
  return number.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function issueLabel(issue: string) {
  const labels: Record<string, string> = {
    missing_customer_profile: 'Нет профиля заказчика',
    missing_fhmo_signer: 'Нет подписанта ФХМ',
    no_ready_accruals: 'Нет начислений к оформлению',
  };
  return labels[issue] || issue;
}

function buildQuery(): URLSearchParams {
  const params = new URLSearchParams({
    page: String(page.value),
    limit: String(limit.value),
  });
  if (filters.search.trim()) params.set('search', filters.search.trim());
  return params;
}

async function loadRows() {
  loading.value = true;
  error.value = '';
  try {
    const response = (await apiFetch(
      `/admin/accounting/closing-documents/tournaments?${buildQuery().toString()}`
    )) as { tournaments?: TournamentRow[]; total?: number };
    rows.value = response.tournaments || [];
    total.value = Number(response.total || 0);
  } catch (err: any) {
    error.value = err?.message || 'Не удалось загрузить список турниров';
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

watch([page, limit], () => {
  void loadRows();
});

onMounted(() => {
  void loadRows();
});
</script>

<template>
  <div class="py-4">
    <div class="container-fluid px-2 px-xl-3">
      <Breadcrumbs class="mb-2" :items="breadcrumbs" />

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body d-flex flex-column gap-3">
          <div
            class="d-flex flex-wrap justify-content-between gap-2 align-items-start"
          >
            <div>
              <h1 class="h5 mb-1">Закрывающие документы</h1>
              <div class="small text-muted">
                Турниры с начислениями, по которым можно массово сформировать и
                отправить акты выполненных работ.
              </div>
            </div>
          </div>

          <div class="row g-2">
            <div class="col-12 col-md-6 col-xl-3">
              <div class="closing-hub-card h-100">
                <div class="closing-hub-card__label">Готовые турниры</div>
                <div class="closing-hub-card__value">
                  {{ pageSummary.readyTournaments }}
                </div>
                <div class="closing-hub-card__meta">
                  без блокирующих замечаний на текущей странице
                </div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-xl-3">
              <div class="closing-hub-card h-100">
                <div class="closing-hub-card__label">
                  Начисления к оформлению
                </div>
                <div class="closing-hub-card__value">
                  {{ pageSummary.readyAccruals }}
                </div>
                <div class="closing-hub-card__meta">
                  можно превратить в акты после проверки
                </div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-xl-3">
              <div class="closing-hub-card h-100">
                <div class="closing-hub-card__label">Ожидают подписи</div>
                <div class="closing-hub-card__value">
                  {{ pageSummary.awaiting }}
                </div>
                <div class="closing-hub-card__meta">
                  акты уже отправлены судьям
                </div>
              </div>
            </div>
            <div class="col-12 col-md-6 col-xl-3">
              <div class="closing-hub-card h-100">
                <div class="closing-hub-card__label">Сумма по странице</div>
                <div class="closing-hub-card__value">
                  {{ formatRub(pageSummary.amount) }} ₽
                </div>
                <div class="closing-hub-card__meta">
                  начисления в текущем наборе турниров
                </div>
              </div>
            </div>
          </div>

          <form class="border rounded-3 p-3" @submit.prevent="loadRows">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-lg-6">
                <label class="form-label">Поиск турнира</label>
                <input
                  v-model="filters.search"
                  type="search"
                  class="form-control"
                  placeholder="Название турнира"
                />
              </div>
              <div class="col-6 col-lg-2">
                <button type="submit" class="btn btn-brand w-100">Найти</button>
              </div>
            </div>
          </form>

          <div v-if="error" class="alert alert-danger mb-0 py-2">
            {{ error }}
          </div>
          <BrandSpinner v-else-if="loading" label="Загрузка турниров" />

          <template v-else>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Турнир</th>
                    <th>Готово начислений</th>
                    <th>Ожидают подписи</th>
                    <th>Проведено</th>
                    <th>Черновики актов</th>
                    <th class="text-end">Сумма</th>
                    <th>Готовность</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.id">
                    <td>
                      <div class="fw-semibold">{{ row.name || '—' }}</div>
                      <div class="small text-muted d-flex flex-wrap gap-2 mt-1">
                        <span
                          class="badge"
                          :class="
                            row.has_customer_profile
                              ? 'bg-success-subtle text-success border'
                              : 'bg-warning-subtle text-warning border'
                          "
                        >
                          {{
                            row.has_customer_profile
                              ? 'Профиль заказчика готов'
                              : 'Нет профиля заказчика'
                          }}
                        </span>
                        <span
                          v-if="row.draft_act_count"
                          class="badge bg-secondary-subtle text-secondary border"
                        >
                          Черновики: {{ row.draft_act_count }}
                        </span>
                      </div>
                    </td>
                    <td>{{ row.ready_accruals }}</td>
                    <td>{{ row.awaiting_signature_count }}</td>
                    <td>{{ row.posted_count }}</td>
                    <td>{{ row.draft_act_count }}</td>
                    <td class="text-end">
                      {{ formatRub(row.amount_total_rub) }}
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span
                          v-for="issue in row.blocking_issues"
                          :key="issue"
                          class="badge text-bg-light border"
                        >
                          {{ issueLabel(issue) }}
                        </span>
                        <span
                          v-if="!row.blocking_issues.length"
                          class="badge text-bg-success"
                        >
                          Готово
                        </span>
                      </div>
                    </td>
                    <td class="text-end">
                      <RouterLink
                        class="btn btn-outline-brand btn-sm"
                        :to="`/admin/tournaments/${row.id}/payments?tab=closing`"
                      >
                        Открыть
                      </RouterLink>
                    </td>
                  </tr>
                  <tr v-if="!rows.length">
                    <td colspan="8" class="text-center text-muted py-4">
                      Турниров для оформления актов пока нет
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <PageNav
              :page="page"
              :total-pages="totalPages"
              :page-size="limit"
              :sizes="[20, 50, 100]"
              @update:page="(value) => (page = value)"
              @update:page-size="(value) => (limit = value)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.closing-hub-card {
  height: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-subtle, #dfe5ec);
  border-radius: var(--radius-tile, 0.75rem);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: var(--shadow-tile);
}

.closing-hub-card__label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.closing-hub-card__value {
  margin-top: 0.35rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: #141922;
}

.closing-hub-card__meta {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: #6b7280;
}
</style>
