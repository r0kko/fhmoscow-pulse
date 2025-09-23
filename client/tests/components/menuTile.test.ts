import { render, screen } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { describe, expect, it } from 'vitest';
import MenuTile from '../../src/components/MenuTile.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div />' } },
  { path: '/profile', component: { template: '<div>Profile</div>' } },
];

interface MenuTileTestProps {
  title: string;
  icon?: string;
  to?: string;
  note?: string;
  placeholder?: boolean;
  imageSrc?: string;
  imageAlt?: string;
  locked?: boolean;
  replace?: boolean;
}

type RenderOpts = NonNullable<Parameters<typeof render>[1]>;

async function renderMenuTile(
  props: MenuTileTestProps,
  options: Partial<RenderOpts> = {}
) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  router.push('/');
  await router.isReady();

  const { global: globalOverrides, ...rest } = options;
  const globalConfig = {
    plugins: [router, ...(globalOverrides?.plugins ?? [])],
    stubs: globalOverrides?.stubs,
    components: globalOverrides?.components,
    config: globalOverrides?.config,
    provide: globalOverrides?.provide,
  } as RenderOpts['global'];

  const renderOptions: RenderOpts = {
    props: props as RenderOpts['props'],
    global: globalConfig,
    ...(rest as RenderOpts),
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
});
