import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SchoolPlayersRoster from '@/views/SchoolPlayersRoster.vue';
import { apiFetch, apiFetchBlobResponse } from '@/api';

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api');
  return {
    ...actual,
    apiFetch: vi.fn(),
    apiFetchBlobResponse: vi.fn(),
  };
});

vi.mock('bootstrap/js/dist/modal', () => ({
  default: class ModalMock {
    private element: Element | null;

    constructor(element: Element | null) {
      this.element = element;
    }

    show(): void {
      this.element?.removeAttribute('aria-hidden');
      this.element?.classList.add('show');
    }

    hide(): void {
      this.element?.setAttribute('aria-hidden', 'true');
      this.element?.classList.remove('show');
    }

    dispose(): void {}
  },
}));

const apiFetchMock = vi.mocked(apiFetch);
const apiFetchBlobResponseMock = vi.mocked(apiFetchBlobResponse);

const routes: RouteRecordRaw[] = [
  {
    path: '/school-players/season/:seasonId/year/:year',
    component: SchoolPlayersRoster,
  },
  { path: '/school-players', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function defaultSummary() {
  return {
    matches: [
      {
        id: 'match-1',
        date_start: '2026-02-01T10:00:00.000Z',
        home_team_name: 'Синие',
        away_team_name: 'Белые',
        label: '01.02.2026; Синие — Белые',
        has_snapshot: true,
      },
    ],
    players: [
      {
        id: 'player-1',
        full_name: 'Иванов Иван',
        date_of_birth: '2009-01-10',
        cells: { 'match-1': 1 },
      },
      {
        id: 'player-2',
        full_name: 'Петров Петр',
        date_of_birth: '2009-03-05',
        cells: { 'match-1': 0 },
      },
    ],
  };
}

function mockApi(summary = defaultSummary()) {
  apiFetchMock.mockImplementation(async (rawPath: unknown) => {
    const path = String(rawPath);
    if (path.startsWith('/players/season-summary')) {
      return { seasons: [{ id: 'season-1', name: '2025/26' }] };
    }
    if (path.startsWith('/clubs?')) {
      return { clubs: [{ id: 'club-1', name: 'Динамо' }] };
    }
    if (path === '/players/roles') {
      return { roles: [] };
    }
    if (path.startsWith('/players?')) {
      return {
        players: [
          {
            id: 'player-1',
            full_name: 'Иванов Иван',
            date_of_birth: '2009-01-10',
            jersey_number: 17,
            role_name: 'Нападающий',
          },
        ],
      };
    }
    if (path.startsWith('/staff?')) {
      return {
        staff: [
          {
            id: 'staff-1',
            full_name: 'Сидоров Сидор',
            date_of_birth: '1980-04-20',
          },
        ],
      };
    }
    if (path.startsWith('/teams/team-1/participation-summary?')) {
      return summary;
    }
    if (path === '/teams/team-1/participation-summary/protocols/export-jobs') {
      return {
        job_id: 'job-1',
        status: 'COMPLETED',
        total_matches: 1,
        processed_matches: 1,
        success_count: 1,
        skipped_count: 0,
        failure_count: 0,
        download_available: true,
      };
    }
    throw new Error(`Unexpected apiFetch path: ${path}`);
  });
}

async function renderView(summary = defaultSummary()) {
  mockApi(summary);
  const router = createRouterInstance();
  await router.push(
    '/school-players/season/season-1/year/2009?club_id=club-1&team_id=team-1'
  );
  await router.isReady();

  const utils = render(SchoolPlayersRoster, {
    global: {
      plugins: [router],
      stubs: {
        Breadcrumbs: true,
        EditPlayerRosterModal: true,
      },
    },
  });

  await waitFor(() => {
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/teams/team-1/participation-summary?')
    );
  });

  return utils;
}

describe('SchoolPlayersRoster view', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchBlobResponseMock.mockReset();
  });

  it('renders three section tiles and switches to staff', async () => {
    await renderView();

    expect(screen.getByRole('tab', { name: /Игроки/i })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Тренерский штаб/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Сводка участия/i })
    ).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole('tab', { name: /Тренерский штаб/i })
    );

    expect(
      screen.getByRole('tab', { name: /Тренерский штаб/i })
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('builds participation summary columns and compact played cells', async () => {
    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));

    const summarySection = container.querySelector('#summary-section');
    expect(summarySection).not.toBeNull();
    const summary = within(summarySection as HTMLElement);

    expect(summary.getByText('ФИО игрока')).toBeInTheDocument();
    expect(summary.getByText(/01\.02\.2026/)).toBeInTheDocument();
    expect(summary.getByText(/Синие/)).toBeInTheDocument();
    expect(summary.getByLabelText(/Иванов Иван: участвовал/)).toHaveTextContent(
      '1'
    );
    expect(
      summary.getByLabelText(/Иванов Иван: 100% матчей/)
    ).toHaveTextContent('100%');
    expect(
      summary.getByLabelText(/Петров Петр: не участвовал/)
    ).toHaveTextContent('0');
  });

  it('filters players in participation summary by full name', async () => {
    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.update(
      summary.getByLabelText(/Поиск по ФИО игрока/i),
      'Петров'
    );

    expect(summary.queryByText('Иванов Иван')).not.toBeInTheDocument();
    expect(summary.getByText('Петров Петр')).toBeInTheDocument();
  });

  it('exports xlsx for selected summary players', async () => {
    const createObjectUrlMock = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:participation-summary');
    const revokeObjectUrlMock = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    apiFetchBlobResponseMock.mockResolvedValue({
      blob: new Blob(['xlsx']),
      headers: new Headers({
        'Content-Disposition':
          "attachment; filename*=UTF-8''participation-summary.xlsx",
      }),
    });

    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText('Выбрать игрока Иванов Иван'));
    await fireEvent.click(summary.getByRole('button', { name: /Выгрузить/i }));
    await fireEvent.click(
      summary.getByRole('button', { name: /Скачать XLSX/i })
    );

    expect(apiFetchBlobResponseMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/export.xlsx',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          season_id: 'season-1',
          player_ids: ['player-1'],
        }),
      })
    );
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith(
      'blob:participation-summary'
    );
  });

  it('exports signed pdf from modal with event fields', async () => {
    const createObjectUrlMock = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:signed-summary');
    const revokeObjectUrlMock = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    apiFetchBlobResponseMock.mockResolvedValue({
      blob: new Blob(['pdf']),
      headers: new Headers({
        'Content-Disposition':
          "attachment; filename*=UTF-8''signed-summary.pdf",
      }),
    });

    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText('Выбрать игрока Иванов Иван'));
    await fireEvent.click(summary.getByRole('button', { name: /Выгрузить/i }));
    await fireEvent.click(
      summary.getByRole('button', { name: /Подписанный документ/i })
    );

    await fireEvent.update(
      screen.getByLabelText(/Реестровый номер мероприятия/i),
      '98239'
    );
    await fireEvent.update(
      screen.getByLabelText(/Наименование мероприятия/i),
      'XIII зимняя Спартакиада'
    );
    await fireEvent.update(screen.getByLabelText(/Дата начала/i), '2026-02-18');
    await fireEvent.update(
      screen.getByLabelText(/Дата окончания/i),
      '2026-02-27'
    );
    await fireEvent.click(screen.getByRole('button', { name: /Скачать PDF/i }));

    expect(apiFetchBlobResponseMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/export-signed.pdf',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          season_id: 'season-1',
          player_ids: ['player-1'],
          registry_number: '98239',
          event_name: 'XIII зимняя Спартакиада',
          event_date_start: '2026-02-18',
          event_date_end: '2026-02-27',
        }),
      })
    );
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:signed-summary');
  });

  it('blocks signed pdf export when end date is before start date', async () => {
    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText('Выбрать игрока Иванов Иван'));
    await fireEvent.click(summary.getByRole('button', { name: /Выгрузить/i }));
    await fireEvent.click(
      summary.getByRole('button', { name: /Подписанный документ/i })
    );

    await fireEvent.update(
      screen.getByLabelText(/Реестровый номер мероприятия/i),
      '98239'
    );
    await fireEvent.update(
      screen.getByLabelText(/Наименование мероприятия/i),
      'XIII зимняя Спартакиада'
    );
    await fireEvent.update(screen.getByLabelText(/Дата начала/i), '2026-02-27');
    await fireEvent.update(
      screen.getByLabelText(/Дата окончания/i),
      '2026-02-18'
    );
    await fireEvent.click(screen.getByRole('button', { name: /Скачать PDF/i }));

    expect(
      screen.getByText('Дата окончания не может быть раньше даты начала')
    ).toBeInTheDocument();
    expect(apiFetchBlobResponseMock).not.toHaveBeenCalled();
  });

  it('starts protocol zip export for selected players with participation', async () => {
    const createObjectUrlMock = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:protocols');
    const revokeObjectUrlMock = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    apiFetchBlobResponseMock.mockResolvedValue({
      blob: new Blob(['zip']),
      headers: new Headers({
        'Content-Disposition': "attachment; filename*=UTF-8''protocols.zip",
      }),
    });

    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText('Выбрать игрока Иванов Иван'));
    await fireEvent.click(
      summary.getByRole('button', { name: /Протоколы ZIP/i })
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/protocols/export-jobs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          season_id: 'season-1',
          player_ids: ['player-1'],
        }),
      })
    );
    expect(apiFetchBlobResponseMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/protocols/export-jobs/job-1/download.zip'
    );
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:protocols');
  });

  it('shows empty state when team has no season matches', async () => {
    await renderView({ matches: [], players: [] });

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));

    expect(
      screen.getByText('В выбранном сезоне нет матчей этой команды.')
    ).toBeInTheDocument();
  });
});
