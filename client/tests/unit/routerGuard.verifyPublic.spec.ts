import { describe, expect, it, afterEach, vi } from 'vitest';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { navigationGuard } from '@/router';
import { auth } from '@/auth';

function createRoute(
  path: string,
  meta: Record<string, unknown> = {}
): RouteLocationNormalized {
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

describe('navigationGuard — public verify page', () => {
  afterEach(() => {
    auth.user = null;
    auth.roles = [];
    auth.token = null;
    auth.mustChangePassword = false;
    vi.unstubAllGlobals();
  });

  it('allows /verify without authentication', async () => {
    auth.user = null;
    auth.roles = [];
    auth.token = null;
    auth.mustChangePassword = false;

    const to = createRoute('/verify', {
      hideLayout: true,
      title: 'Проверка документа',
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/'), next);

    expect(calls).toEqual([undefined]);
  });

  it('allows /verify even when auth state requires redirects on protected routes', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('should not call')));
    vi.stubGlobal('fetch', fetchMock);

    auth.user = null;
    auth.roles = ['REFEREE'];
    auth.token = 'stale-token';
    auth.mustChangePassword = true;

    const to = createRoute('/verify', {
      public: true,
      hideLayout: true,
      title: 'Проверка документа',
      requiresAuth: true,
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/'), next);

    expect(calls).toEqual([undefined]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
