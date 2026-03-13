import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api';
import RefereeClosingDocumentsManager from '@/components/admin-tournament/RefereeClosingDocumentsManager.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

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
});
