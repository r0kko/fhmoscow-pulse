import { render, screen, type RenderOptions } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { describe, expect, it } from 'vitest';
import MenuTile from '@/components/MenuTile.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div />' } },
  { path: '/profile', component: { template: '<div>Profile</div>' } },
];

type MenuTileProps = InstanceType<typeof MenuTile>['$props'];

type MenuTileTestProps = Partial<MenuTileProps> & {
  title: MenuTileProps['title'];
};

type MenuTileRenderOptions = RenderOptions<typeof MenuTile>;

async function renderMenuTile(
  props: MenuTileTestProps,
  options: MenuTileRenderOptions = {}
) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  router.push('/');
  await router.isReady();

  const { global: globalOverrides, props: extraProps, ...rest } = options;
  const globalConfig: MenuTileRenderOptions['global'] = {
    plugins: [router, ...(globalOverrides?.plugins ?? [])],
  };
  if (globalOverrides?.stubs) globalConfig.stubs = globalOverrides.stubs;
  if (globalOverrides?.components)
    globalConfig.components = globalOverrides.components;
  if (globalOverrides?.config) globalConfig.config = globalOverrides.config;
  if (globalOverrides?.provide) globalConfig.provide = globalOverrides.provide;

  const renderOptions: MenuTileRenderOptions = {
    ...rest,
    props: { ...(extraProps ?? {}), ...props },
    global: globalConfig,
  };

  const utils = render(MenuTile, renderOptions);
  return { router, ...utils };
}

describe('MenuTile', () => {
  it('exposes router navigation when destination is provided', async () => {
    await renderMenuTile({
      title: 'Профиль',
      icon: 'bi-person-circle',
      to: '/profile',
    });

    const link = screen.getByRole('link', { name: 'Профиль' });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/profile');
  });

  it('renders image tile when imageSrc is supplied', async () => {
    await renderMenuTile(
      {
        title: 'Документы',
        imageSrc: '/test/image.png',
        imageAlt: 'Документы',
        to: '/documents',
      },
      {
        global: {
          stubs: {
            RouterLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      }
    );

    const img = screen.getByRole('img', { name: 'Документы' });
    expect(img).toHaveAttribute('src', '/test/image.png');
  });

  it('marks tile as placeholder when destination is absent', () => {
    render(MenuTile, {
      props: {
        title: 'Недоступно',
        icon: 'bi-lock',
        placeholder: true,
      },
    });

    const card = screen.getByText('Недоступно').closest('.card');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card?.querySelector('i')).toHaveClass('bi-lock');
  });

  it('shows locked badge and hides supplemental note when locked', async () => {
    await renderMenuTile(
      {
        title: 'Закрытый раздел',
        icon: 'bi-shield-lock',
        to: '/restricted',
        locked: true,
        note: 'В разработке',
      },
      {
        global: {
          stubs: {
            RouterLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      }
    );

    const card = screen.getByText('Закрытый раздел').closest('.card');
    expect(card).not.toBeNull();
    const lockBadge = card?.querySelector('.lock-badge') as HTMLElement | null;
    expect(lockBadge).not.toBeNull();
    expect(lockBadge).toHaveClass('bi', 'bi-lock-fill');
    expect(screen.getByText('Доступ ограничен')).toHaveClass('visually-hidden');
    expect(screen.queryByText('В разработке')).not.toBeInTheDocument();
  });

  it('renders contextual note for available tiles', async () => {
    await renderMenuTile(
      {
        title: 'Отчеты',
        icon: 'bi-graph-up',
        to: '/reports',
        note: 'Новые материалы',
      },
      {
        global: {
          stubs: {
            RouterLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      }
    );

    expect(screen.getByText('Новые материалы')).toHaveClass(
      'tile-note',
      'text-muted',
      'small'
    );
  });

  it('falls back to empty alternate text when imageAlt is missing', async () => {
    await renderMenuTile(
      {
        title: 'Иконка',
        imageSrc: '/icons/sample.png',
        to: '/icons',
      },
      {
        global: {
          stubs: {
            RouterLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      }
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', '');
  });

  it('marks card as non-interactive when no destination is provided', async () => {
    await renderMenuTile(
      {
        title: 'Без ссылки',
        icon: 'bi-info-circle',
      },
      {
        global: {
          stubs: {
            RouterLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      }
    );

    const card = screen.getByText('Без ссылки').closest('.card');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card?.className).toContain('placeholder-card');
  });
});
