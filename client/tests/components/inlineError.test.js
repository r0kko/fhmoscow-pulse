import { render, screen } from '@testing-library/vue';
import InlineError from '../../src/components/InlineError.vue';

describe('InlineError', () => {
  it('renders message and has alert role', async () => {
    render(InlineError, { props: { message: 'Ошибка ввода' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ошибка ввода');
  });
});
