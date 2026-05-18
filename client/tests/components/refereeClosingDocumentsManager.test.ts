import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api';
import RefereeClosingDocumentsManager from '@/components/admin-tournament/RefereeClosingDocumentsManager.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function renderManager() {
  return render(RefereeClosingDocumentsManager, {
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
        PageNav: { template: '<div data-testid="page-nav" />' },
        BrandSpinner: {
          props: ['label'],
          template: '<div>{{ label }}</div>',
        },
      },
    },
  });
}

function closingProfileFixture() {
  return {
    profile: {
      organizer: {
        inn: '7708046206',
        name: 'ФХМ',
        address: 'Москва',
      },
    },
  };
}

function accrualsFixture() {
  return {
    accruals: [
      {
        id: 'acc-1',
        accrual_number: 'A-1',
        match_date_snapshot: '2026-03-10',
        total_amount_rub: '3000.00',
        referee: {
          id: 'ref-1',
          last_name: 'Иванов',
          first_name: 'Иван',
          patronymic: 'Иванович',
        },
        referee_role: { name: 'Главный судья' },
        match: {
          home_team: { name: 'Команда 1' },
          away_team: { name: 'Команда 2' },
        },
      },
    ],
    total: 1,
    summary: {
      total_amount_rub: '3000.00',
    },
  };
}

