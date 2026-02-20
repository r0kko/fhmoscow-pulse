import { render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyView from '@/views/Verify.vue';
import { setupMsw } from '../utils/msw';

const server = setupMsw();

const routes: RouteRecordRaw[] = [
  { path: '/verify', component: VerifyView },
  { path: '/', component: { template: '<div>home</div>' } },
];

function createRouterInstance() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe('Verify view (integration)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/verify');
  });

  it('verifies token from hash and sanitizes URL', async () => {
    const verifySpy = vi.fn<(token: string | null) => void>();
    server.use(
      http.get('*/verify', ({ request }) => {
        verifySpy(request.headers.get('x-verify-token'));
        return HttpResponse.json({
          ok: true,
          result: 'valid',
          message: 'Подпись документа подтверждена.',
          verifiedAt: '2026-02-20T10:00:00.000Z',
          document: {
            number: '26.02/1',
            name: 'Соглашение',
            documentDate: '2026-02-01T00:00:00.000Z',
          },
          signer: { fio: 'Иванов Иван Иванович' },
          signature: {
            type: 'Простая электронная подпись',
            signedAt: '2026-02-01T09:10:00.000Z',
            signedAtMsk: '01.02.2026, 12:10',
          },
        });
      })
    );

    window.history.replaceState({}, '', '/verify#t=token-123');
    const router = createRouterInstance();
    router.push('/verify');
    await router.isReady();

    render(VerifyView, {
      global: { plugins: [router] },
    });

    expect(
      await screen.findByText('Подпись документа подтверждена.')
    ).toBeTruthy();
    expect(await screen.findByText('Соглашение')).toBeTruthy();
    expect(await screen.findByText('26.02/1')).toBeTruthy();
    expect(verifySpy).toHaveBeenCalledWith('token-123');
    await waitFor(() => {
      expect(window.location.hash).not.toContain('t=');
    });
  });

  it('shows friendly reason message when token is missing', async () => {
    window.history.replaceState({}, '', '/verify#reason=not_found');
    const router = createRouterInstance();
    router.push('/verify');
    await router.isReady();

    render(VerifyView, {
      global: { plugins: [router] },
    });

    expect(
      await screen.findByText(
        'Ссылка недействительна или устарела. Запросите актуальную копию документа.'
      )
    ).toBeTruthy();
  });

  it('hides signing date row when signedAt is not provided', async () => {
    server.use(
      http.get('*/verify', () =>
        HttpResponse.json({
          ok: true,
          result: 'valid',
          message: 'Подпись документа подтверждена.',
          verifiedAt: '2026-02-20T10:00:00.000Z',
          document: {
            number: '26.02/1',
            name: 'Соглашение',
            documentDate: '2026-02-01T00:00:00.000Z',
          },
          signer: { fio: 'Иванов Иван Иванович' },
          signature: {
            type: 'Простая электронная подпись',
            signedAt: null,
            signedAtMsk: null,
          },
        })
      )
    );

    window.history.replaceState({}, '', '/verify#t=token-123');
    const router = createRouterInstance();
    router.push('/verify');
    await router.isReady();

    render(VerifyView, {
      global: { plugins: [router] },
    });

    expect(
      await screen.findByText('Подпись документа подтверждена.')
    ).toBeTruthy();
    expect(screen.queryByText('Дата подписания')).toBeNull();
  });
});
