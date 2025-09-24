import { render, screen } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { describe, expect, it } from 'vitest';
import BaseTile from '@/components/BaseTile.vue';

const baseRoutes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div />' } },
];

async function renderWithRouter(props: Record<string, unknown>) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: baseRoutes,
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

  it('supports named router destinations via object syntax', async () => {
    await renderWithRouter({
      to: { path: '/' },
      ariaLabel: 'Домой',
    });

    const link = screen.getByRole('link', { name: 'Домой' });
    expect(link).toHaveAttribute('href', '/');
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

  it('honors explicit target and rel overrides for link-like destinations', () => {
    render(BaseTile, {
      props: {
        to: 'tel:+79991112233',
        ariaLabel: 'Позвонить',
        target: '_self',
        rel: 'nofollow',
      },
      slots: {
        default: '<span>Позвонить</span>',
      },
    });

    const link = screen.getByRole('link', { name: 'Позвонить' });
    expect(link).toHaveAttribute('href', 'tel:+79991112233');
    expect(link).toHaveAttribute('target', '_self');
    expect(link).toHaveAttribute('rel', 'nofollow');
  });

  it('renders mailto and hash destinations without forcing new tab', () => {
    const { unmount } = render(BaseTile, {
      props: {
        to: 'mailto:support@fhmoscow.com',
        ariaLabel: 'Написать в поддержку',
      },
      slots: {
        default: '<span>Связаться</span>',
      },
    });

    const mailLink = screen.getByRole('link', { name: 'Написать в поддержку' });
    expect(mailLink).toHaveAttribute('href', 'mailto:support@fhmoscow.com');
    expect(mailLink).not.toHaveAttribute('target');
    expect(mailLink).not.toHaveAttribute('rel');

    unmount();

    render(BaseTile, {
      props: {
        to: '#details',
        ariaLabel: 'Перейти к деталям',
      },
      slots: {
        default: '<span>Подробнее</span>',
      },
    });

    const anchorLink = screen.getByRole('link', { name: 'Перейти к деталям' });
    expect(anchorLink).toHaveAttribute('href', '#details');
    expect(anchorLink).not.toHaveAttribute('target');
    expect(anchorLink).not.toHaveAttribute('rel');
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

  it('switches to button semantics when requested', () => {
    render(BaseTile, {
      props: {
        role: 'button',
        ariaLabel: 'Открыть модальное окно',
      },
      slots: {
        default: '<span>Открыть</span>',
      },
    });

    const button = screen.getByRole('button', {
      name: 'Открыть модальное окно',
    });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('role');
    expect(button).not.toHaveAttribute('tabindex');
  });

  it('falls back to default group role when custom role is empty', () => {
    render(BaseTile, {
      props: {
        role: '',
        ariaLabel: 'Статичный блок',
      },
      slots: {
        default: '<span>Контент</span>',
      },
    });

    const region = screen.getByText('Контент').closest('.card');
    expect(region).toHaveAttribute('role', 'group');
  });
});