describe('RefereeClosingDocumentsManager', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('supports filtered selection preview payload', async () => {
    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/tournaments/tour-1/referee-closing-profile') {
          return {
            profile: {
              organizer: {
                inn: '7708046206',
                name: 'ФХМ',
                address: 'Москва',
              },
            },
          };
        }
        if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
          return {
            accruals: [
              {
                id: 'acc-1',
                accrual_number: 'A-1',
                match_date_snapshot: '2026-03-10',
                total_amount_rub: '3000.00',
                referee: {
                  id: 'ref-1',
                  last_name: 'Иванов',
                  first_name: 'Иван',
                  patronymic: 'Иванович',
                },
                referee_role: { name: 'Главный судья' },
                match: {
                  home_team: { name: 'Команда 1' },
                  away_team: { name: 'Команда 2' },
                },
              },
              {
                id: 'acc-2',
                accrual_number: 'A-2',
                match_date_snapshot: '2026-03-11',
                total_amount_rub: '2500.00',
                referee: {
                  id: 'ref-2',
                  last_name: 'Петров',
                  first_name: 'Пётр',
                  patronymic: 'Петрович',
                },
                referee_role: { name: 'Судья' },
                match: {
                  home_team: { name: 'Команда 3' },
                  away_team: { name: 'Команда 4' },
                },
              },
            ],
            total: 4,
            summary: {
              total_amount_rub: '11000.00',
            },
          };
        }
        if (
          path === '/tournaments/tour-1/referee-closing-documents/preview' &&
          options?.method === 'POST'
        ) {
          return {
            ready_groups: [],
            blocked_groups: [],
            summary: { selected_total: 4, selected_amount_rub: '11000.00' },
          };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    render(RefereeClosingDocumentsManager, {
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
          PageNav: { template: '<div data-testid="page-nav" />' },
          BrandSpinner: {
            props: ['label'],
            template: '<div>{{ label }}</div>',
          },
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('A-1')).toBeInTheDocument();
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Выбрать все (4)' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Пересчитать' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/tournaments/tour-1/referee-closing-documents/preview',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            selection_mode: 'filtered',
            filters: { status: 'ACCRUED' },
          }),
        })
      );
    });
  });

  it('deletes a closing act from the journal before referee signature', async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);
    let documentsCall = 0;
    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/tournaments/tour-1/referee-closing-profile') {
          return { profile: null };
        }
        if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
          return {
            accruals: [],
            total: 0,
            summary: { total_amount_rub: '0.00' },
          };
        }
        if (path.startsWith('/tournaments/tour-1/referee-closing-documents?')) {
          documentsCall += 1;
          return {
            documents:
              documentsCall === 1
                ? [
                    {
                      id: 'doc-1',
                      status: 'AWAITING_SIGNATURE',
                      can_delete: true,
                      number: '26.03/1042',
                      referee: { full_name: 'Ларин Вячеслав Дмитриевич' },
                      totals: {
                        total_amount_rub: '3100.00',
                        total_amount_words: 'Три тысячи сто рублей 00 копеек',
                      },
                      items: [],
                      signature_timeline: [
                        {
                          party: 'FHMO',
                          created_at: '2026-03-12T12:00:00.000Z',
                        },
                      ],
                    },
                  ]
                : [],
            total: documentsCall === 1 ? 1 : 0,
          };
        }
        if (
          path === '/tournaments/tour-1/referee-closing-documents/doc-1' &&
          options?.method === 'DELETE'
        ) {
          return { deleted: true, id: 'doc-1' };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    render(RefereeClosingDocumentsManager, {
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
          PageNav: { template: '<div data-testid="page-nav" />' },
          BrandSpinner: {
            props: ['label'],
            template: '<div>{{ label }}</div>',
          },
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Акты' }));

    await waitFor(() => {
      expect(screen.getByText('26.03/1042')).toBeInTheDocument();
    });

    const [deleteButton] = screen.getAllByRole('button', { name: 'Удалить' });
    expect(deleteButton).toBeDefined();
    await fireEvent.click(deleteButton!);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/tournaments/tour-1/referee-closing-documents/doc-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  it('supports bulk sending draft acts signed by FHMO', async () => {
    apiFetchMock.mockImplementation(
      async (path: string, _options?: RequestInit) => {
        if (path === '/tournaments/tour-1/referee-closing-profile') {
          return { profile: null };
        }
        if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
          return {
            accruals: [],
            total: 0,
            summary: { total_amount_rub: '0.00' },
          };
        }
        if (
          path === '/tournaments/tour-1/referee-closing-documents/send-batch'
        ) {
          return {
            failures: [],
            summary: {
              sent_total: 2,
              failed_total: 0,
            },
          };
        }
        if (path.startsWith('/tournaments/tour-1/referee-closing-documents?')) {
          return {
            documents: [
              {
                id: 'doc-1',
                status: 'DRAFT',
                number: '26.03/1201',
                referee: { full_name: 'Судья Первый' },
                totals: { total_amount_rub: '3100.00' },
                items: [],
                signature_timeline: [],
                can_delete: true,
              },
              {
                id: 'doc-2',
                status: 'DRAFT',
                number: '26.03/1202',
                referee: { full_name: 'Судья Второй' },
                totals: { total_amount_rub: '4200.00' },
                items: [],
                signature_timeline: [],
                can_delete: true,
              },
              {
                id: 'doc-3',
                status: 'AWAITING_SIGNATURE',
                number: '26.03/1203',
                referee: { full_name: 'Судья Третий' },
                totals: { total_amount_rub: '1500.00' },
                items: [],
                signature_timeline: [],
                can_delete: false,
              },
            ],
            total: 3,
            summary: {
              sendable_total: 2,
            },
          };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    render(RefereeClosingDocumentsManager, {
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
          PageNav: { template: '<div data-testid="page-nav" />' },
          BrandSpinner: {
            props: ['label'],
            template: '<div>{{ label }}</div>',
          },
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Акты' }));

    await waitFor(() => {
      expect(screen.getByText('26.03/1201')).toBeInTheDocument();
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Выбрать все черновики (2)' })
    );
    await fireEvent.click(
      screen.getByRole('button', { name: 'Подписать и отправить выбранные' })
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/tournaments/tour-1/referee-closing-documents/send-batch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            selection_mode: 'filtered',
            filters: {},
          }),
        })
      );
    });
  });

  it('clears stale send error and blocks duplicate single send clicks', async () => {
    let sendCalls = 0;
    let resolveSecondSend: (value: unknown) => void = () => {};
    const secondSendPromise = new Promise((resolve) => {
      resolveSecondSend = resolve;
    });
    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/tournaments/tour-1/referee-closing-profile') {
          return { profile: null };
        }
        if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
          return {
            accruals: [],
            total: 0,
            summary: { total_amount_rub: '0.00' },
          };
        }
        if (
          path === '/tournaments/tour-1/referee-closing-documents/doc-1/send' &&
          options?.method === 'POST'
        ) {
          sendCalls += 1;
          if (sendCalls === 1) {
            const error = new Error(
              'Не удалось сформировать PDF акта. Обновите журнал и повторите попытку. (id: req-old)'
            ) as Error & { code?: string; requestId?: string };
            error.code = 'closing_document_pdf_failed';
            error.requestId = 'req-old';
            throw error;
          }
          return secondSendPromise;
        }
        if (path === '/admin/async-jobs/job-1') {
          return {
            job_id: 'job-1',
            operation: 'SEND_TO_SIGNATURE',
            status: 'COMPLETED',
            total_count: 1,
            processed_count: 1,
            success_count: 1,
            skipped_count: 0,
            failure_count: 0,
            progress_percent: 100,
          };
        }
        if (path.startsWith('/tournaments/tour-1/referee-closing-documents?')) {
          return {
            documents: [
              {
                id: 'doc-1',
                status: 'DRAFT',
                number: '26.03/1301',
                referee: { full_name: 'Судья Первый' },
                totals: { total_amount_rub: '3100.00' },
                items: [],
                signature_timeline: [],
                can_delete: true,
              },
            ],
            total: 1,
            summary: {
              sendable_total: 1,
            },
          };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    renderManager();

    await fireEvent.click(screen.getByRole('button', { name: 'Акты' }));

    await waitFor(() => {
      expect(screen.getByText('26.03/1301')).toBeInTheDocument();
    });

    const sendButton = screen.getByRole('button', {
      name: 'Отправить на подпись',
    });
    await fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/req-old/)).toBeInTheDocument();
    });

    await fireEvent.click(sendButton);

    expect(screen.queryByText(/req-old/)).not.toBeInTheDocument();
    expect(sendButton).toBeDisabled();
    await fireEvent.click(sendButton);
    expect(sendCalls).toBe(2);

    resolveSecondSend({
      job_id: 'job-1',
      operation: 'SEND_TO_SIGNATURE',
      status: 'QUEUED',
      total_count: 1,
      processed_count: 0,
      success_count: 0,
      skipped_count: 0,
      failure_count: 0,
      progress_percent: 0,
    });

    await waitFor(() => {
      expect(screen.queryByText(/req-old/)).not.toBeInTheDocument();
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('shows stable reason for partial bulk send failures', async () => {
    apiFetchMock.mockImplementation(
      async (path: string, _options?: RequestInit) => {
        if (path === '/tournaments/tour-1/referee-closing-profile') {
          return { profile: null };
        }
        if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
          return {
            accruals: [],
            total: 0,
            summary: { total_amount_rub: '0.00' },
          };
        }
        if (
          path === '/tournaments/tour-1/referee-closing-documents/send-batch'
        ) {
          return {
            job_id: 'job-2',
            operation: 'SEND_TO_SIGNATURE',
            status: 'QUEUED',
            total_count: 2,
            processed_count: 0,
            success_count: 0,
            skipped_count: 0,
            failure_count: 0,
            progress_percent: 0,
          };
        }
        if (path === '/admin/async-jobs/job-2') {
          return {
            job_id: 'job-2',
            operation: 'SEND_TO_SIGNATURE',
            status: 'PARTIAL_FAILED',
            total_count: 2,
            processed_count: 2,
            success_count: 1,
            skipped_count: 0,
            failure_count: 1,
            progress_percent: 100,
          };
        }
        if (path.startsWith('/admin/async-jobs/job-2/items')) {
          return {
            items: [
              {
                id: 'item-2',
                status: 'FAILED',
                closing_document_id: 'doc-2',
                error_code: 'closing_document_storage_failed',
              },
            ],
          };
        }
        if (path.startsWith('/tournaments/tour-1/referee-closing-documents?')) {
          return {
            documents: [
              {
                id: 'doc-1',
                status: 'DRAFT',
                number: '26.03/1401',
                referee: { full_name: 'Судья Первый' },
                totals: { total_amount_rub: '3100.00' },
                items: [],
                signature_timeline: [],
                can_delete: true,
              },
              {
                id: 'doc-2',
                status: 'DRAFT',
                number: '26.03/1402',
                referee: { full_name: 'Судья Второй' },
                totals: { total_amount_rub: '4200.00' },
                items: [],
                signature_timeline: [],
                can_delete: true,
              },
            ],
            total: 2,
            summary: {
              sendable_total: 2,
            },
          };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    renderManager();

    await fireEvent.click(screen.getByRole('button', { name: 'Акты' }));

    await waitFor(() => {
      expect(screen.getByText('26.03/1401')).toBeInTheDocument();
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Выбрать все черновики (2)' })
    );
    await fireEvent.click(
      screen.getByRole('button', { name: 'Подписать и отправить выбранные' })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Не удалось сохранить PDF акта в хранилище/)
      ).toBeInTheDocument();
    });
  });

  it('shows performer bank snapshot and disables send while PDF is not ready', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/tournaments/tour-1/referee-closing-profile') {
        return closingProfileFixture();
      }
      if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
        return accrualsFixture();
      }
      if (path.startsWith('/tournaments/tour-1/referee-closing-documents?')) {
        return {
          documents: [
            {
              id: 'doc-bank',
              status: 'DRAFT',
              pdf_status: 'GENERATING',
              pdf_generated_at: null,
              number: '26.03/1500',
              referee: { full_name: 'Тестов Никита Анатольевич' },
              totals: {
                total_amount_rub: '3000.00',
                total_amount_words: 'Три тысячи рублей 00 копеек',
              },
              items: [],
              signature_timeline: [],
              can_delete: true,
              customer_snapshot: { name: 'ФХМ', address: 'Москва' },
              performer_snapshot: {
                full_name: 'Тестов Никита Анатольевич',
                address: 'Москва',
                bank_account: {
                  number: '40702810900000005555',
                  bic: '044525225',
                  bank_name: 'ПАО Сбербанк',
                  correspondent_account: '30101810400000000225',
                  inn: '7707083893',
                  kpp: '773601001',
                  address: 'Москва',
                },
              },
              contract_snapshot: {
                number: '26.03/1024',
                document_date: '2026-03-12',
              },
            },
          ],
          total: 1,
          summary: { sendable_total: 0 },
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    renderManager();

    await fireEvent.click(screen.getByRole('button', { name: 'Акты' }));

    await waitFor(() => {
      expect(screen.getAllByText('PDF формируется').length).toBeGreaterThan(0);
    });
    expect(
      screen.getByText('Банковские реквизиты исполнителя')
    ).toBeInTheDocument();
    expect(screen.getByText('40702810900000005555')).toBeInTheDocument();
    expect(screen.getByText('ПАО Сбербанк')).toBeInTheDocument();
    expect(screen.getByText('30101810400000000225')).toBeInTheDocument();
    expect(
      screen.getByText('Отправка доступна только после успешной генерации PDF.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Отправить на подпись' })
    ).toBeDisabled();
  });

  it('shows missing bank account blocker in preview', async () => {
    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/tournaments/tour-1/referee-closing-profile') {
          return closingProfileFixture();
        }
        if (path.startsWith('/tournaments/tour-1/referee-accruals?')) {
          return accrualsFixture();
        }
        if (
          path === '/tournaments/tour-1/referee-closing-documents/preview' &&
          options?.method === 'POST'
        ) {
          return {
            ready_groups: [],
            blocked_groups: [
              {
                referee: {
                  id: 'ref-1',
                  full_name: 'Иванов Иван Иванович',
                  email: 'judge@example.com',
                },
                performer_snapshot: {
                  full_name: 'Иванов Иван Иванович',
                  address: 'Москва',
                  bank_account: null,
                },
                contract_snapshot: { number: '26.03/1024' },
                totals: { items_count: 1, total_amount_rub: '3000.00' },
                issues: ['missing_referee_bank_account'],
              },
            ],
            summary: { selected_total: 1, ready_groups: 0, blocked_groups: 1 },
          };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    renderManager();

    await waitFor(() => {
      expect(screen.getByText('A-1')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByLabelText('Выбрать начисление A-1'));
    await fireEvent.click(screen.getByRole('button', { name: 'Пересчитать' }));

    await waitFor(() => {
      expect(
        screen.getByText('Не заполнены банковские реквизиты судьи')
      ).toBeInTheDocument();
    });
  });
});
