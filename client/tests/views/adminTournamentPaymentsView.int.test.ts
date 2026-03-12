import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, apiFetchBlob } from '@/api';
import AdminTournamentPaymentsView from '@/views/AdminTournamentPaymentsView.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);
const apiFetchBlobMock = vi.mocked(apiFetchBlob);

const dashboardResponse = {
  summary: {
    active_tariff_rules: 1,
    active_travel_rates: 1,
    draft_accruals: 1,
    tariff_issue_count: 1,
    travel_issue_count: 1,
  },
  schedule_dates: [
    { day: '2026-03-15', count: 4 },
    { day: '2026-03-16', count: 2 },
  ],
  coverage_date: '2026-03-15',
  tariff_coverage_summary: {
    total: 4,
    ok: 1,
    out_of_period: 0,
    missing: 3,
  },
  tariff_coverage_issues: [
    {
      stage_group_id: 'g2',
      referee_role_id: 'r1',
      stage_group_name: 'Группа Б',
      referee_role_name: 'Главный',
      state: 'missing',
      active_count: 0,
      in_period_count: 0,
    },
  ],
  tariff_coverage_matrix: [
    {
      stage_group: { id: 'g1', name: 'Группа А' },
      role_states: [
        {
          stage_group_id: 'g1',
          referee_role_id: 'r1',
          stage_group_name: 'Группа А',
          referee_role_name: 'Главный',
          state: 'ok',
          active_count: 1,
          in_period_count: 1,
        },
      ],
    },
    {
      stage_group: { id: 'g2', name: 'Группа Б' },
      role_states: [
        {
          stage_group_id: 'g2',
          referee_role_id: 'r1',
          stage_group_name: 'Группа Б',
          referee_role_name: 'Главный',
          state: 'missing',
          active_count: 0,
          in_period_count: 0,
        },
      ],
    },
  ],
  travel_coverage_summary: {
    total: 2,
    ok: 1,
    out_of_period: 0,
    missing: 1,
  },
  travel_coverage_rows: [
    {
      ground_id: 'gr1',
      ground_name: 'Арена 1',
      state: 'missing',
      active_count: 0,
      in_period_count: 0,
    },
    {
      ground_id: 'gr2',
      ground_name: 'Арена 2',
      state: 'ok',
      active_count: 1,
      in_period_count: 1,
    },
  ],
  travel_coverage_issues: [
    {
      ground_id: 'gr1',
      ground_name: 'Арена 1',
      state: 'missing',
      active_count: 0,
      in_period_count: 0,
    },
  ],
};

const tariffRowsResponse = {
  tariff_rules: [
    {
      id: 'tariff-1',
      tournament_id: 'tour-1',
      stage_group_id: 'g1',
      referee_role_id: 'r1',
      fare_code: 'A1',
      base_amount_rub: '2500.00',
      meal_amount_rub: '500.00',
      valid_from: '2026-03-01',
      valid_to: null,
      version: 1,
      status: { id: 'ts-active', alias: 'ACTIVE', name_ru: 'Действует' },
      stage_group: { id: 'g1', name: 'Группа А' },
      referee_role: { id: 'r1', name: 'Главный' },
    },
  ],
  total: 1,
};

const accrualListResponse = {
  accruals: [
    {
      id: 'doc-1',
      accrual_number: 'RA-202603-000001',
      tournament_id: 'tour-1',
      fare_code_snapshot: 'A1',
      match_date_snapshot: '2026-03-15',
      total_amount_rub: '3250.00',
      base_amount_rub: '2500.00',
      meal_amount_rub: '500.00',
      travel_amount_rub: '250.00',
      status: { id: 'ds-draft', alias: 'DRAFT', name_ru: 'Черновик' },
      source: { id: 'src-manual', alias: 'MANUAL', name_ru: 'Вручную' },
      referee: {
        id: 'u1',
        last_name: 'Иванов',
        first_name: 'Иван',
        patronymic: 'Иванович',
      },
      referee_role: { id: 'r1', name: 'Главный' },
      tournament: { id: 'tour-1', name: 'Кубок' },
      stage_group: { id: 'g1', name: 'Группа А' },
      ground: { id: 'gr1', name: 'Арена 1' },
      match: {
        id: 'm1',
        date_start: '2026-03-15T12:00:00.000Z',
        home_team: { id: 't1', name: 'Команда 1' },
        away_team: { id: 't2', name: 'Команда 2' },
      },
    },
  ],
  total: 1,
};

