import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import Pagination from '../../src/components/Pagination.vue';

describe('Pagination', () => {
  it('renders full range when total pages are small', () => {
    const spy = vi.fn();
    render(Pagination, {
      props: {
        modelValue: 2,
        totalPages: 3,
        'onUpdate:modelValue': spy,
      },
    });

    const pages = screen.getAllByRole('button', { name: /\d/ });
    expect(pages).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Пред' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'След' })).toBeEnabled();
  });

  it('collapses middle pages with ellipsis for long ranges', () => {
    render(Pagination, {
      props: {
        modelValue: 5,
        totalPages: 10,
        'onUpdate:modelValue': vi.fn(),
      },
    });

    expect(screen.getAllByText('…')).toHaveLength(2);
    const pageButtons = screen.getAllByRole('button', { name: /\d/ });
    expect(pageButtons[0]).toHaveTextContent('1');
    expect(pageButtons[pageButtons.length - 1]).toHaveTextContent('10');
  });

  it('emits updates when navigating forward and backward', async () => {
    const spy = vi.fn();
    render(Pagination, {
      props: {
        modelValue: 2,
        totalPages: 5,
        'onUpdate:modelValue': spy,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'След' }));
    expect(spy).toHaveBeenCalledWith(3);

    await fireEvent.click(screen.getByRole('button', { name: 'Пред' }));
    expect(spy).toHaveBeenCalledWith(1);

    await fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(spy).toHaveBeenCalledWith(4);
  });

  it('disables navigation at range edges', () => {
    render(Pagination, {
      props: {
        modelValue: 1,
        totalPages: 1,
        'onUpdate:modelValue': vi.fn(),
      },
    });

    expect(screen.getByRole('button', { name: 'Пред' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'След' })).toBeDisabled();
  });
});
