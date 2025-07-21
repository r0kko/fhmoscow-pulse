import { jest, expect, test } from '@jest/globals';

const findAllUsersMock = jest.fn();
const findAllTypesMock = jest.fn();
const findAllResultsMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findAll: findAllUsersMock },
  Role: {},
  NormativeType: { findAll: findAllTypesMock },
  NormativeGroupType: {},
  NormativeGroup: {},
  NormativeResult: { findAll: findAllResultsMock },
  NormativeZone: {},
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

const { default: service } = await import('../src/services/normativeLedgerService.js');

findAllUsersMock.mockResolvedValue([{ id: 'u1' }]);
findAllTypesMock.mockResolvedValue([
  {
    id: 't1',
    name: 'N1',
    NormativeGroupTypes: [{ NormativeGroup: { id: 'g1', name: 'G1' } }],
  },
]);
findAllResultsMock.mockResolvedValue([
  { user_id: 'u1', type_id: 't1', value: 5, NormativeZone: { alias: 'GREEN' } },
]);

test('list returns grouped data', async () => {
  const { judges, groups } = await service.list();
  expect(judges).toHaveLength(1);
  expect(groups[0].types[0].id).toBe('t1');
  expect(judges[0].results.t1.value).toBe(5);
});
