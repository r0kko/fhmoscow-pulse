import { beforeEach, expect, jest, test, describe } from '@jest/globals';

const ntFindByPkMock = jest.fn();
const ntFindAndCountAllMock = jest.fn();
const ntCreateMock = jest.fn();
const ntUpdateMock = jest.fn();

const zoneBulkCreateMock = jest.fn();
const zoneDestroyMock = jest.fn();
const groupTypeCreateMock = jest.fn();
const groupTypeCountMock = jest.fn();
const groupTypeDestroyMock = jest.fn();

const seasonFindByPkMock = jest.fn();
const unitFindByPkMock = jest.fn();
const valTypeFindByPkMock = jest.fn();
const groupFindByPkMock = jest.fn();
const zoneFindAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  NormativeType: {
    findByPk: ntFindByPkMock,
    findAndCountAll: ntFindAndCountAllMock,
    create: ntCreateMock,
  },
  NormativeTypeZone: {
    bulkCreate: zoneBulkCreateMock,
    destroy: zoneDestroyMock,
  },
  NormativeGroupType: {
    create: groupTypeCreateMock,
    destroy: groupTypeDestroyMock,
    count: groupTypeCountMock,
  },
  MeasurementUnit: { findByPk: unitFindByPkMock },
  NormativeValueType: { findByPk: valTypeFindByPkMock },
  NormativeGroup: { findByPk: groupFindByPkMock },
  Season: { findByPk: seasonFindByPkMock },
  NormativeZone: { findAll: zoneFindAllMock },
  NormativeResult: { findAll: jest.fn() },
  User: {},
}));

const { default: svc } =
  await import('../src/services/normativeTypeService.js');

beforeEach(() => {
  ntFindByPkMock.mockReset();
  ntFindAndCountAllMock.mockReset();
  ntCreateMock.mockReset();
  ntUpdateMock.mockReset();
  zoneBulkCreateMock.mockReset();
  zoneDestroyMock.mockReset();
  groupTypeCreateMock.mockReset();
  groupTypeCountMock.mockReset();
  groupTypeDestroyMock.mockReset();
  seasonFindByPkMock.mockReset();
  unitFindByPkMock.mockReset();
  valTypeFindByPkMock.mockReset();
  groupFindByPkMock.mockReset();
  zoneFindAllMock.mockReset();
});

describe('normativeTypeService.create errors', () => {
  test('season not found', async () => {
    seasonFindByPkMock.mockResolvedValue(null);
    await expect(svc.create({ season_id: 1 }, 'actor')).rejects.toMatchObject({
      code: 'season_not_found',
    });
  });

  test('unit/value type not found', async () => {
    seasonFindByPkMock.mockResolvedValue({ id: 1 });
    unitFindByPkMock.mockResolvedValue(null);
    await expect(
      svc.create(
        {
          season_id: 1,
          unit_id: 2,
          value_type_id: 3,
          groups: [{ group_id: 'g' }],
          zones: [],
        },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'measurement_unit_not_found' });
  });

  test('normative group required/not found/invalid zones', async () => {
    seasonFindByPkMock.mockResolvedValue({ id: 1 });
    unitFindByPkMock.mockResolvedValue({
      id: 2,
      alias: 'REPS',
      fractional: false,
    });
    valTypeFindByPkMock.mockResolvedValue({ id: 3, alias: 'MORE_BETTER' });
    await expect(
      svc.create(
        { season_id: 1, unit_id: 2, value_type_id: 3, groups: [], zones: [] },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'normative_group_required' });

    groupFindByPkMock.mockResolvedValue({ id: 'g' });
    await expect(
      svc.create(
        {
          season_id: 1,
          unit_id: 2,
          value_type_id: 3,
          groups: [{ group_id: 'g' }],
          zones: 'bad',
        },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'invalid_zones' });

    groupFindByPkMock.mockResolvedValue(null);
    await expect(
      svc.create(
        {
          season_id: 1,
          unit_id: 2,
          value_type_id: 3,
          groups: [{ group_id: 'g' }],
          zones: [],
        },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'normative_group_not_found' });

    groupFindByPkMock.mockResolvedValue({ id: 'g' });
    ntCreateMock.mockResolvedValue({ id: 'nt1' });
    zoneFindAllMock.mockResolvedValue([
      { id: 1, alias: 'GREEN' },
      { id: 2, alias: 'YELLOW' },
      { id: 3, alias: 'RED' },
    ]);
    // zones empty -> buildZones returns [] -> invalid_zones
    await expect(
      svc.create(
        {
          season_id: 1,
          unit_id: 2,
          value_type_id: 3,
          groups: [{ group_id: 'g' }],
          zones: [],
        },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'invalid_zones' });
  });
});

describe('normativeTypeService.update/remove errors', () => {
  test('update throws when type not found', async () => {
    ntFindByPkMock.mockResolvedValue(null);
    await expect(svc.update('x', {}, 'actor')).rejects.toMatchObject({
      code: 'normative_type_not_found',
    });
  });

  test('update zones invalid and groups invalid', async () => {
    ntFindByPkMock.mockResolvedValue({
      id: 'nt',
      season_id: 1,
      unit_id: 2,
      value_type_id: 3,
      update: jest.fn(),
    });
    unitFindByPkMock.mockResolvedValue({
      id: 2,
      alias: 'REPS',
      fractional: false,
    });
    valTypeFindByPkMock.mockResolvedValue({ id: 3, alias: 'MORE_BETTER' });
    // zones provided and not array
    await expect(
      svc.update('nt', { zones: 'bad' }, 'actor')
    ).rejects.toMatchObject({ code: 'invalid_zones' });

    // groups invalid length
    await expect(
      svc.update('nt', { groups: [] }, 'actor')
    ).rejects.toMatchObject({ code: 'normative_group_required' });
  });

  test('remove refuses when in use and when not found', async () => {
    ntFindByPkMock.mockResolvedValue(null);
    await expect(svc.remove('x')).rejects.toMatchObject({
      code: 'normative_type_not_found',
    });
    ntFindByPkMock.mockResolvedValue({
      id: 'nt',
      update: jest.fn(),
      destroy: jest.fn(),
    });
    groupTypeCountMock.mockResolvedValue(1);
    await expect(svc.remove('nt')).rejects.toMatchObject({
      code: 'normative_type_in_use',
    });
  });
});
