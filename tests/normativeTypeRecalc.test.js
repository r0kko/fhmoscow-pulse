import { jest, expect, test } from '@jest/globals';

const findByPkMock = jest.fn();
const findAllResultsMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  NormativeType: { findByPk: findByPkMock },
  NormativeTypeZone: {},
  NormativeGroupType: {},
  MeasurementUnit: {},
  NormativeValueType: {},
  NormativeZone: {},
  NormativeGroup: {},
  Season: {},
  NormativeResult: { findAll: findAllResultsMock },
  User: {},
}));

const { recalcResults } =
  await import('../src/services/normativeTypeService.js');

test('recalcResults updates zones using user sex', async () => {
  const updateMock1 = jest.fn();
  const updateMock2 = jest.fn();
  findByPkMock.mockResolvedValue({
    id: 't1',
    MeasurementUnit: {},
    NormativeTypeZones: [
      { zone_id: 'green', sex_id: 'm', min_value: 5, max_value: null },
      { zone_id: 'yellow', sex_id: 'm', min_value: 0, max_value: 4 },
      { zone_id: 'green', sex_id: 'f', min_value: 6, max_value: null },
      { zone_id: 'yellow', sex_id: 'f', min_value: 0, max_value: 5 },
    ],
  });
  findAllResultsMock.mockResolvedValue([
    { value: 5, User: { sex_id: 'm' }, update: updateMock1 },
    { value: 5, User: { sex_id: 'f' }, update: updateMock2 },
  ]);
  await recalcResults('t1');
  expect(updateMock1).toHaveBeenCalledWith(
    { zone_id: 'green' },
    { returning: false }
  );
  expect(updateMock2).toHaveBeenCalledWith(
    { zone_id: 'yellow' },
    { returning: false }
  );
});
