import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { navigationGuard } from '@/router';
import { auth, type AuthUser } from '@/auth';

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

describe('navigationGuard — pending simple signatures', () => {
  beforeEach(() => {
    const user: AuthUser = { id: 1, status: 'ACTIVE' };
    auth.user = user;
    auth.roles = ['REFEREE'];
    auth.token = 'token';
    auth.mustChangePassword = false;
    auth.pendingSimpleSignatureCount = 2;
  });

  afterEach(() => {
    auth.user = null;
    auth.roles = [];
    auth.token = null;
    auth.mustChangePassword = false;
    auth.pendingSimpleSignatureCount = 0;
  });

  it('redirects protected working routes to pending signatures page', async () => {
    const to = createRoute('/referee-assignments', {
      requiresAuth: true,
      requiresReferee: true,
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/'), next);

    expect(calls).toEqual(['/documents/pending-signatures']);
  });

  it('allows the pending signatures page itself', async () => {
    const to = createRoute('/documents/pending-signatures', {
      requiresAuth: true,
      allowsPendingSignatures: true,
    });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/'), next);

    expect(calls).toEqual([undefined]);
  });

  it('does not block public unactionable routes', async () => {
    const to = createRoute('/login', { hideLayout: true });
    const { calls, next } = createNextRecorder();

    await navigationGuard(to, createRoute('/'), next);

    expect(calls).toEqual([undefined]);
  });

  it('allows password and profile completion pages as explicit exceptions', async () => {
    const passwordNext = createNextRecorder();
    await navigationGuard(
      createRoute('/change-password', { requiresAuth: true }),
      createRoute('/'),
      passwordNext.next
    );

    expect(passwordNext.calls).toEqual([undefined]);

    const profileNext = createNextRecorder();
    await navigationGuard(
      createRoute('/complete-profile', { requiresAuth: true }),
      createRoute('/'),
      profileNext.next
    );

    expect(profileNext.calls).toEqual([undefined]);
  });

  it('keeps password and profile completion redirects ahead of signature lock', async () => {
    auth.mustChangePassword = true;
    const passwordRoute = createRoute('/profile', { requiresAuth: true });
    const passwordNext = createNextRecorder();

    await navigationGuard(passwordRoute, createRoute('/'), passwordNext.next);

    expect(passwordNext.calls).toEqual(['/change-password']);

    auth.mustChangePassword = false;
    auth.user = { id: 1, status: 'REGISTRATION_STEP_2' };
    const profileRoute = createRoute('/profile', { requiresAuth: true });
    const profileNext = createNextRecorder();

    await navigationGuard(profileRoute, createRoute('/'), profileNext.next);

    expect(profileNext.calls).toEqual(['/complete-profile']);
  });
});
