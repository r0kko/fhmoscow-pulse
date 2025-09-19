import { render, screen } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import BaseTile from '../../src/components/BaseTile.vue';

async function renderWithRouter(props) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });
  router.push('/');
  await router.isReady();

  const utils = render(BaseTile, {
    props,
    slots: { default: '<span>Контент</span>' },
    global: {
      plugins: [router],
    },
  });
  return { router, ...utils };
}

describe('BaseTile', () => {
  it('renders a router link when provided with an internal route', async () => {
    await renderWithRouter({
      to: '/',
      ariaLabel: 'Открыть главную',
      extraClass: 'custom-class',
    });

    const link = screen.getByRole('link', { name: 'Открыть главную' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/');
    expect(link).not.toHaveAttribute('aria-disabled');
    expect(link.className).toContain('custom-class');
  });

  it('defaults external links to open in a new tab securely', async () => {
    render(BaseTile, {
      props: {
        to: 'https://fhmoscow.com',
        ariaLabel: 'Внешний ресурс',
        section: true,
      },
      slots: {
        default: '<span>Внешний</span>',
      },
    });

    const link = screen.getByRole('link', { name: 'Внешний ресурс' });
    expect(link).toHaveAttribute('href', 'https://fhmoscow.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders as an inert group when disabled or missing destination', () => {
    render(BaseTile, {
      props: {
        disabled: true,
        ariaLabel: 'Неактивно',
      },
      slots: {
        default: '<span>Недоступно</span>',
      },
    });

    const region = screen.getByText('Недоступно').closest('.card');
    expect(region?.tagName).toBe('DIV');
    expect(region).toHaveAttribute('aria-disabled', 'true');
    expect(region).toHaveAttribute('role', 'group');
    expect(region).toHaveAttribute('tabindex', '0');
  });
});
