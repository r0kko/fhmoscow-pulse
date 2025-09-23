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
      type: 'exam',
      title: 'Медосмотр',
      description: 'Клиника №3 · APPROVED',
      startAt: '2024-05-05T08:00:00+03:00',
    });

    const badge = screen.getByText('Медосмотр');
    const card = badge.closest('.upcoming-card');
    expect(card?.parentElement?.tagName).toBe('DIV');
    expect(screen.getByText('Клиника №3 · APPROVED')).toBeInTheDocument();
  });

  it('links to ground map for offline trainings', () => {
    renderCard({
      id: 'train-1',
      type: 'training',
      title: 'Тренировка',
      description: 'Ледовый дворец',
      startAt: '2024-05-06T12:30:00+03:00',
      link: 'https://maps.yandex.ru/ground',
    });

    const link = screen.getByRole('link', { name: /Тренировка/ });
    expect(link).toHaveAttribute('href', 'https://maps.yandex.ru/ground');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('marks hybrid or online slots with a badge and meeting link', () => {
    renderCard({
      id: 'course-1',
      type: 'event',
      title: 'Мероприятие',
      description: 'Подключиться по ссылке',
      startAt: '2024-05-07T09:15:00+03:00',
      link: 'lk.fhmoscow.com/session',
    });

    const link = screen.getByRole('link', { name: /Подключиться по ссылке/ });
    expect(link).toHaveAttribute('href', 'http://lk.fhmoscow.com/session');
    expect(screen.getByText('Онлайн')).toBeInTheDocument();
  });
});
