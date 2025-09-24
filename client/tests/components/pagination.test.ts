import { fireEvent, render, screen } from '@testing-library/vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import Pagination from '@/components/Pagination.vue';

type PaginationProps = InstanceType<typeof Pagination>['$props'];

describe('Pagination', () => {
  it('renders full range when total pages are small', () => {
    const spy = vi.fn();
    render(Pagination, {
      props: {
        modelValue: 2,
        totalPages: 3,
        'onUpdate:modelValue': spy,
      } as PaginationProps,
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
      } as PaginationProps,
    });

    expect(screen.getAllByText('…')).toHaveLength(2);
    const pageButtons = screen.getAllByRole('button', { name: /\d/ });
    expect(pageButtons[0]).toHaveTextContent('1');
    expect(pageButtons[pageButtons.length - 1]).toHaveTextContent('10');
  });

  it('omits leading ellipsis when the active page is near the start', () => {
    render(Pagination, {
      props: {
        modelValue: 2,
        totalPages: 10,
        'onUpdate:modelValue': vi.fn(),
      } as PaginationProps,
    });

    expect(screen.getAllByText('…')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /\d/ })[1]).toHaveTextContent(
      '2'
    );
  });

  it('omits trailing ellipsis when the active page is near the end', () => {
    render(Pagination, {
      props: {
        modelValue: 9,
        totalPages: 10,
        'onUpdate:modelValue': vi.fn(),
      } as PaginationProps,
    });

    const ellipses = screen.getAllByText('…');
    expect(ellipses).toHaveLength(1);
    const nextItem = ellipses[0].parentElement?.nextElementSibling;
    expect(nextItem?.textContent).toContain('8');
    expect(
      screen.getAllByRole('button', { name: /\d/ }).pop()
    ).toHaveTextContent('10');
  });

  it('guards against ellipsis activation in event handlers', () => {
    const wrapper = mount(Pagination, {
      props: {
        modelValue: 5,
        totalPages: 10,
      } as PaginationProps,
    });

    const vm = wrapper.vm as unknown as {
      setPage: (page: number | '...') => void;
    };
    vm.setPage('...');
    expect(wrapper.emitted()['update:modelValue']).toBeFalsy();

    vm.setPage(6);
    expect(wrapper.emitted()['update:modelValue']?.[0]).toEqual([6]);

    wrapper.unmount();
  });

  it('emits updates when navigating forward and backward', async () => {
    const spy = vi.fn();
    render(Pagination, {
      props: {
        modelValue: 2,
        totalPages: 5,
        'onUpdate:modelValue': spy,
      } as PaginationProps,
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
      } as PaginationProps,
    });

    expect(screen.getByRole('button', { name: 'Пред' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'След' })).toBeDisabled();
  });
});
