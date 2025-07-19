import { jest, expect, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  NormativeResult: { findAndCountAll: findAndCountAllMock },
  NormativeType: {},
  NormativeTypeZone: {},
  NormativeGroupType: {},
  NormativeGroup: {},
  NormativeZone: {},
  CampStadium: {},
  Training: {},
  Season: {},
  User: {},
  MeasurementUnit: {},
}));

const determineZoneMock = jest.fn((type) => type.NormativeTypeZones[0]);

jest.unstable_mockModule('../src/services/normativeTypeService.js', () => ({
  __esModule: true,
  determineZone: determineZoneMock,
  parseResultValue: jest.fn((v) => v),
}));

const { default: service } = await import('../src/services/normativeResultService.js');

const dataRow = {
  setDataValue(key, val) {
    this[key] = val;
  },
  id: 'r1',
  user_id: 'u1',
  season_id: 's1',
  value: 7,
  NormativeType: {
    NormativeTypeZones: [
      { min_value: 5, max_value: 9, NormativeZone: { alias: 'YELLOW' } },
    ],
    NormativeGroupTypes: [{ NormativeGroup: { id: 'g1', name: 'G1' } }],
  },
};

findAndCountAllMock.mockResolvedValue({ rows: [dataRow], count: 1 });

test('listAll filters by user and maps zone and group', async () => {
  const { rows, count } = await service.listAll({ user_id: 'u1' });
  expect(count).toBe(1);
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { user_id: 'u1' },
      include: expect.any(Array),
    })
  );
  expect(determineZoneMock).toHaveBeenCalled();
  expect(rows[0].zone.alias).toBe('YELLOW');
  expect(rows[0].group.name).toBe('G1');
});
