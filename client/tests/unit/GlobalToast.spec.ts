import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import GlobalToast from '@/components/GlobalToast.vue';
import { useToast } from '@/utils/toast';

describe('GlobalToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders active toasts and auto-dismisses them after timeout', async () => {
    const { showToast } = useToast();
    render(GlobalToast);

    showToast('Привет', 'success', 2000);

    await screen.findByText('Привет');
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.queryByText('Привет')).not.toBeInTheDocument();
    });
  });

  it('allows closing via button and Escape key', async () => {
    const { showToast } = useToast();
    render(GlobalToast);

    showToast('Закрыть кнопку', 'warning', 0);
    const closeButton = await screen.findByRole('button', { name: 'Закрыть' });
    await fireEvent.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByText('Закрыть кнопку')).not.toBeInTheDocument();
    });

    showToast('Escape close', 'info', 0);
    await screen.findByText('Escape close');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await waitFor(() => {
      expect(screen.queryByText('Escape close')).not.toBeInTheDocument();
    });
  });
});
