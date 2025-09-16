import { fireEvent, render, screen } from '@testing-library/vue';
import CookieNotice from '@/components/CookieNotice.vue';

describe('CookieNotice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the notice when consent is missing', async () => {
    render(CookieNotice);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      'вы соглашаетесь с использованием файлов cookie'
    );

    const confirmButton = screen.getByRole('button', { name: 'Принять' });
    expect(confirmButton).toBeEnabled();
  });

  it('hides the notice after accepting consent', async () => {
    render(CookieNotice);

    const confirmButton = await screen.findByRole('button', {
      name: 'Принять',
    });
    await fireEvent.click(confirmButton);

    expect(localStorage.getItem('cookieConsent')).toBe('true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not render when consent already granted', () => {
    localStorage.setItem('cookieConsent', 'true');

    render(CookieNotice);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
