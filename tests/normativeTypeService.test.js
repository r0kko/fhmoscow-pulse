import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const zoneFindAllMock = jest.fn();
const typeFindByPkMock = jest.fn();
const resultFindAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  NormativeZone: { findAll: zoneFindAllMock },
  NormativeType: { findByPk: typeFindByPkMock },
  NormativeResult: { findAll: resultFindAllMock },
  User: {},
  MeasurementUnit: {},
  NormativeTypeZone: {},
  NormativeGroupType: {},
  NormativeValueType: {},
  NormativeGroup: {},
  Season: {},
}));

const {
  parseValue,
  parseResultValue,
  stepForUnit,
  determineZone,
  buildZones,
  recalcResults,
} = await import('../src/services/normativeTypeService.js');

beforeEach(() => {
  zoneFindAllMock.mockReset();
  typeFindByPkMock.mockReset();
  resultFindAllMock.mockReset();
});

describe('normativeTypeService helpers', () => {
  test('parseValue parses MIN_SEC', () => {
    const unit = { alias: 'MIN_SEC', fractional: false };
    expect(parseValue('03:45', unit)).toBe(225);
  });

  test('parseValue parses MIN_SEC without colon', () => {
    const unit = { alias: 'MIN_SEC', fractional: false };
    expect(parseValue('0345', unit)).toBe(225);
    expect(parseValue('345', unit)).toBe(225);
  });

  test('parseValue parses numeric with rounding', () => {
    const unit = { alias: 'REPS', fractional: false };
    expect(parseValue('12.7', unit)).toBe(13);
  });

  test('stepForUnit returns fractional step', () => {
    expect(stepForUnit({ alias: 'SECONDS', fractional: true })).toBe(0.01);
  });

  test('stepForUnit defaults to 1', () => {
    expect(stepForUnit({ alias: 'METERS', fractional: false })).toBe(1);
  });

  test('determineZone finds correct zone', () => {
    const type = {
      NormativeTypeZones: [
        { min_value: 10, max_value: null, NormativeZone: { alias: 'GREEN' } },
        { min_value: 5, max_value: 9, NormativeZone: { alias: 'YELLOW' } },
        { min_value: null, max_value: 4, NormativeZone: { alias: 'RED' } },
      ],
    };
    const zone = determineZone(type, 7);
    expect(zone.NormativeZone.alias).toBe('YELLOW');
  });

  test('parseResultValue rounds seconds', () => {
    const unit = { alias: 'SECONDS', fractional: true };
    expect(parseResultValue('12.345', unit)).toBe(12.35);
  });

  test('parseResultValue parses MIN_SEC', () => {
    const unit = { alias: 'MIN_SEC', fractional: false };
    expect(parseResultValue('02:05', unit)).toBe(125);
  });

  test('parseResultValue parses MIN_SEC without colon', () => {
    const unit = { alias: 'MIN_SEC', fractional: false };
    expect(parseResultValue('0205', unit)).toBe(125);
    expect(parseResultValue('205', unit)).toBe(125);
  });
});

describe('buildZones', () => {
  test('constructs zones for MORE_BETTER', async () => {
    zoneFindAllMock.mockResolvedValueOnce([
      { id: 1, alias: 'GREEN' },
      { id: 2, alias: 'YELLOW' },
      { id: 3, alias: 'RED' },
    ]);
    const res = await buildZones({
      zones: [
        { zone_id: 1, sex_id: 1, min_value: '10' },
        { zone_id: 2, sex_id: 1, min_value: '5' },
      ],
      unit: { alias: 'REPS', fractional: false },
      valueType: { alias: 'MORE_BETTER' },
      seasonId: 1,
      typeId: 2,
      actorId: 3,
    });
    expect(res).toHaveLength(3);
    expect(res[0]).toMatchObject({
      zone_id: 1,
      min_value: 10,
    });
    expect(res[1]).toMatchObject({ zone_id: 2, min_value: 5, max_value: 9 });
    expect(res[2]).toMatchObject({ zone_id: 3, max_value: 4 });
  });

  test('constructs zones for LESS_BETTER', async () => {
    zoneFindAllMock.mockResolvedValueOnce([
      { id: 1, alias: 'GREEN' },
      { id: 2, alias: 'YELLOW' },
      { id: 3, alias: 'RED' },
    ]);
    const res = await buildZones({
      zones: [
        { zone_id: 1, sex_id: 2, max_value: '10' },
        { zone_id: 2, sex_id: 2, max_value: '15' },
      ],
      unit: { alias: 'SECONDS', fractional: false },
      valueType: { alias: 'LESS_BETTER' },
      seasonId: 1,
      typeId: 2,
      actorId: 3,
    });
    expect(res).toHaveLength(3);
    expect(res[0]).toMatchObject({ zone_id: 1, max_value: 10 });
    expect(res[1]).toMatchObject({ zone_id: 2, min_value: 11, max_value: 15 });
    expect(res[2]).toMatchObject({ zone_id: 3, min_value: 16 });
  });
});

describe('recalcResults', () => {
  test('updates results with new zones', async () => {
    typeFindByPkMock.mockResolvedValue({
      NormativeTypeZones: [{ min_value: 0, max_value: 10, zone_id: 1, sex_id: null }],
    });
    const update1 = jest.fn();
    const update2 = jest.fn();
    resultFindAllMock.mockResolvedValue([
      { value: 5, User: {}, update: update1 },
      { value: 20, User: {}, update: update2 },
    ]);
    await recalcResults(1);
    expect(update1).toHaveBeenCalledWith({ zone_id: 1 }, { returning: false });
    expect(update2).toHaveBeenCalledWith({ zone_id: null }, { returning: false });
  });

  test('returns when type not found', async () => {
    typeFindByPkMock.mockResolvedValue(null);
    await recalcResults(1);
    expect(resultFindAllMock).not.toHaveBeenCalled();
  });
});

