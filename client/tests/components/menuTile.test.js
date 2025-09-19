import { render, screen } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import MenuTile from '../../src/components/MenuTile.vue';

async function renderMenuTile(props, options = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/profile', component: { template: '<div>Profile</div>' } },
    ],
  });
  router.push('/');
  await router.isReady();

  const { global: globalOverrides, ...rest } = options;
  const globalConfig = {
    plugins: [router, ...(globalOverrides?.plugins || [])],
    stubs: globalOverrides?.stubs,
    components: globalOverrides?.components,
    config: globalOverrides?.config,
    provide: globalOverrides?.provide,
  };

  const utils = render(MenuTile, {
    props,
    global: globalConfig,
    ...rest,
  });
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
