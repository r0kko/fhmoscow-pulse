import { jest, expect, test } from '@jest/globals';

const findAndCountAllUsersMock = jest.fn();
const findAllTypesMock = jest.fn();
const findAllResultsMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findAndCountAll: findAndCountAllUsersMock },
  Role: {},
  NormativeType: { findAll: findAllTypesMock },
  NormativeGroupType: {},
  NormativeGroup: {},
  NormativeResult: { findAll: findAllResultsMock },
  NormativeZone: {},
  NormativeValueType: {},
  MeasurementUnit: {},
  Season: { findOne: jest.fn(() => ({ id: 's1' })) },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (u) => u },
}));

jest.unstable_mockModule('../src/mappers/normativeGroupMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (g) => g },
}));

jest.unstable_mockModule('../src/mappers/normativeZoneMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (z) => z },
}));

const { default: service } =
  await import('../src/services/normativeLedgerService.js');

findAndCountAllUsersMock.mockResolvedValue({ rows: [{ id: 'u1' }], count: 1 });
findAllTypesMock.mockResolvedValue([
  {
    id: 't1',
    name: 'N1',
    MeasurementUnit: { alias: 'MIN_SEC' },
    NormativeGroupTypes: [{ NormativeGroup: { id: 'g1', name: 'G1' } }],
  },
  {
    id: 't2',
    name: 'N2',
    MeasurementUnit: { alias: 'REPS' },
    NormativeGroupTypes: [{ NormativeGroup: { id: 'g1', name: 'G1' } }],
  },
]);
findAllResultsMock.mockResolvedValue([
  {
    user_id: 'u1',
    type_id: 't1',
    value: 5,
    NormativeZone: { alias: 'GREEN' },
    NormativeValueType: { alias: 'MORE_BETTER' },
  },
  {
    user_id: 'u1',
    type_id: 't1',
    value: 7,
    NormativeZone: { alias: 'YELLOW' },
    NormativeValueType: { alias: 'MORE_BETTER' },
  },
  {
    user_id: 'u1',
    type_id: 't2',
    value: 10,
    NormativeZone: { alias: 'GREEN' },
    NormativeValueType: { alias: 'LESS_BETTER' },
  },
  {
    user_id: 'u1',
    type_id: 't2',
    value: 8,
    NormativeZone: { alias: 'YELLOW' },
    NormativeValueType: { alias: 'LESS_BETTER' },
  },
]);

test('list returns best results and total', async () => {
  const { judges, groups, total } = await service.list({ page: 2, limit: 5 });
  expect(total).toBe(1);
  expect(findAndCountAllUsersMock).toHaveBeenCalledWith(
    expect.objectContaining({ limit: 5, offset: 5 })
  );
  expect(judges).toHaveLength(1);
  expect(groups[0].types).toHaveLength(2);
  expect(groups[0].types[0].unit_alias).toBe('MIN_SEC');
  expect(judges[0].results.t1.value).toBe(7);
  expect(judges[0].results.t2.value).toBe(8);
});

test('list applies search filter', async () => {
  await service.list({ search: 'Pet' });
  expect(findAndCountAllUsersMock).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.any(Object) })
  );
});
