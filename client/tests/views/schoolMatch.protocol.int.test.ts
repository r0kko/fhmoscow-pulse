import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SchoolMatchView from '@/views/SchoolMatch.vue';
import edgeFade from '@/utils/edgeFade';
import { auth } from '@/auth';

const { apiFetchMock, apiFetchBlobResponseMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  apiFetchBlobResponseMock: vi.fn(),
}));

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api');
  return {
    ...actual,
    apiFetch: apiFetchMock,
    apiFetchBlobResponse: apiFetchBlobResponseMock,
  };
});

const routes: RouteRecordRaw[] = [
  { path: '/school-matches/:id', component: SchoolMatchView },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function buildMatchResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    match: {
      id: 'match-1',
      external_id: 77,
      date_start: '2026-04-20T10:00:00.000Z',
      team1: 'Синие',
      team2: 'Белые',
      season: '2025/26',
      tournament: 'Первенство',
      is_home: true,
      is_away: false,
      broadcast_links: [],
      permissions: {
        agreements: { allowed: true },
        lineups: { allowed: true },
      },
      status: { alias: 'FINISHED', name: 'Завершён' },
      protocol_download: { configured: true, available: true },
      ...overrides,
    },
  };
}

describe('SchoolMatch protocol tile', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchBlobResponseMock.mockReset();
    auth.user = { id: 1, first_name: 'Тест' };
    auth.roles = ['SPORT_SCHOOL_STAFF'];
    auth.token = 'token';
    auth.mustChangePassword = false;
  });

  afterEach(() => {
    auth.user = null;
    auth.roles = [];
    auth.token = null;
    auth.mustChangePassword = false;
    vi.restoreAllMocks();
  });

  it('downloads protocol for finished matches', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/matches/match-1') return buildMatchResponse();
      if (path === '/matches/match-1/agreements') return { agreements: [] };
      if (path === '/matches/match-1/penalties') return { items: [] };
      throw new Error(`Unexpected apiFetch path: ${path}`);
    });
    apiFetchBlobResponseMock.mockResolvedValue({
      blob: new Blob([new Uint8Array([37, 80, 68, 70])], {
        type: 'application/pdf',
      }),
      headers: new Headers({
        'Content-Disposition': "attachment; filename*=UTF-8''protocol-1.pdf",
      }),
    });

    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:match-protocol');
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const router = createRouterInstance();
    router.push('/school-matches/match-1');
    await router.isReady();

    render(SchoolMatchView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    const button = await screen.findByRole('button', {
      name: 'Скачать протокол',
    });
    await waitFor(() => expect(button).toBeEnabled());

    await fireEvent.click(button);

    await waitFor(() =>
      expect(apiFetchBlobResponseMock).toHaveBeenCalledWith(
        '/matches/match-1/protocol/download.pdf'
      )
    );
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:match-protocol');
  });

  it('keeps the tile disabled for unfinished matches', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/matches/match-1') {
        return buildMatchResponse({
          status: { alias: 'SCHEDULED', name: 'Запланирован' },
        });
      }
      if (path === '/matches/match-1/agreements') return { agreements: [] };
      if (path === '/matches/match-1/penalties') return { items: [] };
      throw new Error(`Unexpected apiFetch path: ${path}`);
    });

    const router = createRouterInstance();
    router.push('/school-matches/match-1');
    await router.isReady();

    render(SchoolMatchView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    const button = await screen.findByRole('button', {
      name: 'Скачать протокол',
    });
    expect(button).toBeDisabled();
    expect(
      await screen.findByText('После завершения матча')
    ).toBeInTheDocument();
  });
});
