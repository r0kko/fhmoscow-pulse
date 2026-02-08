import { beforeEach, expect, jest, test } from '@jest/globals';

const clubCreateMock = jest.fn();
const clubFindByPkMock = jest.fn();
const clubUpdateMethodMock = jest.fn();
const clubTypeFindOneMock = jest.fn();
const clubTypeFindByPkMock = jest.fn();
const clubTypeFindAllMock = jest.fn();

beforeEach(() => {
  clubCreateMock.mockReset();
  clubFindByPkMock.mockReset();
  clubUpdateMethodMock.mockReset();
  clubTypeFindOneMock.mockReset();
  clubTypeFindByPkMock.mockReset();
  clubTypeFindAllMock.mockReset();

  clubTypeFindOneMock.mockResolvedValue({ id: 'type-youth' });
  clubTypeFindByPkMock.mockResolvedValue({ id: 'type-youth' });
  clubFindByPkMock.mockResolvedValue({
    id: 'club-1',
    update: clubUpdateMethodMock,
  });
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Club: {
    create: clubCreateMock,
    findByPk: clubFindByPkMock,
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue([0]),
  },
  ClubType: {
    findOne: clubTypeFindOneMock,
    findByPk: clubTypeFindByPkMock,
    findAll: clubTypeFindAllMock,
  },
}));

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Club: { findAll: jest.fn().mockResolvedValue([]), count: jest.fn() },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: jest.fn(async (cb) => cb({})) },
}));

const { default: service } = await import('../src/services/clubService.js');

test('createManual uses youth type by default', async () => {
  clubCreateMock.mockResolvedValue({ id: 'club-1' });
  clubFindByPkMock.mockResolvedValueOnce({ id: 'club-1' });

  const out = await service.createManual({ name: 'Новый клуб' }, 'actor-1');

  expect(clubTypeFindOneMock).toHaveBeenCalled();
  expect(clubCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: null,
      name: 'Новый клуб',
      club_type_id: 'type-youth',
      created_by: 'actor-1',
      updated_by: 'actor-1',
    })
  );
  expect(out).toEqual({ id: 'club-1' });
});

test('updateClub changes club type and name', async () => {
  clubTypeFindByPkMock.mockResolvedValue({ id: 'type-pro' });
  clubFindByPkMock
    .mockResolvedValueOnce({ id: 'club-2', update: clubUpdateMethodMock })
    .mockResolvedValueOnce({ id: 'club-2', name: 'Обновлённый' });

  const out = await service.updateClub(
    'club-2',
    { name: 'Обновлённый', club_type_id: 'type-pro' },
    'actor-2'
  );

  expect(clubUpdateMethodMock).toHaveBeenCalledWith(
    {
      updated_by: 'actor-2',
      name: 'Обновлённый',
      club_type_id: 'type-pro',
    },
    { returning: false }
  );
  expect(out).toEqual({ id: 'club-2', name: 'Обновлённый' });
});

test('listTypes returns dictionary rows', async () => {
  clubTypeFindAllMock.mockResolvedValue([{ id: 'type-youth' }]);
  const out = await service.listTypes();
  expect(out).toEqual([{ id: 'type-youth' }]);
  expect(clubTypeFindAllMock).toHaveBeenCalledWith({
    order: [['name', 'ASC']],
  });
});