const accrualDetailResponse = {
  document: {
    ...accrualListResponse.accruals[0],
    postings: [
      {
        id: 'p1',
        amount_rub: '2500.00',
        posting_type: { id: 'pt1', alias: 'ORIGINAL', name_ru: 'Исходное' },
        component: { id: 'cmp1', alias: 'BASE', name_ru: 'База' },
      },
    ],
    adjustments: [],
  },
  audit_events: [
    {
      id: 'audit-1',
      action: 'CREATE',
      created_at: '2026-03-15T13:00:00.000Z',
      actor: {
        id: 'admin-1',
        last_name: 'Петров',
        first_name: 'Пётр',
      },
    },
  ],
};

const registryResponse = {
  rows: [
    {
      referee_id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
      inn: '123456789012',
      phone: '79991112233',
      bank_account_number: '40817810099910004312',
      bic: '044525225',
      correspondent_account: '30101810400000000225',
      total_amount_rub: '3250.00',
      taxation_type_alias: 'NPD',
      taxation_type: 'Плательщик налога на профессиональный доход',
      missing_fields: [],
    },
    {
      referee_id: 'u2',
      last_name: 'Петров',
      first_name: 'Пётр',
      patronymic: 'Сергеевич',
      inn: null,
      phone: '79992223344',
      bank_account_number: null,
      bic: null,
      correspondent_account: null,
      total_amount_rub: '1800.00',
      taxation_type_alias: 'PERSON',
      taxation_type: 'Физическое лицо',
      missing_fields: ['inn', 'bank_account_number', 'bic'],
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  summary: {
    referees_total: 2,
    ready_total: 1,
    incomplete_total: 1,
    total_amount_rub: '5050.00',
  },
  filter_options: {
    taxation_types: [
      {
        alias: 'NPD',
        name: 'Плательщик налога на профессиональный доход',
      },
      { alias: 'PERSON', name: 'Физическое лицо' },
    ],
  },
};

function buildMutationTariff(body: Record<string, unknown>) {
  return {
    tariff_rule: {
      ...tariffRowsResponse.tariff_rules[0],
      ...body,
      stage_group: {
        id: String(body['stage_group_id'] || 'g1'),
        name: 'Группа А',
      },
      referee_role: {
        id: String(body['referee_role_id'] || 'r1'),
        name: 'Главный',
      },
      status: {
        id: 'ts-draft',
        alias: String(body['status'] || 'DRAFT'),
        name_ru: 'Черновик',
      },
    },
  };
}

describe('AdminTournamentPaymentsView', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchBlobMock.mockReset();
  });

  it('supports tariff editing, coverage-date refresh, travel coverage switching and generation hints', async () => {
    const patchBodies: Array<Record<string, unknown>> = [];
    const seenCalls: Array<{ path: string; method: string }> = [];

    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit): Promise<unknown> => {
        const url = new URL(path, 'https://lk.fhmoscow.com');
        const method = String(options?.method || 'GET').toUpperCase();
        seenCalls.push({ path, method });

        if (url.pathname === '/admin/accounting/ref-data') {
          return {
            tariff_statuses: [
              { id: 'ts-draft', alias: 'DRAFT', name_ru: 'Черновик' },
              { id: 'ts-filed', alias: 'FILED', name_ru: 'На согласовании' },
              { id: 'ts-active', alias: 'ACTIVE', name_ru: 'Действует' },
              { id: 'ts-retired', alias: 'RETIRED', name_ru: 'Архив' },
            ],
            travel_rate_statuses: [
              { id: 'trs-draft', alias: 'DRAFT', name_ru: 'Черновик' },
              { id: 'trs-active', alias: 'ACTIVE', name_ru: 'Действует' },
              { id: 'trs-retired', alias: 'RETIRED', name_ru: 'Архив' },
            ],
            document_statuses: [
              { id: 'ds-draft', alias: 'DRAFT', name_ru: 'Черновик' },
              { id: 'ds-accrued', alias: 'ACCRUED', name_ru: 'Начислено' },
            ],
            accrual_sources: [
              { id: 'src-manual', alias: 'MANUAL', name_ru: 'Вручную' },
              { id: 'src-cron', alias: 'CRON', name_ru: 'По расписанию' },
            ],
            generation_error_codes: [
              {
                alias: 'missing_ground_travel_rate',
                name_ru: 'Нет ставки проезда арены на дату матча',
              },
            ],
          };
        }

        if (url.pathname === '/tournaments/groups') {
          return {
            groups: [
              { id: 'g1', name: 'Группа А' },
              { id: 'g2', name: 'Группа Б' },
            ],
          };
        }

        if (url.pathname === '/tournaments/referee-roles') {
          return {
            groups: [
              {
                id: 'rg-1',
                name: 'Основные',
                roles: [{ id: 'r1', name: 'Главный' }],
              },
            ],
          };
        }

        if (url.pathname === '/tournaments/groups/referees') {
          return {
            assignments: [
              { tournament_group_id: 'g1', referee_role_id: 'r1', count: 1 },
              { tournament_group_id: 'g2', referee_role_id: 'r1', count: 1 },
            ],
          };
        }

        if (url.pathname === '/tournaments/tour-1/referee-payments/dashboard') {
          return dashboardResponse;
        }

        if (url.pathname === '/tournaments/tour-1/referee-tariffs') {
          return tariffRowsResponse;
        }

        if (url.pathname === '/tournaments/tour-1/referee-tariffs/tariff-1') {
          patchBodies.push(JSON.parse(String(options?.body || '{}')));
          return buildMutationTariff(patchBodies[patchBodies.length - 1] || {});
        }

        if (url.pathname === '/grounds/gr1/referee-travel-rates') {
          return {
            travel_rates: [],
            total: 0,
          };
        }

        if (url.pathname === '/grounds/gr2/referee-travel-rates') {
          return {
            travel_rates: [
              {
                id: 'travel-1',
                ground_id: 'gr2',
                rate_code: 'TRV1',
                travel_amount_rub: '350.00',
                valid_from: '2026-03-01',
                valid_to: null,
                status: {
                  id: 'trs-active',
                  alias: 'ACTIVE',
                  name_ru: 'Действует',
                },
              },
            ],
            total: 1,
          };
        }

        if (url.pathname === '/tournaments/tour-1/referee-accruals') {
          return accrualListResponse;
        }

        if (url.pathname === '/tournaments/tour-1/referee-accruals/doc-1') {
          return accrualDetailResponse;
        }

        if (url.pathname === '/tournaments/tour-1/referee-payment-registry') {
          return registryResponse;
        }

        if (
          url.pathname === '/tournaments/tour-1/referee-accruals/generate' &&
          method === 'POST'
        ) {
          return {
            from_date: '2026-03-15',
            to_date: '2026-03-15',
            mode: 'preview',
            summary: {
              eligible_matches: 1,
              eligible_assignments: 1,
              calculated: 0,
              created: 0,
              skipped_existing: 0,
              errors: 1,
            },
            errors_by_code: {
              missing_ground_travel_rate: 1,
            },
          };
        }

        return {};
      }
    );
    apiFetchBlobMock.mockResolvedValue(new Blob(['xlsx']));

    render(AdminTournamentPaymentsView, {
      props: { tournamentId: 'tour-1' },
      global: {
        stubs: {
          TabSelector: {
            props: ['modelValue', 'tabs', 'ariaLabel'],
            emits: ['update:modelValue'],
            template: `
              <div :aria-label="ariaLabel">
                <button
                  v-for="tab in tabs"
                  :key="tab.key"
                  type="button"
                  @click="$emit('update:modelValue', tab.key)"
                >
                  {{ tab.label }}
                </button>
              </div>
            `,
          },
          PageNav: {
            template: '<div data-testid="page-nav" />',
          },
          BrandSpinner: {
            props: ['label'],
            template: '<div>{{ label }}</div>',
          },
        },
      },
    });

    await waitFor(() => {
      expect(
        seenCalls.some(
          (call) =>
            call.path === '/tournaments/tour-1/referee-accruals/doc-1' &&
            call.method === 'GET'
        )
      ).toBe(true);
    });
    const tariffListCard = screen
      .getByText(/Список норм оплаты/i)
      .closest('.border');
    expect(tariffListCard).not.toBeNull();
    const [tariffRowGroup] = within(tariffListCard as HTMLElement).getAllByText(
      'Группа А'
    );
    expect(tariffRowGroup).toBeDefined();
    await fireEvent.click(tariffRowGroup as HTMLElement);
    const tariffEditorCard = screen
      .getByText('Карточка нормы')
      .closest('.border');
    expect(tariffEditorCard).not.toBeNull();
    const baseInput = within(
      tariffEditorCard as HTMLElement
    ).getAllByPlaceholderText('0,00')[0] as HTMLInputElement | undefined;
    if (!baseInput) {
      throw new Error('Base amount input not found');
    }
    await fireEvent.update(baseInput, '2700,00');
    await fireEvent.click(
      within(tariffEditorCard as HTMLElement).getByRole('button', {
        name: 'Сохранить изменения',
      })
    );

    await waitFor(() => {
      expect(patchBodies).toHaveLength(1);
      expect(patchBodies[0]?.['base_amount_rub']).toBe('2700.00');
    });

    const coverageDateLabel = screen.getByText('Дата контроля покрытия');
    const coverageDateSelect = coverageDateLabel
      .closest('div')
      ?.querySelector('select') as HTMLSelectElement | null;
    expect(coverageDateSelect).not.toBeNull();
    if (!coverageDateSelect) {
      throw new Error('Coverage date select not found');
    }
    await fireEvent.update(coverageDateSelect, '2026-03-16');

    await waitFor(() => {
      expect(
        seenCalls.some(
          (call) =>
            call.method === 'GET' &&
            call.path.includes(
              '/tournaments/tour-1/referee-tariffs?page=1&limit=20&on_date=2026-03-16'
            )
        )
      ).toBe(true);
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Проезд' }));
    const travelCoverageCard = screen
      .getByText('Проблемы покрытия проезда')
      .closest('.border');
    expect(travelCoverageCard).not.toBeNull();
    expect(
      within(travelCoverageCard as HTMLElement).getByText('Арена 1')
    ).toBeInTheDocument();
    expect(
      within(travelCoverageCard as HTMLElement).queryByText('Арена 2')
    ).not.toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole('button', { name: 'Показать все арены' })
    );
    expect(
      await within(travelCoverageCard as HTMLElement).findByText('Арена 2')
    ).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Начисления' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр' }));

    const hintButton = await screen.findByRole('button', {
      name: /Нет ставки проезда арены на дату матча: 1/,
    });
    await fireEvent.click(hintButton);

    expect(
      await screen.findByText('Проблемы покрытия проезда')
    ).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Реестры' }));

    expect(await screen.findByText('Реестр оплат судей')).toBeInTheDocument();
    expect(await screen.findByText('Иванов')).toBeInTheDocument();
    expect(screen.getByText(/5\s?050,00/)).toBeInTheDocument();
    expect(screen.getAllByText('Пропуски').length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole('button', { name: 'XLSX' }));

    await waitFor(() => {
      expect(apiFetchBlobMock).toHaveBeenCalledWith(
        '/tournaments/tour-1/referee-payment-registry/export.xlsx?'
      );
    });
  });
});
