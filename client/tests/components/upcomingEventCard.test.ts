import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import type { UpcomingListItem } from '@/types/upcoming';
import UpcomingEventCard from '@/components/UpcomingEventCard.vue';

function renderCard(event: UpcomingListItem) {
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
      isOnline: false,
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
      isOnline: false,
    });

    const link = screen.getByRole('link', { name: /Тренировка/ });
    expect(link).toHaveAttribute('href', 'https://maps.yandex.ru/ground');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByText('Онлайн')).not.toBeInTheDocument();
  });

  it('marks hybrid or online slots with a badge and meeting link', () => {
    renderCard({
      id: 'course-1',
      type: 'event',
      title: 'Мероприятие',
      description: 'Подключиться по ссылке',
      startAt: '2024-05-07T09:15:00+03:00',
      link: 'lk.fhmoscow.com/session',
      isOnline: true,
    });

    const link = screen.getByRole('link', { name: /Подключиться по ссылке/ });
    expect(link).toHaveAttribute('href', 'http://lk.fhmoscow.com/session');
    expect(screen.getByText('Онлайн')).toBeInTheDocument();
  });

  it('falls back to placeholders when start date is invalid', () => {
    renderCard({
      id: 'unknown-1',
      type: 'exam',
      title: 'Неизвестное мероприятие',
      description: 'Место уточняется',
      startAt: 'not-a-date',
      isOnline: false,
    });

    const wrapper = screen.getByText('Неизвестное мероприятие').closest('div');
    expect(wrapper?.closest('a')).toBeNull();
    const datePill = document.querySelector('.date-pill');
    expect(datePill?.textContent).toContain('—');
    const timeNode = screen.getByText('—:—');
    expect(timeNode).toHaveClass('time');
    expect(
      screen.getByLabelText(
        'Неизвестное мероприятие — Неизвестная дата, Место уточняется'
      )
    ).toBeInTheDocument();
  });

  it('omits address block when description is absent', () => {
    renderCard({
      id: 'train-2',
      type: 'training',
      title: 'Сбор',
      description: '',
      startAt: '2024-06-01T10:00:00+03:00',
      isOnline: false,
    });

    const badge = screen.getByText('Сбор');
    const card = badge.closest('.upcoming-card');
    expect(card?.querySelector('.address')).toBeNull();
  });
});
