import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import UpcomingEventCard from '../../src/components/UpcomingEventCard.vue';

function renderCard(event) {
  return render(UpcomingEventCard, {
    props: { event },
  });
}

describe('UpcomingEventCard', () => {
  it('renders exam events as non-linked cards with address', () => {
    renderCard({
      id: 'exam-1',
      kind: 'exam',
      start_at: '2024-05-05T08:00:00+03:00',
      registration_status: 'APPROVED',
      center: { address: { result: 'Клиника №3' } },
    });

    const card = screen.getByText('Медосмотр').closest('.upcoming-card');
    expect(card?.parentElement?.tagName).toBe('DIV');
    expect(screen.getByText('Клиника №3')).toBeInTheDocument();
    expect(screen.getByText('Медосмотр')).toBeInTheDocument();
  });

  it('links to ground map for offline trainings', () => {
    renderCard({
      id: 'train-1',
      kind: 'training',
      start_at: '2024-05-06T12:30:00+03:00',
      ground: {
        address: { result: 'Ледовый дворец' },
        yandex_url: 'https://maps.yandex.ru/ground',
      },
    });

    const link = screen.getByRole('link', { name: /Тренировка/ });
    expect(link).toHaveAttribute('href', 'https://maps.yandex.ru/ground');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('marks hybrid or online slots with a badge and meeting link', () => {
    renderCard({
      id: 'course-1',
      kind: 'event',
      start_at: '2024-05-07T09:15:00+03:00',
      type: { online: true },
      url: 'lk.fhmoscow.com/session',
    });

    const link = screen.getByRole('link', { name: /Подключиться по ссылке/ });
    expect(link).toHaveAttribute('href', 'http://lk.fhmoscow.com/session');
    expect(screen.getByText('Онлайн')).toBeInTheDocument();
  });
});
