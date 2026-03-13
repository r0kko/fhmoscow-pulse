import { render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api';
import AdminAccountingClosingDocumentsView from '@/views/AdminAccountingClosingDocumentsView.vue';

vi.mock('@/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

describe('AdminAccountingClosingDocumentsView', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('renders summary cards and tournament readiness states', async () => {
    apiFetchMock.mockResolvedValue({
      tournaments: [
        {
          id: 'tour-1',
          name: 'Кубок Москвы',
          has_customer_profile: true,
          ready_accruals: 8,
          awaiting_signature_count: 3,
          posted_count: 5,
          draft_act_count: 1,
          amount_total_rub: '24500.00',
          blocking_issues: [],
        },
        {
          id: 'tour-2',
          name: 'Первенство ФХМ',
          has_customer_profile: false,
          ready_accruals: 2,
          awaiting_signature_count: 0,
          posted_count: 0,
          draft_act_count: 0,
          amount_total_rub: '4800.00',
          blocking_issues: ['missing_customer_profile'],
        },
      ],
      total: 2,
    });

    render(AdminAccountingClosingDocumentsView, {
      global: {
        stubs: {
          Breadcrumbs: { template: '<nav />' },
          BrandSpinner: {
            props: ['label'],
            template: '<div>{{ label }}</div>',
          },
          PageNav: { template: '<div data-testid="page-nav" />' },
          RouterLink: {
            props: ['to'],
            template: '<a :href="String(to)"><slot /></a>',
          },
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Кубок Москвы')).toBeInTheDocument();
    });

    expect(screen.getByText('Готовые турниры')).toBeInTheDocument();
    expect(screen.getByText('Начисления к оформлению')).toBeInTheDocument();
    expect(screen.getAllByText('Ожидают подписи').length).toBeGreaterThan(0);
    expect(screen.getByText('Сумма по странице')).toBeInTheDocument();
    expect(
      screen.getByText('без блокирующих замечаний на текущей странице')
    ).toBeInTheDocument();
    expect(
      screen.getByText('можно превратить в акты после проверки')
    ).toBeInTheDocument();
    expect(screen.getByText('акты уже отправлены судьям')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/admin/accounting/closing-documents/tournaments?page=1&limit=20'
    );
    expect(screen.getByText(/29\s?300,00 ₽/)).toBeInTheDocument();
    expect(screen.getByText('Кубок Москвы')).toBeInTheDocument();
    expect(screen.getByText('Профиль заказчика готов')).toBeInTheDocument();
    const missingProfileBadges = screen.getAllByText('Нет профиля заказчика');
    expect(missingProfileBadges.length).toBeGreaterThan(0);
    expect(missingProfileBadges[0]).toHaveClass('badge');
    expect(missingProfileBadges[0]).toBeVisible();
    const openLinks = screen.getAllByRole('link', { name: 'Открыть' });
    expect(openLinks[0]).toHaveAttribute(
      'href',
      '/admin/tournaments/tour-1/payments?tab=closing'
    );
  });
});
