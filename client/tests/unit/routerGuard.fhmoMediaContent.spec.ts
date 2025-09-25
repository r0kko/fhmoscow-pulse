import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type {
  NavigationGuardNext,
  RouteLocationNormalized,
} from 'vue-router';
import { navigationGuard } from '@/router';
import { auth, type AuthUser } from '@/auth';

type Meta = Record<string, unknown>;

function createRoute(path: string, meta: Meta = {}): RouteLocationNormalized {
  return {
    fullPath: path,
    hash: '',
    matched: [],
    meta,
    name: undefined,
    params: {},
    path,
    redirectedFrom: undefined,
    query: {},
  } as RouteLocationNormalized;
}

function createNextRecorder() {
  const calls: unknown[] = [];
  const next: NavigationGuardNext = (arg?: unknown) => {
    calls.push(arg);
    return undefined;
  };
  return { calls, next };
}

describe('navigationGuard — FHMO media content moderator access', () => {
  beforeEach(() => {
    const user: AuthUser = { id: 1, status: 'ACTIVE' };
    auth.user = user;
    auth.roles = ['FHMO_MEDIA_CONTENT_MODERATOR'];
    auth.token = 'token';
    auth.mustChangePassword = false;
  });

  afterEach(() => {
    auth.user = null;
    auth.roles = [];
    auth.token = null;
    auth.mustChangePassword = false;
  });

  it('allows access to administrative home when flagged for media content', async () => {
    const to = createRoute('/admin', {
      requiresAuth: true,
      requiresAdmin: true,
      allowFhmoMediaContent: true,
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/'), next);

    expect(calls).toEqual([undefined]);
  });

  it('allows access to player photo requests admin section', async () => {
    const to = createRoute('/admin/player-photo-requests', {
      requiresAuth: true,
      requiresAdmin: true,
      allowFhmoMediaContent: true,
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/admin'), next);

    expect(calls).toEqual([undefined]);
  });

  it('denies access to other administrative routes', async () => {
    const to = createRoute('/admin/users', {
      requiresAuth: true,
      requiresAdmin: true,
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/admin'), next);

    expect(calls).toEqual(['/forbidden']);
  });
});
