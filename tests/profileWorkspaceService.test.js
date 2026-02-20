import { beforeEach, expect, jest, test } from '@jest/globals';

const getUserMock = jest.fn();
const getPassportByUserMock = jest.fn();
const getInnByUserMock = jest.fn();
const getSnilsByUserMock = jest.fn();
const getBankByUserMock = jest.fn();
const getTaxByUserMock = jest.fn();
const getAddressForUserMock = jest.fn();
const listUserClubsMock = jest.fn();
const listUserTeamsMock = jest.fn();
const listUserVehiclesMock = jest.fn();
const taskFindAllMock = jest.fn();
const ticketFindAllMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    getUser: getUserMock,
  },
}));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: {
    getByUser: getPassportByUserMock,
  },
}));

jest.unstable_mockModule('../src/services/innService.js', () => ({
  __esModule: true,
  default: {
    getByUser: getInnByUserMock,
  },
}));

jest.unstable_mockModule('../src/services/snilsService.js', () => ({
  __esModule: true,
  default: {
    getByUser: getSnilsByUserMock,
  },
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: {
    getByUser: getBankByUserMock,
  },
}));

jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: {
    getByUser: getTaxByUserMock,
  },
}));

jest.unstable_mockModule('../src/services/addressService.js', () => ({
  __esModule: true,
  default: {
    getForUser: getAddressForUserMock,
  },
}));

jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: {
    listUserClubs: listUserClubsMock,
  },
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: {
    listUserTeams: listUserTeamsMock,
  },
}));

jest.unstable_mockModule('../src/services/vehicleService.js', () => ({
  __esModule: true,
  default: {
    listForUser: listUserVehiclesMock,
  },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Task: { findAll: taskFindAllMock },
  TaskStatus: {},
  Ticket: { findAll: ticketFindAllMock },
  TicketStatus: {},
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/innMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/snilsMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/bankAccountMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/taxationMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/addressMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/teamMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/vehicleMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));

const { default: service } =
  await import('../src/services/profileWorkspaceService.js');

beforeEach(() => {
  getUserMock.mockReset();
  getPassportByUserMock.mockReset();
  getInnByUserMock.mockReset();
  getSnilsByUserMock.mockReset();
  getBankByUserMock.mockReset();
  getTaxByUserMock.mockReset();
  getAddressForUserMock.mockReset();
  listUserClubsMock.mockReset();
  listUserTeamsMock.mockReset();
  listUserVehiclesMock.mockReset();
  taskFindAllMock.mockReset();
  ticketFindAllMock.mockReset();
});

test('getWorkspace builds completeness and permissions', async () => {
  getUserMock.mockResolvedValue({ id: 'u-1', first_name: 'Иван' });
  getPassportByUserMock.mockResolvedValue({ id: 'p-1' });
  getInnByUserMock.mockResolvedValue(null);
  getSnilsByUserMock.mockResolvedValue({ id: 's-1' });
  getBankByUserMock.mockResolvedValue(null);
  getTaxByUserMock.mockResolvedValue(null);
  getAddressForUserMock
    .mockResolvedValueOnce({ id: 'a1' })
    .mockResolvedValueOnce(null);
  listUserClubsMock.mockResolvedValue([{ id: 'club-1', name: 'Клуб 1' }]);
  listUserTeamsMock.mockResolvedValue([{ id: 'team-1', name: 'Команда 1' }]);
  listUserVehiclesMock.mockResolvedValue([
    { id: 'veh-1', brand: 'Toyota', model: 'Camry', number: 'A123AA77' },
  ]);

  const now = Date.now();
  const oldTaskDate = new Date(now - 16 * 24 * 60 * 60 * 1000).toISOString();
  const freshTaskDate = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  taskFindAllMock.mockResolvedValue([
    {
      TaskStatus: { alias: 'PENDING' },
      updated_at: oldTaskDate,
      updatedAt: oldTaskDate,
    },
    {
      TaskStatus: { alias: 'PENDING' },
      updated_at: freshTaskDate,
      updatedAt: freshTaskDate,
    },
    {
      TaskStatus: { alias: 'COMPLETED' },
      updated_at: oldTaskDate,
      updatedAt: oldTaskDate,
    },
  ]);
  ticketFindAllMock.mockResolvedValue([
    { TicketStatus: { alias: 'CREATED' } },
    { TicketStatus: { alias: 'IN_PROGRESS' } },
    { TicketStatus: { alias: 'CONFIRMED' } },
  ]);

  const actorUser = {
    getRoles: jest
      .fn()
      .mockResolvedValue([{ alias: 'ADMINISTRATOR' }, { alias: 'SUPPORT' }]),
  };

  const result = await service.getWorkspace('u-1', actorUser);

  expect(result.user).toEqual({ id: 'u-1', first_name: 'Иван' });
  expect(result.profile.passport).toEqual({ id: 'p-1' });
  expect(result.profile.inn).toBeNull();
  expect(result.profile.snils).toEqual({ id: 's-1' });
  expect(result.profile.vehicles).toEqual([
    { id: 'veh-1', brand: 'Toyota', model: 'Camry', number: 'A123AA77' },
  ]);
  expect(result.profile.addresses.REGISTRATION).toEqual({ id: 'a1' });
  expect(result.profile.addresses.RESIDENCE).toBeNull();
  expect(result.related.tasks_summary).toEqual({ open: 2, overdue: 1 });
  expect(result.related.tickets_summary).toEqual({ open: 2, in_progress: 1 });
  expect(result.completeness.missing).toEqual(
    expect.arrayContaining(['inn', 'bank_account', 'addresses', 'taxation'])
  );
  expect(result.permissions).toEqual({
    can_edit_roles: true,
    can_manage_links: true,
  });
});
