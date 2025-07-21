import { jest, expect, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const createResultMock = jest.fn();
const findTypeMock = jest.fn();
const findSeasonMock = jest.fn();
const findUserMock = jest.fn();
const findRegMock = jest.fn();
const createRegMock = jest.fn();
const findRoleMock = jest.fn();
const findResultByPkMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  NormativeResult: {
    findAndCountAll: findAndCountAllMock,
    create: createResultMock,
    findByPk: findResultByPkMock,
  },
  NormativeType: { findByPk: findTypeMock },
  NormativeTypeZone: {},
  NormativeGroupType: {},
  NormativeGroup: {},
  NormativeZone: {},
  CampStadium: {},
  Training: {},
  Season: { findByPk: findSeasonMock },
  User: { findByPk: findUserMock },
  MeasurementUnit: {},
  TrainingRegistration: {
    findOne: findRegMock,
    create: createRegMock,
  },
  TrainingRole: { findOne: findRoleMock },
}));

const determineZoneMock = jest.fn();
jest.unstable_mockModule('../src/services/normativeTypeService.js', () => ({
  __esModule: true,
  parseResultValue: jest.fn((v) => v),
  determineZone: determineZoneMock,
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
  NormativeZone: { alias: 'YELLOW' },
  NormativeType: {
    NormativeGroupTypes: [{ NormativeGroup: { id: 'g1', name: 'G1' } }],
  },
};

findAndCountAllMock.mockResolvedValue({ rows: [dataRow], count: 1 });
createResultMock.mockResolvedValue({ id: 'nr1' });
findResultByPkMock.mockResolvedValue({ id: 'nr1' });
findTypeMock.mockResolvedValue({
  id: 't1',
  unit_id: 'u1',
  value_type_id: 'vt1',
  season_id: 's1',
  MeasurementUnit: {},
  NormativeTypeZone: [],
});
findSeasonMock.mockResolvedValue({ id: 's1' });
findUserMock.mockResolvedValue({ id: 'u1' });
findRegMock.mockResolvedValue(null);
createRegMock.mockResolvedValue({});
findRoleMock.mockResolvedValue({ id: 'role1' });

test('listAll filters by user and maps zone and group', async () => {
  const { rows, count } = await service.listAll({ user_id: 'u1' });
  expect(count).toBe(1);
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { user_id: 'u1' },
      include: expect.any(Array),
    })
  );
  expect(rows[0].zone.alias).toBe('YELLOW');
  expect(rows[0].group.name).toBe('G1');
});

test('create ensures registration', async () => {
  await service.create({
    user_id: 'u1',
    season_id: 's1',
    training_id: 'tr1',
    type_id: 't1',
    value: 5,
  });
  expect(findRegMock).toHaveBeenCalledWith({
    where: { training_id: 'tr1', user_id: 'u1' },
    paranoid: false,
  });
  expect(createRegMock).toHaveBeenCalledWith(
    expect.objectContaining({ training_id: 'tr1', user_id: 'u1', present: true })
  );
  expect(createResultMock).toHaveBeenCalled();
});
