import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, apiFetchBlob } from '@/api';
import AdminAccountingView from '@/views/AdminAccountingView.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
  }),
}));

vi.mock('@/utils/toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);
const apiFetchBlobMock = vi.mocked(apiFetchBlob);

describe('AdminAccountingView', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchBlobMock.mockReset();
  });

  it('supports choosing all accruals by current filter for bulk approve', async () => {
    const defaultListPath =
      '/admin/accounting/referee-accruals?page=1&limit=20';
    const filteredListPath =
      '/admin/accounting/referee-accruals?page=1&limit=20&search=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2&status=DRAFT';

    apiFetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/admin/accounting/ref-data') {
          return {
            document_statuses: [
              { id: 'ds-draft', alias: 'DRAFT', name_ru: 'Черновик' },
              { id: 'ds-accrued', alias: 'ACCRUED', name_ru: 'Начислено' },
            ],
            accrual_sources: [],
            actions: [
              {
                id: 'act-approve',
                alias: 'APPROVE',
                name_ru: 'Начислить',
                scope: 'ACCRUAL',
              },
            ],
            status_transitions: [
              {
                from_status: { alias: 'DRAFT' },
                action: { alias: 'APPROVE' },
                is_enabled: true,
              },
            ],
          };
        }
        if (path === defaultListPath || path === filteredListPath) {
          return {
            accruals: [
              {
                id: 'doc-1',
                accrual_number: 'RA-1',
                match_date_snapshot: '2026-03-01',
                total_amount_rub: '1200.00',
                fare_code_snapshot: 'RPOT',
                status: { alias: 'DRAFT', name_ru: 'Черновик' },
                referee: { last_name: 'Иванов', first_name: 'Иван' },
                match: {
                  home_team: { name: 'Команда А' },
                  away_team: { name: 'Команда Б' },
                },
              },
            ],
            total: 3,
          };
        }
        if (path === '/admin/accounting/referee-accruals/doc-1') {
          return {
            document: {
              id: 'doc-1',
              accrual_number: 'RA-1',
              status: { alias: 'DRAFT', name_ru: 'Черновик' },
              tournament: { name: 'Кубок Москвы' },
              referee: {
                last_name: 'Иванов',
                first_name: 'Иван',
                patronymic: 'Иванович',
              },
              match: {
                home_team: { name: 'Команда А' },
                away_team: { name: 'Команда Б' },
              },
              fare_code_snapshot: 'RPOT',
              total_amount_rub: '1200.00',
              postings: [],
            },
            audit_events: [],
          };
        }
        if (
          path === '/admin/accounting/referee-accruals/bulk-action' &&
          options?.method === 'POST'
        ) {
          return {
            success: 3,
            failed: 0,
            total: 3,
            results: [],
          };
        }
        throw new Error(`Unexpected path ${path}`);
      }
    );

    render(AdminAccountingView, {
      global: {
        stubs: {
          PageNav: { template: '<div data-testid="page-nav" />' },
          BrandSpinner: {
            props: ['label'],
            template: '<div>{{ label }}</div>',
          },
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('RA-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      '№, исходный №, судья, турнир, матч, статус'
    );
    const [statusSelect] = screen.getAllByRole('combobox');
    expect(statusSelect).toBeDefined();
    await fireEvent.update(searchInput, 'Иванов');
    await fireEvent.update(statusSelect!, 'DRAFT');
    await fireEvent.click(screen.getByRole('button', { name: 'Найти' }));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(([path]) => path === filteredListPath)
      ).toBe(true);
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Выбрать все (3)' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Начислить' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/admin/accounting/referee-accruals/bulk-action',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            selection_mode: 'filtered',
            filters: {
              search: 'Иванов',
              status: 'DRAFT',
            },
            action_alias: 'APPROVE',
          }),
        })
      );
    });
  });
});
