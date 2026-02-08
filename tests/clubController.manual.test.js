import { beforeEach, expect, jest, test } from '@jest/globals';

const listTypesMock = jest.fn();
const createManualMock = jest.fn();
const updateClubMock = jest.fn();

beforeEach(() => {
  listTypesMock.mockReset();
  createManualMock.mockReset();
  updateClubMock.mockReset();
});

jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: {
    listTypes: listTypesMock,
    createManual: createManualMock,
    updateClub: updateClubMock,
  },
}));

jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: { listUserClubs: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (x) => x },
}));

const { default: controller } = await import('../src/controllers/clubController.js');

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('listTypes returns mapped dictionary', async () => {
  listTypesMock.mockResolvedValue([
    { id: '1', alias: 'YOUTH', name: 'Детско-юношеский' },
  ]);
  const res = resMock();
  await controller.listTypes({}, res);
  expect(res.json).toHaveBeenCalledWith({
    types: [{ id: '1', alias: 'YOUTH', name: 'Детско-юношеский' }],
  });
});

test('create delegates to service with actor', async () => {
  createManualMock.mockResolvedValue({ id: 'club-1' });
  const res = resMock();
  await controller.create({ body: { name: 'Клуб' }, user: { id: 'admin' } }, res);
  expect(createManualMock).toHaveBeenCalledWith({ name: 'Клуб' }, 'admin');
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ club: { id: 'club-1' } });
});

test('update delegates to service with id/body/actor', async () => {
  updateClubMock.mockResolvedValue({ id: 'club-9' });
  const res = resMock();
  await controller.update(
    { params: { id: 'club-9' }, body: { club_type_id: 'type-1' }, user: { id: 'u1' } },
    res
  );
  expect(updateClubMock).toHaveBeenCalledWith(
    'club-9',
    { club_type_id: 'type-1' },
    'u1'
  );
  expect(res.json).toHaveBeenCalledWith({ club: { id: 'club-9' } });
});
