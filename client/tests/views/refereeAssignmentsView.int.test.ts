import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RefereeAssignmentsView from '@/views/RefereeAssignments.vue';
import edgeFade from '@/utils/edgeFade';
import { auth } from '@/auth';
import { setupMsw } from '../utils/msw';

const modalSpies = vi.hoisted(() => {
  const show = vi.fn();
  const hide = vi.fn();
  const dispose = vi.fn();
  const ctor = vi.fn();
  class ModalMock {
    _element: HTMLElement | null;
    constructor(element?: HTMLElement) {
      this._element = element || null;
      ctor(element);
    }
    show(): void {
      show();
    }
    hide(): void {
      hide();
      this._element?.dispatchEvent(new Event('hidden.bs.modal'));
    }
    dispose(): void {
      dispose();
    }
  }
  return { show, hide, dispose, ctor, ModalMock };
});

vi.mock('bootstrap/js/dist/modal', () => ({
  default: modalSpies.ModalMock,
}));

const server = setupMsw();

const TEST_DATE = '2099-02-10';

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div />' } },
  { path: '/referee-assignments', component: RefereeAssignmentsView },
  {
    path: '/referee-assignments/matches/:id',
    component: { template: '<div />' },
  },
];

function createRouterInstance() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function makeMatch(status: 'PUBLISHED' | 'CONFIRMED' = 'PUBLISHED') {
  return {
    id: 'm1',
    date_start: '2099-02-10T09:00:00.000Z',
    msk_start_time: '12:00',
    msk_end_time: '12:30',
    duration_minutes: 30,
    tournament: { id: 't1', name: 'Кубок', short_name: 'Кубок' },
    group: { id: 'g1', name: 'Группа A' },
    ground: {
      id: 'gr1',
      name: 'Арена',
      address: 'ул. Спортивная, 1',
      metro: [{ name: 'Динамо' }],
      yandex_url: 'maps.yandex.ru',
    },
    team1: { id: 'h1', name: 'Команда 1' },
    team2: { id: 'a1', name: 'Команда 2' },
    assignments: [
      {
        id: 'as1',
        status,
        role: {
          id: 'r1',
          name: 'Главный судья',
          group_id: 'rg1',
          group_name: 'Поле',
        },
        user: {
          id: 1,
          last_name: 'Иванов',
          first_name: 'Иван',
          patronymic: 'Иванович',
        },
      },
    ],
  };
}

describe('RefereeAssignments view', () => {
  beforeEach(() => {
    auth.user = { id: 1, first_name: 'Иван' };
    auth.roles = ['REFEREE'];
    auth.token = 'token';
    auth.mustChangePassword = false;
    modalSpies.show.mockClear();
    modalSpies.hide.mockClear();
    modalSpies.dispose.mockClear();
    modalSpies.ctor.mockClear();
  });

  it('renders day status and opens match from a dedicated button', async () => {
    server.use(
      http.get('*/referee-assignments/my/dates', () =>
        HttpResponse.json({
          dates: [{ date: TEST_DATE, total: 1, published: 1, confirmed: 0 }],
        })
      ),
      http.get('*/referee-assignments/my', () =>
        HttpResponse.json({
          date: TEST_DATE,
          matches: [makeMatch('PUBLISHED')],
          day_summary: {
            total: 1,
            published: 1,
            confirmed: 0,
            needs_confirmation: true,
          },
        })
      )
    );

    const router = createRouterInstance();
    router.push('/referee-assignments');
    await router.isReady();

    render(RefereeAssignmentsView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    expect(
      await screen.findByText('Нужно подтвердить 1 матч')
    ).toBeInTheDocument();
    const openMatchButton = screen.getByRole('button', {
      name: 'Открыть матч Команда 1 — Команда 2',
    });
    await fireEvent.click(openMatchButton);

    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe(
        '/referee-assignments/matches/m1'
      );
    });
  });

  it('confirms day assignments with optimistic update and restores focus', async () => {
    let confirmed = false;
    server.use(
      http.get('*/referee-assignments/my/dates', () =>
        HttpResponse.json({
          dates: [{ date: TEST_DATE, total: 1, published: 1, confirmed: 0 }],
        })
      ),
      http.get('*/referee-assignments/my', () =>
        HttpResponse.json({
          date: TEST_DATE,
          matches: [makeMatch(confirmed ? 'CONFIRMED' : 'PUBLISHED')],
          day_summary: confirmed
            ? {
                total: 1,
                published: 0,
                confirmed: 1,
                needs_confirmation: false,
              }
            : {
                total: 1,
                published: 1,
                confirmed: 0,
                needs_confirmation: true,
              },
        })
      ),
      http.post('*/referee-assignments/my/confirm', async ({ request }) => {
        await request.json();
        confirmed = true;
        return HttpResponse.json({
          date: TEST_DATE,
          confirmed_matches: ['m1'],
          confirmed_count: 1,
        });
      })
    );

    const router = createRouterInstance();
    router.push('/referee-assignments');
    await router.isReady();

    render(RefereeAssignmentsView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    const openConfirmButton = await screen.findByRole('button', {
      name: 'Подтвердить назначения (1)',
    });

    await fireEvent.click(openConfirmButton);
    const confirmAllButton = document.querySelector(
      '.modal-footer .btn.btn-primary'
    ) as HTMLButtonElement | null;
    expect(confirmAllButton).not.toBeNull();
    await fireEvent.click(confirmAllButton as HTMLButtonElement);

    expect(
      await screen.findByText('Все назначения на день подтверждены')
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(modalSpies.hide).toHaveBeenCalled();
    });
    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent || '').toContain('Подтверждено матчей: 1');
    });
    await waitFor(() => {
      const focusedElement = document.activeElement as HTMLElement | null;
      expect(focusedElement?.dataset['confirmDayTrigger']).toBe('true');
      expect(focusedElement?.textContent || '').toContain(
        'Назначения подтверждены'
      );
    });
  });

  it('shows translated confirm error in live region', async () => {
    server.use(
      http.get('*/referee-assignments/my/dates', () =>
        HttpResponse.json({
          dates: [{ date: TEST_DATE, total: 1, published: 1, confirmed: 0 }],
        })
      ),
      http.get('*/referee-assignments/my', () =>
        HttpResponse.json({
          date: TEST_DATE,
          matches: [makeMatch('PUBLISHED')],
          day_summary: {
            total: 1,
            published: 1,
            confirmed: 0,
            needs_confirmation: true,
          },
        })
      ),
      http.post('*/referee-assignments/my/confirm', () =>
        HttpResponse.json(
          { error: 'referee_assignments_missing' },
          { status: 400 }
        )
      )
    );

    const router = createRouterInstance();
    router.push('/referee-assignments');
    await router.isReady();

    render(RefereeAssignmentsView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    await fireEvent.click(
      await screen.findByRole('button', { name: 'Подтвердить назначения (1)' })
    );
    const confirmAllButton = document.querySelector(
      '.modal-footer .btn.btn-primary'
    ) as HTMLButtonElement | null;
    expect(confirmAllButton).not.toBeNull();
    await fireEvent.click(confirmAllButton as HTMLButtonElement);

    expect(
      await screen.findByText('Черновик назначения не найден', {
        selector: '.text-danger',
      })
    ).toBeInTheDocument();
  });
});
