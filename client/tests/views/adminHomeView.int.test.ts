import { render, screen } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AdminHome from '@/views/AdminHome.vue';
import edgeFade from '@/utils/edgeFade';
import { auth } from '@/auth';

function resetAuth() {
  auth.user = null;
  auth.roles = [];
  auth.token = null;
  auth.mustChangePassword = false;
}

const routes: RouteRecordRaw[] = [
  { path: '/admin', component: AdminHome },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe('Admin Home view', () => {
  beforeEach(() => {
    resetAuth();
  });

  afterEach(() => {
    resetAuth();
  });

  it('shows full administrative suite for platform administrators', async () => {
    auth.roles = ['ADMIN'];
    const router = createRouterInstance();
    router.push('/admin');
    await router.isReady();

    render(AdminHome, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Пользователи системы' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Управление медиа и контентом',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Фото игроков' })
    ).toBeInTheDocument();
  });

  it('scopes FHMO content moderators to media management only', async () => {
    auth.roles = ['FHMO_MEDIA_CONTENT_MODERATOR'];
    const router = createRouterInstance();
    router.push('/admin');
    await router.isReady();

    render(AdminHome, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Управление медиа и контентом',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Фото игроков' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Пользователи системы' })
    ).toBeNull();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'Управление спортивной частью',
      })
    ).toBeNull();
  });
});
