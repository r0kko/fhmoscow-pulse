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

function signedPdfModalElement(): HTMLElement {
  const modal = document
    .getElementById('signedPdfModalTitle')
    ?.closest('.modal');
  expect(modal).not.toBeNull();
  return modal as HTMLElement;
}

type SummaryMatch = {
  id: string;
  date_start: string;
  home_team_name: string;
  away_team_name: string;
  label: string;
  has_snapshot: boolean;
  home_club_is_moscow: boolean;
  away_club_is_moscow: boolean;
};

type SummaryPlayer = {
  id: string;
  full_name: string;
  date_of_birth: string;
  cells: Record<string, number>;
};

type ParticipationSummaryFixture = {
  team_club_is_moscow: boolean;
  filters?: {
    available_tournaments: Array<{ id: string; name: string }>;
    available_stages: Array<{
      id: string;
      name: string;
      tournament_id: string;
    }>;
  };
  matches: SummaryMatch[];
  players: SummaryPlayer[];
};

function defaultSummary(): ParticipationSummaryFixture {
  return {
    team_club_is_moscow: true,
    filters: {
      available_tournaments: [{ id: 'tournament-1', name: 'Турнир 1' }],
      available_stages: [
        { id: 'stage-1', name: 'Этап 1', tournament_id: 'tournament-1' },
      ],
    },
    matches: [
      {
        id: 'match-1',
        date_start: '2026-02-01T10:00:00.000Z',
        home_team_name: 'Синие',
        away_team_name: 'Белые',
        label: '01.02.2026; Синие — Белые',
        has_snapshot: true,
        home_club_is_moscow: true,
        away_club_is_moscow: true,
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

function mixedMoscowSummary(): ParticipationSummaryFixture {
  return {
    team_club_is_moscow: true,
    filters: {
      available_tournaments: [{ id: 'tournament-1', name: 'Турнир 1' }],
      available_stages: [
        { id: 'stage-1', name: 'Этап 1', tournament_id: 'tournament-1' },
      ],
    },
    matches: [
      {
        id: 'match-1',
        date_start: '2026-02-01T10:00:00.000Z',
        home_team_name: 'Синие',
        away_team_name: 'Белые',
        label: '01.02.2026; Синие — Белые',
        has_snapshot: true,
        home_club_is_moscow: true,
        away_club_is_moscow: true,
      },
      {
        id: 'match-2',
        date_start: '2026-02-08T10:00:00.000Z',
        home_team_name: 'Синие',
        away_team_name: 'Регион',
        label: '08.02.2026; Синие — Регион',
        has_snapshot: true,
        home_club_is_moscow: true,
        away_club_is_moscow: false,
      },
    ],
    players: [
      {
        id: 'player-1',
        full_name: 'Иванов Иван',
        date_of_birth: '2009-01-10',
        cells: { 'match-1': 0, 'match-2': 1 },
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
    if (path.startsWith('/teams/team-1/participation-summary/ias-events?')) {
      return {
        events: [
          {
            id: 'event-1',
            registry_number: '102493',
            name: 'Кубок Федерации хоккея г. Москвы, 1-й этап',
            date_start: '2026-01-06',
            date_end: '2026-01-13',
            label:
              '№ 102493 · 06.01.2026 - 13.01.2026 · Кубок Федерации хоккея г. Москвы, 1-й этап',
          },
          {
            id: 'event-2',
            registry_number: '2',
            name: 'Первенство Москвы',
            date_start: '2026-01-04',
            date_end: '2026-05-31',
            label: '№ 2 · 04.01.2026 - 31.05.2026 · Первенство Москвы',
          },
        ],
      };
    }
    if (path === '/teams/team-1/participation-summary/signed-documents') {
      return {
        document: {
          id: 'document-1',
          number: '26.04/1',
          name: 'Выписка из протокола',
          status: { alias: 'SIGNED', name: 'Подписан' },
          signType: { alias: 'HANDWRITTEN', name: 'Собственноручная' },
        },
        file: { id: 'file-1', url: 'https://s3.test/extract.pdf' },
      };
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
          moscow_only: false,
        }),
      })
    );
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith(
      'blob:participation-summary'
    );
  });

  it('creates signed document from modal with IAS event', async () => {
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

    const eventSelect = await screen.findByLabelText(/Мероприятие ИАС/i);
    expect(eventSelect).toHaveValue('event-1');

    await fireEvent.click(
      screen.getByRole('button', { name: /Создать документ/i })
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/signed-documents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          season_id: 'season-1',
          player_ids: ['player-1'],
          tournament_ids: ['tournament-1'],
          ias_event_id: 'event-1',
          event_date_start: '2026-01-06',
          event_date_end: '2026-01-13',
          moscow_only: false,
        }),
      })
    );
    expect(
      screen.getByText(/Документ создан: № 26\.04\/1/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Перейти в документы/i })
    ).toHaveAttribute('href', '/documents');
  });

  it('uses IAS event selector instead of manual signed document fields', async () => {
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

    expect(
      await screen.findByLabelText(/Мероприятие ИАС/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Наименование мероприятия/i)).toHaveValue(
      'Кубок Федерации хоккея г. Москвы, 1-й этап'
    );
    expect(screen.getByLabelText(/Наименование мероприятия/i)).toHaveAttribute(
      'readonly'
    );
    expect(screen.getByLabelText(/Дата начала/i)).toHaveValue('2026-01-06');
    expect(screen.getByLabelText(/Дата окончания/i)).toHaveValue('2026-01-13');
    expect(
      screen.queryByLabelText(/Реестровый номер мероприятия/i)
    ).not.toBeInTheDocument();
    expect(
      within(signedPdfModalElement()).queryByLabelText(/Московские команды/i)
    ).not.toBeInTheDocument();
  });

  it('filters IAS events by number and name in signed document modal', async () => {
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

    const search = await screen.findByLabelText(/Поиск мероприятия ИАС/i);
    const select = screen.getByLabelText(/Мероприятие ИАС/i);

    await fireEvent.update(search, 'Первенство');
    await waitFor(() => expect(select).toHaveValue('event-2'));
    expect(select).toHaveValue('event-2');
    expect(screen.getByLabelText(/Наименование мероприятия/i)).toHaveValue(
      'Первенство Москвы'
    );
    expect(screen.getByLabelText(/Дата начала/i)).toHaveValue('2026-01-04');
    expect(screen.getByLabelText(/Дата окончания/i)).toHaveValue('2026-05-31');
    expect(
      within(select).getByRole('option', { name: /Первенство Москвы/i })
    ).toBeInTheDocument();
    expect(
      within(select).queryByRole('option', { name: /102493/i })
    ).not.toBeInTheDocument();

    await fireEvent.update(search, '102493');
    await waitFor(() => expect(select).toHaveValue('event-1'));
    expect(select).toHaveValue('event-1');
    expect(
      within(select).getByRole('option', { name: /102493/i })
    ).toBeInTheDocument();
  });

  it('uses page moscow-only filter for signed document export', async () => {
    const { container } = await renderView();

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText('Выбрать игрока Иванов Иван'));
    await fireEvent.click(summary.getByLabelText(/Московские команды/i));
    await fireEvent.click(summary.getByRole('button', { name: /Выгрузить/i }));
    await fireEvent.click(
      summary.getByRole('button', { name: /Подписанный документ/i })
    );

    await screen.findByLabelText(/Мероприятие ИАС/i);
    await fireEvent.update(screen.getByLabelText(/Дата начала/i), '2026-02-01');
    await fireEvent.update(
      screen.getByLabelText(/Дата окончания/i),
      '2026-02-10'
    );
    expect(
      within(signedPdfModalElement()).queryByLabelText(/Московские команды/i)
    ).not.toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', { name: /Создать документ/i })
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/signed-documents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          season_id: 'season-1',
          player_ids: ['player-1'],
          tournament_ids: ['tournament-1'],
          ias_event_id: 'event-1',
          event_date_start: '2026-02-01',
          event_date_end: '2026-02-10',
          moscow_only: true,
        }),
      })
    );
  });

  it('hides page moscow-only flag for non-moscow team and signed document sends false', async () => {
    const nonMoscowSummary = {
      ...defaultSummary(),
      team_club_is_moscow: false,
    };
    const { container } = await renderView(nonMoscowSummary);

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

    await screen.findByLabelText(/Мероприятие ИАС/i);
    expect(
      screen.queryByLabelText(/Московские команды/i)
    ).not.toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole('button', { name: /Создать документ/i })
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/signed-documents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          season_id: 'season-1',
          player_ids: ['player-1'],
          tournament_ids: ['tournament-1'],
          ias_event_id: 'event-1',
          event_date_start: '2026-01-06',
          event_date_end: '2026-01-13',
          moscow_only: false,
        }),
      })
    );
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
          moscow_only: false,
        }),
      })
    );
    expect(apiFetchBlobResponseMock).toHaveBeenCalledWith(
      '/teams/team-1/participation-summary/protocols/export-jobs/job-1/download.zip'
    );
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:protocols');
  });

  it('filters summary table to moscow-only matches and sends flag to exports', async () => {
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

    const { container } = await renderView(mixedMoscowSummary());

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    expect(summary.getByText(/08\.02\.2026/)).toBeInTheDocument();
    expect(summary.getByLabelText(/Иванов Иван: 50% матчей/)).toHaveTextContent(
      '50%'
    );

    await fireEvent.click(summary.getByLabelText(/Московские команды/i));

    expect(summary.queryByText(/08\.02\.2026/)).not.toBeInTheDocument();
    expect(summary.getByLabelText(/Иванов Иван: 0% матчей/)).toHaveTextContent(
      '0%'
    );

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
          moscow_only: true,
        }),
      })
    );

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith(
      'blob:participation-summary'
    );
  });

  it('sends moscow-only flag to protocol zip export from page filter', async () => {
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
    const { container } = await renderView(defaultSummary());

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText(/Московские команды/i));
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
          moscow_only: true,
        }),
      })
    );
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:protocols');
  });

  it('hides page moscow-only checkbox for non-moscow team', async () => {
    const { container } = await renderView({
      ...defaultSummary(),
      team_club_is_moscow: false,
    });

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    expect(
      summary.queryByLabelText(/Московские команды/i)
    ).not.toBeInTheDocument();
  });

  it('shows empty state when moscow-only filter has no matches', async () => {
    const nonMoscowMatch: SummaryMatch = {
      id: 'match-2',
      date_start: '2026-02-08T10:00:00.000Z',
      home_team_name: 'Синие',
      away_team_name: 'Регион',
      label: '08.02.2026; Синие — Регион',
      has_snapshot: true,
      home_club_is_moscow: true,
      away_club_is_moscow: false,
    };
    const { container } = await renderView({
      ...mixedMoscowSummary(),
      matches: [nonMoscowMatch],
    });

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));
    const summarySection = container.querySelector(
      '#summary-section'
    ) as HTMLElement;
    const summary = within(summarySection);

    await fireEvent.click(summary.getByLabelText(/Московские команды/i));

    expect(
      summary.getByText(
        'В выбранном сезоне нет матчей между московскими командами.'
      )
    ).toBeInTheDocument();
  });

  it('shows empty state when team has no season matches', async () => {
    await renderView({
      team_club_is_moscow: false,
      matches: [],
      players: [],
    });

    await fireEvent.click(screen.getByRole('tab', { name: /Сводка участия/i }));

    expect(
      screen.getByText('В выбранном сезоне нет матчей этой команды.')
    ).toBeInTheDocument();
  });
});
