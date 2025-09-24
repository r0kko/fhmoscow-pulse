import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import InlineError from '@/components/InlineError.vue';

describe('InlineError', () => {
  it('renders message and exposes alert semantics', async () => {
    render(InlineError, { props: { message: 'Ошибка ввода' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ошибка ввода');
  });
});
