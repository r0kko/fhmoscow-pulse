import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import EmptyState from '@/components/EmptyState.vue';

describe('EmptyState', () => {
  it('renders defaults with accessible icon semantics', () => {
    const { container } = render(EmptyState);

    expect(screen.getByText('Нет данных')).toBeInTheDocument();
    const icon = container.querySelector('.icon-wrap i');
    expect(icon).not.toBeNull();
    if (!icon) throw new Error('Icon element not found');
    expect(icon).toHaveClass('bi');
    expect(icon).toHaveClass('bi-info-circle');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding copy and projecting follow-up actions', () => {
    const { container } = render(EmptyState, {
      props: {
        icon: 'bi-emoji-smile',
        title: 'Всё готово',
        description: 'Добавьте первый элемент',
      },
      slots: {
        default: '<button type="button">Создать</button>',
      },
    });

    expect(screen.getByText('Всё готово')).toBeInTheDocument();
    expect(screen.getByText('Добавьте первый элемент')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать' })).toBeInTheDocument();
    const icon = container.querySelector('.icon-wrap i');
    expect(icon).not.toBeNull();
    if (!icon) throw new Error('Icon element not found');
    expect(icon).toHaveClass('bi-emoji-smile');
  });
});
