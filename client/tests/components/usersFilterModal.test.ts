import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersFilterModal from '../../src/components/UsersFilterModal.vue';
import { createRoleOption } from '../fixtures/admin';

const modalSpies = vi.hoisted(() => {
  const show = vi.fn();
  const hide = vi.fn();
  const dispose = vi.fn();
  const ctor = vi.fn(() => ({ show, hide, dispose }));
  return { show, hide, dispose, ctor };
});

vi.mock('bootstrap/js/dist/modal', () => ({
  default: modalSpies.ctor,
}));

describe('UsersFilterModal', () => {
  beforeEach(() => {
    modalSpies.show.mockClear();
    modalSpies.hide.mockClear();
    modalSpies.dispose.mockClear();
    modalSpies.ctor.mockClear();
  });

  it('applies selected filters with typed payload', async () => {
    const roles = [createRoleOption({ alias: 'MANAGER', name: 'Менеджер' })];
    const { emitted } = render(UsersFilterModal, {
      props: {
        modelValue: true,
        roles,
      },
    });

    await waitFor(() => {
      expect(modalSpies.show).toHaveBeenCalledTimes(1);
    });

    const statusSelect = screen.getByLabelText('Статус') as HTMLSelectElement;
    const roleSelect = screen.getByLabelText('Роль') as HTMLSelectElement;

    await fireEvent.update(statusSelect, 'INACTIVE');
    await fireEvent.update(roleSelect, 'MANAGER');

    const applyButton = screen.getByRole('button', { name: 'Применить' });
    await fireEvent.click(applyButton);

    expect(emitted('apply')).toEqual([[{ status: 'INACTIVE', role: 'MANAGER' }]]);
    expect(emitted('update:modelValue')).toContainEqual([false]);
    expect(modalSpies.hide).toHaveBeenCalled();
  });

  it('resets filters and closes modal gracefully', async () => {
    const roles = [createRoleOption({ alias: 'COACH', name: 'Тренер' })];
    const { emitted, rerender } = render(UsersFilterModal, {
      props: {
        modelValue: true,
        status: 'ACTIVE',
        role: 'COACH',
        roles,
      },
    });

    await waitFor(() => {
      expect(modalSpies.show).toHaveBeenCalled();
    });

    const resetButton = screen.getByRole('button', { name: 'Сбросить' });
    await fireEvent.click(resetButton);

    expect(emitted('reset')).toEqual([[]]);
    expect(emitted('update:modelValue')).toContainEqual([false]);

    await rerender({ modelValue: false });
    await waitFor(() => {
    expect(modalSpies.hide).toHaveBeenCalled();
    });
  });
});
