import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PendingSignatures from '@/views/PendingSignatures.vue';
import { auth, type AuthUser } from '@/auth';
import { setupMsw } from '../utils/msw';

const server = setupMsw();

function resetAuth() {
  auth.user = null;
  auth.roles = [];
  auth.token = null;
  auth.mustChangePassword = false;
  auth.pendingSimpleSignatureCount = 0;
}

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div>Главная</div>' } },
  { path: '/documents/pending-signatures', component: PendingSignatures },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe('PendingSignatures View', () => {
  beforeEach(() => {
    resetAuth();
    const user: AuthUser = {
      id: 42,
      first_name: 'Анна',
      email: 'anna@example.com',
      status: 'ACTIVE',
    };
    auth.user = user;
    auth.roles = ['REFEREE'];
    auth.token = 'token';
    auth.pendingSimpleSignatureCount = 2;
    vi.stubGlobal('open', vi.fn());
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'data:application/pdf;base64,JVBERi0xLjQ='),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    resetAuth();
    vi.unstubAllGlobals();
  });

  it('shows pending documents, preview, and signs all with one code', async () => {
    let sendCodeCalled = 0;
    let signPayload: unknown = null;
    server.use(
      http.get('*/documents/pending-signatures', () =>
        HttpResponse.json({
          documents: [
            {
              id: 'doc-1',
              number: '26.04/1',
              name: 'Согласие',
              documentDate: '2026-04-20T09:00:00Z',
              documentType: { name: 'Согласие', alias: 'CONSENT' },
              signType: { name: 'ПЭП', alias: 'SIMPLE_ELECTRONIC' },
              status: {
                name: 'Ожидает подписи',
                alias: 'AWAITING_SIGNATURE',
              },
              file: { id: 'file-1', url: 'about:blank#doc-1' },
            },
            {
              id: 'doc-2',
              number: '26.04/2',
              name: 'Соглашение',
              documentDate: '2026-04-21T09:00:00Z',
              documentType: { name: 'Соглашение', alias: 'AGREEMENT' },
              signType: { name: 'ПЭП', alias: 'SIMPLE_ELECTRONIC' },
              status: {
                name: 'Ожидает подписи',
                alias: 'AWAITING_SIGNATURE',
              },
              file: { id: 'file-2', url: 'about:blank#doc-2' },
            },
          ],
        })
      ),
      http.post('*/documents/pending-signatures/send-code', () => {
        sendCodeCalled += 1;
        return HttpResponse.json({ message: 'sent' });
      }),
      http.get(
        '*/documents/pending-signatures/doc-1/preview',
        () =>
          new Response('%PDF-1.4 preview', {
            headers: { 'Content-Type': 'application/pdf' },
          })
      ),
      http.post(
        '*/documents/pending-signatures/sign-all',
        async ({ request }) => {
          signPayload = await request.json();
          return HttpResponse.json({
            signed_count: 2,
            failed: [],
            remaining_count: 0,
          });
        }
      ),
      http.get('*/auth/me', () =>
        HttpResponse.json({
          user: auth.user,
          roles: ['REFEREE'],
          pending_simple_signature_count: 0,
        })
      )
    );

    const router = createRouterInstance();
    router.push('/documents/pending-signatures');
    await router.isReady();

    render(PendingSignatures, {
      global: { plugins: [router] },
    });

    expect(
      await screen.findByRole('heading', { name: 'Подпишите документы' })
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Согласие')).length).toBeGreaterThan(0);
    expect(screen.getByText('Соглашение')).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole('button', { name: 'Подписать все' })
    );
    expect(sendCodeCalled).toBe(1);

    const input = await screen.findByLabelText('Код из письма');
    await fireEvent.update(input, '123456');
    await fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

    await waitFor(() =>
      expect(signPayload).toEqual({
        code: '123456',
        documentIds: ['doc-1', 'doc-2'],
      })
    );
    await waitFor(() => expect(auth.pendingSimpleSignatureCount).toBe(0));
  });
});
